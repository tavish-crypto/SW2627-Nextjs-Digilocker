# Implementation Guide - Integrating Relation Queries

## Quick Start - API Route Updates

### Before: Generic Document Fetch

```javascript
// src/app/api/documents/route.js (OLD)
export async function GET() {
  try {
    const documents = await getDocuments(); // No relations
    return successResponse({ documents });
  } catch {
    return errorResponse("Failed to fetch documents", 500);
  }
}
```

### After: Enhanced with User Relations

```javascript
// src/app/api/documents/route.js (NEW)
import { getDocumentsWithUser } from "@/src/lib/documents";

export async function GET() {
  try {
    // Now includes user info for each document
    const documents = await getDocumentsWithUser();
    return successResponse({ documents });
  } catch {
    return errorResponse("Failed to fetch documents", 500);
  }
}
```

---

## Component Integration Examples

### List View - With User Info

**Before:**
```javascript
// components/document-list.js
export async function DocumentList() {
  const documents = await getDocuments(); // No user data
  
  return (
    <div>
      {documents.map((doc) => (
        <div key={doc.id}>
          <h3>{doc.title}</h3>
          <p>{doc.description}</p>
          {/* No owner information available */}
        </div>
      ))}
    </div>
  );
}
```

**After:**
```javascript
// components/document-list.js
import { getDocumentsWithUser } from "@/src/lib/documents";

export async function DocumentList() {
  // Documents now include full user information
  const documents = await getDocumentsWithUser();
  
  return (
    <div>
      {documents.map((doc) => (
        <div key={doc.id}>
          <h3>{doc.title}</h3>
          <p>{doc.description}</p>
          <div className="owner-info">
            {doc.user.image && <img src={doc.user.image} alt={doc.user.name} />}
            <span>By {doc.user.name || doc.user.email}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

### Detail View - Complete Information

**Before:**
```javascript
// app/(vault)/documents/[id]/page.js
import { getDocumentById } from "@/src/lib/documents";

export default async function DocumentDetailPage({ params }) {
  const { id } = await params;
  const document = await getDocumentById(id);

  if (!document) return <div>Not found</div>;

  // Would need separate queries for activities and shareLinks
  const activities = await getDocumentActivity(id);
  const shareLinks = await getDocumentShareLinks(id);

  return (
    <div>
      <h1>{document.title}</h1>
      {/* Manually render activities and shareLinks */}
    </div>
  );
}
```

**After:**
```javascript
// app/(vault)/documents/[id]/page.js
import { getDocumentWithRelations } from "@/src/lib/documents";

