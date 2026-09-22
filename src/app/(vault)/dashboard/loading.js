/**
 * Loading component for dashboard page
 * 
 * This component is displayed while the dashboard page is being rendered.
 * Provides a smooth loading experience with skeleton placeholders.
 */

import { DashboardSkeleton } from "@/src/components/skeletons";

export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
