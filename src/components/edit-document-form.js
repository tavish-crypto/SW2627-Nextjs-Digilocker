"use client";

import { startTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { updateDocument } from "@/src/app/(vault)/documents/actions";
import { useOptimisticDocument } from "@/src/components/optimistic-document-provider";

const initialState = {
  errors: null,
  data: null,
};

export function EditDocumentForm({ document }) {
  const { dispatchOptimisticUpdate } = useOptimisticDocument();
  const router = useRouter();

  const [state, formAction, isPending] = useActionState(updateDocument, initialState);

  const handleSubmit = (event) => {
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(() => {
      const documentId = formData.get("documentId");
      dispatchOptimisticUpdate({
        type: "UPDATE",
        documentId,
        document: {
          id: documentId,
          title: formData.get("title"),
          type: formData.get("type"),
          description: formData.get("description"),
        },
      });
    });

    router.refresh();
  };

  return (
    <div className="rounded-lg border border-black/10 p-6 dark:border-white/15">
      <h3 className="text-sm font-semibold mb-3">Update Document Metadata</h3>
      
      {state.errors?._form?.[0] && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
        >
          {state.errors._form[0]}
        </div>
      )}

      {state.data && !state.errors && (
        <div
          role="status"
          className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-400"
        >
          Document metadata updated successfully.
        </div>
      )}

      <form action={formAction} onSubmit={handleSubmit} aria-busy={isPending} className="space-y-4">
        {isPending && (
          <p role="status" aria-live="polite" className="text-xs text-foreground/60">
            Saving document metadata...
          </p>
        )}
        <input type="hidden" name="documentId" value={document.id} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              htmlFor="edit-title"
              className="text-xs font-medium text-foreground/75"
            >
              Document Title *
            </label>
            <input
              id="edit-title"
              name="title"
              type="text"
              required
              maxLength={120}
              defaultValue={document.title}
              aria-invalid={Boolean(state.errors?.title)}
              aria-describedby={state.errors?.title ? "edit-title-error" : undefined}
              className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 dark:border-white/20 ${
                state.errors?.title
                  ? "border-red-500 dark:border-red-500 focus:ring-red-400/30"
                  : "border-black/15 dark:border-white/20"
              }`}
            />
            {state.errors?.title?.[0] && (
              <p
                id="edit-title-error"
                className="text-xs text-red-600 dark:text-red-400"
              >
                {state.errors.title[0]}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="edit-type"
              className="text-xs font-medium text-foreground/75"
            >
              Type / Format
            </label>
            <select
              id="edit-type"
              name="type"
              defaultValue={document.type}
              aria-invalid={Boolean(state.errors?.type)}
              aria-describedby={state.errors?.type ? "edit-type-error" : undefined}
              className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 dark:border-white/20 ${
                state.errors?.type
                  ? "border-red-500 dark:border-red-500 focus:ring-red-400/30"
                  : "border-black/15 dark:border-white/20"
              }`}
            >
              <option value="PDF" className="dark:bg-neutral-900">PDF</option>
              <option value="DOCX" className="dark:bg-neutral-900">DOCX</option>
              <option value="JPG" className="dark:bg-neutral-900">JPG</option>
              <option value="PNG" className="dark:bg-neutral-900">PNG</option>
              <option value="WEBP" className="dark:bg-neutral-900">WEBP</option>
              <option value="XML" className="dark:bg-neutral-900">XML</option>
              <option value="JSON" className="dark:bg-neutral-900">JSON</option>
            </select>
            {state.errors?.type?.[0] && (
              <p
                id="edit-type-error"
                className="text-xs text-red-600 dark:text-red-400"
              >
                {state.errors.type[0]}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="edit-description"
            className="text-xs font-medium text-foreground/75"
          >
            Description
          </label>
          <input
            id="edit-description"
            name="description"
            type="text"
            defaultValue={document.description}
            aria-invalid={Boolean(state.errors?.description)}
            aria-describedby={
              state.errors?.description ? "edit-description-error" : undefined
            }
            className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 dark:border-white/20 ${
              state.errors?.description
                ? "border-red-500 dark:border-red-500 focus:ring-red-400/30"
                : "border-black/15 dark:border-white/20"
            }`}
          />
          {state.errors?.description?.[0] && (
            <p
              id="edit-description-error"
              className="text-xs text-red-600 dark:text-red-400"
            >
              {state.errors.description[0]}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-foreground text-background px-4 py-2 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