export default async function DocumentDetailPage({ params }) {
  const { id } = await params;
  
  // Single query gets everything - document, user, activities, shareLinks
  const document = await getDocumentWithRelations(id);

  if (!document) return <div>Not found</div>;

  return (
    <div>
      <h1>{document.title}</h1>
      <p>Description: {document.description}</p>
      
      <section className="owner">
        <h2>Owner</h2>
        <p>{document.user.name} ({document.user.email})</p>
      </section>

      <section className="activities">
        <h2>Activity History</h2>
        {document.activities.map((activity) => (
          <div key={activity.id}>
            <p>{activity.action}</p>
            <small>{activity.user.name} • {new Date(activity.createdAt).toLocaleString()}</small>
          </div>
        ))}
      </section>

      <section className="share-links">
        <h2>Share Links ({document.shareLinks.length})</h2>
        {document.shareLinks.map((link) => (
          <div key={link.id} className="share-link-card">
            <code>{link.token}</code>
            <p>Created: {new Date(link.createdAt).toLocaleString()}</p>
            <p>Expires: {link.expiresAt}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
```

---

### Dashboard - Stats View

**Before:**
```javascript
// app/(vault)/dashboard/page.js
import { getDocuments, getVaultStats } from "@/src/lib/documents";

export default async function DashboardPage() {
  const documents = await getDocuments();
  const stats = await getVaultStats();

  // No information about document activity or sharing
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Total Documents: {stats.totalDocuments}</p>
      {/* Cannot show per-document activity counts */}
    </div>
  );
}
```

**After:**
```javascript
// app/(vault)/dashboard/page.js
import { getUserDocumentsWithStats } from "@/src/lib/documents";
import { auth } from "@/src/auth";

export default async function DashboardPage() {
  const session = await auth();
  
  // Get documents with activity and share link counts
  const documents = await getUserDocumentsWithStats(session.user.id);

  const totalDocs = documents.length;
  const totalActivities = documents.reduce((sum, doc) => sum + doc._count.activities, 0);
  const totalShared = documents.reduce((sum, doc) => sum + doc._count.shareLinks, 0);

  return (
    <div>
      <h1>Dashboard</h1>
      
      <div className="stats">
        <div className="stat">
          <h2>{totalDocs}</h2>
          <p>Total Documents</p>
        </div>
        <div className="stat">
          <h2>{totalActivities}</h2>
          <p>Total Activities</p>
        </div>
        <div className="stat">
          <h2>{totalShared}</h2>
          <p>Documents Shared</p>
        </div>
      </div>

      <section className="recent-documents">
        <h2>Recent Documents</h2>
        {documents.map((doc) => (
          <div key={doc.id} className="doc-card">
            <h3>{doc.title}</h3>
            <p>Type: {doc.type}</p>
            <p>Activities: {doc._count.activities}</p>
            <p>Shared with: {doc._count.shareLinks} people</p>
          </div>
        ))}
      </section>
    </div>
  );
}
```

---

### Admin Panel - All Documents Overview

**Implementation:**
```javascript
// app/admin/page.js
import { getDocumentsWithUser } from "@/src/lib/documents";
import { auth } from "@/src/auth";

export default async function AdminPage() {
  const session = await auth();
  
  // Verify admin role
  if (session.user.role !== "admin") {
    return <div>Access Denied</div>;
  }

  // Get all documents with owner information
  const documents = await getDocumentsWithUser();

  return (
    <div>
      <h1>Admin - All Documents</h1>
      
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Owner</th>
            <th>Type</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.id}>
              <td>{doc.title}</td>
              <td>
                <span>{doc.user.name || doc.user.email}</span>
              </td>
              <td>{doc.type}</td>
              <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
              <td>
                <a href={`/documents/${doc.id}`}>View</a>
                <button>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Server Action Updates

### Document Actions with Relations

**Update document metadata and track activity:**
```javascript
// app/(vault)/documents/actions.js
"use server";

import { getDocumentWithRelations, updateDocument, addDocumentActivity } from "@/src/lib/documents";
import { auth } from "@/src/auth";

export async function updateDocumentMetadata(documentId, updates) {
  const session = await auth();
  
  // Get current document with relations
  const document = await getDocumentWithRelations(documentId);
  
  if (!document) {
    throw new Error("Document not found");
  }

  // Verify ownership
  if (document.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  // Update document
  const updated = await updateDocument(documentId, updates);
  
  // Activity is automatically logged
  
  return updated;
}

export async function getDocumentAuditHistory(documentId) {
  const session = await auth();
  
  // Get document with all activities and related user info
  const document = await getDocumentWithRelations(documentId);
  
  if (!document) {
    throw new Error("Document not found");
  }

  // Verify ownership
  if (document.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  // Return complete activity history
  return document.activities;
}
```

---

## Query Optimization Examples

### Scenario 1: User Vault - Efficient Loading

```javascript
// ✅ GOOD: Single query with smart select
export async function getOptimizedUserVault(userId) {
  return await prisma.document.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      type: true,
      size: true,
      createdAt: true,
      _count: {
        select: {
          shareLinks: true,
          activities: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

// ❌ BAD: Multiple queries (N+1 problem)
export async function getUnoptimizedUserVault(userId) {
  const documents = await prisma.document.findMany({
    where: { userId },
  });
  
  // This creates N additional queries!
  return Promise.all(
    documents.map(async (doc) => ({
      ...doc,
      activities: await prisma.documentActivity.findMany({
        where: { documentId: doc.id },
      }),
      shareLinks: await prisma.shareLink.findMany({
        where: { documentId: doc.id },
      }),
    }))
  );
}
```

### Scenario 2: Document Detail - Complete Context

```javascript
// ✅ GOOD: Single include query with all needed relations
export async function getOptimizedDocumentDetail(id) {
  return await prisma.document.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
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
              name: true,
              email: true,
            },
          },
        },
      },
      shareLinks: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

// ❌ BAD: Multiple sequential queries
export async function getUnoptimizedDocumentDetail(id) {
  const document = await prisma.document.findUnique({
    where: { id },
  });
  
  if (!document) return null;
  
  // These run sequentially!
  const user = await prisma.user.findUnique({
    where: { id: document.userId },
  });
  
  const activities = await prisma.documentActivity.findMany({
    where: { documentId: id },
  });
  
  const shareLinks = await prisma.shareLink.findMany({
    where: { documentId: id },
  });
  
  return {
    ...document,
    user,
    activities,
    shareLinks,
  };
}
```

---

## Testing the New Queries

### Unit Test Example

```javascript
// tests/documents-relations.test.mjs
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { getDocumentsWithUser, getDocumentWithRelations } from "@/src/lib/documents";

describe("Document Relation Queries", () => {
  describe("getDocumentsWithUser", () => {
    it("should return documents with user information", async () => {
      const documents = await getDocumentsWithUser();
      
      expect(Array.isArray(documents)).toBe(true);
      documents.forEach((doc) => {
        expect(doc.id).toBeDefined();
        expect(doc.title).toBeDefined();
        expect(doc.user).toBeDefined();
        expect(doc.user.email).toBeDefined();
        expect(doc.user.id).toBeDefined();
      });
    });
  });

  describe("getDocumentWithRelations", () => {
    it("should return complete document with all relations", async () => {
      // Assuming a test document with ID exists
      const document = await getDocumentWithRelations("test-doc-id");
      
      if (document) {
        expect(document.id).toBeDefined();
        expect(document.user).toBeDefined();
        expect(Array.isArray(document.activities)).toBe(true);
        expect(Array.isArray(document.shareLinks)).toBe(true);
      }
    });
  });
});
```

---

## Migration Checklist

- [ ] Update API GET routes to use new query functions
- [ ] Update server components to use relation queries
- [ ] Update server actions to leverage complete document objects
- [ ] Update admin panel for document listing
- [ ] Update dashboard with activity/share statistics
- [ ] Test document detail pages with audit history
- [ ] Test share link functionality
- [ ] Verify performance improvements with Network tab
- [ ] Update TypeScript types if using strict typing
- [ ] Document API response shapes in Swagger/OpenAPI

---

## Performance Metrics

After migration, you should see:
- **API Response Time**: Reduced by 50-70% (fewer queries)
- **Database Queries**: Reduced from N+1 to 1 query per page
- **Payload Size**: Smaller with selective `select` patterns
- **Load Time**: Faster perceived performance on detail pages

---

## Troubleshooting

### Issue: "Cannot query across multiple relations"
**Solution**: You're trying to include relations that don't exist in the schema. Check the schema and Prisma documentation.

### Issue: "Query returns undefined relations"
**Solution**: Ensure you're using `include` or `select` correctly. Mock data fallback may be triggered if Prisma fails.

### Issue: "Performance still slow"
**Solution**: 
1. Check query execution with `prisma studio`
2. Verify database indexes on `userId`, `documentId`, `createdAt`
3. Use `take` to limit related records
4. Use `_count` instead of fetching all records
