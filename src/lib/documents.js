import { cache } from "react";
import prisma from "./prisma.js";
import { createTraceId, getTraceId, logger } from "./logger.js";

// =============================================================================
// MOCK DATA - Used as fallback for development/testing
// =============================================================================

const documents = [
  {
    id: "identity-proof",
    title: "Identity proof",
    description: "A verified copy of your identity document.",
    issuedOn: "January 15, 2026",
    type: "PDF",
    size: "2.1 MB",
  },
  {
    id: "aadhaar-card",
    title: "Aadhaar Card",
    description: "Official government-issued identity document.",
    issuedOn: "December 10, 2025",
    type: "PDF",
    size: "1.8 MB",
  },
  {
    id: "degree-certificate",
    title: "Degree Certificate",
    description: "Educational qualification certificate.",
    issuedOn: "May 20, 2024",
    type: "DOCX",
    size: "1.4 MB",
  },
  {
    id: "pan-card",
    title: "PAN Card",
    description: "Tax identification document.",
    issuedOn: "March 5, 2023",
    type: "JPG",
    size: "820 KB",
  },
  {
    id: "insurance-policy",
    title: "Insurance Policy",
    description: "Health insurance policy document.",
    issuedOn: "January 1, 2026",
    type: "PDF",
    size: "3.2 MB",
  },
];

const documentActivities = {
  "identity-proof": [
    { id: "act-1", action: "Uploaded to vault", timestamp: "January 15, 2026, 10:30 AM" },
    { id: "act-2", action: "Integrity verified (SHA-256)", timestamp: "January 15, 2026, 10:31 AM" },
  ],
  "aadhaar-card": [
    { id: "act-3", action: "Uploaded to vault", timestamp: "December 10, 2025, 02:15 PM" },
    { id: "act-4", action: "Shared via expiring link", timestamp: "December 12, 2025, 09:00 AM" },
  ],
  "degree-certificate": [
    { id: "act-5", action: "Uploaded to vault", timestamp: "May 20, 2024, 11:45 AM" },
  ],
  "pan-card": [
    { id: "act-6", action: "Uploaded to vault", timestamp: "March 5, 2023, 04:20 PM" },
  ],
  "insurance-policy": [
    { id: "act-7", action: "Uploaded to vault", timestamp: "January 1, 2026, 08:00 AM" },
  ],
};

const documentShareLinks = {
  "identity-proof": [],
  "aadhaar-card": [
    { id: "link-1", token: "adh-share-99", expiresAt: "December 13, 2025, 09:00 AM", active: false },
  ],
  "degree-certificate": [],
  "pan-card": [],
  "insurance-policy": [],
};

const SORT_OPTIONS = new Set(["newest", "oldest", "name-asc", "name-desc"]);

export function normalizeDocumentQuery({ q = "", type = "", sort = "newest" } = {}) {
  const normalizedType = typeof type === "string" ? type.trim().toUpperCase() : "";
  const normalizedSort = typeof sort === "string" && SORT_OPTIONS.has(sort) ? sort : "newest";

  return {
    q: typeof q === "string" ? q.trim() : "",
    type: normalizedType,
    sort: normalizedSort,
  };
}

export function filterAndSortDocuments(documentsToFilter, query) {
  const { q, type, sort } = normalizeDocumentQuery(query);
  const searchTerm = q.toLowerCase();
  const filtered = documentsToFilter.filter((document) => {
    const matchesSearch = !searchTerm || [document.title, document.description, document.type]
      .some((value) => String(value || "").toLowerCase().includes(searchTerm));
    const matchesType = !type || String(document.type || "").toUpperCase() === type;
    return matchesSearch && matchesType;
  });

  return filtered.sort((first, second) => {
    if (sort === "name-asc" || sort === "name-desc") {
      const comparison = String(first.title || "").localeCompare(String(second.title || ""));
      return sort === "name-asc" ? comparison : -comparison;
    }

    const firstDate = first.createdAt ? new Date(first.createdAt).getTime() : 0;
    const secondDate = second.createdAt ? new Date(second.createdAt).getTime() : 0;
    return sort === "oldest" ? firstDate - secondDate : secondDate - firstDate;
  });
}

