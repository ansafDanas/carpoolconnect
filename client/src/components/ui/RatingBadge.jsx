/* eslint-disable react-refresh/only-export-components -- this module also exports shared hooks and helpers alongside its components */
import { Star } from "lucide-react";

import { cn } from "../../lib/utils";

/** Rating tone drives the colour chip. "New" is never given a fake score. */
function ratingTone(rating, count) {
  if (!count || rating === null || rating === undefined) {
    return "new";
  }
  const value = Number(rating);
  if (!Number.isFinite(value)) {
    return "new";
  }
  if (value >= 4) return "high";
  if (value >= 3) return "mid";
  return "low";
}

/**
 * Trust signal. Rendered consistently everywhere a person appears, and it
 * never invents a rating: an account with no reviews reads "New".
 */
function RatingBadge({ rating, count, size = "md", showCount = true, className }) {
  const tone = ratingTone(rating, count);

  const sizing = {
    lg: "px-3 py-1 text-[13px]",
    sm: "px-2 py-0.5 text-[11px]",
    md: "",
  }[size];

  const label =
    tone === "new"
      ? "New"
      : `${Number(rating).toFixed(1)}${showCount && count ? ` (${count})` : ""}`;

  const title =
    tone === "new"
      ? "No ratings yet"
      : `Rated ${Number(rating).toFixed(1)} out of 5 from ${count} review${
          count === 1 ? "" : "s"
        }`;

  return (
    <span className={cn("rating-chip", `rating-${tone}`, sizing, className)} title={title}>
      {tone !== "new" ? <Star className="size-3 fill-current" aria-hidden="true" /> : null}
      {label}
      {tone === "low" ? <span className="sr-only">below average, read the reviews</span> : null}
    </span>
  );
}

export { RatingBadge, ratingTone };
export default RatingBadge;
