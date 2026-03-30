import { Suspense } from "react";
import { LoaderCircle } from "lucide-react";

import { LiveTripClient } from "./live-trip-client";

export default async function LiveTripPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const params = await searchParams;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-surface-container px-5 py-3 text-sm text-white/70">
            <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
            بنحضر شاشة المشوار...
          </div>
        </div>
      }
    >
      <LiveTripClient tripId={params.id} />
    </Suspense>
  );
}