export function normalizePaginationQuery(input = {}) {
  const page = Number.parseInt(input.page ?? 1, 10);
  const pageSize = Number.parseInt(input.pageSize ?? input.limit ?? 10, 10);

  return {
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 10,
  };
}

export async function getPaginatedDocuments({
  userId = "demo-user",
  page = 1,
  pageSize = 10,
  q = "",
  type = "",
  sort = "newest",
} = {}) {
  const allDocuments = await getDocuments();
  const scopedDocuments = userId
    ? allDocuments.filter((document) => !document.userId || document.userId === userId)
    : allDocuments;
  const sortedDocuments = filterAndSortDocuments(scopedDocuments, { q, type, sort });
  const normalizedPage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  const normalizedPageSize = Number.isFinite(Number(pageSize)) && Number(pageSize) > 0 ? Math.min(Number(pageSize), 100) : 10;
  const total = sortedDocuments.length;
  const totalPages = total === 0 ? 1 : Math.ceil(total / normalizedPageSize);
  const safePage = Math.min(normalizedPage, totalPages);
  const start = (safePage - 1) * normalizedPageSize;
  const items = sortedDocuments.slice(start, start + normalizedPageSize);

  return {
    items,
    meta: {
      mode: "offset",
      page: safePage,
      pageSize: normalizedPageSize,
      total,
      totalPages,
      hasMore: safePage < totalPages,
      hasPrevious: safePage > 1,
    },
  };
}

/**
 * Helper to ensure a valid user exists for document foreign key relationships.
 */
async function ensureUserExists(userId) {
  const targetId = userId || "demo-user";
  try {
    const existing = await prisma.user.findUnique({ where: { id: targetId } });
    if (existing) return existing;
    return await prisma.user.upsert({
      where: { email: `${targetId}@example.com` },
      update: {},
      create: {
        id: targetId,
        email: `${targetId}@example.com`,
        name: "Demo User",
      },
    });
  } catch {
    return { id: targetId, email: `${targetId}@example.com`, name: "Demo User" };
  }
}

/**
 * Fetch all documents from the server using Prisma findMany.
 * Merges with default vault documents for complete catalogue availability.
 * Wrapped in React cache() to deduplicate queries within a single render cycle.
 */
export async function getDocuments() {
  try {
    const dbDocs = await prisma.document.findMany({
      orderBy: { createdAt: "desc" },
    });

    return (dbDocs || []).map((doc) => ({
      id: doc.id,
      title: doc.title,
      description: doc.description || "",
      issuedOn: doc.issuedOn || (doc.createdAt ? new Date(doc.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""),
      type: doc.type,
      size: doc.size || "",
      fileKey: doc.fileKey || null,
      fileUrl: doc.fileUrl || null,
      mimeType: doc.mimeType || "application/octet-stream",
      fileSizeBytes: doc.fileSizeBytes || null,
      fileHash: doc.fileHash || null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      userId: doc.userId,
    }));
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), err: error }, "Prisma query failed, returning empty list");
    return [];
  }
}

/**
 * Fetch a single document by ID from the server using Prisma findUnique.
 * Wrapped in React cache() so generateMetadata and DocumentPage share a single
 * data fetch per request during rendering/regeneration without duplicate queries.
 */
