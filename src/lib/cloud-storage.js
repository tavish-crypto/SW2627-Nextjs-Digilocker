import crypto from "node:crypto";
import { logger } from "./logger.js";

/**
 * Supported Cloud Storage Providers
 */
export const STORAGE_PROVIDERS = {
  GCP: "gcp",
  S3: "s3",
  DATABASE: "database",
  MOCK: "mock",
};

/**
 * Default URL expiration: 15 minutes (900 seconds) per PRD Section 5.5
 */
export const DEFAULT_URL_EXPIRY_SECONDS = 900;

/**
 * Normalizes and sanitizes an object key to prevent directory traversal
 * and ensure clean path structure within the bucket.
 */
export function sanitizeStorageKey(key) {
  if (!key || typeof key !== "string") {
    throw new Error("Invalid storage object key: must be a non-empty string");
  }

  // Replace backslashes with forward slashes
  let sanitized = key.replace(/\\/g, "/");

  // Remove leading slashes
  sanitized = sanitized.replace(/^\/+/, "");

  // Prevent path traversal
  const segments = sanitized.split("/").filter(Boolean);
  if (segments.some((seg) => seg === ".." || seg === ".")) {
    throw new Error("Invalid storage object key: directory traversal detected");
  }

  return segments.join("/");
}

/**
 * Formats RFC 6266 / RFC 5987 Content-Disposition header value
 */
