DigiLocker Secure Document Vault

1. Product Overview

1.1 Product Name

DigiLocker Secure Document Vault

1.2 Product Type

Web-based secure document storage and sharing application.

1.3 Product Goal

Build a simple, fast document vault that allows users to:

Upload documents directly to cloud storage.

Reject unsupported files and files larger than 10 MB before upload.

Browse documents using infinite scroll.

Generate secure, expiring links to share documents.

The product is based on the provided DigiLocker PRD, which identifies
direct-to-cloud uploads, strict pre-flight validation, infinite-scroll
browsing, and expiring secure sharing as the core requirements.

2. Problem Statement

Users need a convenient way to store and share important documents
without sending large files through the application server.

The system must solve four main problems:

Slow and inefficient uploads caused by routing file data through
application servers.

Invalid uploads caused by unsupported file formats or files
larger than 10 MB.

Poor document browsing when many documents need to be displayed.

Unsafe document sharing when permanent or uncontrolled links are
used.

The solution is a document vault where files are uploaded directly from
the browser to cloud storage using temporary pre-signed URLs, documents
are displayed using infinite scrolling, and users can create links that
automatically expire.

3. Target Users

3.1 Document Owner

A citizen who stores and manages personal documents.

Needs:

Fast uploads.

Easy document retrieval.

Search and filtering.

Simple sharing controls.

Temporary sharing links.

3.2 Document Verifier

A third party such as an employer, bank, university, or HR officer.

Needs:

Quick access to a shared document.

Confidence that the link is valid.

Clear expiration information.

Secure document viewing.

The original PRD identifies the citizen/vault owner and third-party
verifier as the primary product personas.

4. Scope

4.1 In Scope

The initial product will contain:

Document vault dashboard.

Document upload.

Client-side file validation.

Direct cloud upload using pre-signed URLs.

Document listing.

Infinite scroll.

Search and category filtering.

Document metadata display.

Expiring share links.

Shared document viewing.

Basic link expiration handling.

4.2 Out of Scope

The initial version will not include:

Native mobile applications.

Offline document caching.

Multi-party e-Sign workflows.

AI OCR and automatic field extraction.

Zero-Knowledge Proof selective sharing.

These are consistent with the source PRD's initial-release scope and
future roadmap.

5. Core Features

5.1 Document Vault

The dashboard is the main screen of the application.

Users can:

View uploaded documents.

Search documents.

Filter documents by category.

Open a document.

Share a document.

See file size and upload date.

Categories

The interface will support:

All

Identity

Education

Tax & Finance

Medical

Document Card

Each document card should display:

Document name.

File type.

File size.

Upload date.

Share action.

Open/view action.

The source PRD also specifies a metadata inspector for S3 object key,
SHA-256 digest, file size, upload timestamp, and issuing authority.

5.2 Infinite Scroll

Documents should not all be loaded at once.

The frontend will load documents in batches as the user approaches the
bottom of the page.

Flow

Open Vault
    ↓
Load first batch
    ↓
Display documents
    ↓
User scrolls
    ↓
IntersectionObserver detects near-bottom
    ↓
Request next batch
    ↓
Append documents
    ↓
Continue until no documents remain

The source PRD specifically requires dynamic batches and
IntersectionObserver-based loading.

5.3 Document Search

Users can search across:

Document title.

Issuer name.

Metadata tags.

Search results should update without requiring a full page reload.

5.4 File Upload

Users can upload documents through a drag-and-drop area or file picker.

Supported formats

PDF
JPG
JPEG
PNG
WEBP
DOCX
XML
JSON

Maximum size

10 MB per file

Files exceeding the limit must be rejected before a server upload
request is made.

Unsupported file types must also be rejected.

5.5 Direct Cloud Upload

The application must avoid sending the actual file binary through the
Node.js API server.

Upload flow

Browser
   │
   ├── Validate file
   │      ├── Size <= 10 MB
   │      └── Allowed type
   │
   ↓
POST /api/upload/presign
   │
   ↓
Backend
   │
   └── Generate temporary pre-signed URL
             │
             ↓
Browser ───────────────→ Cloud Storage
                         Direct file upload
                              │
                              ↓
                         Upload complete
                              │
                              ↓
Browser → POST /api/upload/complete
                              │
                              ↓
                         Save metadata

The provided PRD specifies that the pre-signed URL is temporary and
valid for 15 minutes.

5.6 Upload Validation

Validation happens before requesting the upload URL.

Validation rules

IF file.size > 10 MB
    Reject file

IF file.type is not allowed
    Reject file

ELSE
    Continue upload

The user should immediately see a clear error message such as:

File is larger than the 10 MB limit.

or:

This file type is not supported.

The original PRD requires immediate UI feedback without making a server
network request for invalid files.

5.7 Expiring Share Links

A user can create a temporary link for any document.

Expiration options

10 minutes.

1 hour.

24 hours.

Example

Document:
Aadhaar Card.pdf

Share Link:
https://example.com/share/abc123

Expires:
10 minutes

When the expiration time is reached, the link becomes invalid
automatically.

5.8 Shared Document Page

When a recipient opens a share link, the system should:

Check whether the link exists.

Check whether it has expired.

Allow access if the link is valid.

Display the shared document.

Display the remaining validity time.

If the link has expired:

This sharing link has expired.
Please request a new link from the document owner.

6. Optional Security Controls

The source PRD defines additional sharing controls that can be
implemented in the initial or extended version.

PIN Protection

