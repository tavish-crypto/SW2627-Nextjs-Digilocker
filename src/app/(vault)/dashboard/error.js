'use client';

import RouteErrorState from "@/src/components/error-state";

export default function DashboardError({ error, reset }) {
  console.error("Vault dashboard route error:", error instanceof Error ? error.message : "Unknown error");

  return (
    <RouteErrorState
      title="We couldn't load your dashboard."
      message="Something went wrong while loading your vault overview. Please try again."
      onRetry={() => reset()}
      actionHref="/dashboard"
      actionLabel="Back to Dashboard"
    />
  );
}
