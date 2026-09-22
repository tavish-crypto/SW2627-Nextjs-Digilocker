# Prisma Schema for DigiLocker - LU-2.38

This document describes the Prisma database schema for the DigiLocker Vault application.

## Overview

The Prisma schema defines four main models for managing users, documents, document activities, and share links. It uses SQLite for local development and can be easily migrated to other databases (PostgreSQL, MySQL, etc.) by changing the datasource provider.

## Database Models

### 1. User Model

Represents application users who can authenticate and manage documents.

**Fields:**
- `id`: Unique identifier (CUID)
- `email`: User email address (unique)
- `name`: User display name (optional)
- `passwordHash`: Bcrypt-hashed password for local authentication (optional)
- `provider`: OAuth provider name (e.g., "google") for OAuth authentication (optional)
- `image`: Profile image URL for OAuth providers (optional)
- `createdAt`: Timestamp when user was created
- `updatedAt`: Timestamp when user was last updated

**Relationships:**
- `documents`: One-to-many relationship with Document model
- `shareLinks`: One-to-many relationship with ShareLink model
- `activities`: One-to-many relationship with DocumentActivity model

### 2. Document Model

Represents files uploaded to the vault.

**Fields:**
- `id`: Unique identifier (CUID)
- `title`: Document title
- `description`: Document description (default: "")
- `type`: File type (PDF, DOCX, JPG, etc.)
- `size`: Human-readable file size (e.g., "2.1 MB")
- `issuedOn`: Issue date or upload date string
- `fileKey`: S3/cloud storage object key (optional)
- `fileUrl`: URL to the file (optional)
- `mimeType`: MIME type of the file (default: "application/octet-stream")
- `fileSizeBytes`: File size in bytes (optional)
- `fileHash`: SHA-256 hash for integrity verification (optional)
- `userId`: Foreign key to User model
- `createdAt`: Timestamp when document was created
- `updatedAt`: Timestamp when document was last updated

**Relationships:**
- `user`: Many-to-one relationship with User model
- `activities`: One-to-many relationship with DocumentActivity model
- `shareLinks`: One-to-many relationship with ShareLink model

**Indexes:**
- On `userId` for efficient lookups by user
- On `createdAt` for sorting and filtering

### 3. DocumentActivity Model

Audit log for tracking actions performed on documents.

**Fields:**
- `id`: Unique identifier (CUID)
- `action`: Activity type (e.g., "Uploaded", "Shared", "Verified")
- `description`: Additional details about the activity (optional)
- `documentId`: Foreign key to Document model
- `userId`: Foreign key to User model
- `createdAt`: Timestamp when activity occurred

**Relationships:**
- `document`: Many-to-one relationship with Document model
- `user`: Many-to-one relationship with User model

**Indexes:**
- On `documentId` for filtering activities by document
- On `userId` for filtering activities by user
- On `createdAt` for sorting activities chronologically

### 4. ShareLink Model

Represents expiring share links for document sharing.

**Fields:**
- `id`: Unique identifier (CUID)
- `token`: Unique share link token (unique)
- `expiresAt`: Link expiration timestamp (optional for permanent links)
- `active`: Whether the link is currently active
- `maxAccess`: Maximum number of accesses (-1 for unlimited)
- `accessCount`: Current number of times the link was accessed
- `documentId`: Foreign key to Document model
- `createdBy`: Foreign key to User model (who created the link)
- `createdAt`: Timestamp when link was created
- `updatedAt`: Timestamp when link was last updated

**Relationships:**
- `document`: Many-to-one relationship with Document model
- `createdByUser`: Many-to-one relationship with User model

**Indexes:**
- On `documentId` for finding all shares for a document
- On `token` for fast lookup of share link validation
- On `expiresAt` for finding expired links

## Database Configuration

**Datasource:** SQLite (file-based)
**Environment Variable:** `DATABASE_URL`
**Default Location:** `./prisma/dev.db`

## Cascade Deletes

- When a User is deleted, all related documents, activities, and share links are automatically deleted
- When a Document is deleted, all related activities and share links are automatically deleted

## Next Steps

### 1. Generate Prisma Client
```bash
npx prisma generate
```

### 2. Push Schema to Database
```bash
npx prisma db push
```

### 3. Open Prisma Studio (Interactive Browser)
```bash
npx prisma studio
```

### 4. Integrate with Application

#### Using the Prisma Client in your code:

```javascript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create a new user
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe',
    passwordHash: 'hashed_password_here',
  },
});

// Create a document
const document = await prisma.document.create({
  data: {
    title: 'My Document',
    description: 'A test document',
    userId: user.id,
    type: 'PDF',
    size: '2.1 MB',
  },
});

// Query documents for a user
const userDocuments = await prisma.document.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: 'desc' },
});

// Update a document
const updated = await prisma.document.update({
  where: { id: document.id },
  data: { title: 'Updated Title' },
});

// Create a share link
const shareLink = await prisma.shareLink.create({
  data: {
    token: 'unique-share-token',
    documentId: document.id,
    createdBy: user.id,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  },
});
```

## Migration for Production

To use a different database in production (e.g., PostgreSQL):

1. Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Run migration:
```bash
npx prisma migrate deploy
```

## Performance Considerations

- **Indexes:** The schema includes indexes on frequently queried fields (userId, documentId, token, createdAt, expiresAt)
- **Cascade Deletes:** Implement careful deletion policies to avoid data loss
- **Activity Logging:** Consider archiving old activities to manage database size

## Security Notes

- Store passwords using bcrypt (minimum 12 rounds)
- Validate file hashes for integrity verification
- Use short expiration times for share links
- Implement rate limiting on share link access
- Store file contents in external storage (S3) with secure keys

## Files Generated

- `prisma/schema.prisma` - Database schema definition
- `src/lib/prisma.ts` - Global Prisma Client singleton
- `.env` - Environment configuration with DATABASE_URL
- `prisma/dev.db` - SQLite database file (auto-created)

## Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Next.js Prisma Guide](https://www.prisma.io/docs/getting-started/quickstart)
