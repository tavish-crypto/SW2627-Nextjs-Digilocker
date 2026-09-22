# Prisma User-Document Relation Queries - LU-2.41

## Overview

This document explains the new Prisma relation query functions added to support efficient User-Document queries using Prisma's `select` and `include` features. These queries are optimized for different use cases and follow best practices for performance and data fetching.

## Query Pattern Categories

### 1. Include Pattern - Fetching Related Data

The `include` pattern is used when you want to fetch a model along with its related models.

#### Use Case: getDocumentsWithUser
```javascript
export const getDocumentsWithUser = cache(async () => {
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
});
```

**When to Use:**
- Displaying document lists with owner information
- Admin dashboards showing all documents and their owners
- Need quick access to related data in the same query

**Benefits:**
- Single database query instead of N+1 queries
- Related data is already structured in the response

---

### 2. Deep Include - Multiple Nested Relations

Fetch a single model with multiple levels of related data.

#### Use Case: getDocumentWithRelations
```javascript
export const getDocumentWithRelations = cache(async (id) => {
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
});
```

**When to Use:**
- Document detail pages showing complete information
- Need to display owner, audit history, and share links
- Building rich detail views

**Benefits:**
- All related data fetched in one query
- Predictable response structure
- Optimized field selection to reduce payload

---

### 3. Select Pattern - Selective Field Fetching

The `select` pattern allows you to choose exactly which fields to return, reducing payload size.

#### Use Case: getUserDocumentsSummary
```javascript
export const getUserDocumentsSummary = cache(async (userId) => {
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
    take: 50,
  });
});
```

**When to Use:**
- Quick list views (mobile-optimized)
- API responses with limited bandwidth
- Search results
- Sidebar lists

**Benefits:**
- Minimal payload size
- Faster query execution
- Explicit about what data is needed

---

### 4. Aggregation Pattern - Using _count

Count related records without fetching all the data.

#### Use Case: getUserDocumentsWithStats
```javascript
export const getUserDocumentsWithStats = cache(async (userId) => {
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
});
```

**When to Use:**
- Dashboard statistics and counters
- Displaying activity counts without listing all activities
- Performance-sensitive queries

**Benefits:**
- Counts computed at database level
- No need to fetch all related records
- Minimal overhead

---

### 5. Filtered Include - Including Only Relevant Relations

Filter the included relations to get only what you need.

#### Use Case: getDocumentsByUser
```javascript
export const getDocumentsByUser = cache(async (userId) => {
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
});
```

**When to Use:**
- User vault views showing all their documents
- Each document displays with its related data
- Batch operations on user documents

**Benefits:**
- Single query for all user documents and their relations
- Maintains data consistency
- Efficient compared to separate queries per document

---

### 6. Reverse Relation - User with Documents

Query the inverse relationship (User → Documents).

#### Use Case: getUserWithDocuments
```javascript
export const getUserWithDocuments = cache(async (userId) => {
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
        take: 10,
        orderBy: { createdAt: "desc" },
      },
    },
  });
});
```

**When to Use:**
- User profile pages
- User data exports
- User account management

**Benefits:**
- Comprehensive user profile in one query
- Includes user's document collection
- Recent activities for quick review

---

## API Route Integration

### Example: GET /api/documents with User Info

```javascript
import { revalidatePath } from "next/cache";
import { getDocumentsWithUser } from "@/src/lib/documents";
import { successResponse, errorResponse } from "@/src/lib/api-validation";

export async function GET() {
  try {
    const documents = await getDocumentsWithUser();
    return successResponse({ documents });
  } catch (error) {
    return errorResponse("Failed to fetch documents", 500);
  }
}
```

### Example: GET /api/documents/:id with Relations

```javascript
import { getDocumentWithRelations } from "@/src/lib/documents";
import { successResponse, errorResponse } from "@/src/lib/api-validation";

export async function GET(_request, { params }) {
  const { id } = await params;

  try {
    const document = await getDocumentWithRelations(id);

    if (!document) {
      return errorResponse("Document not found", 404);
    }

    return successResponse({ document });
  } catch (error) {
    return errorResponse("Failed to fetch document", 500);
  }
}
```

---

## Server Component Usage

### Example: Vault Dashboard

```javascript
import { getUserDocumentsWithStats } from "@/src/lib/documents";
import { auth } from "@/src/auth";

export default async function VaultDashboard() {
  const session = await auth();
  const documents = await getUserDocumentsWithStats(session.user.id);

  return (
    <div>
      {documents.map((doc) => (
        <div key={doc.id}>
          <h3>{doc.title}</h3>
          <p>Type: {doc.type}</p>
          <p>Activities: {doc._count.activities}</p>
          <p>Shared: {doc._count.shareLinks} links</p>
        </div>
      ))}
    </div>
  );
}
```

