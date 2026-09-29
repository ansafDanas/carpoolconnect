/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import TrackingControls from "../components/TrackingControls";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { DriverSavings } from "../components/ui/Contribution";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";
import { formatDate, formatTime } from "../utils/format";

function MyRides() {
  const { token } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestsByRide, setRequestsByRide] = useState({});
  const [busyRequestId, setBusyRequestId] = useState("");
  const [summaries, setSummaries] = useState({});
  // The savings panel is scoped to a booking, so the ids are resolved from
  // the driver's own booking list rather than guessed from a ride id.
  const [bookingIdsByRide, setBookingIdsByRide] = useState({});

  const loadDriverBookings = useCallback(
    async () => {
      try {
        const response = await api.get("/bookings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const list = Array.isArray(response.data.bookings)
          ? response.data.bookings
          : [];

        const grouped = {};
        for (const booking of list) {
          const rideRef = booking.ride;
          const rideId =
            typeof rideRef === "object" ? rideRef?._id : rideRef;
          if (!rideId) {
            continue;
          }
          if (!grouped[rideId]) {
            grouped[rideId] = [];
          }
          grouped[rideId].push(booking._id);
        }
        setBookingIdsByRide(grouped);
      } catch (bookingError) {
        // A missing driver booking list only affects the optional savings
        // panel, so it must not block the page.
        console.warn(
          "Driver bookings failed",
          bookingError.response?.status || "network"
        );
      }
    },
    [token]
  );

  const loadIncomingRequests = useCallback(
    async (rideId) => {
      try {
        const response = await api.get(`/ride-requests/ride/${rideId}/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRequestsByRide((current) => ({
          ...current,
          [rideId]: response.data.data || [],
        }));
      } catch (requestError) {
        console.warn(
          "Ride requests failed",
          requestError.response?.status || "network"
        );
      }
    },
    [token]
  );

  const loadSavings = async (bookingId) => {
    try {
      const response = await api.get(`/trip/bookings/${bookingId}/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSummaries((current) => ({ ...current, [bookingId]: response.data.data }));
    } catch {
      // A missing summary is not worth surfacing to the driver.
    }
  };

  const respondToRequest = async (requestId, action) => {
    setError("");
    setBusyRequestId(requestId);

    try {
      await api.patch(`/ride-requests/${requestId}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchMyRides();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not update that request."
      );
    } finally {
      setBusyRequestId("");
    }
  };

  const fetchMyRides = useCallback(async () => {
    try {
      const response = await api.get("/rides/my-rides", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setRides(response.data.data || []);
    } catch (requestError) {
      console.warn("Rides request failed", requestError.response?.status || "network");
      setError(
        requestError.response?.data?.message ||
          "Failed to load your rides. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void fetchMyRides();
    } else {
      setLoading(false);
      setError("Please log in to view your rides.");
    }
  }, [fetchMyRides, token]);

  useEffect(() => {
    if (token) {
      void loadDriverBookings();
    }
  }, [loadDriverBookings, token]);

  // Savings are only meaningful once a trip is finished, and the summary
  // endpoint is booking-scoped, so this loads per real booking id in an
  // effect rather than firing a request during render.
  useEffect(() => {
    if (loading || error) {
      return;
    }

    const pending = [];

    for (const ride of rides) {
      if (ride.status !== "completed") {
        continue;
      }
      for (const bookingId of bookingIdsByRide[ride._id] || []) {
        if (!summaries[bookingId]) {
          pending.push(bookingId);
        }
      }
    }

    for (const bookingId of pending) {
      void loadSavings(bookingId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, rides, bookingIdsByRide, summaries]);

  const detailLabel =
    "min-w-[5.625rem] shrink-0 text-xs font-bold uppercase tracking-[0.05em] text-primary";

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-12 sm:px-6 sm:py-16 lg:px-0">
      <PageHeader
        className="max-w-[54rem]"
        eyebrow="Your activity"
        title="My Rides"
        description="Manage the journeys you have shared with the CarpoolConnect community."
        action={
          <Link
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-extrabold text-white no-underline shadow-lg shadow-primary/15 transition duration-200 hover:-translate-y-0.5 hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto"
            to="/app/offer-ride"
          >
            Offer a Ride <span aria-hidden="true">→</span>
          </Link>
        }
      />

      {loading && (
        <LoadingState className="mb-8" message="Loading your rides..." />
      )}

      {!loading && error && (
        <Alert className="mb-8" tone="error" role="alert">
          {error}
        </Alert>
      )}

      {!loading && !error && rides.length === 0 && (
        <EmptyState
          className="mb-8"
          title="No rides yet"
          description="You haven't offered any rides yet. Start by sharing your journey."
          action={
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-extrabold text-white no-underline shadow-lg shadow-primary/15 transition duration-200 hover:-translate-y-0.5 hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              to="/app/offer-ride"
            >
              Offer a Ride
            </Link>
          }
        />
      )}

      {!loading && !error && rides.length > 0 && (
        <section className="grid gap-5" aria-labelledby="my-rides-results-title">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-text-muted">
              Your journey history
            </p>
            <h2
              id="my-rides-results-title"
              className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl"
            >
              {rides.length} {rides.length === 1 ? "ride" : "rides"}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rides.map((ride) => (
              <Card
                className="flex flex-col p-5 transition duration-200 hover:-translate-y-1 hover:shadow-elevated sm:p-6"
                as="article"
                key={ride._id}
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <h2 className="min-w-0 break-words text-lg font-extrabold leading-snug text-primary">
                    {ride.source}{" "}
                    <span aria-hidden="true">→</span>{" "}
                    {ride.destination}
                  </h2>
                  <Badge tone={ride.status}>{ride.status}</Badge>
                </div>

                <div className="grid flex-1 gap-2.5">
                  <p className="flex items-baseline gap-2 break-words text-sm text-text-muted"><strong className={detailLabel}>Date</strong> {formatDate(ride.date)}</p>
                  <p className="flex items-baseline gap-2 break-words text-sm text-text-muted"><strong className={detailLabel}>Time</strong> {formatTime(ride.date)}</p>
                  <p className="flex items-baseline gap-2 break-words text-sm text-text-muted"><strong className={detailLabel}>Seats</strong> {ride.seatsAvailable} available</p>
                  <p className="flex items-baseline gap-2 break-words text-sm text-text-muted"><strong className={detailLabel}>Contribution</strong> ₹{ride.price}</p>
                  <p className="flex items-baseline gap-2 break-words text-sm text-text-muted">
                    <strong className={detailLabel}>Vehicle</strong>{" "}
                    {ride.vehicle || "Vehicle not specified"}
                  </p>
                </div>

                {/* Summaries are booking-scoped, so the first real booking on
                    this ride represents the card. Loading happens in an
                    effect above, never during render. */}
                {ride.status === "completed" &&
                  (() => {
                    const firstBookingId = (bookingIdsByRide[ride._id] || [])[0];
                    const summary = firstBookingId
                      ? summaries[firstBookingId]
                      : null;
                    if (!summary) {
                      return null;
                    }
                    return (
                      <div className="mt-4"><DriverSavings summary={summary} /></div>
                    );
                  })()}

                <div className="mt-4 border-t border-border pt-4">
                  {requestsByRide[ride._id] === undefined ? (
                    <button
                      className="text-sm font-extrabold text-accent transition hover:text-accent-hover"
                      onClick={() => loadIncomingRequests(ride._id)}
                      type="button"
                    >
                      View rider requests
                    </button>
                  ) : requestsByRide[ride._id].length === 0 ? (
                    <p className="text-sm text-text-muted">
                      No rider requests for this trip yet.
                    </p>
                  ) : (
                    <ul className="grid gap-3">
                      {requestsByRide[ride._id].map((match) => (
                        <li
                          className="rounded-2xl border border-border bg-surface-muted p-4"
                          key={match.request._id}
                        >
                          <p className="font-extrabold text-primary">
                            {match.request.pickup} → {match.request.drop}
                          </p>
                          <p className="mt-1 text-sm text-text-muted">
                            {match.request.seats} seat(s) ·{" "}
                            {formatTime(match.request.earliestTime)} –{" "}
                            {formatTime(match.request.latestTime)}
                            {match.detourKm !== null
                              ? ` · ${match.detourKm} km detour`
                              : ""}
                          </p>
                          {typeof match.request.rider === "object" && (
                            <p className="mt-1 text-sm font-bold text-text-muted">
                              {match.request.rider?.name} · rated{" "}
                              {match.request.rider?.rating ?? "new"}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              onClick={() =>
                                respondToRequest(match.request._id, "accept")
                              }
                              loading={busyRequestId === match.request._id}
                              type="button"
                            >
                              Accept
                            </Button>
                            <Button
                              onClick={() =>
                                respondToRequest(match.request._id, "decline")
                              }
                              variant="secondary"
                              loading={busyRequestId === match.request._id}
                              type="button"
                            >
                              Decline
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <TrackingControls
                  ride={ride}
                  onRideUpdate={(updatedRide) =>
                    setRides((currentRides) =>
                      currentRides.map((currentRide) =>
                        currentRide._id === updatedRide._id
                          ? updatedRide
                          : currentRide
                      )
                    )
                  }
                />
              </Card>
            ))}
          </div>
        </section>
      )}

      <Link
        className="mt-8 inline-flex items-center text-sm font-bold text-accent no-underline transition hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        to="/app/dashboard"
      >
        Back to Dashboard
      </Link>
    </main>
  );
}

export default MyRides;