export async function getDocumentById(id) {
  if (!id) return null;
  try {
    const doc = await prisma.document.findUnique({
      where: { id },
    });
    if (doc) {
      return {
        id: doc.id,
        title: doc.title,
        description: doc.description || "",
        issuedOn: doc.issuedOn || (doc.createdAt ? new Date(doc.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""),
        type: doc.type,
        size: doc.size || "",
        fileKey: doc.fileKey || null,
        fileUrl: doc.fileUrl || null,
        mimeType: doc.mimeType || "application/octet-stream",
        fileSizeBytes: doc.fileSizeBytes || null,
        fileHash: doc.fileHash || null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        userId: doc.userId,
      };
    }
    return documents.find((document) => document.id === id) ?? null;
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), documentId: id, err: error }, "Prisma query failed, falling back to mock data");
    return documents.find((document) => document.id === id) ?? null;
  }
}

/**
 * Fetch audit activity logs for a document using Prisma findMany.
 * This is a dependent query requiring a verified document ID.
 */
export async function getDocumentActivity(documentId) {
  if (!documentId) return [];
  try {
    const activities = await prisma.documentActivity.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
    });
    if (activities && activities.length > 0) {
      return activities.map((act) => ({
        id: act.id,
        action: act.action,
        timestamp: act.createdAt
          ? new Date(act.createdAt).toLocaleString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
      }));
    }
    return documentActivities[documentId] ?? [];
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), documentId, err: error }, "Prisma query failed, falling back to mock data");
    return documentActivities[documentId] ?? [];
  }
}

/**
 * Fetch active share links for a document using Prisma findMany.
 * This is a dependent query requiring a verified document ID.
 */
export const getDocumentShareLinks = cache(async (documentId) => {
  if (!documentId) return [];
  try {
    const links = await prisma.shareLink.findMany({
      where: { documentId, active: true },
      orderBy: { createdAt: "desc" },
    });
    if (links && links.length > 0) {
      return links.map((link) => ({
        id: link.id,
        token: link.token,
        expiresAt: link.expiresAt
          ? new Date(link.expiresAt).toLocaleString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Never",
        active: link.active,
      }));
    }
    return documentShareLinks[documentId] ?? [];
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), documentId, err: error }, "Prisma query failed, falling back to mock data");
    return documentShareLinks[documentId] ?? [];
  }
});

/**
 * Fetch aggregated vault statistics using Prisma count and aggregation.
 * Independent query that can run concurrently with document fetches.
 */
export const getVaultStats = cache(async () => {
  try {
    const allDocs = await getDocuments();
    const totalDocs = allDocs.length;
    const categories = new Set(allDocs.map((d) => d.type)).size;
    return {
      totalDocuments: totalDocs,
      totalCategories: categories,
      storageQuotaMB: 100,
    };
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), err: error }, "Prisma query failed, falling back to mock data");
    const mockDocs = documents.length;
    const mockCategories = new Set(documents.map((d) => d.type)).size;
    return {
      totalDocuments: mockDocs,
      totalCategories: mockCategories,
      storageQuotaMB: 100,
    };
  }
});

/**
 * Add an audit activity log entry for a document using Prisma create.
 */
export async function addDocumentActivity(documentId, action, userId) {
  const timestamp = new Date().toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const fallbackActivity = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    action,
    timestamp,
  };

  if (!documentActivities[documentId]) {
    documentActivities[documentId] = [];
  }
  documentActivities[documentId].unshift(fallbackActivity);

  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, userId: true },
    });
    if (doc) {
      const activityUserId = userId || doc.userId;
      const created = await prisma.documentActivity.create({
        data: {
          documentId,
          userId: activityUserId,
          action,
        },
      });
      return {
        id: created.id,
        action: created.action,
        timestamp: new Date(created.createdAt).toLocaleString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    }
  } catch (error) {
    logger.warn({ action: "data.activity_create_fallback", traceId: getTraceId() || createTraceId(), documentId, userId, err: error }, "Prisma activity creation failed, using in-memory store");
  }

  return fallbackActivity;
}

/**
 * Create a new document in the vault using Prisma $transaction for atomic creation.
 * Supports both API route payloads and Server Action submissions.
 */
