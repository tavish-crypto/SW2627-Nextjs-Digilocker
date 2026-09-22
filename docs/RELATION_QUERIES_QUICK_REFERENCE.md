# Relation Queries Quick Reference - LU-2.41

## Import All Queries

```javascript
import {
  getDocumentsWithUser,
  getDocumentsByUser,
  getDocumentWithRelations,
  getDocumentWithUser,
  getUserDocumentsSummary,
  getUserDocumentsWithStats,
  getDocumentActivitiesWithUser,
  getDocumentShareLinksWithDetails,
  getUserWithDocuments,
  getSharedDocumentByToken,
} from "@/src/lib/documents";
```

---

## Query Cheat Sheet

### For Lists
```javascript
// Full list with owner
const docs = await getDocumentsWithUser();
// Result: [{ id, title, user: { id, email, name, image }, ... }]

// Lightweight list
const docs = await getUserDocumentsSummary(userId);
// Result: [{ id, title, type, size, createdAt }]

// List with stats
const docs = await getUserDocumentsWithStats(userId);
// Result: [{ id, title, type, createdAt, _count: { activities, shareLinks } }]
```

### For User-Specific Views
```javascript
// User's documents with relations
const docs = await getDocumentsByUser(userId);
// Result: [{ id, title, user, activities, shareLinks }]

// Complete user profile
const user = await getUserWithDocuments(userId);
// Result: { id, email, name, documents: [...], activities: [...] }
```

### For Detail Pages
```javascript
// Document with everything
const doc = await getDocumentWithRelations(id);
// Result: { id, title, user, activities: [{ user, ... }], shareLinks }

// Document with just owner
const doc = await getDocumentWithUser(id);
// Result: { id, title, user: { id, email, name } }
```

### For Activity Tracking
```javascript
// Activities with actor info
const activities = await getDocumentActivitiesWithUser(documentId);
// Result: [{ id, action, description, createdAt, user: { name, email } }]
```

### For Share Management
```javascript
// All share links for document
const links = await getDocumentShareLinksWithDetails(documentId);
// Result: [{ id, token, createdAt, expiresAt }]

// Access shared document
const doc = await getSharedDocumentByToken(shareToken);
// Result: { id, title, user, ... }
```

---

## Query Patterns Explained

### Pattern 1: Include (Fetch Relations)
```javascript
// Use include when you want related data
include: {
  user: { select: { id: true, name: true } },
  activities: { take: 10 },
}
```
**When**: You need related objects in the response

### Pattern 2: Select (Specific Fields)
```javascript
// Use select for exact fields needed
select: {
  id: true,
  title: true,
  type: true,
  user: { select: { name: true } },
}
```
**When**: You want to reduce payload size

### Pattern 3: _count (Aggregation)
```javascript
// Use _count for relation counts
_count: {
  select: {
    activities: true,
    shareLinks: true,
  }
}
```
**When**: You need counts, not actual records

### Pattern 4: Where + OrderBy (Filtering/Sorting)
```javascript
where: { userId },
orderBy: { createdAt: "desc" },
take: 50,
```
**When**: You need filtered, sorted results

---

## Common Use Cases

### Display List of Documents with Owners
```javascript
const documents = await getDocumentsWithUser();
documents.forEach(doc => {
  console.log(`${doc.title} by ${doc.user.name}`);
});
```

### Show User's Vault with Stats
```javascript
const documents = await getUserDocumentsWithStats(userId);
documents.forEach(doc => {
  console.log(`${doc.title} - ${doc._count.activities} activities`);
});
```

### Build Document Detail Page
```javascript
const document = await getDocumentWithRelations(id);
// Access: document.title, document.user, document.activities, document.shareLinks
```

### Quick Mobile-Optimized List
```javascript
const documents = await getUserDocumentsSummary(userId);
// Minimal payload: id, title, type, size, createdAt only
```

### Access Shared Document
```javascript
const document = await getSharedDocumentByToken(shareToken);
// Verify expiresAt hasn't passed
// Access document metadata and owner info
```

---

## Response Shape Reference

### getDocumentsWithUser()
```javascript
[
  {
    id: "doc-1",
    title: "My Document",
    description: "...",
    type: "PDF",
    size: "2.1 MB",
    issuedOn: "January 15, 2026",
    userId: "user-1",
    createdAt: "2026-01-15T10:30:00Z",
    updatedAt: "2026-01-15T10:30:00Z",
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "John Doe",
      image: "https://..."
    }
  }
]
```

