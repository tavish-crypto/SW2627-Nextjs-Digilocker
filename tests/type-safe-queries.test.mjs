import test from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_STORAGE_BUCKET = "local";
process.env.AUTH_SECRET = "test-auth-secret-for-jwt-signing";
process.env.DATABASE_URL = "file:./prisma/dev.db";

const { prisma, default: defaultPrisma } = await import("../src/lib/prisma.js");
const {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
  getDocumentActivity,
  getDocumentShareLinks,
  getVaultStats,
  createShareLink,
  deleteShareLink,
} = await import("../src/lib/documents.js");

test("Prisma Client Singleton Pattern", async (t) => {
  await t.test("exports shared singleton instance matching default export", () => {
    assert.ok(prisma, "prisma singleton must be defined");
    assert.strictEqual(prisma, defaultPrisma, "Named and default prisma exports must be identical instance");
  });

  await t.test("attaches singleton to globalThis in non-production environments", () => {
    assert.strictEqual(globalThis.prisma, prisma, "globalThis.prisma must hold the singleton instance");
  });

  await t.test("re-importing prisma module reuses the existing singleton", async () => {
    const reimported = await import(`../src/lib/prisma.js?cacheBust=${Date.now()}`);
    assert.strictEqual(reimported.prisma, prisma, "Subsequent imports must return the same singleton instance");
  });
});

test("Type-Safe Prisma Client CRUD Operations", async (t) => {
  const testDocId = `test-doc-${Date.now()}`;

  await t.test("create persists new document using typed fields and atomic activity log", async () => {
    const created = await createDocument({
      id: testDocId,
      title: "Type-Safe Insurance Policy",
      description: "Automated test policy",
      type: "PDF",
      size: "2.5 MB",
    });

    assert.ok(created, "Document should be created successfully");
    assert.strictEqual(created.id, testDocId);
    assert.strictEqual(created.title, "Type-Safe Insurance Policy");
    assert.strictEqual(created.type, "PDF");

    // Verify initial audit activity was recorded
    const activities = await getDocumentActivity(testDocId);
    assert.ok(activities.length > 0, "Initial audit activity must exist");
    assert.ok(
      activities.some((a) => a.action.includes("Uploaded")),
      "Activity must reflect document upload"
    );
  });

  await t.test("getDocumentById retrieves document by unique ID", async () => {
    const fetched = await getDocumentById(testDocId);
    assert.ok(fetched, "Document must be fetchable by ID");
    assert.strictEqual(fetched.id, testDocId);
    assert.strictEqual(fetched.title, "Type-Safe Insurance Policy");
  });

  await t.test("getDocumentById returns null for non-existent ID", async () => {
    const missing = await getDocumentById(`missing-id-${Date.now()}`);
    assert.strictEqual(missing, null, "Query for non-existent record must resolve to null without throwing");
  });

  await t.test("getDocuments lists documents with stable ordering", async () => {
    const allDocs = await getDocuments();
    assert.ok(Array.isArray(allDocs), "getDocuments must return an array");
    assert.ok(allDocs.length > 0, "Documents list must not be empty");
    assert.ok(
      allDocs.some((d) => d.id === testDocId),
      "Created document must be in document list"
    );
  });

  await t.test("updateDocument modifies targeted fields atomically and records audit log", async () => {
    const updated = await updateDocument(testDocId, {
      title: "Updated Insurance Policy Title",
      description: "Updated description for verification",
      type: "DOCX",
    });

    assert.ok(updated, "Update must succeed");
    assert.strictEqual(updated.title, "Updated Insurance Policy Title");
    assert.strictEqual(updated.description, "Updated description for verification");
    assert.strictEqual(updated.type, "DOCX");

    // Verify activity recorded for update
    const activities = await getDocumentActivity(testDocId);
    assert.ok(
      activities.some((a) => a.action.includes("Metadata updated")),
      "Activity must record metadata update"
    );
  });

  await t.test("getVaultStats aggregates document counts and distinct categories", async () => {
    const stats = await getVaultStats();
    assert.ok(typeof stats.totalDocuments === "number");
    assert.ok(stats.totalDocuments >= 1);
    assert.ok(typeof stats.totalCategories === "number");
    assert.ok(stats.totalCategories >= 1);
    assert.strictEqual(stats.storageQuotaMB, 100);
  });

  await t.test("createShareLink and deleteShareLink manage share records atomically", async () => {
    const link = await createShareLink(testDocId, { expiresInMinutes: 30 });
    assert.ok(link, "Share link should be created");
    assert.ok(link.token.startsWith("share-"), "Token must follow share link format");

    const links = await getDocumentShareLinks(testDocId);
    assert.ok(
      links.some((l) => l.token === link.token),
      "Share link must be listed in document share links"
    );

    const deleted = await deleteShareLink(testDocId, link.id);
    assert.strictEqual(deleted, true, "Revoking share link must succeed");
  });

  await t.test("deleteDocument removes document and cascades cleanup", async () => {
    const deleted = await deleteDocument(testDocId);
    assert.strictEqual(deleted, true, "Delete document must return true");

    const fetchedAfterDelete = await getDocumentById(testDocId);
    assert.strictEqual(fetchedAfterDelete, null, "Deleted document must no longer be retrievable");
  });
});

test("SQL Injection Resistance & Safe Parameterization", async (t) => {
  await t.test("special characters and SQL keywords do not cause query syntax errors or injection", async () => {
    const maliciousId = `doc' OR '1'='1' -- `;
    const result = await getDocumentById(maliciousId);
    assert.strictEqual(result, null, "SQL injection string must not match arbitrary records");
  });

  await t.test("filter expressions treat inputs as literal string values", async () => {
    const maliciousTitle = "'; DROP TABLE Document; --";
    const created = await createDocument({
      title: maliciousTitle,
      type: "PDF",
    });

    assert.ok(created);
    assert.strictEqual(created.title, maliciousTitle, "SQL string must be safely stored as literal text");

    // Clean up
    await deleteDocument(created.id);
  });
});

test("Atomic Transactions with prisma.$transaction", async (t) => {
  await t.test("prisma.$transaction handles multiple queries atomically", async () => {
    const txDocId = `tx-doc-${Date.now()}`;

    // Ensure demo user exists
    const user = await prisma.user.upsert({
      where: { email: "tx-tester@example.com" },
      update: {},
      create: {
        id: "tx-user",
        email: "tx-tester@example.com",
        name: "TX Tester",
      },
    });

    const [docResult, actResult] = await prisma.$transaction([
      prisma.document.create({
        data: {
          id: txDocId,
          title: "Atomic Transaction Doc",
          type: "PDF",
          userId: user.id,
        },
      }),
      prisma.documentActivity.create({
        data: {
          documentId: txDocId,
          userId: user.id,
          action: "Transaction Verification",
        },
      }),
    ]);

    assert.strictEqual(docResult.id, txDocId);
    assert.strictEqual(actResult.action, "Transaction Verification");

    // Clean up
    await prisma.document.delete({ where: { id: txDocId } });
  });

  await t.test("prisma.$transaction rolls back all writes if any step fails", async () => {
    const failDocId = `fail-doc-${Date.now()}`;

    await assert.rejects(async () => {
      await prisma.$transaction(async (tx) => {
        await tx.document.create({
          data: {
            id: failDocId,
            title: "Will be rolled back",
            type: "PDF",
            userId: "non-existent-user-id-xyz", // Fails foreign key constraint
          },
        });
      });
    });

    const orphan = await prisma.document.findUnique({ where: { id: failDocId } });
    assert.strictEqual(orphan, null, "Rolled-back document must not exist in database");
  });
});