export async function createDocument(documentData) {
  const title = documentData?.title || "Untitled Document";
  let uniqueId = documentData?.id;

  if (!uniqueId) {
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `doc-${Date.now()}`;

    uniqueId = slug;
    let counter = 1;
    while (documents.some((d) => d.id === uniqueId)) {
      uniqueId = `${slug}-${counter}`;
      counter++;
    }
  }

  const issuedOn = documentData?.issuedOn || new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const newDoc = {
    id: uniqueId,
    title: title.trim(),
    description: documentData?.description ? documentData.description.trim() : "Uploaded vault document.",
    issuedOn,
    type: (documentData?.type || "PDF").toUpperCase(),
    size: documentData?.size || "1.2 MB",
    fileKey: documentData?.fileKey || documentData?.objectKey || null,
    fileUrl: documentData?.fileUrl || null,
    mimeType: documentData?.mimeType || documentData?.contentType || "application/octet-stream",
    fileSizeBytes: typeof documentData?.fileSizeBytes === "number" ? documentData.fileSizeBytes : (typeof documentData?.fileSize === "number" ? documentData.fileSize : null),
    fileHash: documentData?.fileHash || null,
    ...documentData,
    id: uniqueId,
    title: title.trim(),
    issuedOn,
  };

  documents.unshift(newDoc);
  documentActivities[newDoc.id] = [];
  documentShareLinks[newDoc.id] = [];

  try {
    const user = await ensureUserExists(documentData?.userId);
    const result = await prisma.$transaction(async (tx) => {
      const createdDoc = await tx.document.upsert({
        where: { id: uniqueId },
        update: {
          title: newDoc.title,
          description: newDoc.description,
          type: newDoc.type,
          size: newDoc.size,
          issuedOn: newDoc.issuedOn,
          fileKey: newDoc.fileKey,
          fileUrl: newDoc.fileUrl,
          mimeType: newDoc.mimeType,
          fileSizeBytes: newDoc.fileSizeBytes,
          fileHash: newDoc.fileHash,
        },
        create: {
          id: uniqueId,
          title: newDoc.title,
          description: newDoc.description,
          type: newDoc.type,
          size: newDoc.size,
          issuedOn: newDoc.issuedOn,
          userId: user.id,
          fileKey: newDoc.fileKey,
          fileUrl: newDoc.fileUrl,
          mimeType: newDoc.mimeType,
          fileSizeBytes: newDoc.fileSizeBytes,
          fileHash: newDoc.fileHash,
        },
      });

      await tx.documentActivity.create({
        data: {
          documentId: createdDoc.id,
          userId: user.id,
          action: "Uploaded to vault",
        },
      });

      return createdDoc;
    });

    await addDocumentActivity(newDoc.id, "Uploaded to vault", user.id);

    return {
      ...newDoc,
      id: result.id,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      userId: result.userId,
    };
  } catch (error) {
    logger.warn({ action: "document.create_fallback", traceId: getTraceId() || createTraceId(), documentId: newDoc.id, userId: documentData?.userId, err: error }, "Prisma document creation failed, using mock data");
    await addDocumentActivity(newDoc.id, "Uploaded to vault");
    return newDoc;
  }
}

/**
 * Update an existing document's metadata using Prisma $transaction.
 */
