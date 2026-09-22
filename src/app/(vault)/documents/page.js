import { Suspense } from "react";
import { cookies } from "next/headers";
import {
  getPaginatedDocuments,
  normalizeDocumentQuery,
  normalizePaginationQuery,
} from "@/src/lib/documents";
import { DocumentList } from "@/src/components/document-list";
import { DocumentGridSkeleton, VaultHeaderSkeleton } from "@/src/components/skeletons";
import { UploadDocumentForm } from "@/src/components/upload-document-form";
import { OptimisticVaultProvider } from "@/src/components/optimistic-vault-provider";

/**
 * DocumentsPage - Server Component
 * 
 * Main vault page that displays documents with Suspense boundaries
 * for better loading state handling and progressive enhancement.
 * 
 * DYNAMIC RENDERING: This page is configured to render fresh content on every request
 * rather than being statically generated. This demonstrates request-specific server
 * rendering in the Next.js App Router.
 * 
 * Optimized to fetch all independent data in parallel using Promise.all
 * for better performance.
 */

// Force dynamic rendering for this route - fresh render on every request
export const dynamic = "force-dynamic";

export default async function DocumentsPage({ searchParams }) {
  const params = await searchParams;
  const query = {
    ...normalizeDocumentQuery(params),
    ...normalizePaginationQuery(params),
  };
  // Fetch server-specific request data and documents in parallel
  const { documents, userId, renderedAt, pagination } = await fetchVaultData(query);
  
  return (
    <section className="vault-shell space-y-6 pt-3">
      <Suspense fallback={<VaultHeaderSkeleton />}>
        <VaultHeader documents={documents} userId={userId} renderedAt={renderedAt} pagination={pagination} />
      </Suspense>

      <OptimisticVaultProvider documents={documents}>
        {/* Upload Document Form with Server Action (Client Component Leaf with useActionState) */}
        <div className="panel accent-panel p-6">
          <h2 className="text-lg font-semibold mb-1 text-[#004b87]">Upload Document to Vault</h2>
          <p className="text-sm text-foreground/75 mb-4">
            Add a new verified document to your secure vault via direct Server Action mutation.
          </p>
          <UploadDocumentForm />
        </div>

        <Suspense fallback={<DocumentGridSkeleton count={6} />}>
          <VaultDocuments documents={documents} userId={userId} renderedAt={renderedAt} query={query} pagination={pagination} />
        </Suspense>
      </OptimisticVaultProvider>
    </section>
  );
}

/**
 * VaultHeader - Server Component
 * 
 * Displays the vault header with title and document count.
 * Receives request-specific data (userId, renderedAt) to demonstrate dynamic rendering.
 */
function VaultHeader({ documents, userId, renderedAt, pagination }) {
  const totalDocuments = pagination?.total ?? documents.length;
  return (
    <div className="space-y-2">
      <p className="eyebrow">My documents</p>
      <h1 className="text-3xl font-semibold tracking-tight">My DigiLocker Vault</h1>
      <p className="text-foreground/75">
        You have {totalDocuments} document{totalDocuments !== 1 ? "s" : ""} securely stored.
      </p>
      <div className="mt-3 pt-3 border-t border-foreground/10 text-xs text-foreground/60">
        <p>User: <span className="font-mono font-medium text-foreground/70">{userId}</span></p>
        <p>Rendered at: <span className="font-mono font-medium text-foreground/70">{renderedAt}</span></p>
      </div>
    </div>
  );
}

/**
 * VaultDocuments - Server Component
 * 
 * Displays the list of vault documents.
 * Passes server-specific request data to DocumentList for display to the client.
 */
function VaultDocuments({ documents, userId, renderedAt, query, pagination }) {
  return <DocumentList documents={documents} userId={userId} renderedAt={renderedAt} query={query} pagination={pagination} />;
}

/**
 * fetchVaultData - Fetch all vault data including server-specific request values
 * 
 * Uses Promise.all to fetch independent operations concurrently:
 * - cookies(): Read incoming request headers/cookies
 * - getDocuments(): Retrieve vault documents
 * 
 * Concurrently captures request-specific values that prove dynamic rendering.
 */
async function fetchVaultData(query) {
  // Start independent queries and request data concurrently in parallel
  const [cookieStore, pageResult] = await Promise.all([
    cookies(),
    getPaginatedDocuments({
      userId: "demo-user",
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      type: query.type,
      sort: query.sort,
    }),
  ]);
  const documents = pageResult.items;
  const pagination = pageResult.meta;
  
  const userId = cookieStore.get("demo-user")?.value || "demo-user";
  const renderedAt = new Date().toISOString();

  return { documents, userId, renderedAt, pagination };
}

