import test from "node:test";
import assert from "node:assert/strict";
import {
  getDocumentById,
  getDocuments,
  getPaginatedDocuments,
} from "../src/lib/documents.js";
import {
  completeUploadSchema,
  createShareLinkSchema,
  documentQuerySchema,
  errorResponse,
  parseRequestBody,
  presignUploadSchema,
  successResponse,
} from "../src/lib/api-validation.js";
import fs from "node:fs";
import path from "node:path";

test("API payload validation (LU-2.27)", async (t) => {
  await t.test("accepts valid upload and pagination payloads", () => {
    assert.equal(
      presignUploadSchema.safeParse({
        fileName: "aadhaar.pdf",
        contentType: "application/pdf",
        fileSize: 10 * 1024 * 1024,
      }).success,
      true
    );
    assert.deepEqual(documentQuerySchema.parse({ limit: "25" }), { limit: 25 });
    assert.deepEqual(documentQuerySchema.parse({ page: "2", pageSize: "8" }), {
      page: 2,
      pageSize: 8,
    });
  });

  await t.test("rejects unsafe upload payloads and unknown fields", () => {
    assert.equal(
      presignUploadSchema.safeParse({
        fileName: "aadhaar.pdf",
        contentType: "application/pdf",
        fileSize: 10 * 1024 * 1024 + 1,
      }).success,
      false
    );
    assert.equal(
      completeUploadSchema.safeParse({
        objectKey: "uploads/aadhaar.pdf",
        fileName: "aadhaar.pdf",
        contentType: "application/pdf",
        fileSize: 100,
        unexpected: true,
      }).success,
      false
    );
  });

  await t.test("enforces documented share link options", () => {
    assert.equal(
      createShareLinkSchema.safeParse({
        expiresInMinutes: 60,
        pin: "1234",
        maxViews: 3,
      }).success,
      true
    );
    assert.equal(
      createShareLinkSchema.safeParse({ expiresInMinutes: 15, pin: "12" }).success,
      false
    );
  });

  await t.test("returns a 400 response for malformed JSON", async () => {
    const result = await parseRequestBody(
      { json: async () => { throw new SyntaxError("bad JSON"); } },
      presignUploadSchema
    );

    assert.equal(result.success, false);
    assert.equal(result.response.status, 400);
    assert.deepEqual(await result.response.json(), {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid JSON payload",
      },
    });
  });

  await t.test("uses a consistent response envelope and HTTP status", async () => {
    const success = successResponse({ documents: [] });
    assert.equal(success.status, 200);
    assert.deepEqual(await success.json(), {
      success: true,
      data: { documents: [] },
    });

    const error = errorResponse({
      code: "VALIDATION_ERROR",
      message: "Invalid request data",
      status: 400,
      details: { title: ["Required"] },
    });
    assert.equal(error.status, 400);
    assert.deepEqual(await error.json(), {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: { title: ["Required"] },
      },
    });
  });
});

test("Document Metadata & Revalidation Strategy (LU-2.23)", async (t) => {
  const pageContent = fs.readFileSync(
    path.resolve("src/app/(vault)/documents/[id]/page.js"),
    "utf-8"
  );
  const rootLayoutContent = fs.readFileSync(
    path.resolve("src/app/layout.js"),
    "utf-8"
  );
  const homePageContent = fs.readFileSync(
    path.resolve("src/app/page.js"),
    "utf-8"
  );

  await t.test("root layout configures global metadata with title template and Open Graph defaults", () => {
    assert.match(
      rootLayoutContent,
      /title:\s*\{[\s\S]*default:[\s\S]*template:[\s\S]*\}/,
      "root layout should define default title and template"
    );
    assert.match(
      rootLayoutContent,
      /metadataBase:\s*new\s+URL\(/,
      "root layout should set metadataBase from the configured APP URL"
    );
    assert.match(
      rootLayoutContent,
      /openGraph:\s*\{[\s\S]*siteName:[\s\S]*type:\s*["']website["']/,
      "root layout should include default Open Graph metadata"
    );
  });

  await t.test("home page exposes public marketing metadata for indexable content", () => {
    assert.match(
      homePageContent,
      /export\s+const\s+metadata\s*=\s*\{/,
      "home page should export route metadata"
    );
    assert.match(
      homePageContent,
      /title:\s*["']DigiLocker["']/,
      "home page should define a useful public title"
    );
  });

  await t.test("page.js contains revalidate export configured to 300 seconds", () => {
    assert.match(
      pageContent,
      /export\s+const\s+revalidate\s*=\s*300;/,
      "revalidate should be statically exported as 300 seconds"
    );
  });

  await t.test("page.js exports generateMetadata with non-indexable robots configuration", () => {
    assert.match(
      pageContent,
      /export\s+async\s+function\s+generateMetadata/,
      "page.js should export generateMetadata function"
    );
    assert.match(
      pageContent,
      /robots:\s*\{[\s\S]*?index:\s*false[\s\S]*?follow:\s*false[\s\S]*?\}/,
      "generateMetadata should configure private robots tags"
    );
  });

  await t.test("page.js exports generateStaticParams for build-time pre-rendering", () => {
    assert.match(
      pageContent,
      /export\s+async\s+function\s+generateStaticParams/,
      "page.js should export generateStaticParams function"
    );
  });

  await t.test("getDocumentById retrieves document by ID and returns null for unknown ID", async () => {
    const doc = await getDocumentById("pan-card");
    assert.ok(doc);
    assert.strictEqual(doc.id, "pan-card");
    assert.strictEqual(doc.title, "PAN Card");
    assert.strictEqual(doc.type, "JPG");

    const missing = await getDocumentById("unknown-id-xyz");
    assert.strictEqual(missing, null);
  });

  await t.test("getDocuments returns all available vault documents", async () => {
    const docs = await getDocuments();
    assert.ok(Array.isArray(docs));
    assert.ok(docs.length >= 5);
    assert.ok(docs.some((d) => d.id === "aadhaar-card"));
    assert.ok(docs.some((d) => d.id === "identity-proof"));
    assert.ok(docs.some((d) => d.id === "degree-certificate"));
    assert.ok(docs.some((d) => d.id === "insurance-policy"));
  });

  await t.test("getPaginatedDocuments returns offset pagination metadata and slices the list", async () => {
    const page = await getPaginatedDocuments({ userId: "demo-user", page: 1, pageSize: 2 });

    assert.equal(page.meta.mode, "offset");
    assert.equal(page.meta.page, 1);
    assert.equal(page.meta.pageSize, 2);
    assert.ok(Array.isArray(page.items));
    assert.ok(page.items.length <= 2);
    assert.equal(typeof page.meta.hasMore, "boolean");
  });

  await t.test("getDocumentById returns consistent metadata structure for all documents", async () => {
    const docs = await getDocuments();
    for (const doc of docs) {
      const fetched = await getDocumentById(doc.id);
      assert.strictEqual(fetched.id, doc.id);
      assert.strictEqual(fetched.title, doc.title);
      assert.strictEqual(fetched.description, doc.description);
      assert.ok(typeof fetched.title === "string" && fetched.title.length > 0);
      assert.ok(typeof fetched.description === "string" && fetched.description.length > 0);
    }
  });
});