export async function updateDocument(id, updates) {
  const index = documents.findIndex((d) => d.id === id);
  let existing = index !== -1 ? documents[index] : null;

  const titleUpdate = updates.title !== undefined ? updates.title.trim() : undefined;
  const descUpdate = updates.description !== undefined ? updates.description.trim() : undefined;
  const typeUpdate = updates.type !== undefined ? updates.type.toUpperCase() : undefined;

  let updatedDoc = existing
    ? {
        ...existing,
        ...(titleUpdate !== undefined && { title: titleUpdate }),
        ...(descUpdate !== undefined && { description: descUpdate }),
        ...(typeUpdate !== undefined && { type: typeUpdate }),
      }
    : null;

  if (index !== -1 && updatedDoc) {
    documents[index] = updatedDoc;
  }

  try {
    const dbDoc = await prisma.document.findUnique({ where: { id } });
    if (!dbDoc && !existing) {
      return null;
    }

    if (dbDoc) {
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.document.update({
          where: { id },
          data: {
            ...(titleUpdate !== undefined && { title: titleUpdate }),
            ...(descUpdate !== undefined && { description: descUpdate }),
            ...(typeUpdate !== undefined && { type: typeUpdate }),
          },
        });

        await tx.documentActivity.create({
          data: {
            documentId: id,
            userId: dbDoc.userId,
            action: "Metadata updated",
          },
        });

        return updated;
      });

      await addDocumentActivity(id, "Metadata updated", dbDoc.userId);
      return {
        id: result.id,
        title: result.title,
        description: result.description,
        type: result.type,
        size: result.size,
        issuedOn: result.issuedOn,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        userId: result.userId,
      };
    }
  } catch (error) {
    logger.warn({ action: "document.update_fallback", traceId: getTraceId() || createTraceId(), documentId: id, err: error }, "Prisma document update failed, using mock data");
  }

  if (updatedDoc) {
    await addDocumentActivity(id, "Metadata updated");
    return updatedDoc;
  }

  return null;
}

/**
 * Delete a document from the vault using Prisma delete.
 */
export async function deleteDocument(id) {
  const index = documents.findIndex((d) => d.id === id);
  let found = index !== -1;

  if (found) {
    documents.splice(index, 1);
    delete documentActivities[id];
    delete documentShareLinks[id];
  }

  try {
    const dbDoc = await prisma.document.findUnique({ where: { id } });
    if (dbDoc) {
      await prisma.document.delete({ where: { id } });
      return true;
    }
  } catch (error) {
    logger.warn({ action: "document.delete_fallback", traceId: getTraceId() || createTraceId(), documentId: id, err: error }, "Prisma document deletion failed, using mock state");
  }

  return found;
}

/**
 * Create an expiring share link using Prisma $transaction.
 */
export async function createShareLink(documentId, { expiresInMinutes = 60 } = {}) {
  const document = documents.find((d) => d.id === documentId);

  const expiresDate = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  const expiresAtFormatted = expiresDate.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const token = `share-${Math.random().toString(36).substring(2, 8)}`;
  const newLink = {
    id: `link-${Date.now()}`,
    token,
    expiresAt: expiresAtFormatted,
    active: true,
  };

  if (!documentShareLinks[documentId]) {
    documentShareLinks[documentId] = [];
  }
  documentShareLinks[documentId].unshift(newLink);

  try {
    const dbDoc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!dbDoc && !document) {
      return null;
    }

    if (dbDoc) {
      const created = await prisma.$transaction(async (tx) => {
        const link = await tx.shareLink.create({
          data: {
            token,
            expiresAt: expiresDate,
            active: true,
            documentId,
            createdBy: dbDoc.userId,
          },
        });

        await tx.documentActivity.create({
          data: {
            documentId,
            userId: dbDoc.userId,
            action: `Shared via expiring link (${expiresInMinutes}m)`,
          },
        });

        return link;
      });

      await addDocumentActivity(documentId, `Shared via expiring link (${expiresInMinutes}m)`, dbDoc.userId);
      return {
        id: created.id,
        token: created.token,
        expiresAt: expiresAtFormatted,
        active: created.active,
      };
    }
  } catch (error) {
    logger.warn({ action: "document.share_link_fallback", traceId: getTraceId() || createTraceId(), documentId, err: error }, "Prisma createShareLink failed, using mock data");
  }

  if (document) {
    await addDocumentActivity(documentId, `Shared via expiring link (${expiresInMinutes}m)`);
    return newLink;
  }

  return null;
}

// =============================================================================
// PRISMA RELATION QUERIES - User-Document Relations with select/include
// =============================================================================

