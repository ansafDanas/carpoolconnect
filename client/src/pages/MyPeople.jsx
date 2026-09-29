/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import Alert from "../components/ui/Alert";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";
import RatingBadge from "../components/ui/RatingBadge";
import { formatDate } from "../utils/format";

// Repeat rides are the whole retention story: the relationship is the product.
function MyPeople() {
  const { token } = useAuth();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await api.get("/social/partners", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPartners(response.data.data || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not load your travel buddies."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-0">
      <PageHeader
        eyebrow="Your circle"
        title="People you ride with"
        description="The more you travel together, the easier it gets. Ride again with someone you know."
      />

      {error && <Alert className="mb-6" tone="error" role="alert">{error}</Alert>}
      {loading && <LoadingState className="mb-6" message="Loading your people..." />}

      {!loading && partners.length === 0 && (
        <EmptyState
          title="No regulars yet"
          description="Once you have shared a couple of rides with the same person, they will show up here."
          action={
            <Link to="/app/find-rides" className="text-sm font-extrabold text-leaf no-underline">
              Find a ride →
            </Link>
          }
        />
      )}

      {!loading && partners.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {partners.map(({ user: person, sharedRides, lastRideAt }) => (
            <Card className="p-5" key={person._id}>
              <Link
                className="flex items-start gap-4 no-underline"
                to={`/app/people/${person._id}`}
              >
                {person.profileImage ? (
                  <img
                    alt={person.name}
                    className="h-14 w-14 rounded-2xl object-cover"
                    src={person.profileImage}
                  />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-lg font-black text-marigold">
                    {person.name.slice(0, 1).toUpperCase()}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold text-primary">
                    {person.name}
                  </p>
                  <p className="mt-0.5 text-sm text-text-muted">
                    {sharedRides} rides together
                    {lastRideAt ? ` · last ${formatDate(lastRideAt)}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <RatingBadge
                      count={person.ratingCount}
                      rating={person.rating}
                      size="sm"
                    />
                    {(person.vibeTags || []).slice(0, 2).map((tag) => (
                      <span
                        className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-text-muted"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>

              {person.conversationStarter && (
                <p className="mt-4 rounded-2xl bg-marigold-soft p-3 text-xs font-semibold text-primary">
                  &ldquo;{person.conversationStarter}&rdquo;
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}

export default MyPeople;