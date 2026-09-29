/* eslint-disable react-hooks/set-state-in-effect -- data loading in an effect is the established pattern in this codebase */
import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { ComingSoonButton, useComingSoon } from "../components/ComingSoon";
import TripChat from "../components/TripChat";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { SkeletonList } from "../components/ui/LoadingState";
import { formatDate, formatTime } from "../utils/format";
import { cn } from "../lib/utils";

/**
 * Booking-scoped messaging.
 *
 * The backend exposes chat only between the two people on a confirmed trip,
 * so this screen derives its conversation list from the caller's confirmed
 * bookings. Delivery is by short-interval polling, which is stated plainly
 * rather than presented as realtime.
 */
function Messages() {
  const { token, user } = useAuth();
  const { openComingSoon } = useComingSoon();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await api.get("/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const confirmed = Array.isArray(response.data.bookings)
        ? response.data.bookings.filter((booking) => booking.status === "confirmed")
        : [];

      setBookings(confirmed);
      setError("");
      setActiveId((current) => current || confirmed[0]?._id || "");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "We could not load your conversations. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void load();
    } else {
      setLoading(false);
    }
  }, [load, token]);

  const active = bookings.find((booking) => booking._id === activeId) || bookings[0];

  // The other person is the driver, unless you are the driver on that ride.
  const resolveOther = (booking) => {
    const rideDriver = booking?.ride?.driver;
    const driverId = typeof rideDriver === "object" ? rideDriver?._id : rideDriver;

    const iAmDriver = driverId && driverId === user?._id;
    const other = iAmDriver ? booking.passenger : rideDriver;

    return typeof other === "object" && other ? other : null;
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Trip chat"
        title="Messages"
        description="Chat with the people you are sharing a ride with. Conversations open once a booking is confirmed."
        action={
          <ComingSoonButton
            feature="messaging"
            variant="ghost"
            size="sm"
            icon={MessageSquare}
          >
            Realtime chat
          </ComingSoonButton>
        }
      />

      {error ? (
        <Alert tone="error" title="We could not load your conversations">
          <p>{error}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={load}>
            Try again
          </Button>
        </Alert>
      ) : null}

      {loading ? (
        <SkeletonList rows={3} />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Once a booking is confirmed, you and the other person on the trip can message each other here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <nav
            className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
            aria-label="Your conversations"
          >
            <ul className="divide-y divide-border">
              {bookings.map((booking) => {
                const other = resolveOther(booking);
                const isActive = active?._id === booking._id;

                return (
                  <li key={booking._id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(booking._id)}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition",
                        isActive ? "bg-leaf-soft" : "hover:bg-surface-muted"
                      )}
                    >
                      {other?.profileImage ? (
                        <img
                          alt=""
                          className="size-9 shrink-0 rounded-full object-cover"
                          src={other.profileImage}
                        />
                      ) : (
                        <span
                          className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary"
                          aria-hidden="true"
                        >
                          {(other?.name || "?").slice(0, 1).toUpperCase()}
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-primary">
                          {other?.name || "Travel buddy"}
                        </span>
                        <span className="block truncate text-xs text-text-muted">
                          {booking.ride?.source} → {booking.ride?.destination}
                        </span>
                      </span>

                      <Badge tone="success" className="shrink-0">
                        {formatTime(booking.ride?.date)}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0">
            {active ? (
              <>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-text-muted">
                  <span className="font-medium text-primary">
                    {active.ride?.source} → {active.ride?.destination}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {formatDate(active.ride?.date)}, {formatTime(active.ride?.date)}
                  </span>
                </div>

                <TripChat
                  key={active._id}
                  bookingId={active._id}
                  token={token}
                  currentUserId={user?._id}
                  otherPerson={resolveOther(active)}
                />
              </>
            ) : null}

            <p className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
              <Send className="size-3" aria-hidden="true" />
              Messages refresh every few seconds while this page is open.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
        <p className="text-sm text-text-muted">
          Need to report a problem instead of chatting?
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openComingSoon("support")}
        >
          Safety &amp; support
        </Button>
      </div>
    </div>
  );
}

export default Messages;
