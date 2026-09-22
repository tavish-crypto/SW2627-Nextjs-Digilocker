"use client";

import { useOptimisticDocument } from "./optimistic-document-provider";

export function DocumentDetailsClient() {
  const { optimisticDocument } = useOptimisticDocument();

  return (
    <>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {optimisticDocument.title}
        </h1>
        <p className="text-foreground/75">{optimisticDocument.description}</p>
      </div>

      {/* Document Details Grid */}
      <div className="rounded-lg border border-black/10 p-6 dark:border-white/15">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-foreground/75">Type</h3>
            <p className="mt-1 text-lg font-semibold">{optimisticDocument.type}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground/75">Size</h3>
            <p className="mt-1 text-lg font-semibold">{optimisticDocument.size}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground/75">
              Issued On
            </h3>
            <p className="mt-1 text-lg font-semibold">{optimisticDocument.issuedOn}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground/75">
              Document ID
            </h3>
            <p className="mt-1 text-sm font-mono">{optimisticDocument.id}</p>
          </div>
        </div>
      </div>
    </>
  );
}