export function formatContentDisposition(fileName, disposition = "inline") {
  const type = disposition === "attachment" ? "attachment" : "inline";
  if (!fileName) {
    return type;
  }

  // Clean ASCII fallback name (strip quotes and control characters)
  const asciiName = fileName
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\r\n\\]/g, "");

  // RFC 5987 UTF-8 encoded filename
  const encodedName = encodeURIComponent(fileName)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");

  return `${type}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

/**
 * Resolves the active Cloud Storage provider based on configuration.
 */
export function getStorageProvider() {
  const explicitProvider = process.env.STORAGE_PROVIDER?.toLowerCase()?.trim();
  if (explicitProvider && Object.values(STORAGE_PROVIDERS).includes(explicitProvider)) {
    return explicitProvider;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const isLocalDevelopment =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_APP_ENV === "development" ||
    appUrl.includes("localhost") ||
    appUrl.includes("127.0.0.1");

  // Local development should always default to the mock provider unless the app
  // explicitly opts into a real cloud backend via STORAGE_PROVIDER.
  if (isLocalDevelopment) {
    return STORAGE_PROVIDERS.MOCK;
  }

  const bucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || "";

  // Auto-detect GCP
  const hasGcp = Boolean(
    process.env.GCP_PROJECT_ID ||
    process.env.GCP_CLIENT_EMAIL ||
    process.env.GCP_PRIVATE_KEY ||
    process.env.GCP_STORAGE_BUCKET
  );
  if (hasGcp) {
    return STORAGE_PROVIDERS.GCP;
  }

  // Auto-detect S3 (when credentials exist and bucket is not "local")
  const hasS3 = Boolean(
    process.env.STORAGE_ACCESS_KEY_ID &&
    process.env.STORAGE_SECRET_ACCESS_KEY &&
    bucket !== "local"
  );
  if (hasS3) {
    return STORAGE_PROVIDERS.S3;
  }

  // Production-safe zero-config fallback: persist file chunks in PostgreSQL.
  // This keeps uploads functional on Vercel when DATABASE_URL is configured
  // but no external object-storage credentials have been supplied yet.
  if (process.env.DATABASE_URL) {
    return STORAGE_PROVIDERS.DATABASE;
  }

  return STORAGE_PROVIDERS.MOCK;
}

/**
 * Resolves bucket name for the active provider
 */
export function getStorageBucket(provider = getStorageProvider()) {
  if (provider === STORAGE_PROVIDERS.GCP) {
    if (process.env.GCP_STORAGE_BUCKET) {
      return process.env.GCP_STORAGE_BUCKET;
    }
    const publicBucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET;
    if (publicBucket && publicBucket !== "local") {
      return publicBucket;
    }
    return "digilocker-gcp-vault";
  }
  return process.env.NEXT_PUBLIC_STORAGE_BUCKET || "digilocker-vault";
}

/**
 * Generates HMAC signature string in hex format
 */
function hmacHex(key, message) {
  return crypto.createHmac("sha256", key).update(message, "utf8").digest("hex");
}

/**
 * Generates SHA256 hash in hex format
 */
function sha256Hex(message) {
  return crypto.createHash("sha256").update(message, "utf8").digest("hex");
}

/**
 * Formats ISO 8601 timestamps for V4 signing
 */
function getSigningTimestamps(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = iso.slice(0, 8); // YYYYMMDD
  const timestamp = iso; // YYYYMMDDTHHMMSSZ
  return { dateStamp, timestamp };
}

/**
 * Generates a Google Cloud Storage V4 Signed URL
 * 
 * Supports both Service Account Private Keys (RSA-SHA256) and HMAC keys.
 */
export function generateGcpSignedUrl({
  method,
  objectKey,
  bucket,
  contentType,
  disposition,
  expiresInSeconds = DEFAULT_URL_EXPIRY_SECONDS,
  now = new Date(),
}) {
  const clientEmail =
    process.env.GCP_CLIENT_EMAIL ||
    process.env.STORAGE_ACCESS_KEY_ID ||
    "digilocker-storage@project.iam.gserviceaccount.com";
  const privateKey = (process.env.GCP_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const hmacSecret = process.env.STORAGE_SECRET_ACCESS_KEY || "";

  const { dateStamp, timestamp } = getSigningTimestamps(now);
  const host = "storage.googleapis.com";
  const canonicalUri = `/${bucket}/${sanitizeStorageKey(objectKey)}`;
  const credentialScope = `${dateStamp}/auto/storage/goog4_request`;
  const algorithm = privateKey ? "GOOG4-RSA-SHA256" : "GOOG4-HMAC-SHA256";

  // Build canonical query parameters
  const queryParams = [
    ["X-Goog-Algorithm", algorithm],
    ["X-Goog-Credential", `${clientEmail}/${credentialScope}`],
    ["X-Goog-Date", timestamp],
    ["X-Goog-Expires", String(expiresInSeconds)],
  ];

  const headersToSign = [["host", host]];
  if (method === "PUT" && contentType) {
    headersToSign.push(["content-type", contentType.toLowerCase()]);
  }

  headersToSign.sort((a, b) => a[0].localeCompare(b[0]));
  const signedHeaders = headersToSign.map(([k]) => k).join(";");
  queryParams.push(["X-Goog-SignedHeaders", signedHeaders]);

  if (disposition) {
    queryParams.push(["response-content-disposition", disposition]);
  }
  if (contentType && method === "GET") {
    queryParams.push(["response-content-type", contentType]);
  }

  queryParams.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalQueryString = queryParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalHeaders = headersToSign
    .map(([k, v]) => `${k}:${v.trim()}\n`)
    .join("");

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  let signature = "";
  if (privateKey) {
    try {
      const signer = crypto.createSign("RSA-SHA256");
      signer.update(stringToSign, "utf8");
      signature = signer.sign(privateKey, "hex");
    } catch {
      // Fallback to HMAC if private key parsing fails in test/mock environment
      signature = hmacHex(hmacSecret || "fallback-secret", stringToSign);
    }
  } else {
    signature = hmacHex(hmacSecret || "fallback-secret", stringToSign);
  }

  const endpoint = process.env.NEXT_PUBLIC_STORAGE_ENDPOINT || `https://${host}`;
  return `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Goog-Signature=${signature}`;
}

/**
 * Generates an AWS S3 / MinIO V4 Pre-Signed URL
 */
