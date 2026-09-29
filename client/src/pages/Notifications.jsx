import { Bell, BellOff, CheckCheck } from "lucide-react";

import { useNotifications } from "../components/Notifications";
import { ComingSoonButton } from "../components/ComingSoon";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { SkeletonList } from "../components/ui/LoadingState";
import { formatDateTime } from "../utils/format";
import { cn } from "../lib/utils";

/**
 * Full notification history. Notifications arrive by polling; there is no
 * push channel, so "push alerts" stays explicitly marked as coming soon
 * rather than being implied to already work.
 */
function Notifications() {
  const { notifications, unreadCount, loading, error, markRead, markAllRead, reload } =
    useNotifications();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Your activity"
        title="Notifications"
        description="Booking updates, ride changes and reviews on trips you are part of."
        action={
          <>
            {unreadCount > 0 ? (
              <Button variant="secondary" size="sm" onClick={markAllRead}>
                <CheckCheck aria-hidden="true" />
                Mark all read
              </Button>
            ) : null}
            <ComingSoonButton
              feature="pushNotifications"
              variant="ghost"
              size="sm"
              icon={Bell}
            >
              Push alerts
            </ComingSoonButton>
          </>
        }
      />

      {error ? (
        <Alert tone="error" title="We could not load your notifications">
          <p>{error}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={reload}>
            Try again
          </Button>
        </Alert>
      ) : null}

      {loading ? (
        <SkeletonList rows={4} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Nothing new"
          description="When you book a seat, a ride changes, or somebody leaves you a review, it will show up here."
        />
      ) : (
        <ul className="grid gap-2">
          {notifications.map((notification) => (
            <li key={notification._id}>
              <button
                type="button"
                onClick={() => markRead(notification)}
                aria-label={
                  notification.read
                    ? notification.title
                    : `${notification.title}, unread. Mark as read.`
                }
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition",
                  notification.read
                    ? "border-border bg-surface hover:border-leaf/30"
                    : "border-leaf/30 bg-leaf-soft/40 hover:border-leaf/50"
                )}
              >
                <span
                  className="mt-1 size-2 shrink-0 rounded-full"
                  style={{
                    background: notification.read ? "transparent" : "var(--color-leaf)",
                  }}
                  aria-hidden="true"
                />

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-primary">
                      {notification.title}
                    </span>
                    {!notification.read ? <Badge tone="success">New</Badge> : null}
                  </span>
                  <span className="mt-0.5 block text-sm leading-6 text-text-muted">
                    {notification.message}
                  </span>
                  <span className="mt-1 block text-xs text-text-muted">
                    {formatDateTime(notification.createdAt)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Notifications;
