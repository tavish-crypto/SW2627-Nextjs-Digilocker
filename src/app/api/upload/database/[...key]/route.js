import crypto from "node:crypto";
import prisma from "../../../../../lib/prisma.js";
import {
  sanitizeStorageKey,
  verifyDatabaseSignedUrl,
} from "../../../../../lib/cloud-storage.js";
import { logger } from "../../../../../lib/logger.js";

const MAX_CHUNK_BYTES = 2 * 1024 * 1024; // 2 MiB, comfortably below serverless limits
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function objectKeyFromParams(params) {
  const raw = Array.isArray(params?.key) ? params.key.join("/") : params?.key || "";
  return sanitizeStorageKey(raw);
}

async function ensureStorageTables() {
  // Makes the fallback self-healing even if the latest migration was not applied yet.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StoredObject" (
      "key" TEXT PRIMARY KEY,
      "contentType" TEXT NOT NULL DEFAULT 'application/octet-stream',
      "size" INTEGER NOT NULL DEFAULT 0,
      "totalChunks" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StoredObjectChunk" (
      "id" TEXT PRIMARY KEY,
      "objectKey" TEXT NOT NULL,
      "chunkIndex" INTEGER NOT NULL,
      "data" BYTEA NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "StoredObjectChunk_objectKey_chunkIndex_key"
    ON "StoredObjectChunk"("objectKey", "chunkIndex")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StoredObjectChunk_objectKey_idx"
    ON "StoredObjectChunk"("objectKey")
  `);
}

function validateSignedRequest(request, key, requiredMethod) {
  const verification = verifyDatabaseSignedUrl(request.url);
  if (!verification.valid) return verification;
  if (verification.objectKey !== key) {
    return { valid: false, error: "Storage key does not match signed URL" };
  }
  if (verification.method !== requiredMethod) {
    return { valid: false, error: `Signed URL is not valid for ${requiredMethod}` };
  }
  return verification;
}

export async function PUT(request, { params }) {
  try {
    const resolved = await params;
    const key = objectKeyFromParams(resolved);
    const verified = validateSignedRequest(request, key, "PUT");
    if (!verified.valid) {
      return Response.json({ error: verified.error }, { status: 403 });
    }

    const url = new URL(request.url);
    const chunkIndex = Number.parseInt(url.searchParams.get("chunkIndex") || "0", 10);
    const totalChunks = Number.parseInt(url.searchParams.get("totalChunks") || "1", 10);
    const totalSize = Number.parseInt(url.searchParams.get("fileSize") || "0", 10);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0 ||
        !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 20 ||
        !Number.isInteger(totalSize) || totalSize < 1 || totalSize > MAX_FILE_BYTES) {
      return Response.json({ error: "Invalid upload chunk metadata" }, { status: 400 });
    }

    const body = Buffer.from(await request.arrayBuffer());
    if (body.byteLength === 0 || body.byteLength > MAX_CHUNK_BYTES) {
      return Response.json({ error: "Chunk must be between 1 byte and 2 MiB" }, { status: 413 });
    }

    await ensureStorageTables();
    const contentType = request.headers.get("content-type") || verified.contentType || "application/octet-stream";

    await prisma.storedObject.upsert({
      where: { key },
      update: { contentType, size: totalSize, totalChunks },
      create: { key, contentType, size: totalSize, totalChunks },
    });

    await prisma.storedObjectChunk.upsert({
      where: { objectKey_chunkIndex: { objectKey: key, chunkIndex } },
      update: { data: body },
      create: {
        id: crypto.randomUUID(),
        objectKey: key,
        chunkIndex,
        data: body,
      },
    });

    return Response.json({ ok: true, chunkIndex, totalChunks }, { status: 200 });
  } catch (error) {
    logger.error({ action: "database_storage.upload_failed", err: error }, "Database storage upload failed");
    return Response.json({ error: "Unable to persist upload" }, { status: 500 });
  }
}

export async function GET(request, { params }) {
  try {
    const resolved = await params;
    const key = objectKeyFromParams(resolved);
    const verified = validateSignedRequest(request, key, "GET");
    if (!verified.valid) {
      return Response.json({ error: verified.error }, { status: 403 });
    }

    await ensureStorageTables();
    const object = await prisma.storedObject.findUnique({
      where: { key },
      include: { chunks: { orderBy: { chunkIndex: "asc" } } },
    });
    if (!object || object.chunks.length !== object.totalChunks) {
      return new Response("File not found or upload incomplete", { status: 404 });
    }

    const body = Buffer.concat(object.chunks.map((chunk) => Buffer.from(chunk.data)));
    const disposition = verified.disposition || "inline";
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": object.contentType || verified.contentType || "application/octet-stream",
        "Content-Length": String(body.byteLength),
        "Content-Disposition": disposition,
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    logger.error({ action: "database_storage.download_failed", err: error }, "Database storage download failed");
    return new Response("Unable to retrieve file", { status: 500 });
  }
}

export async function HEAD(request, { params }) {
  try {
    const resolved = await params;
    const key = objectKeyFromParams(resolved);
    const verified = validateSignedRequest(request, key, "GET");
    if (!verified.valid) return new Response(null, { status: 403 });

    await ensureStorageTables();
    const object = await prisma.storedObject.findUnique({ where: { key } });
    if (!object) return new Response(null, { status: 404 });
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": object.contentType,
        "Content-Length": String(object.size),
      },
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}
