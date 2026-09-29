/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";
import Select from "../components/ui/Select";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import ContributionSlider from "../components/ui/Contribution";
import TripChat from "../components/TripChat";
import { formatDate, formatTime } from "../utils/format";

function MyBookings() {
  const { token, user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cancellingId, setCancellingId] = useState("");
  const [pendingCancellation, setPendingCancellation] = useState(null);
  const [reviewingId, setReviewingId] = useState("");
  const [reviewRatings, setReviewRatings] = useState({});
  const [reviewComments, setReviewComments] = useState({});
  const [reviewErrors, setReviewErrors] = useState({});
  const [reviewSuccesses, setReviewSuccesses] = useState({});
  const [draftContributions, setDraftContributions] = useState({});
  const [payingId, setPayingId] = useState("");

  const payContribution = async (booking, amount) => {
    setError("");
    setSuccess("");
    setPayingId(booking._id);

    try {
      await api.patch(
        `/trip/bookings/${booking._id}/contribution`,
        { contributionAmount: amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await api.post(
        `/trip/bookings/${booking._id}/pay`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess("Settled. Your driver can see that fuel is covered.");
      await fetchBookings();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not settle the contribution."
      );
    } finally {
      setPayingId("");
    }
  };

  const fetchBookings = useCallback(async () => {
    try {
      const response = await api.get("/bookings", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setBookings(response.data.bookings || []);
    } catch (requestError) {
      console.warn("Bookings request failed", requestError.response?.status || "network");
      setError(
        requestError.response?.data?.message ||
          "Failed to load your bookings. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void fetchBookings();
    } else {
      setLoading(false);
      setError("Please log in to view your bookings.");
    }
  }, [fetchBookings, token]);

  const cancelBooking = async (bookingId) => {
    setError("");
    setSuccess("");
    setCancellingId(bookingId);

    try {
      await api.patch(
        `/bookings/${bookingId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSuccess("Booking cancelled successfully.");
      setPendingCancellation(null);
      await fetchBookings();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Failed to cancel this booking. Please try again."
      );
    } finally {
      setCancellingId("");
    }
  };

  const submitReview = async (booking) => {
    const rating = Number(reviewRatings[booking._id] || 5);
    const ride = booking.ride;

    if (!ride || ride.status !== "completed") {
      return;
    }

    setReviewingId(booking._id);
    setReviewErrors({ ...reviewErrors, [booking._id]: "" });
    setReviewSuccesses({ ...reviewSuccesses, [booking._id]: "" });

    try {
      await api.post(
        "/reviews",
        {
          rideId: ride._id,
          bookingId: booking._id,
          rating,
          comment: reviewComments[booking._id] || "",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setReviewSuccesses({
        ...reviewSuccesses,
        [booking._id]: "Review submitted successfully.",
      });
    } catch (requestError) {
      console.warn("Review request failed", requestError.response?.status || "network");
      setReviewErrors({
        ...reviewErrors,
        [booking._id]:
          requestError.response?.data?.message ||
          "Failed to submit your review. Please try again.",
      });
    } finally {
      setReviewingId("");
    }
  };

  const detailLabel =
    "min-w-[4.875rem] shrink-0 text-xs font-bold uppercase tracking-[0.05em] text-primary";

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-12 sm:px-6 sm:py-16 lg:px-0">
      <PageHeader
        className="max-w-[45rem]"
        eyebrow="Your activity"
        title="My Bookings"
        description="Keep track of the rides you have booked."
      />

      {success && <Alert className="mb-6" tone="success">{success}</Alert>}
      {loading && (
        <LoadingState
          className="mb-8"
          message="Loading your bookings..."
        />
      )}
      {!loading && error && (
        <Alert className="mb-8" tone="error" role="alert">
          {error}
        </Alert>
      )}

      {!loading && !error && bookings.length === 0 && (
        <EmptyState
          className="mb-8"
          title="No bookings yet"
          description="You haven&apos;t booked any rides yet."
          action={
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-extrabold text-white no-underline shadow-lg shadow-primary/15 transition duration-200 hover:-translate-y-0.5 hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              to="/app/find-rides"
            >
              Find a Ride
            </Link>
          }
        />
      )}

      {!loading && !error && bookings.length > 0 && (
        <section className="grid gap-5" aria-labelledby="bookings-results-title">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.1em] text-text-muted">
              Your journey history
            </p>
            <h2
              id="bookings-results-title"
              className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl"
            >
              {bookings.length} {bookings.length === 1 ? "booking" : "bookings"}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bookings.map((booking) => {
              const ride = booking.ride;
              const rideDriverId = typeof ride?.driver === "object"
                ? ride?.driver?._id
                : ride?.driver;
              // A driver now also sees bookings made on their own rides, so
              // the per-card wording and controls have to reflect whose trip
              // this actually is.
              const isMyRide = Boolean(
                rideDriverId && user?._id && rideDriverId === user._id
              );
              const driverName = typeof ride?.driver === "object"
                ? ride.driver?.name
                : "";

              return (
                <Card
                  className="flex flex-col gap-4 p-5 transition duration-200 hover:-translate-y-1 hover:shadow-elevated sm:p-6"
                  as="article"
                  key={booking._id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                    <h2 className="min-w-0 break-words text-lg font-extrabold leading-snug text-primary">
                      {ride?.source && ride?.destination
                        ? <>{ride.source} <span aria-hidden="true">→</span> {ride.destination}</>
                        : "Ride details unavailable"}
                    </h2>
                    <Badge tone={booking.status}>{booking.status}</Badge>
                  </div>

                  {ride ? (
                    <div className="grid flex-1 gap-2.5">
                      <p className="flex items-baseline gap-2 break-words text-sm text-text-muted"><strong className={detailLabel}>Date</strong> {formatDate(ride.date)}</p>
                      <p className="flex items-baseline gap-2 break-words text-sm text-text-muted"><strong className={detailLabel}>Time</strong> {formatTime(ride.date)}</p>
                      <p className="flex items-baseline gap-2 break-words text-sm text-text-muted"><strong className={detailLabel}>Seats</strong> {booking.seats || 1} booked</p>
                      {!isMyRide && (
                        <p className="flex items-baseline gap-2 break-words text-sm text-text-muted"><strong className={detailLabel}>Contribution</strong> {booking.contributionAmount ? `₹${booking.contributionAmount}` : `₹${ride.price * (booking.seats || 1)}`}</p>
                      )}
                      <p className="flex items-baseline gap-2 break-words text-sm text-text-muted"><strong className={detailLabel}>Vehicle</strong> {ride.vehicle || "Vehicle not specified"}</p>
                      {driverName && <p className="flex items-baseline gap-2 break-words text-sm text-text-muted"><strong className={detailLabel}>Driver</strong> {driverName}</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">
                      Ride details are unavailable.
                    </p>
                  )}

                  {ride && booking.status === "confirmed" && (
                    <div className="mt-4 grid gap-3">
                      {/* Contribution is the passenger's decision, so a driver
                          viewing their own ride sees only the outcome. */}
                      {!isMyRide && (
                        <ContributionSlider
                          disabled={payingId === booking._id}
                          fuelCost={ride.fuelCost || 0}
                          fuelShare={booking.fuelShare || 0}
                          onChange={(value) =>
                            setDraftContributions((current) => ({
                              ...current,
                              [booking._id]: value,
                            }))
                          }
                          onPay={(amount) => payContribution(booking, amount)}
                          paying={payingId === booking._id}
                          paymentStatus={booking.paymentStatus}
                          seats={booking.seats || 1}
                          value={draftContributions[booking._id] ?? booking.contributionAmount}
                        />
                      )}

                      <TripChat
                        bookingId={booking._id}
                        currentUserId={user?._id}
                        otherPerson={
                          isMyRide
                            ? typeof booking.passenger === "object"
                              ? booking.passenger
                              : null
                            : typeof ride.driver === "object"
                              ? ride.driver
                              : null
                        }
                        token={token}
                      />
                    </div>
                  )}

                  {ride?.status === "completed" && booking.status !== "cancelled" && (
                    <div className="grid gap-3 rounded-xl border border-border bg-surface-muted p-4">
                      <p className="m-0 text-xs font-extrabold uppercase tracking-[0.1em] text-text-muted">
                        Rate this ride
                      </p>
                      <Select
                        id={`review-rating-${booking._id}`}
                        label="Rating"
                        value={reviewRatings[booking._id] || 5}
                        onChange={(event) =>
                          setReviewRatings({
                            ...reviewRatings,
                            [booking._id]: event.target.value,
                          })
                        }
                        disabled={reviewingId === booking._id}
                      >
                        {[5, 4, 3, 2, 1].map((rating) => (
                          <option key={rating} value={rating}>
                            {rating} / 5
                          </option>
                        ))}
                      </Select>
                      <textarea
                        className="min-h-[4.5rem] w-full resize-y rounded-xl border border-border bg-white px-4 py-3 text-sm text-primary outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:bg-surface-muted"
                        value={reviewComments[booking._id] || ""}
                        onChange={(event) =>
                          setReviewComments({
                            ...reviewComments,
                            [booking._id]: event.target.value,
                          })
                        }
                        placeholder="Share a comment (optional)"
                        maxLength="500"
                        disabled={reviewingId === booking._id}
                      />
                      {reviewErrors[booking._id] && (
                        <Alert tone="error" role="alert">
                          {reviewErrors[booking._id]}
                        </Alert>
                      )}
                      {reviewSuccesses[booking._id] && (
                        <Alert tone="success">
                          {reviewSuccesses[booking._id]}
                        </Alert>
                      )}
                      <Button
                        className="w-full sm:w-auto sm:justify-self-start"
                        variant="secondary"
                        type="button"
                        onClick={() => submitReview(booking)}
                        loading={reviewingId === booking._id}
                        disabled={reviewingId === booking._id || Boolean(reviewSuccesses[booking._id])}
                      >
                        {reviewingId === booking._id ? "Submitting..." : "Submit Review"}
                      </Button>
                    </div>
                  )}

                  {booking.status !== "cancelled" && (
                    <Button
                      className="self-start"
                      variant="danger"
                      type="button"
                      onClick={() => setPendingCancellation(booking._id)}
                      loading={cancellingId === booking._id}
                      disabled={cancellingId === booking._id}
                    >
                      {cancellingId === booking._id ? "Cancelling..." : "Cancel Booking"}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <Link
        className="mt-8 inline-flex items-center text-sm font-bold text-accent no-underline transition hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        to="/app/dashboard"
      >
        Back to Dashboard
      </Link>
      <ConfirmDialog
        open={Boolean(pendingCancellation)}
        title="Cancel this booking?"
        description="Your reserved seats will be released. This action cannot be undone."
        confirmLabel="Cancel booking"
        loading={Boolean(cancellingId)}
        onCancel={() => setPendingCancellation(null)}
        onConfirm={() => cancelBooking(pendingCancellation)}
      />
    </main>
  );
}

export default MyBookings;

