import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_STORAGE_BUCKET = "local";
process.env.DATABASE_URL = "file:./prisma/dev.db";

const {
  STORAGE_PROVIDERS,
  DEFAULT_URL_EXPIRY_SECONDS,
  sanitizeStorageKey,
  formatContentDisposition,
  getStorageProvider,
  generateSignedUploadUrl,
  generateSignedDownloadUrl,
  generateGcpSignedUrl,
  generateS3SignedUrl,
  generateMockSignedUrl,
  verifyMockSignedUrl,
} = await import("../src/lib/cloud-storage.js");

const { POST: handlePresign } = await import("../src/app/api/upload/presign/route.js");
const { POST: handleComplete } = await import("../src/app/api/upload/complete/route.js");
const { GET: handleDownload, POST: handleDownloadPost } = await import(
  "../src/app/api/documents/[id]/download/route.js"
);
const { PUT: handleMockPut, GET: handleMockGet } = await import(
  "../src/app/api/upload/mock-s3/[...key]/route.js"
);
const { createDocument, getDocumentById } = await import("../src/lib/documents.js");

test("LU-2.55 Signed Cloud Storage URLs for Direct Upload and Download", async (t) => {
  await t.test("Storage Key Sanitization: sanitizes path and protects against directory traversal", () => {
    assert.strictEqual(
      sanitizeStorageKey("uploads/user-1/doc.pdf"),
      "uploads/user-1/doc.pdf"
    );
    assert.strictEqual(
      sanitizeStorageKey("uploads\\user-1\\doc.pdf"),
      "uploads/user-1/doc.pdf",
      "Must normalize backslashes to forward slashes"
    );
    assert.strictEqual(
      sanitizeStorageKey("///uploads/user-1/doc.pdf"),
      "uploads/user-1/doc.pdf",
      "Must strip leading slashes"
    );

    assert.throws(
      () => sanitizeStorageKey("../sensitive/secret.key"),
      /directory traversal detected/,
      "Must reject directory traversal attempts"
    );
    assert.throws(
      () => sanitizeStorageKey("uploads/../../etc/passwd"),
      /directory traversal detected/,
      "Must reject nested directory traversal"
    );
    assert.throws(
      () => sanitizeStorageKey(""),
      /Invalid storage object key/,
      "Must reject empty storage key"
    );
  });

  await t.test("Content-Disposition: formats compliant RFC 6266 / RFC 5987 headers", () => {
    const inlineHeader = formatContentDisposition("Aadhaar Card.pdf", "inline");
    assert.match(inlineHeader, /^inline;/);
    assert.match(inlineHeader, /filename="Aadhaar Card\.pdf"/);
    assert.match(inlineHeader, /filename\*=UTF-8''Aadhaar(%20|\+)Card\.pdf/);

    const downloadHeader = formatContentDisposition("Degree Certificate 2026.docx", "attachment");
    assert.match(downloadHeader, /^attachment;/);
    assert.match(downloadHeader, /filename="Degree Certificate 2026\.docx"/);

    const defaultInline = formatContentDisposition("passport.jpg");
    assert.match(defaultInline, /^inline;/);
  });

  await t.test("Local development defaults to the mock provider when no explicit storage provider is configured", () => {
    const previousProvider = process.env.STORAGE_PROVIDER;
    const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const previousNodeEnv = process.env.NODE_ENV;
    const previousBucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET;
    const previousAccessKey = process.env.STORAGE_ACCESS_KEY_ID;
    const previousSecret = process.env.STORAGE_SECRET_ACCESS_KEY;

    try {
      delete process.env.STORAGE_PROVIDER;
      process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
      process.env.NODE_ENV = "development";
      process.env.NEXT_PUBLIC_STORAGE_BUCKET = "digilocker-vault-dev";
      process.env.STORAGE_ACCESS_KEY_ID = "test-access-key";
      process.env.STORAGE_SECRET_ACCESS_KEY = "test-secret-key";

      const provider = getStorageProvider();
      assert.strictEqual(provider, STORAGE_PROVIDERS.MOCK, "Local dev must default to the mock storage provider");
      const uploadUrl = generateSignedUploadUrl({
        objectKey: "uploads/demo-user/dev-test.pdf",
        contentType: "application/pdf",
      });
      assert.match(uploadUrl.uploadUrl, /\/api\/upload\/mock-s3\//, "Mock upload URL must stay on the local mock storage route");
    } finally {
      if (previousProvider === undefined) {
        delete process.env.STORAGE_PROVIDER;
      } else {
        process.env.STORAGE_PROVIDER = previousProvider;
      }
      if (previousAppUrl === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
      }
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousBucket === undefined) {
        delete process.env.NEXT_PUBLIC_STORAGE_BUCKET;
      } else {
        process.env.NEXT_PUBLIC_STORAGE_BUCKET = previousBucket;
      }
      if (previousAccessKey === undefined) {
        delete process.env.STORAGE_ACCESS_KEY_ID;
      } else {
        process.env.STORAGE_ACCESS_KEY_ID = previousAccessKey;
      }
      if (previousSecret === undefined) {
        delete process.env.STORAGE_SECRET_ACCESS_KEY;
      } else {
        process.env.STORAGE_SECRET_ACCESS_KEY = previousSecret;
      }
    }
  });

  await t.test("Mock Signed URLs: generates and cryptographically verifies temporary signed URLs", () => {
    const key = "uploads/demo-user/test-file.pdf";
    const signedUrl = generateMockSignedUrl({
      method: "GET",
      objectKey: key,
      expiresInSeconds: 600,
      disposition: "attachment; filename=\"test-file.pdf\"",
    });

    assert.ok(signedUrl.includes("/api/upload/mock-s3/uploads/demo-user/test-file.pdf"));
    assert.ok(signedUrl.includes("sig="));
    assert.ok(signedUrl.includes("exp="));
    assert.ok(signedUrl.includes("method=GET"));

    // Verification
    const verification = verifyMockSignedUrl(signedUrl);
    assert.strictEqual(verification.valid, true);
    assert.strictEqual(verification.objectKey, key);
    assert.strictEqual(verification.method, "GET");

    // Tampered verification
    const tampered = signedUrl.replace("method=GET", "method=PUT");
    const tamperedCheck = verifyMockSignedUrl(tampered);
    assert.strictEqual(tamperedCheck.valid, false);

    // Expired verification
    const expiredUrl = generateMockSignedUrl({
      method: "GET",
      objectKey: key,
      expiresInSeconds: -10, // already expired
    });
    const expiredCheck = verifyMockSignedUrl(expiredUrl);
    assert.strictEqual(expiredCheck.valid, false);
    assert.match(expiredCheck.error, /expired/i);
  });

  await t.test("GCP Cloud Storage: generates V4 compliant signed upload and download URLs", () => {
    const objectKey = "uploads/demo-user/passport-scan.pdf";
    const bucket = "digilocker-gcp-vault";

    // 1. GCP Signed Upload URL (PUT)
    const gcpUpload = generateSignedUploadUrl({
      objectKey,
      contentType: "application/pdf",
      expiresInSeconds: 900,
      provider: STORAGE_PROVIDERS.GCP,
    });

    assert.strictEqual(gcpUpload.method, "PUT");
    assert.strictEqual(gcpUpload.provider, "gcp");
    assert.strictEqual(gcpUpload.expiresIn, 900);
    assert.strictEqual(gcpUpload.headers["Content-Type"], "application/pdf");
    assert.match(gcpUpload.uploadUrl, /^https:\/\/storage\.googleapis\.com\/digilocker-gcp-vault\//);
    assert.match(gcpUpload.uploadUrl, /X-Goog-Algorithm=GOOG4-/);
    assert.match(gcpUpload.uploadUrl, /X-Goog-Credential=/);
    assert.match(gcpUpload.uploadUrl, /X-Goog-Date=/);
    assert.match(gcpUpload.uploadUrl, /X-Goog-Expires=900/);
    assert.match(gcpUpload.uploadUrl, /X-Goog-Signature=/);

    // 2. GCP Signed Download URL (GET)
    const gcpDownload = generateSignedDownloadUrl({
      objectKey,
      fileName: "Passport.pdf",
      disposition: "attachment",
      contentType: "application/pdf",
      expiresInSeconds: 900,
      provider: STORAGE_PROVIDERS.GCP,
    });

    assert.strictEqual(gcpDownload.method, "GET");
    assert.strictEqual(gcpDownload.provider, "gcp");
    assert.match(gcpDownload.downloadUrl, /^https:\/\/storage\.googleapis\.com\/digilocker-gcp-vault\//);
    assert.match(gcpDownload.downloadUrl, /X-Goog-Signature=/);
    assert.match(gcpDownload.downloadUrl, /response-content-disposition=attachment/);
  });

  await t.test("S3 / MinIO Cloud Storage: generates AWS V4 compliant signed upload and download URLs", () => {
    const objectKey = "uploads/demo-user/tax-return.pdf";

    // 1. S3 Signed Upload URL (PUT)
    const s3Upload = generateSignedUploadUrl({
      objectKey,
      contentType: "application/pdf",
      expiresInSeconds: 900,
      provider: STORAGE_PROVIDERS.S3,
    });

    assert.strictEqual(s3Upload.method, "PUT");
    assert.strictEqual(s3Upload.provider, "s3");
    assert.match(s3Upload.uploadUrl, /X-Amz-Algorithm=AWS4-HMAC-SHA256/);
    assert.match(s3Upload.uploadUrl, /X-Amz-Credential=/);
    assert.match(s3Upload.uploadUrl, /X-Amz-Signature=/);
    assert.match(s3Upload.uploadUrl, /X-Amz-Expires=900/);

    // 2. S3 Signed Download URL (GET)
    const s3Download = generateSignedDownloadUrl({
      objectKey,
      fileName: "Tax-Return.pdf",
      disposition: "inline",
      provider: STORAGE_PROVIDERS.S3,
    });

    assert.strictEqual(s3Download.method, "GET");
    assert.strictEqual(s3Download.provider, "s3");
    assert.match(s3Download.downloadUrl, /X-Amz-Signature=/);
    assert.match(s3Download.downloadUrl, /response-content-disposition=inline/);
  });

  await t.test("POST /api/upload/presign: returns direct cloud storage upload URL with provider metadata", async () => {
    const req = {
      json: async () => ({
        fileName: "driving-license.pdf",
        contentType: "application/pdf",
        fileSize: Math.round(1.2 * 1024 * 1024),
      }),
      headers: new Headers({ "x-trace-id": "test-trace-upload-presign" }),
    };

    const res = await handlePresign(req);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.uploadUrl);
    assert.ok(body.data.objectKey);
    assert.match(body.data.objectKey, /^uploads\/demo-user\//);
    assert.strictEqual(body.data.expiresIn, 900);
    assert.strictEqual(body.data.method, "PUT");
    assert.ok(body.data.provider);
  });

  await t.test("GET /api/documents/[id]/download: redirects to signed download URL by default (307)", async () => {
    // 1. Create document in database
    const docId = `test-doc-dl-${Date.now()}`;
    const objectKey = `uploads/demo-user/${Date.now()}-salary-slip.pdf`;
    await createDocument({
      id: docId,
      title: "Salary Slip January",
      type: "PDF",
      fileKey: objectKey,
      mimeType: "application/pdf",
      userId: "demo-user",
    });

    // 2. Request download with redirect (default)
    const req = {
      url: `http://localhost:3000/api/documents/${docId}/download?action=download`,
      headers: new Headers(),
    };

    const res = await handleDownload(req, { params: Promise.resolve({ id: docId }) });
    assert.strictEqual(res.status, 307, "Must issue 307 Temporary Redirect");
    
    const location = res.headers.get("Location");
    assert.ok(location, "Must provide Location header");
    assert.ok(location.includes(objectKey));
    assert.strictEqual(
      res.headers.get("Cache-Control"),
      "private, no-store, max-age=0, must-revalidate",
      "Must forbid proxy and browser caching of temporary signed download URL"
    );
  });

  await t.test("GET /api/documents/[id]/download: returns JSON signed URL metadata when requested", async () => {
    const docId = `test-doc-json-${Date.now()}`;
    const objectKey = `uploads/demo-user/${Date.now()}-marksheet.pdf`;
    await createDocument({
      id: docId,
      title: "Class 12 Marksheet",
      type: "PDF",
      fileKey: objectKey,
      mimeType: "application/pdf",
      userId: "demo-user",
    });

    const req = {
      url: `http://localhost:3000/api/documents/${docId}/download?action=view&redirect=false`,
      headers: new Headers({
        Accept: "application/json",
      }),
    };

    const res = await handleDownload(req, { params: Promise.resolve({ id: docId }) });
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.downloadUrl);
    assert.strictEqual(body.data.objectKey, objectKey);
    assert.strictEqual(body.data.expiresIn, 900);
    assert.strictEqual(body.data.method, "GET");
    assert.match(body.data.disposition, /^inline/);
    assert.strictEqual(body.data.fileName, "Class 12 Marksheet.pdf");
  });

  await t.test("GET /api/documents/[id]/download: returns 404 for non-existent document", async () => {
    const req = {
      url: "http://localhost:3000/api/documents/non-existent-doc-id/download",
      headers: new Headers({ Accept: "application/json" }),
    };

    const res = await handleDownload(req, { params: Promise.resolve({ id: "non-existent-doc-id" }) });
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, "NOT_FOUND");
  });

  await t.test("End-to-End Flow: Presign upload -> direct PUT -> complete -> signed download retrieves data", async () => {
    const fileName = "pan-verification-card.pdf";
    const contentType = "application/pdf";
    const testFileBytes = Buffer.from("%PDF-1.4 Mock Encrypted DigiLocker Document Payload");

    // 1. Presign Upload
    const presignReq = {
      json: async () => ({
        fileName,
        contentType,
        fileSize: testFileBytes.length,
      }),
      headers: new Headers(),
    };
    const presignRes = await handlePresign(presignReq);
    assert.strictEqual(presignRes.status, 200);
    const { uploadUrl, objectKey } = (await presignRes.json()).data;

    // 2. Direct Cloud Upload (PUT binary to uploadUrl)
    const putUrl = new URL(uploadUrl);
    const mockPutReq = {
      url: uploadUrl,
      arrayBuffer: async () => testFileBytes.buffer.slice(testFileBytes.byteOffset, testFileBytes.byteOffset + testFileBytes.byteLength),
      headers: new Headers({ "content-type": contentType }),
    };
    const keySegments = objectKey.split("/");
    const putRes = await handleMockPut(mockPutReq, { params: Promise.resolve({ key: keySegments }) });
    assert.strictEqual(putRes.status, 200);

    // 3. Complete Upload & persist metadata
    const docId = `e2e-doc-${Date.now()}`;
    const completeReq = {
      json: async () => ({
        documentId: docId,
        objectKey,
        fileName,
        contentType,
        fileSize: testFileBytes.length,
      }),
    };
    const completeRes = await handleComplete(completeReq);
    assert.strictEqual(completeRes.status, 201);

    // 4. Request Signed Download URL
    const dlReq = {
      url: `http://localhost:3000/api/documents/${docId}/download?action=download&redirect=false`,
      headers: new Headers({ Accept: "application/json" }),
    };
    const dlRes = await handleDownload(dlReq, { params: Promise.resolve({ id: docId }) });
    assert.strictEqual(dlRes.status, 200);
    const { downloadUrl } = (await dlRes.json()).data;

    // 5. Fetch file directly using the signed download URL
    const dlUrlObj = new URL(downloadUrl);
    const mockGetReq = {
      url: downloadUrl,
    };
    const fetchFileRes = await handleMockGet(mockGetReq, { params: Promise.resolve({ key: keySegments }) });
    assert.strictEqual(fetchFileRes.status, 200);
    assert.strictEqual(fetchFileRes.headers.get("Content-Type"), contentType);
    assert.match(fetchFileRes.headers.get("Content-Disposition"), /^attachment/);

    const downloadedBytes = Buffer.from(await fetchFileRes.arrayBuffer());
    assert.strictEqual(
      downloadedBytes.toString("utf8"),
      testFileBytes.toString("utf8"),
      "Downloaded binary must be byte-for-byte identical to uploaded document"
    );
  });
});