export function generateS3SignedUrl({
  method,
  objectKey,
  bucket,
  contentType,
  disposition,
  expiresInSeconds = DEFAULT_URL_EXPIRY_SECONDS,
  now = new Date(),
}) {
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID || "minioadmin";
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY || "minioadmin";
  const region = process.env.NEXT_PUBLIC_STORAGE_REGION || "us-east-1";
  const rawEndpoint = process.env.NEXT_PUBLIC_STORAGE_ENDPOINT || "";

  const { dateStamp, timestamp } = getSigningTimestamps(now);
  const isCustomEndpoint = Boolean(rawEndpoint);
  const host = isCustomEndpoint
    ? new URL(rawEndpoint).host
    : `${bucket}.s3.${region}.amazonaws.com`;
  
  const canonicalUri = isCustomEndpoint
    ? `/${bucket}/${sanitizeStorageKey(objectKey)}`
    : `/${sanitizeStorageKey(objectKey)}`;
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const algorithm = "AWS4-HMAC-SHA256";

  const queryParams = [
    ["X-Amz-Algorithm", algorithm],
    ["X-Amz-Credential", `${accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", timestamp],
    ["X-Amz-Expires", String(expiresInSeconds)],
  ];

  const headersToSign = [["host", host]];
  if (method === "PUT" && contentType) {
    headersToSign.push(["content-type", contentType.toLowerCase()]);
  }

  headersToSign.sort((a, b) => a[0].localeCompare(b[0]));
  const signedHeaders = headersToSign.map(([k]) => k).join(";");
  queryParams.push(["X-Amz-SignedHeaders", signedHeaders]);

  if (disposition) {
    queryParams.push(["response-content-disposition", disposition]);
  }

  queryParams.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalQueryString = queryParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const canonicalHeaders = headersToSign
    .map(([k, v]) => `${k}:${v.trim()}\n`)
    .join("");

  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  // Derive AWS V4 signing key
  const kDate = crypto.createHmac("sha256", `AWS4${secretAccessKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac("sha256", kDate).update(region).digest();
  const kService = crypto.createHmac("sha256", kRegion).update("s3").digest();
  const kSigning = crypto.createHmac("sha256", kService).update("aws4_request").digest();
  const signature = hmacHex(kSigning, stringToSign);

  const baseUrl = isCustomEndpoint ? rawEndpoint.replace(/\/+$/, "") : `https://${host}`;
  return `${baseUrl}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

/**
 * Generates a Local / Mock Signed URL for development and testing
 */
export function generateMockSignedUrl({
  method,
  objectKey,
  contentType,
  disposition,
  expiresInSeconds = DEFAULT_URL_EXPIRY_SECONDS,
  now = new Date(),
}) {
  const secret = process.env.AUTH_SECRET || "digilocker-mock-signing-secret";
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
  const sanitizedKey = sanitizeStorageKey(objectKey);
  const expiresAt = Math.floor(now.getTime() / 1000) + expiresInSeconds;

  const payloadToSign = `${method.toUpperCase()}:${sanitizedKey}:${expiresAt}:${disposition || ""}:${contentType || ""}`;
  const signature = crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex");

  const params = new URLSearchParams({
    sig: signature,
    exp: String(expiresAt),
    method: method.toUpperCase(),
  });

  if (disposition) {
    params.set("disposition", disposition);
  }
  if (contentType) {
    params.set("contentType", contentType);
  }

  return `${appUrl}/api/upload/mock-s3/${sanitizedKey}?${params.toString()}`;
}

/**
 * Validates a mock storage signed URL
 */
export function verifyMockSignedUrl(urlStr, secret = process.env.AUTH_SECRET || "digilocker-mock-signing-secret") {
  try {
    const parsed = new URL(urlStr, "http://localhost");
    const sig = parsed.searchParams.get("sig");
    const exp = parseInt(parsed.searchParams.get("exp"), 10);
    const method = parsed.searchParams.get("method") || "GET";
    const disposition = parsed.searchParams.get("disposition") || "";
    const contentType = parsed.searchParams.get("contentType") || "";

    if (!sig || !exp || isNaN(exp)) {
      return { valid: false, error: "Missing signature or expiration parameters" };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > exp) {
      return { valid: false, error: "Signed URL has expired" };
    }

    const match = parsed.pathname.match(/\/api\/upload\/mock-s3\/(.+)$/);
    if (!match) {
      return { valid: false, error: "Invalid mock storage URL path" };
    }

    const objectKey = match[1];
    const payloadToSign = `${method.toUpperCase()}:${objectKey}:${exp}:${disposition}:${contentType}`;
    const expectedSig = crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex");

    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true, objectKey, method, disposition, contentType };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}


/**
 * Generates an application-local signed URL backed by PostgreSQL chunk storage.
 * The URL is still temporary/signed, but the bytes are stored in Supabase/Postgres
 * instead of the Vercel filesystem.
 */
export function generateDatabaseSignedUrl({
  method,
  objectKey,
  contentType,
  disposition,
  expiresInSeconds = DEFAULT_URL_EXPIRY_SECONDS,
  now = new Date(),
}) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required for signed database-storage URLs.");
  }

  const sanitizedKey = sanitizeStorageKey(objectKey);
  const expiresAt = Math.floor(now.getTime() / 1000) + expiresInSeconds;
  const payloadToSign = `${method.toUpperCase()}:${sanitizedKey}:${expiresAt}:${disposition || ""}:${contentType || ""}`;
  const signature = crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex");

  const params = new URLSearchParams({
    sig: signature,
    exp: String(expiresAt),
    method: method.toUpperCase(),
  });
  if (disposition) params.set("disposition", disposition);
  if (contentType) params.set("contentType", contentType);

  return `/api/upload/database/${sanitizedKey}?${params.toString()}`;
}

/** Validate an application-local signed database-storage URL. */
export function verifyDatabaseSignedUrl(
  urlStr,
  secret = process.env.AUTH_SECRET
) {
  try {
    if (!secret) return { valid: false, error: "AUTH_SECRET is not configured" };
    const parsed = new URL(urlStr, "http://localhost");
    const sig = parsed.searchParams.get("sig");
    const exp = Number.parseInt(parsed.searchParams.get("exp") || "", 10);
    const method = (parsed.searchParams.get("method") || "GET").toUpperCase();
    const disposition = parsed.searchParams.get("disposition") || "";
    const contentType = parsed.searchParams.get("contentType") || "";

    if (!sig || !Number.isFinite(exp)) {
      return { valid: false, error: "Missing signature or expiration parameters" };
    }
    if (Math.floor(Date.now() / 1000) > exp) {
      return { valid: false, error: "Signed URL has expired" };
    }

    const match = parsed.pathname.match(/\/api\/upload\/database\/(.+)$/);
    if (!match) return { valid: false, error: "Invalid database storage URL path" };
    const objectKey = sanitizeStorageKey(decodeURIComponent(match[1]));
    const payloadToSign = `${method}:${objectKey}:${exp}:${disposition}:${contentType}`;
    const expectedSig = crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex");

    if (!/^[0-9a-f]{64}$/i.test(sig)) {
      return { valid: false, error: "Invalid signature" };
    }
    const supplied = Buffer.from(sig, "hex");
    const expected = Buffer.from(expectedSig, "hex");
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true, objectKey, method, disposition, contentType };
  } catch (error) {
    return { valid: false, error: error?.message || "Invalid signed URL" };
  }
}

/**
 * Generates a signed Cloud Storage URL for DIRECT UPLOAD (HTTP PUT).
 * 
 * Complies with DigiLocker PRD Section 5.5:
 * - Temporary pre-signed URL with 15-minute default validity
 * - Returns uploadUrl, objectKey, expiresIn, and headers
 */
export function generateSignedUploadUrl({
  objectKey,
  contentType = "application/octet-stream",
  expiresInSeconds = DEFAULT_URL_EXPIRY_SECONDS,
  provider = getStorageProvider(),
}) {
  const sanitizedKey = sanitizeStorageKey(objectKey);
  const bucket = getStorageBucket(provider);
  let uploadUrl = "";

  switch (provider) {
    case STORAGE_PROVIDERS.GCP:
      uploadUrl = generateGcpSignedUrl({
        method: "PUT",
        objectKey: sanitizedKey,
        bucket,
        contentType,
        expiresInSeconds,
      });
      break;

    case STORAGE_PROVIDERS.S3:
      uploadUrl = generateS3SignedUrl({
        method: "PUT",
        objectKey: sanitizedKey,
        bucket,
        contentType,
        expiresInSeconds,
      });
      break;

    case STORAGE_PROVIDERS.DATABASE:
      uploadUrl = generateDatabaseSignedUrl({
        method: "PUT",
        objectKey: sanitizedKey,
        contentType,
        expiresInSeconds,
      });
      break;

    case STORAGE_PROVIDERS.MOCK:
    default:
      uploadUrl = generateMockSignedUrl({
        method: "PUT",
        objectKey: sanitizedKey,
        contentType,
        expiresInSeconds,
      });
      break;
  }

  logger.debug(
    { action: "storage.upload_url_generated", provider, objectKey: sanitizedKey, expiresInSeconds },
    "Generated signed upload URL"
  );

  return {
    uploadUrl,
    objectKey: sanitizedKey,
    expiresIn: expiresInSeconds,
    method: "PUT",
    provider,
    headers: {
      "Content-Type": contentType,
    },
  };
}

/**
 * Generates a signed Cloud Storage URL for DIRECT DOWNLOAD or INLINE VIEWING (HTTP GET).
 * 
 * Supports:
 * - `disposition = "inline"` for browser preview
 * - `disposition = "attachment"` for forced file download
 * - Sanitized RFC 6266 Content-Disposition with UTF-8 support
 */
export function generateSignedDownloadUrl({
  objectKey,
  fileName,
  disposition = "inline",
  expiresInSeconds = DEFAULT_URL_EXPIRY_SECONDS,
  contentType,
  provider = getStorageProvider(),
}) {
  const sanitizedKey = sanitizeStorageKey(objectKey);
  const bucket = getStorageBucket(provider);
  const formattedDisposition = formatContentDisposition(fileName, disposition);
  let downloadUrl = "";

  switch (provider) {
    case STORAGE_PROVIDERS.GCP:
      downloadUrl = generateGcpSignedUrl({
        method: "GET",
        objectKey: sanitizedKey,
        bucket,
        contentType,
        disposition: formattedDisposition,
        expiresInSeconds,
      });
      break;

    case STORAGE_PROVIDERS.S3:
      downloadUrl = generateS3SignedUrl({
        method: "GET",
        objectKey: sanitizedKey,
        bucket,
        contentType,
        disposition: formattedDisposition,
        expiresInSeconds,
      });
      break;

    case STORAGE_PROVIDERS.DATABASE:
      downloadUrl = generateDatabaseSignedUrl({
        method: "GET",
        objectKey: sanitizedKey,
        contentType,
        disposition: formattedDisposition,
        expiresInSeconds,
      });
      break;

    case STORAGE_PROVIDERS.MOCK:
    default:
      downloadUrl = generateMockSignedUrl({
        method: "GET",
        objectKey: sanitizedKey,
        contentType,
        disposition: formattedDisposition,
        expiresInSeconds,
      });
      break;
  }

  logger.debug(
    { action: "storage.download_url_generated", provider, objectKey: sanitizedKey, disposition },
    "Generated signed download URL"
  );

  return {
    downloadUrl,
    objectKey: sanitizedKey,
    expiresIn: expiresInSeconds,
    method: "GET",
    provider,
    disposition: formattedDisposition,
  };
}