The owner can optionally require a 4-digit PIN before the recipient can
access the document.

View Limits

Possible limits:

1 view.

3 views.

5 views.

Watermark

A shared document preview can display:

VERIFIED BY DIGILOCKER - FOR OFFICIAL USE ONLY

These controls should be treated as extensions of the basic
expiring-link feature.

7. User Interface

The application should use a clean, modern document-vault interface.

Visual Direction

Minimal layout.

Light background.

Purple/violet primary accent.

Rounded cards.

Subtle gradients.

Clear document-type icons.

Simple navigation.

Responsive desktop and mobile layouts.

Main Dashboard

┌──────────────────────────────────────────────────────────┐
│ DigiLocker Vault                         + Upload         │
│                                                          │
│ My Documents                                             │
│ Store and manage your important documents.               │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Search documents...                                  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ All   Identity   Education   Finance   Medical           │
│                                                          │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│ │ PDF        │ │ DOCX       │ │ JPG        │             │
│ │ Aadhaar    │ │ Degree     │ │ PAN Card   │             │
│ │ 2.1 MB     │ │ 1.4 MB     │ │ 820 KB     │             │
│ │ Share      │ │ Share      │ │ Share      │             │
│ └────────────┘ └────────────┘ └────────────┘             │
│                                                          │
│                     Load more...                         │
└──────────────────────────────────────────────────────────┘

Upload Interface

The upload modal should contain:

Drag-and-drop area.

Browse button.

Supported format information.

10 MB limit.

Upload progress.

Success/error state.

Share Interface

The share modal should contain:

Document name.

Expiration selector.

Create link button.

Generated link.

Copy button.

8. Data Model

The initial application can use two primary entities.

Document

Document
├── id
├── userId
├── name
├── cloudUrl
├── cloudKey
├── size
├── mimeType
└── uploadedAt

Optional metadata:

├── category
├── issuer
└── sha256

ShareLink

ShareLink
├── id
├── documentId
├── token
├── expiresAt
└── createdAt

If PIN protection and view limits are implemented:

├── pinHash
├── maxViews
└── currentViews

9. API Requirements

Documents

GET /api/documents
GET /api/documents/:id
DELETE /api/documents/:id

Upload

POST /api/upload/presign
POST /api/upload/complete

Sharing

POST /api/share/:documentId
GET /api/share/:token
DELETE /api/share/:token

Pagination

The document endpoint should support cursor-based pagination.

Example:

GET /api/documents?cursor=abc123&limit=10

Response:

{
  "documents": [],
  "nextCursor": "xyz789",
  "hasMore": true
}

10. Recommended Project Structure

digilocker-vault/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── DocumentCard.jsx
│   │   │   ├── UploadModal.jsx
│   │   │   ├── ShareModal.jsx
│   │   │   └── Loader.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   └── SharedDocument.jsx
│   │   │
│   │   ├── services/
│   │   │   └── api.js
│   │   │
│   │   ├── utils/
│   │   │   └── fileValidation.js
│   │   │
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── documentController.js
│   │   │   ├── uploadController.js
│   │   │   └── shareController.js
│   │   │
│   │   ├── routes/
│   │   │   ├── documentRoutes.js
│   │   │   ├── uploadRoutes.js
│   │   │   └── shareRoutes.js
│   │   │
│   │   ├── models/
│   │   │   ├── Document.js
│   │   │   └── ShareLink.js
│   │   │
│   │   ├── services/
│   │   │   └── s3Service.js
│   │   │
│   │   ├── middleware/
│   │   │   └── errorHandler.js
│   │   │
│   │   ├── app.js
│   │   └── server.js
│   │
│   └── .env
│
├── docs/
│   ├── PRD.md
│   ├── HLD.md
│   ├── LLD.md
│   └── API.md
│
├── README.md
├── package.json
└── .gitignore

11. Success Criteria

The project will be considered successful when:

Users can upload supported documents.

Files larger than 10 MB are rejected before upload.

Unsupported file types are rejected before upload.

File binaries are uploaded directly to cloud storage through
pre-signed URLs.

Users can view documents in the vault.

Documents load progressively using infinite scroll.

Users can search and filter documents.

Users can create expiring share links.

Expired links cannot be used to access documents.

The application provides clear success and error feedback.

12. Performance and Security Goals

The implementation should follow the source PRD's major targets:

More than 95% of uploads should use pre-signed cloud URLs.

Invalid/oversized uploads should be handled client-side.

Share-link expiration should be automatically enforced.

Document pagination should target less than 400 ms per scroll batch.

The default storage quota is 100 MB per verified account.

Cloud storage should use encryption at rest.

API and cloud transfers should use TLS.

SHA-256 can be used for document integrity verification.

13. Future Enhancements

Potential future versions can add:

AI-based OCR.

Automatic document field extraction.

Selective field sharing using Zero-Knowledge Proofs.

Multi-party e-Sign workflows.

Native mobile applications.

Advanced audit history.

These features are intentionally not required for the initial
implementation.

14. Final Product Definition

DigiLocker Secure Document Vault is a focused document-management
application built around three core capabilities:

        UPLOAD
           │
           ↓
    Direct Cloud Storage
           │
           ↓
        MY VAULT
           │
      ┌────┴────┐
      ↓         ↓
  INFINITE    SHARE
   SCROLL       │
                ↓
          EXPIRING LINK
                │
                ↓
          SHARED DOCUMENT

The product prioritizes fast uploads, simple document management, and
controlled temporary sharing without introducing unnecessary features
into the initial release.