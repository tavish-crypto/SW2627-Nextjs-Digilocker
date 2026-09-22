import { notFound } from "next/navigation.js";
import { getSharedDocumentByToken } from "../../../lib/documents.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { token } = await params;
  const doc = await getSharedDocumentByToken(token);
  if (!doc) return { title: "Link Expired or Invalid" };
  return { title: `Shared: ${doc.title}` };
}

export default async function SharePage({ params }) {
  const { token } = await params;
  const doc = await getSharedDocumentByToken(token);

  if (!doc) {
    notFound();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-black/10 dark:border-white/10">
          <p className="text-xs text-foreground/50 uppercase tracking-widest mb-1">Shared Document</p>
          <h1 className="text-xl font-semibold">{doc.title}</h1>
          {doc.description && (
            <p className="mt-1 text-sm text-foreground/60">{doc.description}</p>
          )}
        </div>

        {/* Details */}
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground/50">Type</span>
            <span className="font-mono font-medium rounded-md bg-black/5 dark:bg-white/10 px-2 py-0.5 text-xs">
              {doc.type}
            </span>
          </div>

          {doc.size && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground/50">Size</span>
              <span>{doc.size}</span>
            </div>
          )}

          {doc.issuedOn && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground/50">Issued On</span>
              <span>{doc.issuedOn}</span>
            </div>
          )}

          {doc.user?.name && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground/50">Shared By</span>
              <span>{doc.user.name}</span>
            </div>
          )}
        </div>

        {/* Access Notice */}
        <div className="px-6 pb-6">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-3 text-xs text-amber-700 dark:text-amber-400">
            🔒 This is a secure, time-limited link. Document access is verified.
          </div>
        </div>
      </div>
    </main>
  );
}
