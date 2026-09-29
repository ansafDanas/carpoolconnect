import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Car, ChevronDown, LifeBuoy, LogOut, Search, Shield, User } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useComingSoon } from "./ComingSoon";
import { NotificationBell } from "./Notifications";
import { cn } from "../lib/utils";

/**
 * A quiet text link for the header. The link matching the current page is the
 * only one that gains weight, so the header never shouts.
 */
function HeaderLink({ to, isPassenger, isDriver, children }) {
  const allowed = isPassenger || isDriver;

  if (!allowed) return null;

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "text-sm transition hover:text-text",
          isActive ? "font-semibold text-text" : "font-medium text-text-muted"
        )
      }
    >
      {children}
    </NavLink>
  );
}

/** Desktop + mobile top bar: search, quick links, notifications, account. */
export function AppHeader({ className }) {
  const { user, isAdmin, isPassenger, isDriver, logout } = useAuth();
  const { openComingSoon } = useComingSoon();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // "/" focuses search, the way every search-first product behaves.
  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const initials = (user?.name || "?").slice(0, 1).toUpperCase();

  return (
    <header
      className={cn(
        "sticky top-0 z-20 border-b border-border bg-surface",
        className
      )}
    >
      <div className="flex h-[72px] items-center gap-3 px-4 sm:px-6">
        <Link
          to="/app/dashboard"
          className="flex shrink-0 items-center gap-2.5 lg:hidden"
          aria-label="CarpoolConnect home"
        >
          <span className="grid size-9 place-items-center rounded-lg bg-leaf text-white">
            <Car className="size-5" aria-hidden="true" />
          </span>
        </Link>

        <div className="relative hidden min-w-0 flex-1 sm:block sm:max-w-[490px]">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search location, destination, or driver..."
            aria-label="Search CarpoolConnect"
            className="h-10 w-full rounded-lg border-0 bg-surface-muted pl-10 pr-12 text-sm text-text transition placeholder:text-text-muted focus-visible:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/40"
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              const value = event.currentTarget.value.trim();
              navigate(
                value ? `/app/find-rides?q=${encodeURIComponent(value)}` : "/app/find-rides"
              );
            }}
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-text-muted lg:block">
            /
          </kbd>
        </div>

        <nav
          className="ml-auto hidden items-center gap-7 lg:flex"
          aria-label="Quick links"
        >
          <HeaderLink to="/app/find-rides" isPassenger={isPassenger}>
            Find Rides
          </HeaderLink>
          <HeaderLink to="/app/offer-ride" isDriver={isDriver}>
            Offer a Ride
          </HeaderLink>
          <HeaderLink to="/app/my-rides" isDriver={isDriver}>
            My Rides
          </HeaderLink>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-6">
          <NotificationBell />

          <div className="relative" ref={menuRef}>
            <button
              ref={triggerRef}
              type="button"
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              {user?.profileImage ? (
                <img
                  alt=""
                  className="size-8 rounded-full object-cover"
                  src={user.profileImage}
                />
              ) : (
                <span
                  className="grid size-8 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary"
                  aria-hidden="true"
                >
                  {initials}
                </span>
              )}
              <span className="hidden max-w-24 truncate text-sm font-medium text-text sm:block">
                {user?.name?.split(" ")[0] || "Account"}
              </span>
              <ChevronDown className="size-4 text-text-muted" aria-hidden="true" />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-elevated"
              >
                <div className="border-b border-border px-3 py-2.5">
                  <p className="truncate text-sm font-semibold text-primary">{user?.name}</p>
                  <p className="truncate text-xs text-text-muted">{user?.email}</p>
                </div>

                <Link
                  role="menuitem"
                  to="/app/profile"
                  onClick={() => setMenuOpen(false)}
                  className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-muted transition hover:bg-surface-muted hover:text-primary"
                >
                  <User className="size-4" aria-hidden="true" />
                  Profile
                </Link>

                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openComingSoon("settings");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-muted transition hover:bg-surface-muted hover:text-text"
                >
                  <Shield className="size-4" aria-hidden="true" />
                  Settings
                </button>

                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    openComingSoon("support");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-muted transition hover:bg-surface-muted hover:text-text"
                >
                  <LifeBuoy className="size-4" aria-hidden="true" />
                  Help &amp; Support
                </button>

                {isAdmin ? (
                  <Link
                    role="menuitem"
                    to="/admin/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-muted transition hover:bg-surface-muted hover:text-primary"
                  >
                    <Shield className="size-4" aria-hidden="true" />
                    Admin control center
                  </Link>
                ) : null}

                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    navigate("/login");
                  }}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-border px-3 py-2 text-sm text-text-muted transition hover:bg-danger-soft hover:text-danger"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
