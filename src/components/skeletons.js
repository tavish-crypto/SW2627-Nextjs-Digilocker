/**
 * Skeleton Loaders for Vault
 * 
 * Provides accessible loading placeholders that maintain layout
 * stability while data is being fetched.
 */

/**
 * DocumentCardSkeleton
 * 
 * Skeleton for a single document card in the vault grid.
 * Mimics the dimensions and layout of a real document card.
 */
export function DocumentCardSkeleton() {
  return (
    <div className="rounded-lg border border-black/10 p-5 dark:border-white/15">
      <div className="space-y-3">
        <div>
          <div className="mb-2 h-6 w-3/4 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="mt-1 h-4 w-full animate-pulse rounded bg-black/10 dark:bg-white/10" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-3 w-1/4 animate-pulse rounded bg-black/10 dark:bg-white/10" />
          <div className="h-3 w-1/4 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        </div>
        <div className="h-3 w-1/3 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      </div>
    </div>
  );
}

/**
 * DocumentGridSkeleton
 * 
 * Skeleton for a grid of document cards.
 * Shows 3 columns on desktop, 2 on tablet, 1 on mobile.
 */
export function DocumentGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <DocumentCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * VaultHeaderSkeleton
 * 
 * Skeleton for the vault page header (title and description).
 */
export function VaultHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-9 w-1/3 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      <div className="h-5 w-1/2 animate-pulse rounded bg-black/10 dark:bg-white/10" />
    </div>
  );
}

/**
 * DashboardSkeleton
 * 
 * Full skeleton for the vault dashboard including header and document grid.
 */
export function DashboardSkeleton() {
  return (
    <section className="space-y-6">
      <VaultHeaderSkeleton />
      <DocumentGridSkeleton count={6} />
    </section>
  );
}
