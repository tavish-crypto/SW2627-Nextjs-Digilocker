/**
 * Loading component for vault layout
 * 
 * This component is displayed while the vault layout is being rendered
 * or while child pages are loading.
 */

import { DashboardSkeleton } from "@/src/components/skeletons";

export default function VaultLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <DashboardSkeleton />
    </main>
  );
}
