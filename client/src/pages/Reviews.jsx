import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { RatingBadge } from "../components/ui/RatingBadge";
import { SkeletonList } from "../components/ui/LoadingState";
import { formatDate } from "../utils/format";

/**
 * Reviews received, and the trips still waiting to be reviewed.
 *
 * The two-sided model is preserved exactly: a review can only be left on a
 * completed trip you were personally part of, and the server enforces that.
 */
function Reviews() {
  const { token, user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [drafts, setDrafts] = useState({});
  const [success, setSuccess] = useState({});
  const [rowError, setRowError] = useState({});

  const load = useCallback(async () => {
    if (!token || !user?._id) {
      setLoading(false);
      return;
    }

    try {
      const [reviewsResponse, bookingsResponse] = await Promise.all([
        api.get(`/reviews/user/${user._id}`),
        api.get("/bookings", { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      setReviews(Array.isArray(reviewsResponse.data.data) ? reviewsResponse.data.data : []);
      setBookings(Array.isArray(bookingsResponse.data.bookings) ? bookingsResponse.data.bookings : []);
      setError("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "We could not load your reviews. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    void load();
  }, [load]);

  // A review can only be written once the trip is complete, so only completed
  // rides are ever offered as reviewable.
  const reviewable = bookings.filter(
    (booking) => booking.ride?.status === "completed" && booking.status !== "cancelled"
  );

  const submitReview = async (booking) => {
    const draft = drafts[booking._id] || {};

    if (!draft.rating) {
      setRowError((current) => ({ ...current, [booking._id]: "Choose a rating first." }));
      return;
    }

    setRowError((current) => ({ ...current, [booking._id]: "" }));
    setBusyId(booking._id);

    try {
      await api.post(
        "/reviews",
        {
          rideId: booking.ride._id,
          bookingId: booking._id,
          rating: Number(draft.rating),
          comment: draft.comment || "",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess((current) => ({
        ...current,
        [booking._id]: "Thanks — your review has been recorded.",
      }));
      setDrafts((current) => ({ ...current, [booking._id]: {} }));
      await load();
    } catch (requestError) {
      setRowError((current) => ({
        ...current,
        [booking._id]:
          requestError.response?.data?.message ||
          "We could not save that review. Please try again.",
      }));
    } finally {
      setBusyId("");
    }
  };


  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Trust"
        title="Reviews"
        description="Both sides of a completed trip can review each other. Reviews are never written for you."
      />

      {error ? (
        <Alert tone="error" title="We could not load your reviews">
          <p>{error}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={load}>
            Try again
          </Button>
        </Alert>
      ) : null}

      {loading ? (
        <SkeletonList rows={3} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="min-w-0">
            <h2 className="mb-3 font-display text-base font-bold text-primary">
              Leave a review
            </h2>

            {reviewable.length === 0 ? (
              <EmptyState
                icon={Star}
                title="Nothing to review yet"
                description="Once a trip you were part of is completed, you can rate the other person here."
              />
            ) : (
              <ul className="grid gap-3">
                {reviewable.map((booking) => (
                  <li
                    key={booking._id}
                    className="rounded-2xl border border-border bg-surface p-4 shadow-card"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-primary">
                          {booking.ride.source} → {booking.ride.destination}
                        </p>
                        <p className="text-xs text-text-muted">
                          {formatDate(booking.ride.date)}
                        </p>
                      </div>
                      <Badge tone="info">Completed</Badge>
                    </div>

                    {success[booking._id] ? (
                      <Alert tone="success" className="mt-3">
                        {success[booking._id]}
                      </Alert>
                    ) : (
                      <div className="mt-3 grid gap-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {[5, 4, 3, 2, 1].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                setDrafts((current) => ({
                                  ...current,
                                  [booking._id]: {
                                    ...current[booking._id],
                                    rating: value,
                                  },
                                }))
                              }
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                                drafts[booking._id]?.rating === value
                                  ? "border-leaf bg-leaf-soft text-leaf"
                                  : "border-border text-text-muted hover:border-leaf/40"
                              }`}
                              aria-pressed={drafts[booking._id]?.rating === value}
                            >
                              {value}
                              <Star className="size-3" aria-hidden="true" />
                            </button>
                          ))}
                        </div>

                        <label className="grid gap-1">
                          <span className="sr-only">Comment</span>
                          <textarea
                            className="min-h-20 resize-y rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-primary outline-none transition placeholder:text-text-muted/70 focus-visible:border-leaf focus-visible:ring-4 focus-visible:ring-leaf/10"
                            placeholder="How was the trip? (optional)"
                            maxLength={500}
                            value={drafts[booking._id]?.comment || ""}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [booking._id]: {
                                  ...current[booking._id],
                                  comment: event.target.value,
                                },
                              }))
                            }
                          />
                        </label>

                        {rowError[booking._id] ? (
                          <p className="text-sm font-medium text-danger" role="alert">
                            {rowError[booking._id]}
                          </p>
                        ) : null}

                        <Button
                          size="sm"
                          className="justify-self-start"
                          loading={busyId === booking._id}
                          loadingText="Saving…"
                          onClick={() => submitReview(booking)}
                        >
                          Submit review
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="min-w-0">
            <h2 className="mb-3 font-display text-base font-bold text-primary">
              Reviews about you
            </h2>

            {reviews.length === 0 ? (
              <EmptyState
                icon={Star}
                title="No reviews yet"
                description="When someone you travelled with reviews you, it will appear here."
              />
            ) : (
              <ul className="grid gap-3">
                {reviews.map((review) => (
                  <li
                    key={review._id}
                    className="rounded-2xl border border-border bg-surface p-4 shadow-card"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-primary">
                        {review.reviewer?.name || "Traveller"}
                      </p>
                      <RatingBadge
                        rating={review.rating}
                        count={1}
                        showCount={false}
                        size="sm"
                      />
                    </div>
                    {review.comment ? (
                      <p className="mt-2 text-sm leading-6 text-text-muted">
                        {review.comment}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-text-muted">
                      {formatDate(review.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
              <RatingBadge
                rating={user?.rating}
                count={user?.ratingCount}
                size="lg"
              />
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Your rating comes only from real trips you completed. It is never edited
                or removed by the platform.
              </p>
              <Link
                to="/app/profile"
                className="mt-2 inline-block text-sm font-semibold text-leaf hover:underline"
              >
                View your profile
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Reviews;
