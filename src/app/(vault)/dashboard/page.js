import { Suspense } from "react";
import { getDocuments, getVaultStats } from "@/src/lib/documents";
import { OptimisticVaultProvider } from "@/src/components/optimistic-vault-provider";
import { DocumentList } from "@/src/components/document-list";
import { DocumentGridSkeleton, VaultHeaderSkeleton } from "@/src/components/skeletons";

export const dynamic = "force-dynamic";

/**
 * Dashboard - Server Component
 * 
 * Main dashboard page that displays vault overview and recent documents.
 * Uses Suspense boundaries for progressive rendering and independent streaming.
 */
export default async function Dashboard() {
  return (
    <section className="space-y-6">
      <Suspense fallback={<VaultHeaderSkeleton />}>
        <DashboardHeader />
      </Suspense>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Recent Documents</h2>
        <Suspense fallback={<DocumentGridSkeleton count={6} />}>
          <RecentDocuments />
        </Suspense>
      </div>
    </section>
  );
}

/**
 * DashboardHeader - Server Component
 * 
 * Displays the dashboard header with welcome message and stats.
 * Uses Promise.all to fetch independent metrics (documents and vault stats)
 * concurrently in parallel without creating an accidental waterfall.
 */
async function DashboardHeader() {
  // Independent queries are initiated and executed concurrently in parallel
  const [documents, stats] = await Promise.all([
    getDocuments(),
    getVaultStats(),
  ]);

  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome to Your Vault
      </h1>
      <p className="text-foreground/75">
        You have {documents.length} document{documents.length !== 1 ? "s" : ""} across {stats.totalCategories} categories securely stored.
      </p>
    </div>
  );
}



/**
 * RecentDocuments - Server Component
 * 
 * Displays the list of recent documents.
 * Deduplicated via React cache() so no duplicate DB queries occur in the same render pass.
 */
async function RecentDocuments() {
  const documents = await getDocuments();
  return (
    <OptimisticVaultProvider documents={documents}>
      <DocumentList documents={documents} />
    </OptimisticVaultProvider>
  );
}

