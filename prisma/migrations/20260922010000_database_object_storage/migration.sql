-- Persistent database-backed object storage fallback for Vercel/serverless.
CREATE TABLE IF NOT EXISTS "StoredObject" (
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "totalChunks" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "StoredObjectChunk" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredObjectChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoredObjectChunk_objectKey_chunkIndex_key"
ON "StoredObjectChunk"("objectKey", "chunkIndex");

CREATE INDEX IF NOT EXISTS "StoredObjectChunk_objectKey_idx"
ON "StoredObjectChunk"("objectKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StoredObjectChunk_objectKey_fkey'
  ) THEN
    ALTER TABLE "StoredObjectChunk"
      ADD CONSTRAINT "StoredObjectChunk_objectKey_fkey"
      FOREIGN KEY ("objectKey") REFERENCES "StoredObject"("key")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