### getDocumentWithRelations(id)
```javascript
{
  id: "doc-1",
  title: "My Document",
  description: "...",
  type: "PDF",
  size: "2.1 MB",
  issuedOn: "January 15, 2026",
  userId: "user-1",
  createdAt: "2026-01-15T10:30:00Z",
  updatedAt: "2026-01-15T10:30:00Z",
  user: {
    id: "user-1",
    email: "user@example.com",
    name: "John Doe",
    image: "https://..."
  },
  activities: [
    {
      id: "act-1",
      action: "Uploaded to vault",
      description: null,
      createdAt: "2026-01-15T10:30:00Z",
      user: {
        email: "user@example.com",
        name: "John Doe"
      }
    }
  ],
  shareLinks: [
    {
      id: "link-1",
      token: "share-abc123",
      createdAt: "2026-01-15T10:35:00Z",
      expiresAt: "2026-01-16T10:35:00Z"
    }
  ]
}
```

### getUserDocumentsWithStats(userId)
```javascript
[
  {
    id: "doc-1",
    title: "My Document",
    type: "PDF",
    createdAt: "2026-01-15T10:30:00Z",
    _count: {
      activities: 5,
      shareLinks: 2
    }
  }
]
```

### getUserDocumentsSummary(userId)
```javascript
[
  {
    id: "doc-1",
    title: "My Document",
    type: "PDF",
    size: "2.1 MB",
    createdAt: "2026-01-15T10:30:00Z"
  }
]
```

---

## Performance Tips

1. **Use `_count` instead of fetching all records**
   ```javascript
   // ✅ Good
   _count: { select: { activities: true } }
   
   // ❌ Avoid
   activities: true
   ```

2. **Limit related records with `take`**
   ```javascript
   // ✅ Good
   activities: { take: 10 }
   
   // ❌ Avoid
   activities: true // Fetches all
   ```

3. **Use `select` for read-only views**
   ```javascript
   // ✅ Good
   select: { id: true, title: true, type: true }
   
   // ❌ Avoid
   // No select (fetches all fields)
   ```

4. **Combine filters efficiently**
   ```javascript
   // ✅ Good - Single query
   const docs = await getDocumentsByUser(userId);
   
   // ❌ Avoid - Multiple queries
   const docs = await getDocuments();
   const userDocs = docs.filter(d => d.userId === userId);
   ```

---

## Testing Each Query

```javascript
// Test each query returns expected structure
describe("Relation Queries", () => {
  it("getDocumentsWithUser includes user data", async () => {
    const docs = await getDocumentsWithUser();
    expect(docs[0]).toHaveProperty("user.email");
  });

  it("getDocumentWithRelations includes activities", async () => {
    const doc = await getDocumentWithRelations("test-id");
    expect(Array.isArray(doc.activities)).toBe(true);
  });

  it("getUserDocumentsWithStats includes counts", async () => {
    const docs = await getUserDocumentsWithStats("user-id");
    expect(docs[0]).toHaveProperty("_count.activities");
  });
});
```

---

## Error Handling

All queries gracefully fallback to mock data on error:

```javascript
try {
  const docs = await getDocumentsWithUser();
} catch (error) {
  // Falls back to mock documents array automatically
  console.warn("Database error, using mock data");
}
```

No need for additional error handling - queries return safe fallback data.

---

## Related Documentation

- [Full Documentation](./PRISMA_RELATION_QUERIES.md)
- [Implementation Guide](./RELATION_QUERIES_IMPLEMENTATION.md)
- [Prisma Schema](./PRISMA_SCHEMA.md)
- [Prisma Docs](https://www.prisma.io/docs/)

---

## Function Quick Index

| Function Name | Parameters | Returns | Use Case |
|---|---|---|---|
| `getDocumentsWithUser()` | None | Array[Document with User] | All docs with owners |
| `getDocumentsByUser(userId)` | string | Array[Document with Relations] | User's vault |
| `getDocumentWithRelations(id)` | string | Document with All Relations | Detail page |
| `getDocumentWithUser(id)` | string | Document with User | Simple detail |
| `getUserDocumentsSummary(userId)` | string | Array[Document Summary] | Quick lists |
| `getUserDocumentsWithStats(userId)` | string | Array[Document with Counts] | Dashboard |
| `getDocumentActivitiesWithUser(docId)` | string | Array[Activity with User] | Audit logs |
| `getDocumentShareLinksWithDetails(docId)` | string | Array[ShareLink] | Share management |
| `getUserWithDocuments(userId)` | string | User with Documents | User profile |
| `getSharedDocumentByToken(token)` | string | Document or null | Shared access |
