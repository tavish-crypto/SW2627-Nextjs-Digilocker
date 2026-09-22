import Link from "next/link";

export default function DocumentNotFound() {
  return (
    <div className="space-y-6">
      <Link
        href="/documents"
        className="inline-flex items-center gap-2 text-sm font-medium text-foreground/75 hover:text-foreground transition-colors"
      >
        ← Back to Documents
      </Link>

      <div className="rounded-lg border border-black/10 p-8 text-center dark:border-white/15">
        <h1 className="text-2xl font-semibold mb-2">Document Not Found</h1>
        <p className="text-foreground/75">
          The document you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>

        <Link
          href="/documents"
          className="mt-4 inline-block rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Return to Vault
        </Link>
      </div>
    </div>
  );
}
