/* eslint-disable react-refresh/only-export-components -- this module also exports shared hooks and helpers alongside its components */
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Bell,
  Bookmark,
  CalendarRange,
  Car,
  Check,
  Compass,
  CreditCard,
  HeartHandshake,
  Home,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Route,
  Star,
  User,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { ComingSoonChip, useComingSoon } from "./ComingSoon";
import { cn } from "../lib/utils";

/**
 * Role-aware navigation. Passenger-only and driver-only entries are hidden
 * rather than shown-then-refused, and unavailable areas keep their place with
 * an honest "Coming soon" marker.
 *
 * Notifications, Profile, Settings and Support are deliberately not repeated
 * here: the header bell and the account menu already own them, so listing
 * them twice would be duplication rather than navigation.
 */
export function useNavigation() {
  const { isPassenger, isDriver, isAdmin } = useAuth();
  const { openComingSoon } = useComingSoon();

  const items = [
    { label: "Home", to: "/app/dashboard", icon: Home },
    { label: "Find Rides", to: "/app/find-rides", icon: Compass, show: isPassenger },
    { label: "Offer a Ride", to: "/app/offer-ride", icon: Car, show: isDriver },
    { label: "My Bookings", to: "/app/my-bookings", icon: HeartHandshake, show: isPassenger },
    { label: "My Rides", to: "/app/my-rides", icon: CalendarRange, show: isDriver },
    { label: "Messages", to: "/app/messages", icon: MessageSquare },
    { label: "Saved Rides", icon: Bookmark, comingSoon: "savedRides" },
    { label: "Payments", icon: CreditCard, comingSoon: "payments" },
    { label: "Reviews", to: "/app/reviews", icon: Star },
  ];

  // Request-a-Ride stays reachable for passengers who would rather be matched.
  if (isPassenger) {
    items.splice(2, 0, { label: "Request a Ride", to: "/app/request-ride", icon: Route });
  }

  return {
    items: items.filter((item) => item.show !== false && !isAdmin),
    openComingSoon,
  };
}

function NavItem({ item, onUnavailable }) {
  const Icon = item.icon;
  const isUnavailable = !item.to;

  if (isUnavailable) {
    return (
      <button
        type="button"
        className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[15px] font-medium text-text-muted transition hover:bg-surface-muted hover:text-text"
        onClick={() => onUnavailable(item.comingSoon)}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <ComingSoonChip compact />
      </button>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to === "/app/dashboard"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition",
          isActive
            ? "bg-leaf font-semibold text-white shadow-soft"
            : "text-text-muted hover:bg-surface-muted hover:text-text"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn("size-[18px] shrink-0", isActive ? "text-white" : "text-text-muted")}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

/** The value proposition, restated where the eye already is. */
function SidebarPitch({ isDriver }) {
  const points = ["Lower cost", "Less traffic", "A greener tomorrow"];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <img
        src="/carpool-commute.webp"
        alt=""
        className="h-28 w-full object-cover"
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />

      <div className="p-4">
        <p className="text-[17px] font-bold leading-tight tracking-[-0.01em] text-text">
          Travel Together
          <br />
          Save More
        </p>

        <ul className="mt-3 space-y-2">
          {points.map((point) => (
            <li key={point} className="flex items-center gap-2 text-[13px] text-text-muted">
              <span
                className="grid size-[18px] shrink-0 place-items-center rounded-full bg-leaf text-white"
                aria-hidden="true"
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              {point}
            </li>
          ))}
        </ul>

        <NavLink
          to={isDriver ? "/app/offer-ride" : "/app/find-rides"}
          className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg bg-leaf text-sm font-semibold text-white transition hover:bg-leaf-hover"
        >
          {isDriver ? "Offer a Ride" : "Find a Ride"}
          <span aria-hidden="true">&rarr;</span>
        </NavLink>
      </div>
    </div>
  );
}

/** Desktop sidebar: the primary wayfinding element on wide screens. */
export function AppSidebar({ className }) {
  const { logout, isDriver } = useAuth();
  const { items, openComingSoon } = useNavigation();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-border bg-surface lg:flex",
        className
      )}
    >
      <div className="flex h-[72px] shrink-0 items-center gap-2.5 border-b border-border px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-leaf text-white">
          <Car className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 truncate text-[17px] font-bold tracking-[-0.01em] text-text">
          CarpoolConnect
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
        <nav aria-label="Main navigation">
          <ul className="grid gap-1">
            {items.map((item) => (
              <li key={item.label}>
                <NavItem item={item} onUnavailable={openComingSoon} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto pt-6">
          <SidebarPitch isDriver={isDriver} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-3 py-3">
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium text-text-muted transition hover:bg-surface-muted hover:text-text"
        >
          <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
          Log out
        </button>
      </div>
    </aside>
  );
}

/**
 * Mobile bottom tab bar. Five destinations, matching the reference. Tabs are
 * role-aware so a driver-only account still gets a coherent set.
 *
 * Messages, Reviews and People do not each earn a tab, so the last slot
 * opens a sheet that lists them. They were previously reachable only on
 * desktop, which left those routes unreachable on a phone.
 */
export function MobileTabBar({ className }) {
  const { isPassenger, isDriver } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  const tabs = [
    { label: "Home", to: "/app/dashboard", icon: Home },
    isPassenger
      ? { label: "Find", to: "/app/find-rides", icon: Compass }
      : { label: "Rides", to: "/app/my-rides", icon: CalendarRange },
    isDriver
      ? { label: "Offer", to: "/app/offer-ride", icon: Car, accent: true }
      : { label: "Request", to: "/app/request-ride", icon: Route, accent: true },
    isPassenger
      ? { label: "Bookings", to: "/app/my-bookings", icon: HeartHandshake }
      : { label: "Bookings", to: "/app/my-bookings", icon: HeartHandshake },
  ].filter(Boolean);

  const moreLinks = [
    { label: "Messages", to: "/app/messages", icon: MessageSquare },
    { label: "Reviews", to: "/app/reviews", icon: Star },
    { label: "People", to: "/app/people", icon: HeartHandshake },
    { label: "Notifications", to: "/app/notifications", icon: Bell },
    { label: "Profile", to: "/app/profile", icon: User },
  ];

  const moreActive = moreLinks.some((link) => link.to === location.pathname);

  return (
    <>
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden",
          className
        )}
        aria-label="Primary navigation"
      >
        <ul className="grid grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <li key={tab.label}>
                <NavLink
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition",
                      isActive ? "text-leaf" : "text-text-muted"
                    )
                  }
                >
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-xl transition",
                      tab.accent && "bg-leaf text-white"
                    )}
                  >
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  {tab.label}
                </NavLink>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={cn(
                "flex w-full flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition",
                moreActive || moreOpen ? "text-leaf" : "text-text-muted"
              )}
            >
              <span className="grid size-8 place-items-center rounded-xl">
                <MoreHorizontal className="size-[18px]" aria-hidden="true" />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-primary/45 backdrop-blur-sm lg:hidden"
          role="presentation"
          onClick={() => setMoreOpen(false)}
        >
          <div
            role="dialog"
            aria-label="More"
            aria-modal="true"
            className="w-full rounded-t-[28px] border-t border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
            <ul className="grid gap-1">
              {moreLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
                          isActive
                            ? "bg-leaf-soft text-leaf"
                            : "text-primary hover:bg-surface-muted"
                        )
                      }
                    >
                      <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                      {link.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
