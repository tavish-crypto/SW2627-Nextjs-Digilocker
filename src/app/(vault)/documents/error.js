'use client';

import RouteErrorState from "@/src/components/error-state";

export default function DocumentsError({ error, reset }) {
  console.error("Vault documents route error:", error instanceof Error ? error.message : "Unknown error");

  return (
    <RouteErrorState
      title="We couldn't load your documents."
      message="Something went wrong while loading your vault. Please try again in a moment."
      onRetry={() => reset()}
      actionHref="/documents"
      actionLabel="Back to Documents"
    />
  );
}
