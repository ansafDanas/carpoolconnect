import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Car,
  Flag,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { cn } from "../lib/utils";

/**
 * Admin control center.
 *
 * Deliberately a separate shell from the member app: a different nav, a
 * different tone, and no mixing of passenger navigation with moderation
 * tooling. The design language is shared so the product still feels like one
 * platform.
 */
const navItems = [
  { label: "Overview", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "People", to: "/admin/users", icon: Users },
  { label: "Rides", to: "/admin/rides", icon: Car },
  { label: "Bookings", to: "/admin/bookings", icon: Receipt },
  { label: "Reports", to: "/admin/reports", icon: ShieldAlert },
];

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-leaf text-marigold">
        <Car className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[15px] font-bold leading-tight text-primary">
          CarpoolConnect
        </span>
        {!compact ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
            <Flag className="size-3" aria-hidden="true" />
            Control center
          </span>
        ) : null}
      </span>
    </div>
  );
}

function AdminNav({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1 p-3" aria-label="Admin navigation">
      {navItems.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-leaf-soft font-semibold text-primary"
                  : "text-text-muted hover:bg-surface-muted hover:text-primary"
              )
            }
          >
            <Icon className="size-[18px] shrink-0" aria-hidden="true" />
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between px-4">
          <Brand compact />
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl border border-border text-text-muted transition hover:bg-surface-muted"
            aria-label={menuOpen ? "Close admin menu" : "Open admin menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? (
              <X className="size-[18px]" aria-hidden="true" />
            ) : (
              <Menu className="size-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-border">
            <AdminNav onNavigate={() => setMenuOpen(false)} />
            <div className="border-t border-border p-3">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition hover:bg-danger-soft hover:text-danger"
              >
                <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
                Log out
              </button>
            </div>
          </div>
        ) : null}
      </header>

      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex"
        aria-label="Admin sidebar"
      >
        <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <Brand />
        </div>

        <div className="flex-1 overflow-y-auto">
          <AdminNav />
        </div>

        <div className="shrink-0 border-t border-border p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-muted transition hover:bg-danger-soft hover:text-danger"
          >
            <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-64">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;


