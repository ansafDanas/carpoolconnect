import { Suspense, lazy } from "react";

// Leaflet is heavy, so the picker loads on demand and never lands in the
// main bundle. Matching works without it; this only improves the form.
const LocationPicker = lazy(() => import("./LocationPicker"));

function LocationPickerLoader(props) {
  return (
    <Suspense
      fallback={
        <div className="h-56 w-full animate-pulse rounded-2xl border border-border bg-surface-muted" />
      }
    >
      <LocationPicker {...props} />
    </Suspense>
  );
}

export default LocationPickerLoader;