import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_STORAGE_BUCKET = "local";

const {
  createDocument,
  updateDocument,
  deleteDocument,
  createShareLink,
  revokeShareLink,
} = await import("../src/app/(vault)/documents/actions.js");

const {
  getDocumentById,
  getDocuments,
  getDocumentActivity,
  getDocumentShareLinks,
} = await import("../src/lib/documents.js");

test("Action Validation and Error Returns in Server Actions", async (t) => {
  const actionsFilePath = path.resolve("src/app/(vault)/documents/actions.js");
  const actionsContent = fs.readFileSync(actionsFilePath, "utf-8");

  const docPagePath = path.resolve("src/app/(vault)/documents/page.js");
  const docPageContent = fs.readFileSync(docPagePath, "utf-8");

  const docIdPagePath = path.resolve("src/app/(vault)/documents/[id]/page.js");
  const docIdPageContent = fs.readFileSync(docIdPagePath, "utf-8");

  const uploadFormPath = path.resolve("src/components/upload-document-form.js");
  const uploadFormContent = fs.readFileSync(uploadFormPath, "utf-8");

  const editFormPath = path.resolve("src/components/edit-document-form.js");
  const editFormContent = fs.readFileSync(editFormPath, "utf-8");

  const deleteBtnPath = path.resolve("src/components/delete-document-button.js");
  const deleteBtnContent = fs.readFileSync(deleteBtnPath, "utf-8");

  const shareSecPath = path.resolve("src/components/share-link-section.js");
  const shareSecContent = fs.readFileSync(shareSecPath, "utf-8");

  await t.test("actions.js contains 'use server' directive at module boundary", () => {
    assert.match(
      actionsContent,
      /^["']use server["'];?/m,
      "actions.js must start with 'use server' directive"
    );
  });

  await t.test("documents/page.js renders UploadDocumentForm client leaf component", () => {
    assert.match(
      docPageContent,
      /import\s*\{\s*UploadDocumentForm\s*\}\s*from\s*["']@\/src\/components\/upload-document-form["']/,
      "page.js should import UploadDocumentForm"
    );
    assert.match(
      docPageContent,
      /<UploadDocumentForm\s*\/>/,
      "page.js must render <UploadDocumentForm />"
    );
    assert.doesNotMatch(
      docPageContent,
      /^["']use client["'];?/m,
      "page.js must remain a Server Component"
    );
  });

  await t.test("upload-document-form.js uses 'use client' and useActionState", () => {
    assert.match(
      uploadFormContent,
      /^["']use client["'];?/m,
      "upload-document-form.js must be a Client Component"
    );
    assert.match(
      uploadFormContent,
      /useActionState\s*\(\s*createDocument/,
      "upload-document-form.js must use useActionState with createDocument"
    );
    assert.match(
      uploadFormContent,
      /aria-invalid=/,
      "upload-document-form.js must include aria-invalid for accessibility"
    );
  });

  await t.test("documents/[id]/page.js renders client leaf form components", () => {
    assert.match(
      docIdPageContent,
      /import\s*\{\s*EditDocumentForm\s*\}\s*from\s*["']@\/src\/components\/edit-document-form["']/,
      "document detail page should import EditDocumentForm"
    );
    assert.match(
      docIdPageContent,
      /import\s*\{\s*DeleteDocumentButton\s*\}\s*from\s*["']@\/src\/components\/delete-document-button["']/,
      "document detail page should import DeleteDocumentButton"
    );
    assert.match(
      docIdPageContent,
      /import\s*\{\s*ShareLinkSection\s*\}\s*from\s*["']@\/src\/components\/share-link-section["']/,
      "document detail page should import ShareLinkSection"
    );
    assert.match(
      docIdPageContent,
      /<EditDocumentForm\s+document=\{document\}\s*\/>/,
      "document detail page must render EditDocumentForm"
    );
    assert.match(
      docIdPageContent,
      /<DeleteDocumentButton\s+documentId=\{document\.id\}\s*\/>/,
      "document detail page must render DeleteDocumentButton"
    );
    assert.match(
      docIdPageContent,
      /<ShareLinkSection\s+documentId=\{document\.id\}\s+shareLinks=\{shareLinks\}\s*\/>/,
      "document detail page must render ShareLinkSection"
    );
    assert.doesNotMatch(
      docIdPageContent,
      /^["']use client["'];?/m,
      "documents/[id]/page.js must remain a Server Component"
    );
  });

  await t.test("edit-document-form.js, delete-document-button.js, and share-link-section.js use useActionState", () => {
    assert.match(
      editFormContent,
      /useActionState\s*\(\s*updateDocument/,
      "edit-document-form.js must use useActionState"
    );
    assert.match(
      deleteBtnContent,
      /useActionState\s*\(\s*deleteDocument/,
      "delete-document-button.js must use useActionState"
    );
    assert.match(
      shareSecContent,
      /useActionState\s*\(\s*createShareLink/,
      "share-link-section.js must use useActionState"
    );
  });

  await t.test("edit metadata uses optimistic state and refreshes from the server", () => {
    assert.match(
      editFormContent,
      /dispatchOptimisticUpdate\s*\(\s*\{\s*type:\s*["']UPDATE["']/s,
      "edit form must apply an optimistic metadata update"
    );
    assert.match(
      editFormContent,
      /router\.refresh\(\)/,
      "edit form must reconcile with the server-rendered document"
    );
    assert.match(
      editFormContent,
      /aria-busy=\{isPending\}/,
      "edit form must expose its pending state"
    );
    assert.match(
      editFormContent,
      /Saving document metadata\.\.\./,
      "edit form must provide a visible pending status"
    );
    assert.match(
      fs.readFileSync(path.resolve("src/components/optimistic-document-provider.js"), "utf-8"),
      /useOptimistic/,
      "document metadata must be held in temporary useOptimistic state"
    );
  });

  await t.test("createDocument creates document on valid input and returns structured data or redirects", async () => {
    const formData = new FormData();
    formData.append("title", "Birth Certificate");
    formData.append("type", "PDF");
    formData.append("description", "Official birth certificate copy");
    formData.append("size", "1.9 MB");

    let result;
    try {
      result = await createDocument(null, formData);
    } catch (err) {
      if (!err.message.includes("NEXT_REDIRECT")) {
        throw err;
      }
    }

    const doc = await getDocumentById("birth-certificate");
    assert.ok(doc, "Created document should exist in vault");
    assert.strictEqual(doc.title, "Birth Certificate");
    assert.strictEqual(doc.type, "PDF");
    assert.strictEqual(doc.description, "Official birth certificate copy");
    if (result) {
      assert.strictEqual(result.errors, null);
      assert.ok(result.data);
    }
  });

  await t.test("createDocument returns field validation errors on empty title without throwing", async () => {
    const formData = new FormData();
    formData.append("title", "   ");
    formData.append("type", "PDF");

    const result = await createDocument(null, formData);
    assert.ok(result, "Action must return an object");
    assert.strictEqual(result.data, null);
    assert.ok(result.errors, "Validation errors must be returned");
    assert.ok(
      Array.isArray(result.errors.title) && result.errors.title.length > 0,
      "errors.title must contain error message array"
    );
  });

  await t.test("createDocument returns field validation errors on invalid type without throwing", async () => {
    const formData = new FormData();
    formData.append("title", "Executable File");
    formData.append("type", "EXE");

    const result = await createDocument(null, formData);
    assert.ok(result, "Action must return an object");
    assert.strictEqual(result.data, null);
    assert.ok(result.errors, "Validation errors must be returned");
    assert.ok(
      Array.isArray(result.errors.type) && result.errors.type.length > 0,
      "errors.type must contain error message array"
    );
  });

  await t.test("updateDocument updates metadata on valid input and returns structured success", async () => {
    const formData = new FormData();
    formData.append("documentId", "pan-card");
    formData.append("title", "Permanent Account Number (PAN)");
    formData.append("description", "Updated tax identification certificate");
    formData.append("type", "JPG");

    const result = await updateDocument(null, formData);
    assert.strictEqual(result.errors, null);
    assert.ok(result.data);
    assert.strictEqual(result.data.title, "Permanent Account Number (PAN)");

    const updated = await getDocumentById("pan-card");
    assert.strictEqual(updated.title, "Permanent Account Number (PAN)");
    assert.strictEqual(updated.description, "Updated tax identification certificate");
  });

  await t.test("updateDocument returns field errors on empty title without throwing", async () => {
    const formData = new FormData();
    formData.append("documentId", "pan-card");
    formData.append("title", "");

    const result = await updateDocument(null, formData);
    assert.strictEqual(result.data, null);
    assert.ok(result.errors?.title?.length > 0);
  });

  await t.test("updateDocument returns form error on non-existent document ID without throwing", async () => {
    const formData = new FormData();
    formData.append("documentId", "non-existent-doc-999");
    formData.append("title", "New Title");

    const result = await updateDocument(null, formData);
    assert.strictEqual(result.data, null);
    assert.ok(result.errors?._form?.length > 0);
  });

  await t.test("createShareLink and revokeShareLink manage expiring links with structured returns", async () => {
    const shareFormData = new FormData();
    shareFormData.append("documentId", "identity-proof");
    shareFormData.append("expiresInMinutes", "60");

    const shareResult = await createShareLink(null, shareFormData);
    assert.strictEqual(shareResult.errors, null);
    assert.ok(shareResult.data?.token?.startsWith("share-"));

    const links = await getDocumentShareLinks("identity-proof");
    assert.ok(links.some((l) => l.id === shareResult.data.id));

    // Revoke link
    const revokeFormData = new FormData();
    revokeFormData.append("documentId", "identity-proof");
    revokeFormData.append("linkId", shareResult.data.id);

    const revokeResult = await revokeShareLink(null, revokeFormData);
    assert.strictEqual(revokeResult.errors, null);
    assert.strictEqual(revokeResult.data, true);

    const remainingLinks = await getDocumentShareLinks("identity-proof");
    assert.ok(!remainingLinks.some((l) => l.id === shareResult.data.id));
  });

  await t.test("createShareLink returns validation errors on negative expiration without throwing", async () => {
    const shareFormData = new FormData();
    shareFormData.append("documentId", "identity-proof");
    shareFormData.append("expiresInMinutes", "-10");

    const shareResult = await createShareLink(null, shareFormData);
    assert.strictEqual(shareResult.data, null);
    assert.ok(shareResult.errors?.expiresInMinutes?.length > 0);
  });

  await t.test("deleteDocument removes document from vault", async () => {
    const formData = new FormData();
    formData.append("documentId", "degree-certificate");

    try {
      await deleteDocument(null, formData);
    } catch (err) {
      if (!err.message.includes("NEXT_REDIRECT")) {
        throw err;
      }
    }

    const doc = await getDocumentById("degree-certificate");
    assert.strictEqual(doc, null, "Deleted document should no longer exist");
  });

  await t.test("deleteDocument returns form error on non-existent document ID", async () => {
    const formData = new FormData();
    formData.append("documentId", "missing-document-123");

    const result = await deleteDocument(null, formData);
    assert.strictEqual(result.data, null);
    assert.ok(result.errors?._form?.length > 0);
  });
});

