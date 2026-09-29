/* eslint-disable react-refresh/only-export-components -- one module owns the single Coming Soon mechanism, including its context and copy table */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Clock3, Info } from "lucide-react";

import { Button } from "./ui/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/Dialog";
import { cn } from "../lib/utils";

/**
 * ============================================================================
 * Single Coming Soon mechanism for the whole product.
 * ----------------------------------------------------------------------------
 * Rule this enforces: never delete a feature because the backend does not
 * support it yet. Keep the control, keep it clickable, and explain honestly
 * that the capability is still being built. No fake functionality, ever.
 * ============================================================================
 */

const DEFAULT_DETAIL =
  "This feature is currently under development and will be available soon.";

const ComingSoonContext = createContext(null);

/**
 * Every unavailable capability gets the same voice and the same honesty:
 * say what it will do, and never imply it already works.
 */
const FEATURE_COPY = {
  payments: {
    title: "Online payments are coming soon",
    detail:
      "Contributions are settled directly with your driver for now. Online payment will arrive here once a real payment gateway is connected — nothing is charged until then.",
  },
  tracking: {
    title: "Continuous background tracking is coming soon",
    detail:
      "Right now a driver can share their current location for a trip from their device while the app is open. Continuous background GPS sharing is still being built.",
  },
  driverVerification: {
    title: "Driver document verification is coming soon",
    detail:
      "Licence and registration certificate checks are not available yet. A Verified badge is only ever shown once the check has genuinely been carried out.",
  },
  pushNotifications: {
    title: "Push notifications are coming soon",
    detail:
      "Notifications currently arrive inside the app while it is open. Browser and mobile push alerts are still being built.",
  },
  savedRides: {
    title: "Saved rides are coming soon",
    detail:
      "Saving a ride for later is still being built. Your searches and upcoming rides are all kept on your dashboard in the meantime.",
  },
  mapExplore: {
    title: "Full-screen maps are coming soon",
    detail:
      "The map on your dashboard already plots every ride that has real coordinates. Panning it across the full screen is still being built.",
  },
  advancedFilters: {
    title: "Advanced filters are coming soon",
    detail:
      "Filters for vehicle type, amenities and women-only preferences are still being built. Every ride you can book is shown by default.",
  },
  settings: {
    title: "More settings are coming soon",
    detail:
      "Notification preferences, language and privacy controls are still being built. Your safety preferences already live on your profile.",
  },
  support: {
    title: "Live support is coming soon",
    detail:
      "In-app help chat is still being built. For now you can report a safety issue from any profile and our moderation team reviews every report.",
  },
  messaging: {
    title: "Realtime messaging is coming soon",
    detail:
      "Trip chat currently updates on a short interval while the app is open. Instant delivery is still being built.",
  },
  realtimeMessaging: {
    title: "Realtime messaging is coming soon",
    detail:
      "Trip chat currently updates on a short interval while the app is open. Instant delivery is still being built.",
  },
  mapSearch: {
    title: "Searching on the map is coming soon",
    detail:
      "Picking a start point directly on the map is still being built. Search by place name for now.",
  },
};

export function ComingSoonProvider({ children }) {
  const [feature, setFeature] = useState(null);

  const openComingSoon = useCallback((key) => {
    setFeature(typeof key === "string" ? key : "default");
  }, []);

  const closeComingSoon = useCallback(() => setFeature(null), []);

  const copy = useMemo(() => {
    if (!feature) return null;
    if (feature === "default") {
      return { title: "Coming soon", detail: DEFAULT_DETAIL };
    }
    return FEATURE_COPY[feature] || { title: "Coming soon", detail: DEFAULT_DETAIL };
  }, [feature]);

  const value = useMemo(() => ({ openComingSoon }), [openComingSoon]);

  return (
    <ComingSoonContext.Provider value={value}>
      {children}

      <Dialog open={Boolean(feature)} onOpenChange={(open) => !open && closeComingSoon()}>
        <DialogContent>
          <DialogHeader>
            <span
              className="mb-1 grid size-11 place-items-center rounded-2xl bg-marigold-soft text-marigold-hover"
              aria-hidden="true"
            >
              <Clock3 className="size-5" />
            </span>
            <DialogTitle>Coming soon</DialogTitle>
            <DialogDescription>
              <span className="block font-semibold text-primary">{copy?.title}</span>
              <span className="mt-1.5 block">{copy?.detail}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2.5 rounded-xl bg-surface-muted px-3.5 py-3 text-xs leading-5 text-text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
            <p>This feature is currently under development and will be available soon.</p>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={closeComingSoon}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ComingSoonContext.Provider>
  );
}

/** Access the shared Coming Soon dialog from any component. */
export function useComingSoon() {
  return useContext(ComingSoonContext) || { openComingSoon: () => {} };
}

/**
 * A real, focusable, clickable control that opens the shared Coming Soon
 * dialog. Use this instead of removing a feature that is not built yet.
 */
export function ComingSoonButton({
  feature = "default",
  children,
  variant = "secondary",
  size = "md",
  className,
  icon: Icon = Clock3,
  ...props
}) {
  const { openComingSoon } = useComingSoon();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => openComingSoon(feature)}
      {...props}
    >
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

/** Small non-interactive marker for a capability that is not available yet. */
export function ComingSoonChip({ label, className, compact = false }) {
  // The compact form drops the icon and the word "coming" so a full nav label
  // still fits beside it at 264px; the full form is used everywhere with room.
  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted",
          className
        )}
      >
        {label ?? "Soon"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted",
        className
      )}
    >
      <Clock3 className="size-3" aria-hidden="true" />
      {label ?? "Coming soon"}
    </span>
  );
}

