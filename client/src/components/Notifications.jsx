/* eslint-disable react-refresh/only-export-components -- this module also exports shared hooks and helpers alongside its components */
/* eslint-disable react-hooks/set-state-in-effect -- data loading in an effect is the established pattern in this codebase */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bell, BellOff, Car, Check, MessageSquare, ShieldAlert, Star } from "lucide-react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { cn } from "../lib/utils";

/**
 * In-app notifications, loaded by polling (the backend has no push channel).
 * The desktop bell opens a compact popover; mobile and the dedicated page
 * show the full list.
 */

const POLL_INTERVAL_MS = 30000;

const notificationIcon = {
  booking_created: Car,
  booking_cancelled: Car,
  ride_cancelled: Car,
  ride_completed: Car,
  review_received: Star,
  message: MessageSquare,
  safety: ShieldAlert,
  // Emitted by the ride-request and moderation flows.
  request_received: MessageSquare,
  request_accepted: Check,
  account_warning: ShieldAlert,
};

/**
 * Where a notification points, using only references the backend already
 * stores. Returns null when there is nothing to open, so the item simply
 * marks as read instead of linking nowhere.
 */
const notificationLink = (notification) => {
  if (notification.relatedBooking) {
    return "/app/my-bookings";
  }
  if (notification.relatedRide) {
    return `/app/rides/${notification.relatedRide}`;
  }
  if (notification.type === "request_received") {
    return "/app/request-ride";
  }
  if (notification.type === "account_warning" || notification.type === "safety") {
    return "/app/profile";
  }
  return null;
};

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!token) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);

      try {
        const response = await api.get("/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!mountedRef.current) return;
        setNotifications(Array.isArray(response.data.data) ? response.data.data : []);
        setError("");
      } catch (requestError) {
        if (!mountedRef.current) return;
        setError(
          requestError.response?.data?.message ||
            "Notifications could not be loaded. Please try again."
        );
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Poll so a notification still arrives if the tab was left open quietly.
  useEffect(() => {
    if (!token) return undefined;

    const timer = setInterval(() => {
      void load({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [load, token]);


  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const markRead = useCallback(
    async (notification) => {
      if (notification.read) return;

      setNotifications((current) =>
        current.map((item) =>
          item._id === notification._id ? { ...item, read: true } : item
        )
      );

      try {
        await api.patch(
          `/notifications/${notification._id}/read`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch {
        if (!mountedRef.current) return;
        setNotifications((current) =>
          current.map((item) =>
            item._id === notification._id ? { ...item, read: false } : item
          )
        );
        setError("That notification could not be updated. Please try again.");
      }
    },
    [token]
  );

  const markAllRead = useCallback(async () => {
    if (!unreadCount) return;

    try {
      await api.patch(
        "/notifications/read-all",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!mountedRef.current) return;
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, read: true }))
      );
    } catch (requestError) {
      if (!mountedRef.current) return;
      setError(
        requestError.response?.data?.message ||
          "Notifications could not be updated. Please try again."
      );
    }
  }, [token, unreadCount]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      markRead,
      markAllRead,
      reload: load,
    }),
    [notifications, unreadCount, loading, error, markRead, markAllRead, load]
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return (
    useContext(NotificationsContext) || {
      notifications: [],
      unreadCount: 0,
      loading: false,
    }
  );
}


/** Desktop bell with a compact popover of the most recent notifications. */
export function NotificationBell({ className }) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const recent = notifications.slice(0, 5);

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="relative grid size-10 place-items-center rounded-xl border border-border bg-surface text-text-muted transition hover:border-leaf/40 hover:bg-leaf-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="size-[18px]" aria-hidden="true" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-clay px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-surface">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-elevated">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="font-display text-sm font-bold text-primary">Notifications</h2>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="text-xs font-semibold text-leaf hover:underline"
                onClick={markAllRead}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Loading…</p>
          ) : recent.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <BellOff className="mx-auto size-5 text-text-muted" aria-hidden="true" />
              <p className="mt-2 text-sm text-text-muted">No notifications yet.</p>
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {recent.map((notification) => {
                const Icon = notificationIcon[notification.type] || Bell;
                const target = notificationLink(notification);

                return (
                  <li key={notification._id}>
                    {target ? (
                      <Link
                        to={target}
                        onClick={() => {
                          markRead(notification);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-muted",
                          !notification.read && "bg-leaf-soft/40"
                        )}
                      >
                        <Icon className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-primary">
                            {notification.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-text-muted">
                            {notification.message}
                          </span>
                        </span>
                      </Link>
                    ) : (
                    <button
                      type="button"
                      onClick={() => markRead(notification)}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-muted",
                        !notification.read && "bg-leaf-soft/40"
                      )}
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-primary">
                          {notification.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-text-muted">
                          {notification.message}
                        </span>
                      </span>
                    </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-border px-4 py-3">
            <Link
              to="/app/notifications"
              className="flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-primary transition hover:bg-surface-muted"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { notificationIcon, notificationLink };
