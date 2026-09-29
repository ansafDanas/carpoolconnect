import { Suspense, lazy } from "react";

// Leaflet pulls in a large map bundle, so the dashboard map loads on demand
// and never lands in the main chunk.
const DashboardMap = lazy(() => import("./DashboardMap"));

function DashboardMapLoader(props) {
  return (
    <Suspense
      fallback={
        <div
          className="h-[300px] w-full animate-pulse rounded-xl border border-border bg-surface-muted sm:h-[340px]"
          aria-hidden="true"
        />
      }
    >
      <DashboardMap {...props} />
    </Suspense>
  );
}

export default DashboardMapLoader;