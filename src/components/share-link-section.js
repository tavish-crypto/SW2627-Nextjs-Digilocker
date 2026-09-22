"use client";

import { useActionState } from "react";
import {
  createShareLink,
  revokeShareLink,
} from "@/src/app/(vault)/documents/actions";

const initialState = {
  errors: null,
  data: null,
};

function RevokeShareButton({ documentId, linkId }) {
  const [state, formAction, isPending] = useActionState(revokeShareLink, initialState);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="linkId" value={linkId} />
      {state.errors?._form?.[0] && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.errors._form[0]}
        </span>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="text-red-600 hover:underline dark:text-red-400 disabled:opacity-50"
      >
        {isPending ? "Revoking..." : "Revoke"}
      </button>
    </form>
  );
}

export function ShareLinkSection({ documentId, shareLinks = [] }) {
  const [createState, createAction, isCreating] = useActionState(createShareLink, initialState);

  return (
    <div className="rounded-lg border border-black/10 p-6 dark:border-white/15 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Secure Expiring Share Links</h3>
          <p className="text-xs text-foreground/70">
            Create time-limited access tokens for external verification.
          </p>
        </div>

        <form action={createAction} className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input type="hidden" name="documentId" value={documentId} />
          
          <div className="flex items-center gap-2">
            <label htmlFor="expiresInMinutes" className="sr-only">
              Expiration duration
            </label>
            <select
              id="expiresInMinutes"
              name="expiresInMinutes"
              defaultValue="60"
              aria-invalid={Boolean(createState.errors?.expiresInMinutes)}
              aria-describedby={
                createState.errors?.expiresInMinutes ? "expires-error" : undefined
              }
              className="rounded-md border border-black/15 bg-transparent px-2.5 py-1.5 text-xs focus:outline-none dark:border-white/20"
            >
              <option value="10" className="dark:bg-neutral-900">10 Minutes</option>
              <option value="60" className="dark:bg-neutral-900">1 Hour</option>
              <option value="1440" className="dark:bg-neutral-900">24 Hours</option>
            </select>

            <button
              type="submit"
              disabled={isCreating}
              className="rounded-md bg-foreground text-background px-3 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating..." : "Create Link"}
            </button>
          </div>

          {createState.errors?.expiresInMinutes?.[0] && (
            <p id="expires-error" className="text-xs text-red-600 dark:text-red-400">
              {createState.errors.expiresInMinutes[0]}
            </p>
          )}
        </form>
      </div>

      {createState.errors?._form?.[0] && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
        >
          {createState.errors._form[0]}
        </div>
      )}

      {shareLinks.length > 0 ? (
        <ul className="divide-y divide-black/10 dark:divide-white/10 text-xs">
          {shareLinks.map((link) => {
            const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/share/${link.token}`;
            return (
              <li
                key={link.id}
                className="py-2.5 flex items-center justify-between gap-2"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/share/${link.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono font-medium text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[180px] sm:max-w-xs"
                      title={shareUrl}
                    >
                      /share/{link.token}
                    </a>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${link.token}`)}
                      className="shrink-0 text-foreground/40 hover:text-foreground transition-colors"
                      title="Copy link"
                    >
                      📋
                    </button>
                  </div>
                  <p className="text-foreground/60">Expires: {link.expiresAt}</p>
                </div>
                <RevokeShareButton documentId={documentId} linkId={link.id} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-foreground/50">No active share links.</p>
      )}
    </div>
  );
}