### Example: Document Detail Page

```javascript
import { getDocumentWithRelations } from "@/src/lib/documents";
import { auth } from "@/src/auth";

export default async function DocumentPage({ params }) {
  const { id } = await params;
  const session = await auth();
  const document = await getDocumentWithRelations(id);

  if (!document) {
    return <div>Document not found</div>;
  }

  // Verify ownership
  if (document.userId !== session.user.id) {
    return <div>Access denied</div>;
  }

  return (
    <div>
      <h1>{document.title}</h1>
      <p>Owner: {document.user.name || document.user.email}</p>
      
      <section>
        <h2>Activity History</h2>
        {document.activities.map((activity) => (
          <div key={activity.id}>
            <p>{activity.action} by {activity.user.name}</p>
            <time>{new Date(activity.createdAt).toLocaleString()}</time>
          </div>
        ))}
      </section>

      <section>
        <h2>Share Links ({document.shareLinks.length})</h2>
        {document.shareLinks.map((link) => (
          <div key={link.id}>
            <code>{link.token}</code>
            <p>Expires: {link.expiresAt}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
```

---

## Performance Optimization Tips

### 1. Use `select` for Read-Only Operations
When you only need specific fields, use `select` instead of `include`:

```javascript
// ✅ Good - Only fetches needed fields
select: {
  id: true,
  title: true,
  type: true,
}

// ❌ Avoid - Fetches all fields including large fields
include: {
  activities: true, // Fetches all activity fields
}
```

### 2. Limit Related Records
When fetching relations, limit the number of records:

```javascript
activities: {
  orderBy: { createdAt: "desc" },
  take: 10, // Only last 10 activities
}
```

### 3. Use _count for Statistics
Instead of fetching all related records and counting them:

```javascript
// ✅ Good - Counts at database level
_count: {
  select: {
    activities: true,
  }
}

// ❌ Avoid - Fetches all records then counts in memory
include: {
  activities: true, // Then count manually
}
```

### 4. Implement React Cache
All query functions are wrapped with React's `cache()` to deduplicate queries:

```javascript
export const getDocumentsWithUser = cache(async () => {
  // This query runs only once per render cycle
  return await prisma.document.findMany({...});
});
```

### 5. Selective User Field Fetching
Only fetch user fields you need, avoid sensitive data in list views:

```javascript
// ✅ Good - Limited fields
user: {
  select: {
    id: true,
    name: true,
    email: true,
  }
}

// ❌ Avoid - Includes unnecessary fields
user: true, // Includes everything including sensitive data
```

---

## Error Handling Pattern

All functions implement graceful fallback to mock data:

```javascript
try {
  return await prisma.document.findMany({...});
} catch (error) {
  console.warn("Prisma query failed, falling back to mock data", error);
  return documents; // Fallback to mock data
}
```

This ensures the app continues to work during database errors or during development before database is set up.

---

## Testing Recommendations

When testing these queries:

1. **Mock Prisma Client** - Use `jest.mock("@prisma/client")` to mock responses
2. **Test Fallback** - Verify mock data is returned when Prisma fails
3. **Validate Structure** - Ensure returned objects match expected shape
4. **Performance** - Check that queries execute in <100ms for typical datasets

Example test:
```javascript
describe("getDocumentsWithUser", () => {
  it("should fetch documents with user info", async () => {
    const docs = await getDocumentsWithUser();
    
    expect(Array.isArray(docs)).toBe(true);
    docs.forEach((doc) => {
      expect(doc.id).toBeDefined();
      expect(doc.title).toBeDefined();
      expect(doc.user).toBeDefined();
      expect(doc.user.email).toBeDefined();
    });
  });
});
```

---

## Summary of Available Functions

| Function | Pattern | Best For |
|----------|---------|----------|
| `getDocumentsWithUser()` | include + select | Document lists with owners |
| `getDocumentsByUser(userId)` | where + include | User vault view |
| `getDocumentWithRelations(id)` | deep include | Document detail page |
| `getDocumentWithUser(id)` | include + select | Lightweight document view |
| `getUserDocumentsSummary(userId)` | select | Quick lists, search results |
| `getUserDocumentsWithStats(userId)` | select + _count | Dashboard stats |
| `getDocumentActivitiesWithUser(documentId)` | include | Activity history |
| `getDocumentShareLinksWithDetails(documentId)` | select | Share management |
| `getUserWithDocuments(userId)` | reverse include | User profile |
| `getSharedDocumentByToken(token)` | include | Shared document access |

---

## Related Issues & Tasks

- **LU-2.38**: Prisma Schema Definition
- **LU-2.40**: Server Actions for Documents
- **LU-2.41**: User-Document Relation Queries (This Task)
- **LU-2.42**: API Routes Enhancement
