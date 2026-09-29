import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Single class-merging helper used by every component. Keeps Tailwind
 * conflict resolution in one place so component overrides behave predictably.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Convert a ride/booking status into a stable status tone key. */
export const statusTone = (status) => {
  switch (status) {
    case "active":
    case "confirmed":
    case "open":
    case "paid":
      return "success";
    case "pending":
    case "processing":
      return "warning";
    case "cancelled":
    case "failed":
      return "danger";
    case "completed":
    case "matched":
      return "info";
    default:
      return "neutral";
  }
};

/** Human label for a status, never raw machine text in the UI. */
export const statusLabel = (status) => {
  switch (status) {
    case "active":
      return "Active";
    case "confirmed":
      return "Confirmed";
    case "pending":
      return "Pending";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    case "matched":
      return "Matched";
    case "open":
      return "Open";
    case "expired":
      return "Expired";
    case "reviewed":
      return "Reviewed";
    case "dismissed":
      return "Dismissed";
    case "actioned":
      return "Actioned";
    case "unpaid":
      return "Unpaid";
    case "processing":
      return "Processing";
    case "paid":
      return "Settled";
    case "failed":
      return "Failed";
    default:
      return status || "Unknown";
  }
};

/** Format a rupee amount for display. Never called a "fare". */
export const formatRupees = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "₹0";
  }
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
};
