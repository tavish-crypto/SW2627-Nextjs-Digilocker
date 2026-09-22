"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimisticVault } from "@/src/components/optimistic-vault-provider";

/**
 * DocumentListClient - Client Component
 * 
 * This component demonstrates the Server → Client boundary in Next.js App Router.
 * 
 * Server Component (DocumentList) fetches the data and passes it here as props.
 * This Client Component handles all interactive behavior:
 * - Document selection state
 * - Toggling selected document details
 * - User interactions
 * 
 * It also receives and displays request-specific values from the server to demonstrate
 * that dynamic rendering occurred - these values are generated fresh on each request.
 * 
 * Data comes from the server as serializable props.
 * Client-side React hooks (useState) manage the interactive state.
 */
export function DocumentListClient({ userId, renderedAt, query, pagination }) {
  const { optimisticDocuments } = useOptimisticVault();
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [searchValue, setSearchValue] = useState(query?.q || "");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateQuery(updates) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [name, value] of Object.entries(updates)) {
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
    }
    if (updates.q || updates.type || updates.sort) {
      params.delete("page");
    }
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    updateQuery({ q: searchValue.trim() });
  }

  // Find the selected document from the list
  const selectedDocument = optimisticDocuments.find((doc) => doc.id === selectedDocId);
  const pageMeta = pagination || { page: 1, pageSize: query?.pageSize || 10, totalPages: 1, hasMore: false, hasPrevious: false, total: optimisticDocuments.length };

  return (
    <div className="space-y-6">
      {query && (
        <div className="panel border-t-2 border-t-[#f58220] p-4">
          <form key={`${query.q}:${query.type}:${query.sort}`} onSubmit={handleSearchSubmit} className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div className="space-y-1">
              <label htmlFor="document-search" className="text-sm font-medium">
                Search documents
              </label>
              <input
                id="document-search"
                name="q"
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search by title or description"
                className="w-full rounded-md border border-[#c8d8e8] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066b3]/20"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="document-type" className="text-sm font-medium">
                Type
              </label>
              <select
                id="document-type"
                value={query.type}
                onChange={(event) => updateQuery({ type: event.target.value })}
                className="w-full rounded-md border border-[#c8d8e8] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066b3]/20"
              >
                <option value="">All types</option>
                <option value="PDF">PDF</option>
                <option value="DOCX">DOCX</option>
                <option value="JPG">JPG</option>
                <option value="PNG">PNG</option>
                <option value="WEBP">WEBP</option>
                <option value="JSON">JSON</option>
                <option value="XML">XML</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="document-sort" className="text-sm font-medium">
                Sort
              </label>
              <select
                id="document-sort"
                value={query.sort}
                onChange={(event) => updateQuery({ sort: event.target.value })}
                className="w-full rounded-md border border-[#c8d8e8] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066b3]/20"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
              </select>
            </div>
          </form>

          {(query.q || query.type || query.sort !== "newest") && (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                updateQuery({ q: "", type: "", sort: "" });
              }}
              className="mt-3 text-sm font-medium underline underline-offset-2 hover:no-underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {optimisticDocuments.length === 0 ? (
        <div className="rounded-lg border border-black/10 bg-black/5 p-8 text-center dark:border-white/15 dark:bg-white/5">
          <h3 className="text-lg font-medium">
            {query?.q || query?.type ? "No documents match your current search or filters." : "No documents yet"}
          </h3>
          <p className="mt-2 text-sm text-foreground/75">
            {query?.q || query?.type ? "Try changing your search or clearing the filters." : "Upload your first document to get started."}
          </p>
        </div>
      ) : (
      <>
      {/* Server Render Information - Demonstrates Dynamic Rendering */}
      <div className="rounded-lg border border-[#b9d8ef] bg-[#eaf5fd] p-4 text-sm">
        <p className="font-medium text-[#004b87]">
          Vault session
        </p>
        <div className="mt-2 grid gap-2 text-xs text-[#365b7d] sm:grid-cols-2">
          <p><span className="font-medium">Account:</span> <span className="font-mono">{userId}</span></p>
          <p><span className="font-medium">Last refreshed:</span> <span className="font-mono">{renderedAt}</span></p>
          <p className="sm:col-span-2 text-[#52789b]">
            Your documents are stored securely in your personal vault.
          </p>
        </div>
      </div>

      {/* Document List */}
      <div className="grid gap-6 lg:grid-cols-3">
      {/* Document List */}
      <div className="lg:col-span-2">
        <div className="mb-4">
          <div className="flex items-end justify-between gap-4">
          <h2 className="text-lg font-semibold text-[#132846]">
            Documents ({pageMeta.total})
          </h2>
          <span className="hidden text-xs font-semibold uppercase tracking-[0.12em] text-[#62738a] sm:block">Your files</span>
          </div>
          <p className="text-sm text-foreground/75">
            Click a document to view details
          </p>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-md border border-[#d8e3ef] bg-[#f7fbff] px-3 py-2 text-sm">
          <button
            type="button"
            onClick={() => updateQuery({ page: String(Math.max(1, pageMeta.page - 1)) })}
            disabled={!pageMeta.hasPrevious}
            className="rounded border border-[#c8d8e8] px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <span className="font-medium text-[#132846]">
            Page {pageMeta.page} of {pageMeta.totalPages}
          </span>

          <button
            type="button"
            onClick={() => updateQuery({ page: String(pageMeta.page + 1) })}
            disabled={!pageMeta.hasMore}
            className="rounded border border-[#c8d8e8] px-3 py-1.5 font-medium disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {optimisticDocuments.map((document) => (
            <button
              key={document.id}
              onClick={() => setSelectedDocId(document.id)}
              className={`document-row group rounded-lg border bg-white p-4 text-left transition-all ${
                selectedDocId === document.id
                  ? "border-foreground bg-foreground/10 dark:bg-foreground/20"
                  : "border-[#d8e3ef] hover:bg-[#f7fbff]"
              }`}
            >
              <div className="space-y-2">
                <div>
                  <h3 className="font-medium group-hover:underline">
                    {document.title}
                  </h3>
                  <p className="text-xs text-foreground/60">
                    {document.description}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-foreground/50">
                  <span>{document.type}</span>
                  <span>{document.size}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Document Details Panel */}
      <div className="lg:col-span-1">
        {selectedDocument ? (
          <div className="panel sticky top-4 border-t-2 border-t-[#138808] p-6">
            <div className="mb-4 pb-4 border-b border-black/10 dark:border-white/15">
              <h3 className="text-sm font-medium text-foreground/75">
                Selected Document
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground/60">
                  Name
                </label>
                <p className="mt-1 font-medium">{selectedDocument.title}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground/60">
                  Description
                </label>
                <p className="mt-1 text-sm">{selectedDocument.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground/60">
                    Type
                  </label>
                  <p className="mt-1 text-sm font-mono">
                    {selectedDocument.type}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/60">
                    Size
                  </label>
                  <p className="mt-1 text-sm font-mono">
                    {selectedDocument.size}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground/60">
                  Issued On
                </label>
                <p className="mt-1 text-sm">{selectedDocument.issuedOn}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground/60">
                  Document ID
                </label>
                <p className="mt-1 text-xs font-mono text-foreground/60">
                  {selectedDocument.id}
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href={`/documents/${selectedDocument.id}`}
                  className="inline-flex w-full justify-center rounded-md bg-foreground text-background px-3 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  View Full Details
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="sticky top-4 rounded-lg border border-dashed border-[#b9d8ef] bg-[#f7fbff] p-6 text-center">
            <p className="text-sm text-foreground/75">
              Select a document to view details
            </p>
          </div>
        )}
      </div>
    </div>
      </>
      )}
    </div>
  );
}
