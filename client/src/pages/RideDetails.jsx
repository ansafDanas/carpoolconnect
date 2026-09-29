import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import Input from "../components/ui/Input";
import LoadingState from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";
import { formatDate, formatTime, formatDateTime } from "../utils/format";
import TrackingControls from "../components/TrackingControls";
import TrackingMap from "../components/TrackingMap";

function RideDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user, isPassenger, isDriver } = useAuth();
  const [ride, setRide] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seatsToBook, setSeatsToBook] = useState(1);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");
  const [existingBooking, setExistingBooking] = useState(null);
  const [bookingCheckLoading, setBookingCheckLoading] = useState(true);
  const [bookingCheckError, setBookingCheckError] = useState("");
  const [locationState, setLocationState] = useState({
    loading: true,
    error: "",
    trackingActive: false,
    currentLocation: null,
  });
  const [locationRetry, setLocationRetry] = useState(0);
  const navigationTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(navigationTimerRef.current), []);

  useEffect(() => {
    let cancelled = false;
    // Reset the previous route before loading the next ride.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRide(null);
    setReviews([]);
    setError("");
    setLoading(true);

    const fetchRide = async () => {
      try {
        const response = await api.get(`/rides/${id}`);
        const reviewsResponse = await api.get(`/reviews/ride/${id}`);
        if (cancelled) {
          return;
        }
        setRide(response.data.ride);
        setReviews(reviewsResponse.data.data || []);
      } catch (requestError) {
        if (cancelled) {
          return;
        }
        setError(
          requestError.response?.status === 404
            ? "Ride not found."
            : requestError.response?.data?.message ||
              "Failed to load ride details. Please try again."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchRide();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    // Clear stale booking access before checking the next ride.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExistingBooking(null);

    const checkExistingBooking = async () => {
      if (!token || !id) {
        if (!cancelled) {
          setBookingCheckLoading(false);
        }
        return;
      }

      setBookingCheckLoading(true);
      setBookingCheckError("");

      try {
        const response = await api.get("/bookings", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const bookings = response.data.bookings || [];
        const currentBooking = bookings.find((bookingRecord) => {
          const bookingRideId =
            typeof bookingRecord.ride === "object"
              ? bookingRecord.ride?._id
              : bookingRecord.ride;

          return bookingRideId === id && bookingRecord.status !== "cancelled";
        });

        if (!cancelled) {
          setExistingBooking(currentBooking || null);
        }
      } catch (requestError) {
        if (!cancelled) {
          setBookingCheckError(
            requestError.response?.data?.message ||
              "Unable to verify your booking status."
          );
        }
      } finally {
        if (!cancelled) {
          setBookingCheckLoading(false);
        }
      }
    };

    checkExistingBooking();
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  const driverId =
    typeof ride?.driver === "object" ? ride.driver?._id : ride?.driver;
  const isRideOwner = Boolean(user?._id && driverId === user._id);
  const isDriverForRide = isDriver && isRideOwner;
  const isPassengerForRide = isPassenger && !isRideOwner;

  useEffect(() => {
    const canPollLocation = Boolean(
      ride &&
      isPassengerForRide &&
      ride.status === "active" &&
      !bookingCheckLoading &&
      !bookingCheckError &&
      existingBooking
    );

    if (!canPollLocation) {
      // Keep the passenger panel settled when polling is not applicable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocationState({
        loading: false,
        error: "",
        trackingActive: false,
        currentLocation: null,
      });
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;
    let requestInFlight = false;
    let consecutiveFailures = 0;
    let trackingActive = false;
    // Keep polling intent separate from the last server-reported state so a
    // transient first-request failure can still be retried with backoff.
    let shouldPoll = true;

    const clearPolling = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const scheduleNextPoll = (delay) => {
      clearPolling();
      if (!cancelled && shouldPoll && document.visibilityState === "visible") {
        timeoutId = window.setTimeout(fetchLocation, delay);
      }
    };

    const fetchLocation = async () => {
      if (cancelled || requestInFlight) {
        return;
      }

      requestInFlight = true;

      try {
        const response = await api.get(`/rides/${ride._id}/location`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const locationResponse = response.data;

        if (cancelled) {
          return;
        }

        trackingActive = locationResponse.trackingActive === true;
        shouldPoll = trackingActive;
        consecutiveFailures = 0;
        setLocationState({
          loading: false,
          error: "",
          trackingActive,
          currentLocation: locationResponse.currentLocation || null,
        });
        scheduleNextPoll(5000);
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        if (requestError.response?.status === 403) {
          trackingActive = false;
          shouldPoll = false;
          setLocationState({
            loading: false,
            error:
              "Live location is available to passengers with a confirmed booking.",
            trackingActive: false,
            currentLocation: null,
          });
          clearPolling();
          return;
        }

        consecutiveFailures += 1;
        setLocationState((currentState) => ({
          ...currentState,
          loading: false,
          error: "Live location is temporarily unavailable. Please try again.",
        }));
        const backoffDelay = Math.min(
          5000 * 2 ** Math.min(consecutiveFailures - 1, 4),
          80000
        );
        scheduleNextPoll(backoffDelay);
      } finally {
        requestInFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        clearPolling();
        return;
      }

      if (shouldPoll) {
        clearPolling();
        void fetchLocation();
      }
    };

    setLocationState({
      loading: true,
      error: "",
      trackingActive: false,
      currentLocation: null,
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void fetchLocation();

    return () => {
      cancelled = true;
      clearPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [bookingCheckError, bookingCheckLoading, existingBooking, id, isPassengerForRide, locationRetry, ride, token]);

  const formatLocationTime = (dateValue) => formatDateTime(dateValue);

  const handleSeatsChange = (event) => {
    const requestedSeats = Number(event.target.value);
    const maxSeats = ride?.seatsAvailable || 1;

    setSeatsToBook(Math.min(Math.max(requestedSeats || 1, 1), maxSeats));
  };

  const handleBooking = async () => {
    setBookingError("");
    setBookingSuccess("");

    if (!token) {
      setBookingError("Please log in before booking a ride.");
      return;
    }

    if (!ride || ride.seatsAvailable <= 0) {
      setBookingError("No seats are available.");
      return;
    }

    if (bookingCheckLoading || bookingCheckError) {
      return;
    }

    if (existingBooking) {
      setBookingError("You already have a booking for this ride.");
      return;
    }

    if (seatsToBook < 1 || seatsToBook > ride.seatsAvailable) {
      setBookingError("Please select a valid number of available seats.");
      return;
    }

    if (booking) {
      return;
    }

    setBooking(true);

    try {
      await api.post(
        "/bookings",
        {
          rideId: ride._id,
          seats: Number(seatsToBook),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setBookingSuccess("Ride booked successfully!");

      navigationTimerRef.current = setTimeout(() => {
        navigate("/app/my-bookings");
      }, 1000);
    } catch (requestError) {
      console.warn("Ride details request failed", requestError.response?.status || "network");
      setBookingError(
        requestError.response?.data?.message ||
          "Failed to book this ride. Please try again."
      );
    } finally {
      setBooking(false);
    }
  };

  const backLinkClasses =
    "inline-flex items-center gap-2 text-sm font-bold text-accent no-underline transition hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const fieldLabel =
    "mb-1 block text-xs font-extrabold uppercase tracking-[0.1em] text-text-muted";
  const fieldValue = "block break-words text-base font-bold text-primary";
  const trackingMessage = "m-0 text-sm leading-6 text-text-muted";

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-12 sm:px-6 sm:py-16 lg:px-0">
      <Link className={`${backLinkClasses} mb-10`} to="/app/find-rides">
        <span aria-hidden="true">←</span> Back to Find Rides
      </Link>

      {loading && (
        <LoadingState
          className="mb-8"
          message="Loading ride details..."
        />
      )}

      {!loading && error && (
        <EmptyState
          className="mb-8"
          title={error}
          description="We could not find the ride you requested."
          action={<Link className={backLinkClasses} to="/app/find-rides">Back to Find Rides</Link>}
        />
      )}

      {!loading && !error && ride && (
        <>
          <PageHeader
            eyebrow="Ride details"
            title={`${ride.source} → ${ride.destination}`}
            description="Review the trip information before booking your seat."
          />

          <Card className="p-5 shadow-elevated sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
              <div className="grid min-w-0 gap-1" aria-label={`Route from ${ride.source} to ${ride.destination}`}>
                <p className={fieldLabel}>Route</p>
                <strong className="break-words text-2xl font-extrabold leading-tight text-primary sm:text-3xl">{ride.source}</strong>
                <span className="text-xl leading-none text-accent" aria-hidden="true">↓</span>
                <strong className="break-words text-2xl font-extrabold leading-tight text-primary sm:text-3xl">{ride.destination}</strong>
              </div>
              <Badge tone={ride.status}>{ride.status}</Badge>
            </div>

            <div className="grid grid-cols-1 gap-6 py-6 sm:grid-cols-2">
              <div className="min-w-0">
                <span className={fieldLabel}>Date</span>
                <strong className={fieldValue}>{formatDate(ride.date)}</strong>
              </div>
              <div className="min-w-0">
                <span className={fieldLabel}>Time</span>
                <strong className={fieldValue}>{formatTime(ride.date)}</strong>
              </div>
              <div className="min-w-0">
                <span className={fieldLabel}>Available seats</span>
                <strong className={fieldValue}>{ride.seatsAvailable}</strong>
              </div>
              <div className="min-w-0">
                <span className={fieldLabel}>Suggested contribution</span>
                <strong className={fieldValue}>₹{ride.price}</strong>
              </div>
              <div className="min-w-0">
                <span className={fieldLabel}>Vehicle</span>
                <strong className={fieldValue}>{ride.vehicle || "Vehicle not specified"}</strong>
              </div>
              <div className="min-w-0">
                <span className={fieldLabel}>Driver</span>
                <strong className={fieldValue}>{typeof ride.driver === "object" ? ride.driver?.name || "Driver information unavailable" : "Driver information unavailable"}</strong>
              </div>
            </div>
            <p className="m-0 rounded-xl bg-surface-muted p-4 text-sm leading-6 text-text-muted">
              This is a shared carpool ride. Contributions are optional and
              are not processed as payments here.
            </p>

            {isDriverForRide && (
              <TrackingControls
                ride={ride}
                onRideUpdate={(updatedRide) => setRide(updatedRide)}
              />
            )}

            {isPassengerForRide && (
              <section className="mt-6 grid gap-4 rounded-2xl border border-border bg-accent-soft/40 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <p className={fieldLabel}>Live Driver Location</p>
                    <h2 className="m-0 text-xl font-extrabold tracking-tight text-primary sm:text-2xl">Live tracking</h2>
                  </div>
                  {locationState.trackingActive && (
                    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-bold text-success">
                      <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_4px_rgba(22,138,91,0.15)]" aria-hidden="true" />
                      Tracking active
                    </span>
                  )}
                </div>

                {locationState.loading && (
                  <LoadingState message="Checking live location..." />
                )}

                {!locationState.loading && locationState.error && (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <Alert className="min-w-0 flex-1" tone="error" role="alert">{locationState.error}</Alert>
                    <Button
                      className="shrink-0"
                      variant="secondary"
                      type="button"
                      onClick={() => setLocationRetry((value) => value + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                )}

                {!locationState.loading &&
                  !locationState.error &&
                  ride.status === "completed" && (
                    <p className={trackingMessage}>
                      This ride has been completed.
                    </p>
                  )}

                {!locationState.loading &&
                  !locationState.error &&
                  ride.status === "cancelled" && (
                    <p className={trackingMessage}>
                      This ride has been cancelled.
                    </p>
                  )}

                {!locationState.loading &&
                  !locationState.error &&
                  ride.status === "active" &&
                  !locationState.trackingActive &&
                  locationState.currentLocation && (
                    <p className={trackingMessage}>
                      The driver has stopped live tracking.
                    </p>
                  )}

                {!locationState.loading &&
                  !locationState.error &&
                  ride.status === "active" &&
                  !locationState.trackingActive &&
                  !locationState.currentLocation && (
                    <p className={trackingMessage}>
                      The driver hasn&apos;t started the journey yet. Live
                      location will appear when tracking starts.
                    </p>
                  )}

                {!locationState.loading &&
                  !locationState.error &&
                  locationState.trackingActive &&
                  !locationState.currentLocation && (
                    <p className={trackingMessage}>
                      The driver has started tracking. Waiting for the first
                      location...
                    </p>
                  )}

                {!locationState.loading &&
                  !locationState.error &&
                  locationState.trackingActive &&
                  locationState.currentLocation && (
                    <>
                      <p className={trackingMessage}>
                        Driver is currently on the journey.
                      </p>
                      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <div className="min-w-0">
                          <span className={fieldLabel}>Latitude</span>
                          <strong className={fieldValue}>{locationState.currentLocation.latitude}</strong>
                        </div>
                        <div className="min-w-0">
                          <span className={fieldLabel}>Longitude</span>
                          <strong className={fieldValue}>{locationState.currentLocation.longitude}</strong>
                        </div>
                        {locationState.currentLocation.accuracy !== undefined && (
                          <div className="min-w-0">
                            <span className={fieldLabel}>Accuracy</span>
                            <strong className={fieldValue}>{locationState.currentLocation.accuracy} m</strong>
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className={fieldLabel}>Last updated</span>
                          <strong className={fieldValue}>
                            {formatLocationTime(locationState.currentLocation.updatedAt)}
                          </strong>
                        </div>
                      </div>
                      <TrackingMap currentLocation={locationState.currentLocation} />
                    </>
                  )}
              </section>
            )}

            {isPassengerForRide && (
              <div className="mt-6 grid gap-4 border-t border-border pt-6">
                <div>
                  <p className={fieldLabel}>Reserve your seats</p>
                  <h2 className="m-0 text-xl font-extrabold tracking-tight text-primary sm:text-2xl">Book this ride</h2>
                </div>
                {bookingCheckLoading ? (
                  <LoadingState message="Checking your booking status..." />
                ) : bookingCheckError ? (
                  <Alert tone="error" role="alert">{bookingCheckError}</Alert>
                ) : existingBooking ? (
                  <Alert tone="info">
                    Already booked ({existingBooking.seats}{" "}
                    {existingBooking.seats === 1 ? "seat" : "seats"}).
                  </Alert>
                ) : ride.seatsAvailable > 0 ? (
                  <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(9rem,11rem)_minmax(0,1fr)_auto]">
                    <Input
                      id="seats-to-book"
                      label="Seats to book"
                      type="number"
                      min="1"
                      max={ride.seatsAvailable}
                      value={seatsToBook}
                      onChange={handleSeatsChange}
                      disabled={booking}
                      required
                    />
                    <p className="m-0 text-base font-extrabold text-primary">
                      Estimated contribution: ₹{ride.price * seatsToBook}
                    </p>
                    <Button
                      className="w-full min-w-[9rem] sm:w-auto"
                      type="button"
                      onClick={handleBooking}
                      loading={booking}
                    >
                      {booking ? "Booking..." : "Book This Ride"}
                    </Button>
                  </div>
                ) : (
                  <Alert tone="warning">No seats available</Alert>
                )}

                {bookingError && <Alert tone="error" role="alert">{bookingError}</Alert>}
                {bookingSuccess && <Alert tone="success">{bookingSuccess}</Alert>}
              </div>
            )}
          </Card>

          <section className="mt-8 border-t border-border pt-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className={fieldLabel}>Passenger feedback</p>
                <h2 className="m-0 text-xl font-extrabold tracking-tight text-primary sm:text-2xl">Reviews</h2>
              </div>
              <strong className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-extrabold text-primary">
                {reviews.length}
              </strong>
            </div>
            {reviews.length === 0 ? (
              <p className="m-0 text-sm text-text-muted">No reviews for this ride yet.</p>
            ) : (
              <div className="grid gap-2.5">
                {reviews.map((review) => (
                  <article className="rounded-xl border border-border bg-surface-muted p-4" key={review._id}>
                    <div className="flex items-center justify-between gap-3 text-sm text-primary">
                      <strong>{review.reviewer?.name || "Passenger"}</strong>
                      <span className="whitespace-nowrap tracking-[0.08em] text-accent">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                    </div>
                    {review.comment && <p className="mt-2 text-sm text-text-muted">{review.comment}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>

          <Link className={`${backLinkClasses} mt-8`} to="/app/find-rides">
            <span aria-hidden="true">←</span> Back to Find Rides
          </Link>
        </>
      )}
    </main>
  );
}

export default RideDetails;
