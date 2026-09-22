import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_STORAGE_BUCKET = "local";
process.env.DATABASE_URL = "file:./prisma/dev.db";

const {
  validateFile,
  formatFileSize,
  detectDocumentType,
  extractTitleFromFileName,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
} = await import("../src/lib/file-validation.js");

const {
  getDocumentById,
  getDocuments,
} = await import("../src/lib/documents.js");

const { POST: handlePresign } = await import("../src/app/api/upload/presign/route.js");
const { POST: handleComplete } = await import("../src/app/api/upload/complete/route.js");

test("Validated Document File Upload Flow (LU-2.46)", async (t) => {
  const uploadFormPath = path.resolve("src/components/upload-document-form.js");
  const uploadFormContent = fs.readFileSync(uploadFormPath, "utf-8");

  await t.test("UI Component Contract: upload-document-form.js implements validated upload UX", () => {
    assert.match(
      uploadFormContent,
      /^["']use client["'];?/m,
      "upload-document-form.js must be a Client Component"
    );
    assert.match(
      uploadFormContent,
      /useActionState\s*\(\s*createDocument/,
      "must integrate useActionState with createDocument Server Action"
    );
    assert.match(
      uploadFormContent,
      /aria-invalid=/,
      "must include aria-invalid accessibility attributes"
    );
    assert.match(
      uploadFormContent,
      /onDragOver/,
      "must include drag-and-drop dragOver handler"
    );
    assert.match(
      uploadFormContent,
      /onDrop/,
      "must include drag-and-drop drop handler"
    );
    assert.match(
      uploadFormContent,
      /10\s*MB/i,
      "must visibly indicate the 10 MB maximum file size limit"
    );
    assert.match(
      uploadFormContent,
      /accept=\{ALLOWED_EXTENSIONS\.join\(["'],["']\)\}/,
      "must restrict file input accept filter to supported formats"
    );
  });

  await t.test("Client-Side Validation: accepts supported files under 10 MB", () => {
    const validPdf = {
      name: "income-tax-return.pdf",
      size: 4 * 1024 * 1024,
      type: "application/pdf",
    };
    const resPdf = validateFile(validPdf);
    assert.strictEqual(resPdf.valid, true);
    assert.strictEqual(resPdf.error, null);
    assert.strictEqual(resPdf.details.detectedType, "PDF");
    assert.strictEqual(resPdf.details.formattedSize, "4 MB");

    const validDocx = {
      name: "Degree-Certificate.docx",
      size: 1.5 * 1024 * 1024,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const resDocx = validateFile(validDocx);
    assert.strictEqual(resDocx.valid, true);
    assert.strictEqual(resDocx.details.detectedType, "DOCX");

    const validJpg = {
      name: "pan_card_front.jpg",
      size: 820 * 1024,
      type: "image/jpeg",
    };
    const resJpg = validateFile(validJpg);
    assert.strictEqual(resJpg.valid, true);
    assert.strictEqual(resJpg.details.detectedType, "JPG");

    const validPng = {
      name: "voter-id.png",
      size: 1024 * 1024,
      type: "image/png",
    };
    const resPng = validateFile(validPng);
    assert.strictEqual(resPng.valid, true);
    assert.strictEqual(resPng.details.detectedType, "PNG");

    const validWebp = {
      name: "passport_photo.webp",
      size: 250 * 1024,
      type: "image/webp",
    };
    assert.strictEqual(validateFile(validWebp).valid, true);

    const validJson = {
      name: "driving_license_payload.json",
      size: 12 * 1024,
      type: "application/json",
    };
    assert.strictEqual(validateFile(validJson).valid, true);

    const validXml = {
      name: "aadhaar_offline.xml",
      size: 45 * 1024,
      type: "application/xml",
    };
    assert.strictEqual(validateFile(validXml).valid, true);
  });

  await t.test("Client-Side Validation: immediately rejects files exceeding 10 MB limit", () => {
    const oversizedFile = {
      name: "massive_scanned_archive.pdf",
      size: MAX_FILE_SIZE_BYTES + 1, // 10 MB + 1 byte
      type: "application/pdf",
    };

    const res = validateFile(oversizedFile);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(
      res.error,
      "File is larger than the 10 MB limit.",
      "Must match PRD 5.6 exact rejection message for oversized files"
    );
  });

  await t.test("Client-Side Validation: immediately rejects unsupported file formats", () => {
    const executable = {
      name: "malware.exe",
      size: 1024 * 1024,
      type: "application/x-msdownload",
    };
    const resExe = validateFile(executable);
    assert.strictEqual(resExe.valid, false);
    assert.strictEqual(
      resExe.error,
      "This file type is not supported.",
      "Must match PRD 5.6 exact rejection message for unsupported types"
    );

    const zipArchive = {
      name: "documents.zip",
      size: 2 * 1024 * 1024,
      type: "application/zip",
    };
    assert.strictEqual(validateFile(zipArchive).error, "This file type is not supported.");

    const video = {
      name: "recording.mp4",
      size: 5 * 1024 * 1024,
      type: "video/mp4",
    };
    assert.strictEqual(validateFile(video).error, "This file type is not supported.");
  });

  await t.test("Helper utilities: formatting and type detection", () => {
    assert.strictEqual(formatFileSize(0), "0 B");
    assert.strictEqual(formatFileSize(1024), "1 KB");
    assert.strictEqual(formatFileSize(1024 * 1024), "1 MB");
    assert.strictEqual(formatFileSize(2.5 * 1024 * 1024), "2.5 MB");

    assert.strictEqual(detectDocumentType("doc.pdf", ""), "PDF");
    assert.strictEqual(detectDocumentType("file.docx", ""), "DOCX");
    assert.strictEqual(detectDocumentType("photo.jpeg", ""), "JPG");
    assert.strictEqual(detectDocumentType("data.unknown", "application/json"), "JSON");

    assert.strictEqual(extractTitleFromFileName("aadhaar-card-2026.pdf"), "Aadhaar Card 2026");
    assert.strictEqual(extractTitleFromFileName("salary_slip_jan.docx"), "Salary Slip Jan");
  });

  await t.test("POST /api/upload/presign: returns temporary pre-signed URL for valid file payload", async () => {
    const validRequest = {
      json: async () => ({
        fileName: "pan-card-copy.jpg",
        contentType: "image/jpeg",
        fileSize: 850 * 1024,
      }),
    };

    const response = await handlePresign(validRequest);
    assert.strictEqual(response.status, 200);

    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.uploadUrl, "Response must include direct upload URL");
    assert.ok(body.data.objectKey, "Response must include unique objectKey");
    assert.match(body.data.objectKey, /^uploads\//, "Object key must be scoped to uploads/");
    assert.strictEqual(body.data.expiresIn, 900, "Pre-signed URL expiry must be 15 minutes (900s)");
    assert.strictEqual(body.data.method, "PUT");
  });

  await t.test("POST /api/upload/presign: rejects oversized payloads with 400", async () => {
    const oversizedRequest = {
      json: async () => ({
        fileName: "huge-document.pdf",
        contentType: "application/pdf",
        fileSize: 15 * 1024 * 1024, // 15 MB > 10 MB
      }),
    };

    const response = await handlePresign(oversizedRequest);
    assert.strictEqual(response.status, 413);

    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, "FILE_TOO_LARGE");
  });

  await t.test("POST /api/upload/presign: rejects unsupported content types with 400", async () => {
    const invalidTypeRequest = {
      json: async () => ({
        fileName: "script.sh",
        contentType: "text/x-shellscript",
        fileSize: 1024,
      }),
    };

    const response = await handlePresign(invalidTypeRequest);
    assert.strictEqual(response.status, 415);
    const body = await response.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, "INVALID_FILE_TYPE");
  });

  await t.test("POST /api/upload/complete: finalizes upload and persists document with storage metadata", async () => {
    const uniqueDocId = `uploaded-doc-${Date.now()}`;
    const objectKey = `uploads/demo-user/${Date.now()}-vehicle-registration.pdf`;
    const payload = {
      documentId: uniqueDocId,
      objectKey,
      fileName: "Vehicle-Registration-RC.pdf",
      contentType: "application/pdf",
      fileSize: 2411725,
    };
    const completeRequest = {
      json: async () => payload,
    };

    const response = await handleComplete(completeRequest);
    assert.strictEqual(response.status, 201);

    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.document);
    assert.strictEqual(body.data.document.type, "PDF");
    assert.strictEqual(body.data.document.fileKey, objectKey);

    // Verify document can be retrieved from vault
    const retrieved = await getDocumentById(uniqueDocId);
    assert.ok(retrieved, "Persisted document must be fetchable via getDocumentById");
    assert.strictEqual(retrieved.id, uniqueDocId);
    assert.strictEqual(retrieved.type, "PDF");
    assert.strictEqual(retrieved.fileKey, objectKey);
  });

  await t.test("POST /api/upload/complete: rejects missing required fields with 400", async () => {
    const invalidRequest = {
      json: async () => ({
        fileName: "missing-key.pdf",
      }),
    };

    const response = await handleComplete(invalidRequest);
    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.success, false);
  });
});
