import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth.js";
import { getDocuments, getVaultStats } from "../../lib/documents.js";
import { AdminActionsPanel } from "./admin-actions-panel.js";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Console | DigiLocker Vault",
  description: "Administrative console for managing vault security and user roles.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * AdminPage - Server Component
 * 
 * Enforces defense-in-depth server boundary authorization:
 * - Unauthenticated callers are redirected to /login.
 * - Authenticated callers without admin role are redirected to /forbidden.
 */
export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/admin");
  }

  if (user.role !== "admin") {
    redirect("/forbidden");
  }

  const [documents, stats] = await Promise.all([
    getDocuments(),
    getVaultStats(),
  ]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link className="text-lg font-semibold" href="/dashboard">
              DigiLocker Vault
            </Link>
            <span className="rounded bg-black/5 dark:bg-white/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
              Admin
            </span>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-foreground/75 hover:text-foreground transition-colors"
          >
            ← Back to Vault
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin Console</h1>
          <p className="mt-1 text-foreground/75">
            Signed in as <span className="font-mono font-medium">{user.email}</span> (Role: <span className="font-bold text-red-600 dark:text-red-400">{user.role}</span>)
          </p>
        </div>

        {/* System Metrics Overview */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-black/10 p-5 dark:border-white/15">
            <h3 className="text-xs font-medium uppercase tracking-wider text-foreground/60">Total Documents</h3>
            <p className="mt-2 text-2xl font-bold">{documents.length}</p>
          </div>
          <div className="rounded-lg border border-black/10 p-5 dark:border-white/15">
            <h3 className="text-xs font-medium uppercase tracking-wider text-foreground/60">Document Types</h3>
            <p className="mt-2 text-2xl font-bold">{stats.totalCategories}</p>
          </div>
          <div className="rounded-lg border border-black/10 p-5 dark:border-white/15">
            <h3 className="text-xs font-medium uppercase tracking-wider text-foreground/60">Storage Limit</h3>
            <p className="mt-2 text-2xl font-bold">{stats.storageQuotaMB} MB</p>
          </div>
        </div>

        {/* Interactive Admin Mutations (Client Leaf Component) */}
        <AdminActionsPanel />
      </main>
    </div>
  );
}