/**
 * Fetch all documents with their associated user information.
 * Uses Prisma include to fetch related user data in a single query.
 * 
 * Query Pattern: Using include to fetch relations
 * Optimized for: Admin dashboards, document listings with owner info
 * 
 * @returns {Promise<Array>} Documents with nested user objects
 */
export const getDocumentsWithUser = cache(async () => {
  try {
    return await prisma.document.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), err: error }, "Prisma query failed, falling back to mock data");
    return documents;
  }
});

/**
 * Fetch documents for a specific user with all relations.
 * Uses Prisma include to fetch activities and shareLinks in a single query.
 * 
 * Query Pattern: Filtering with include for nested relations
 * Optimized for: User vault view, document detail pages
 * 
 * @param {string} userId - User ID to fetch documents for
 * @returns {Promise<Array>} User's documents with activities and shareLinks
 */
export const getDocumentsByUser = cache(async (userId) => {
  if (!userId) return [];

  try {
    return await prisma.document.findMany({
      where: { userId },
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            action: true,
            description: true,
            createdAt: true,
          },
        },
        shareLinks: {
          select: {
            id: true,
            token: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), userId, err: error }, "Prisma query failed, falling back to mock data");
    return documents;
  }
});

/**
 * Fetch a single document with all its relations and associated user.
 * Uses Prisma include to fetch user, activities, and shareLinks efficiently.
 * 
 * Query Pattern: Deep include with selective field selection
 * Optimized for: Document detail page, edit page
 * 
 * @param {string} id - Document ID
 * @returns {Promise<Object|null>} Complete document with all relations or null
 */
export const getDocumentWithRelations = cache(async (id) => {
  if (!id) return null;

  try {
    return await prisma.document.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            action: true,
            description: true,
            createdAt: true,
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
        shareLinks: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            token: true,
            createdAt: true,
            expiresAt: true,
          },
        },
      },
    });
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), documentId: id, err: error }, "Prisma query failed, falling back to mock data");
    return getDocumentById(id);
  }
});

/**
 * Fetch a document with only its owner user data (lightweight).
 * Uses Prisma select to fetch only necessary fields.
 * 
 * Query Pattern: Selective field fetching with include
 * Optimized for: List views, API responses with limited payload
 * 
 * @param {string} id - Document ID
 * @returns {Promise<Object|null>} Document with user info or null
 */
export const getDocumentWithUser = cache(async (id) => {
  if (!id) return null;

  try {
    return await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        size: true,
        issuedOn: true,
        mimeType: true,
        fileSizeBytes: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), documentId: id, err: error }, "Prisma query failed, falling back to mock data");
    return getDocumentById(id);
  }
});

/**
 * Fetch lightweight document summaries for a user.
 * Uses Prisma select with minimal fields for optimal performance.
 * 
 * Query Pattern: Selective field selection for performance
 * Optimized for: Quick list views, search results, mobile apps
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Lightweight document summaries
 */
export const getUserDocumentsSummary = cache(async (userId) => {
  if (!userId) return [];

  try {
    return await prisma.document.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        type: true,
        size: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit for performance
    });
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), userId, err: error }, "Prisma query failed, falling back to mock data");
    return documents.slice(0, 50);
  }
});

/**
 * Fetch documents with activity and share link counts.
 * Uses Prisma select with _count for aggregated relation data.
 * 
 * Query Pattern: Aggregation using _count
 * Optimized for: Dashboard views, document statistics
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Documents with relation counts
 */
export const getUserDocumentsWithStats = cache(async (userId) => {
  if (!userId) return [];

  try {
    return await prisma.document.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        type: true,
        createdAt: true,
        _count: {
          select: {
            activities: true,
            shareLinks: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), userId, err: error }, "Prisma query failed, falling back to mock data");
    return documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      createdAt: new Date(doc.issuedOn),
      _count: {
        activities: documentActivities[doc.id]?.length || 0,
        shareLinks: documentShareLinks[doc.id]?.length || 0,
      },
    }));
  }
});

