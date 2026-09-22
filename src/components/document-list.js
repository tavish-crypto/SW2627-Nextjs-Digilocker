import { DocumentListClient } from "@/src/components/document-list-client";

/**
 * DocumentList - Server Component
 * 
 * This component demonstrates the Server → Client component boundary in Next.js App Router.
 * 
 * Responsibilities:
 * 1. Receive serializable document data and request-specific values from the Server
 * 2. Pass this data as props to the Client Component
 * 3. Remain a Server Component (no "use client" directive)
 * 
 * The DocumentListClient receives the data as props and handles all interactive behavior
 * like document selection, showing/hiding details, and user interactions.
 */
export async function DocumentList({ documents, userId, renderedAt, query, pagination }) {
  // Pass serializable document data and request-specific values to the Client Component
  // The Client Component handles all state management and interactivity
  return <DocumentListClient documents={documents} userId={userId} renderedAt={renderedAt} query={query} pagination={pagination} />;
}
