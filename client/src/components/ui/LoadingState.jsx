import { Loader2 } from "lucide-react";

import { cn } from "../../lib/utils";

/** Inline spinner with an accessible status message. */
function LoadingState({ message = "Loading\u2026", className, compact = false }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 text-sm font-medium text-text-muted",
        compact ? "py-4" : "py-14",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-4 animate-spin text-leaf" aria-hidden="true" />
      {message}
    </div>
  );
}

/** A single shimmering placeholder block. */
function Skeleton({ className }) {
  return <div className={cn("cc-skeleton", className)} aria-hidden="true" />;
}

/** Generic skeleton list used while a page's primary list is loading. */
function SkeletonList({ rows = 3, className }) {
  return (
    <div className={cn("grid gap-4", className)} role="status" aria-live="polite">
      <span className="sr-only">Loading content</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border bg-surface p-5 shadow-card"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export { LoadingState, Skeleton, SkeletonList };
export default LoadingState;
