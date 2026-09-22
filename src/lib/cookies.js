import { cookies } from "next/headers.js";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Standard secure cookie options.
 * Enforces HttpOnly (XSS defense), SameSite=Lax (CSRF defense),
 * Secure in production (MitM defense), and root path scoping.
 */
export function getDefaultCookieOptions(customOptions = {}) {
  const isProduction = process.env.NODE_ENV === "production";
  const defaultMaxAge = parseInt(process.env.AUTH_SESSION_EXPIRY_SECONDS || "86400", 10) || 86400;
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: defaultMaxAge,
    ...customOptions,
  };
}

/**
 * Resolves the secret used for signing and verifying tamper-proof cookies.
 */
function getCookieSecret(overrideSecret) {
  if (overrideSecret) return overrideSecret;
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required to sign cookies in production.");
  }
  return "local-development-cookie-secret";
}

/**
 * Signs a raw string value using HMAC-SHA256.
 * Output format: <raw_value>.<base64url_hmac>
 */
export function signCookieValue(value, secret = getCookieSecret()) {
  if (typeof value !== "string") {
    throw new TypeError("Value to sign must be a string.");
  }
  const hmac = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${hmac}`;
}

/**
 * Verifies a signed cookie string using constant-time comparison (timingSafeEqual).
 * Returns original value if valid, or null if tampered/invalid.
 */
export function verifySignedCookieValue(signedValue, secret = getCookieSecret()) {
  if (typeof signedValue !== "string") return null;

  const lastDotIndex = signedValue.lastIndexOf(".");
  if (lastDotIndex === -1) return null;

  const value = signedValue.slice(0, lastDotIndex);
  const signature = signedValue.slice(lastDotIndex + 1);
  if (!value || !signature) return null;

  const expectedSignature = createHmac("sha256", secret).update(value).digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  return value;
}

/**
 * Serializes and signs a structured JSON payload with an optional expiration timestamp.
 */
export function createSignedPayload(payload, { secret, expiresInSeconds } = {}) {
  const resolvedSecret = getCookieSecret(secret);
  const exp = typeof expiresInSeconds === "number"
    ? Date.now() + expiresInSeconds * 1000
    : null;

  const envelope = {
    data: payload,
    exp,
  };

  const encodedEnvelope = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  return signCookieValue(encodedEnvelope, resolvedSecret);
}

/**
 * Verifies and unpacks a signed structured JSON payload, enforcing expiration.
 */
export function verifySignedPayload(signedToken, { secret } = {}) {
  const resolvedSecret = getCookieSecret(secret);
  const encodedEnvelope = verifySignedCookieValue(signedToken, resolvedSecret);
  if (!encodedEnvelope) return null;

  try {
    const envelope = JSON.parse(Buffer.from(encodedEnvelope, "base64url").toString("utf8"));
    if (envelope.exp && envelope.exp <= Date.now()) {
      return null; // Expired
    }
    return envelope.data;
  } catch {
    return null;
  }
}

/**
 * Read-safe cookie retrieval in Server Components, Server Actions, or Route Handlers.
 * Returns the cookie object { name, value } or null.
 */
export async function getCookie(name) {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(name);
    return cookie || null;
  } catch {
    return null;
  }
}

/**
 * Safely get the string value of a cookie or null if absent.
 */
export async function getCookieValue(name) {
  const cookie = await getCookie(name);
  return cookie?.value || null;
}

/**
 * Check if a cookie exists.
 */
export async function hasCookie(name) {
  try {
    const cookieStore = await cookies();
    return cookieStore.has(name);
  } catch {
    return false;
  }
}

/**
 * Set a cookie on the server with secure defaults.
 * Can be called in Server Actions or Route Handlers.
 */
export async function setCookie(name, value, customOptions = {}) {
  const cookieStore = await cookies();
  const options = getDefaultCookieOptions(customOptions);
  cookieStore.set(name, String(value), options);
  return options;
}

/**
 * Delete a cookie on the server.
 */
export async function deleteCookie(name, customOptions = {}) {
  const cookieStore = await cookies();
  const options = getDefaultCookieOptions({
    ...customOptions,
    maxAge: 0,
  });

  try {
    cookieStore.delete(name);
  } catch {
    // Fallback: overwrite with empty value and maxAge: 0
    cookieStore.set(name, "", options);
  }
  return options;
}

/**
 * Sets a signed, tamper-proof cookie.
 */
export async function setSignedCookie(name, payload, customOptions = {}, secret) {
  const maxAge = customOptions.maxAge ?? (parseInt(process.env.AUTH_SESSION_EXPIRY_SECONDS || "86400", 10) || 86400);
  const signedToken = createSignedPayload(payload, { secret, expiresInSeconds: maxAge });
  return setCookie(name, signedToken, { ...customOptions, maxAge });
}

/**
 * Reads and verifies a signed, tamper-proof cookie.
 */
export async function getSignedCookie(name, secret) {
  const rawValue = await getCookieValue(name);
  if (!rawValue) return null;
  return verifySignedPayload(rawValue, { secret });
}
