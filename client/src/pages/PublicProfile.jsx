import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import LoadingState from "../components/ui/LoadingState";
import RatingBadge from "../components/ui/RatingBadge";

function Stars({ rating }) {
  return (
    <span className="tracking-tight text-marigold" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-border">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function PublicProfile() {
  const { userId } = useParams();
  const { token, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await api.get(`/social/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (active) setProfile(response.data.data);
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message || "Could not load this profile."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [token, userId]);

  const block = async () => {
    setBusy(true);
    setNotice("");
    try {
      await api.post(`/social/block/${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotice("Blocked. They will not appear in your matches.");
    } catch (blockError) {
      setError(blockError.response?.data?.message || "Could not block this person.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState className="mb-8" message="Loading profile..." />;
  if (error || !profile) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-16">
        <Alert tone="error" role="alert">{error || "Profile not found"}</Alert>
      </main>
    );
  }

  const isSelf = user?._id === profile._id;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-0">
      <Link to="/app/dashboard" className="text-sm font-extrabold text-leaf no-underline">
        ← Back
      </Link>

      {notice && <Alert className="mt-4" tone="success">{notice}</Alert>}

      <Card className="mt-4 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {profile.profileImage ? (
            <img
              alt={profile.name}
              className="h-24 w-24 rounded-3xl object-cover"
              src={profile.profileImage}
            />
          ) : (
            <span className="grid h-24 w-24 place-items-center rounded-3xl bg-primary text-3xl font-black text-marigold">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl font-bold text-primary">
              {profile.name}
              {profile.isVerified && (
                <span className="rating-chip rating-high" title="Verified">✓ Verified</span>
              )}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RatingBadge count={profile.ratingCount} rating={profile.rating} size="lg" />
              {profile.completedRides > 0 && (
                <span className="text-sm font-semibold text-text-muted">
                  {profile.completedRides} trips given
                </span>
              )}
              {(profile.roles || []).map((role) => (
                <Badge key={role} tone={role}>{role}</Badge>
              ))}
            </div>

            {profile.bio && <p className="mt-4 text-sm leading-7 text-text-muted">{profile.bio}</p>}

            {profile.vibeTags?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {profile.vibeTags.map((tag) => (
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-text-muted" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {profile.conversationStarter && (
              <p className="mt-5 rounded-2xl bg-marigold-soft p-4 text-sm font-semibold text-primary">
                &ldquo;{profile.conversationStarter}&rdquo;
              </p>
            )}

            {profile.vehicleInfo?.make && (
              <p className="mt-4 text-sm text-text-muted">
                Drives a {profile.vehicleInfo.color} {profile.vehicleInfo.make} {profile.vehicleInfo.model}
                {profile.vehicleInfo.mileageKmpl
                  ? ` · ${profile.vehicleInfo.mileageKmpl} km/litre`
                  : ""}
              </p>
            )}

            {!isSelf && (
              <Button
                className="mt-6"
                onClick={block}
                type="button"
                variant="secondary"
                loading={busy}
              >
                Block this person
              </Button>
            )}
          </div>
        </div>
      </Card>

      <section className="mt-6">
        <h2 className="font-display text-2xl font-bold text-primary">
          What people said
        </h2>
        {profile.reviews?.length === 0 ? (
          <Card className="mt-3 p-6 text-sm text-text-muted">
            No reviews yet. Be the first to ride with them.
          </Card>
        ) : (
          <div className="mt-3 grid gap-3">
            {profile.reviews.map((review) => (
              <Card className="p-5" key={review._id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-primary">
                    {review.reviewer?.name || "Traveller"}
                  </p>
                  <Stars rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm leading-6 text-text-muted">{review.comment}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default PublicProfile;