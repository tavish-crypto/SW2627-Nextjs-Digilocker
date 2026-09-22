/**
 * Loading component for documents page
 * 
 * This component is displayed while the documents page is being rendered.
 * Provides a smooth loading experience with skeleton placeholders.
 */

import { DashboardSkeleton } from "@/src/components/skeletons";

export default function DocumentsLoading() {
  return <DashboardSkeleton />;
}
