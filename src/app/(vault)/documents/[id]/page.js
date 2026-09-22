import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getDocumentById,
  getDocumentActivity,
  getDocumentShareLinks,
} from "@/src/lib/documents";
import { DeleteDocumentButton } from "@/src/components/delete-document-button";
import { EditDocumentForm } from "@/src/components/edit-document-form";
import { ShareLinkSection } from "@/src/components/share-link-section";
import { OptimisticDocumentProvider } from "@/src/components/optimistic-document-provider";
import { DocumentDetailsClient } from "@/src/components/document-details-client";

// This page resolves request-specific document IDs and should not reuse stale
// prerendered values after document creation or updates.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * generateMetadata - Builds document-specific, non-indexable head metadata.
 *
 * The document ID is part of the dynamic route and therefore selects the
 * corresponding statically generated ISR entry; no metadata is shared between
 * document routes.
 */
export async function generateMetadata({ params }) {
  const { id } = await params;
  const document = await getDocumentById(id);

  if (!document) {
    return {
      title: "Document Not Found",
      description: "Secure DigiLocker document not available.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return {
    title: "Document",
    description: "Private DigiLocker document stored in the authenticated vault.",
    robots: {
      index: false,
      follow: false,
    },
  };
}

/**
 * DocumentPage - Server Component for individual document display
 * 
 * Data Fetching Strategy (LU-2.25):
 * 1. Sequential: Primary document lookup requires the resolved route param `id`.
 * 2. Prerequisite boundary: If the document is missing, return not-found UI immediately
 *    without executing dependent queries with invalid/undefined IDs.
 * 3. Parallel Dependent: Once `document.id` is verified, dependent queries
 *    (audit activity logs, share links) are fetched concurrently using `Promise.all`
 *    to eliminate accidental waterfalls.
 * 4. Client Leaf Components (LU-2.18 / LU-2.20 / LU-2.28): Interactive forms
 *    use useActionState in isolated leaf components, preserving Server Component rendering.
 */
export default async function DocumentPage({ params }) {
  // Extract and await params for Next.js 16+ compatibility
  const { id } = await params;

  // 1. Primary sequential fetch: verify document existence
  const document = await getDocumentById(id);

  // 2. Handle missing document gracefully before attempting dependent queries
  if (!document) {
    notFound();
  }

  // 3. Dependent queries: execute concurrently in parallel once parent document is verified
  const [activity, shareLinks] = await Promise.all([
    getDocumentActivity(document.id),
    getDocumentShareLinks(document.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/documents"
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground/75 hover:text-foreground transition-colors"
        >
          ← Back to Documents
        </Link>

        {/* Delete Document Client Leaf Component with useActionState */}
        <DeleteDocumentButton documentId={document.id} />
      </div>

      <OptimisticDocumentProvider document={document}>
        <div className="space-y-6">
          {/* Document Details Component consuming optimistic state */}
          <DocumentDetailsClient />

          {/* Edit Metadata Form (Client Leaf Component with useActionState) */}
          <EditDocumentForm document={document} />

          {/* Expiring Share Links Section (Client Leaf Component with useActionState) */}
          <ShareLinkSection documentId={document.id} shareLinks={shareLinks} />

          {/* Audit Activity & Sharing Information */}
          {activity.length > 0 && (
            <div className="rounded-lg border border-black/10 p-6 dark:border-white/15">
              <h3 className="text-sm font-semibold mb-3">Activity & Verification</h3>
              <ul className="space-y-2 text-sm text-foreground/80">
                {activity.map((item) => (
                  <li key={item.id} className="flex justify-between items-center text-xs">
                    <span>{item.action}</span>
                    <span className="text-foreground/50">{item.timestamp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {document.fileKey && (
            <div className="flex gap-3">
              <a
                href={`/api/documents/${document.id}/download?action=view`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-foreground px-4 py-2 font-medium text-background hover:opacity-90 transition-opacity"
              >
                View Document
              </a>
              <a
                href={`/api/documents/${document.id}/download?action=download`}
                download
                className="rounded-md border border-foreground/20 px-4 py-2 font-medium hover:bg-foreground/5 transition-colors"
              >
                Download
              </a>
            </div>
          )}
        </div>
      </OptimisticDocumentProvider>
    </div>
  );


}
