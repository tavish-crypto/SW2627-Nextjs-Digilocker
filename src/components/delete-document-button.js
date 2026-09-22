"use client";

import { useActionState } from "react";
import { deleteDocument } from "@/src/app/(vault)/documents/actions";

const initialState = {
  errors: null,
  data: null,
};

export function DeleteDocumentButton({ documentId }) {
  const [state, formAction, isPending] = useActionState(deleteDocument, initialState);

  return (
    <div className="space-y-2">
      {state.errors?._form?.[0] && (
        <p
          role="alert"
          className="text-xs text-red-600 dark:text-red-400"
        >
          {state.errors._form[0]}
        </p>
      )}
      <form action={formAction}>
        <input type="hidden" name="documentId" value={documentId} />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Deleting..." : "Delete Document"}
        </button>
      </form>
    </div>
  );
}