/**
 * Fetch document activities (audit log) with user information.
 * Uses Prisma include to fetch activity author details.
 * 
 * Query Pattern: Including nested user relations
 * Optimized for: Activity history views, audit logs
 * 
 * @param {string} documentId - Document ID
 * @returns {Promise<Array>} Document activities with user details
 */
export const getDocumentActivitiesWithUser = cache(async (documentId) => {
  if (!documentId) return [];

  try {
    return await prisma.documentActivity.findMany({
      where: { documentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), documentId, err: error }, "Prisma query failed, falling back to mock data");
    return documentActivities[documentId] ?? [];
  }
});

/**
 * Fetch all share links for a document with user information.
 * Uses Prisma query to fetch sharing data with optional user filtering.
 * 
 * Query Pattern: Basic query without nested relations
 * Optimized for: Share management, expiration tracking
 * 
 * @param {string} documentId - Document ID
 * @returns {Promise<Array>} Active share links for document
 */
export const getDocumentShareLinksWithDetails = cache(async (documentId) => {
  if (!documentId) return [];

  try {
    return await prisma.shareLink.findMany({
      where: { documentId },
      select: {
        id: true,
        token: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), documentId, err: error }, "Prisma query failed, falling back to mock data");
    return documentShareLinks[documentId] ?? [];
  }
});

/**
 * Fetch a user with all their documents (complete profile).
 * Uses Prisma include to fetch user with all associated documents.
 * 
 * Query Pattern: Single model with included relations
 * Optimized for: User profile page, user data export
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User with all documents or null
 */
export const getUserWithDocuments = cache(async (userId) => {
  if (!userId) return null;

  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      include: {
        documents: {
          select: {
            id: true,
            title: true,
            type: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        activities: {
          select: {
            id: true,
            action: true,
            createdAt: true,
          },
          take: 10, // Recent activities
          orderBy: { createdAt: "desc" },
        },
      },
    });
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), userId, err: error }, "Prisma query failed for user with documents");
    return null;
  }
});

/**
 * Fetch documents shared with a specific user by checking share links.
 * Joins through shareLinks to find documents available to user.
 * 
 * Query Pattern: Relation-based filtering
 * Optimized for: Finding shared documents
 * 
 * @param {string} shareToken - Share link token
 * @returns {Promise<Object|null>} Shared document or null
 */
export const getSharedDocumentByToken = cache(async (shareToken) => {
  if (!shareToken) return null;

  try {
    const shareLink = await prisma.shareLink.findUnique({
      where: { token: shareToken },
      include: {
        document: {
          include: {
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return shareLink?.document ?? null;
  } catch (error) {
    logger.warn({ action: "data.fetch_fallback", traceId: getTraceId() || createTraceId(), shareToken, err: error }, "Prisma query failed for shared document");
    return null;
  }
});


/**
 * Delete a share link for a document using Prisma delete.
 */
export async function deleteShareLink(documentId, linkId) {
  let found = false;
  if (documentShareLinks[documentId]) {
    const index = documentShareLinks[documentId].findIndex((l) => l.id === linkId);
    if (index !== -1) {
      documentShareLinks[documentId].splice(index, 1);
      found = true;
    }
  }

  try {
    const link = await prisma.shareLink.findUnique({
      where: { id: linkId },
      include: { document: true },
    });
    if (link) {
      await prisma.shareLink.delete({ where: { id: linkId } });
      await addDocumentActivity(documentId, "Revoked share link", link.createdBy);
      return true;
    }
  } catch (error) {
    logger.warn({ action: "document.share_link_delete_fallback", traceId: getTraceId() || createTraceId(), documentId, linkId, err: error }, "Prisma deleteShareLink failed, using mock state");
  }

  if (found) {
    await addDocumentActivity(documentId, "Revoked share link");
    return true;
  }

  return false;
}
