/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import LocationPicker from "../components/LocationPickerLoader";
import { formatDate, formatTime } from "../utils/format";

const statusTone = {
  open: "info",
  matched: "success",
  cancelled: "danger",
  expired: "warning",
};

function RequestRide() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [matches, setMatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({
    pickup: "",
    drop: "",
    fromTime: "",
    toTime: "",
    seats: "1",
    maxDetourKm: "5",
  });
  const [pickupPin, setPickupPin] = useState(null);
  const [dropPin, setDropPin] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      const response = await api.get("/ride-requests/mine", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(response.data.data || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not load your requests. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      void loadRequests();
    } else {
      setLoading(false);
    }
  }, [loadRequests, token]);

  // Find Rides hands its search straight over when a rider chooses to post a
  // request instead, so the journey does not have to be typed twice.
  useEffect(() => {
    const pickup = searchParams.get("pickup");
    const drop = searchParams.get("drop");
    const date = searchParams.get("date");
    const seats = searchParams.get("seats");

    if (!pickup && !drop && !date && !seats) {
      return;
    }

    setFormData((current) => ({
      ...current,
      ...(pickup ? { pickup } : {}),
      ...(drop ? { drop } : {}),
      ...(seats ? { seats } : {}),
      // A date alone is not enough: the matching engine scores a window, so
      // default it to an hour either side of the requested departure.
      ...(date
        ? {
            fromTime: `${date}T07:00`,
            toTime: `${date}T10:00`,
          }
        : {}),
    }));
  }, [searchParams]);

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const loadMatches = async (requestId) => {
    setBusyId(requestId);
    try {
      const response = await api.get(`/ride-requests/${requestId}/matches`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMatches((current) => ({
        ...current,
        [requestId]: response.data.data || [],
      }));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not load matches."
      );
    } finally {
      setBusyId("");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.pickup.trim() || !formData.drop.trim()) {
      setError("Tell us your pickup and drop points.");
      return;
    }

    // Pins are what let us rank drivers by real detour instead of text.
    if (!pickupPin || !dropPin) {
      setError(
        "Drop a pin for your pickup and drop so we can find drivers who add the least detour."
      );
      return;
    }

    if (!formData.fromTime || !formData.toTime) {
      setError("Choose the window you can travel in.");
      return;
    }

    const from = new Date(formData.fromTime);
    const to = new Date(formData.toTime);

    if (to <= from) {
      setError("The end of your window must be after the start.");
      return;
    }

    setSaving(true);

    try {
      const response = await api.post(
        "/ride-requests",
        {
          pickup: formData.pickup.trim(),
          drop: formData.drop.trim(),
          earliestTime: from.toISOString(),
          latestTime: to.toISOString(),
          seats: Number(formData.seats),
          maxDetourKm: Number(formData.maxDetourKm),
          pickupCoordinates: pickupPin,
          dropCoordinates: dropPin,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const created = response.data.data;
      setRequests((current) => [created, ...current]);
      setSuccess("Request posted. Finding drivers on your route...");
      void loadMatches(created._id);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not post your request. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const sendToDriver = async (requestId, rideId) => {
    setError("");
    setSuccess("");
    setBusyId(requestId);

    try {
      await api.post(
        `/ride-requests/${requestId}/send`,
        { rideId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess("Request sent. The driver has been notified.");
      await loadRequests();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not send this request to the driver."
      );
    } finally {
      setBusyId("");
    }
  };

  const cancelRequest = async (requestId) => {
    setError("");
    setBusyId(requestId);

    try {
      await api.patch(
        `/ride-requests/${requestId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadRequests();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not cancel this request."
      );
    } finally {
      setBusyId("");
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-12 sm:px-6 sm:py-16 lg:px-0">
      <PageHeader
        className="max-w-[52rem]"
        eyebrow="Rider tools"
        title="Request a Ride"
        description="Post what you need and we rank the drivers who can pick you up with the least detour."
      />

      {error && <Alert className="mb-6" tone="error" role="alert">{error}</Alert>}
      {success && <Alert className="mb-6" tone="success">{success}</Alert>}

      <Card as="section" className="mb-10 p-5 sm:p-8" aria-label="Ride request form">
        <form className="grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={handleSubmit} noValidate>
          <Input id="req-pickup" name="pickup" label="Pickup point" type="text" value={formData.pickup} onChange={handleChange} placeholder="e.g. Kochi" required />
          <Input id="req-drop" name="drop" label="Drop point" type="text" value={formData.drop} onChange={handleChange} placeholder="e.g. Alappuzha" required />
          <div className="sm:col-span-2">
            <LocationPicker
              hint="Where you want to be picked up. Drivers already passing nearby will rank first."
              label="Pickup pin"
              onChange={setPickupPin}
              required
              value={pickupPin}
            />
          </div>
          <div className="sm:col-span-2">
            <LocationPicker
              hint="Where you want to get off. We use both pins to work out the real detour."
              label="Drop pin"
              onChange={setDropPin}
              required
              tone="clay"
              value={dropPin}
            />
          </div>
          <Input id="req-from" name="fromTime" label="Earliest time" type="datetime-local" value={formData.fromTime} onChange={handleChange} required />
          <Input id="req-to" name="toTime" label="Latest time" type="datetime-local" value={formData.toTime} onChange={handleChange} required />
          <Input id="req-seats" name="seats" label="Seats needed" type="number" min="1" max="8" value={formData.seats} onChange={handleChange} required />
          <Input id="req-detour" name="maxDetourKm" label="Max detour (km)" type="number" min="0" max="50" value={formData.maxDetourKm} onChange={handleChange} helperText="How far a driver may go out of their way for you." required />
          <div className="sm:col-span-2">
            <Button type="submit" loading={saving}>Post request</Button>
          </div>
        </form>
      </Card>

      {loading && <LoadingState className="mb-8" message="Loading your requests..." />}

      {!loading && requests.length === 0 && (
        <EmptyState
          className="mb-8"
          title="No requests yet"
          description="Post a request above and we will show the best matching drivers first."
        />
      )}

      {!loading && requests.length > 0 && (
        <section className="grid gap-5" aria-labelledby="my-requests-title">
          <h2 id="my-requests-title" className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
            Your requests
          </h2>

          {requests.map((request) => {
            const requestMatches = matches[request._id];

            return (
              <Card key={request._id} className="p-5 sm:p-7" as="article">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-extrabold text-primary">
                      {request.pickup} <span aria-hidden="true">→</span> {request.drop}
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">
                      {formatDate(request.earliestTime)} · {formatTime(request.earliestTime)} – {formatTime(request.latestTime)} · {request.seats} seat(s)
                    </p>
                  </div>
                  <Badge tone={statusTone[request.status] || "info"}>{request.status}</Badge>
                </div>

                {request.matchedRide && (
                  <p className="mt-4 rounded-2xl bg-surface-muted p-4 text-sm text-text-muted">
                    Sent to a driver for {request.matchedRide.source} → {request.matchedRide.destination}. Waiting for their response.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  {request.status === "open" && !request.matchedRide && (
                    <Button type="button" variant="secondary" onClick={() => loadMatches(request._id)} loading={busyId === request._id}>
                      {requestMatches ? "Refresh matches" : "Find matching drivers"}
                    </Button>
                  )}
                  {request.status === "open" && request.matchedRide && (
                    <Button type="button" variant="secondary" onClick={() => cancelRequest(request._id)} loading={busyId === request._id}>
                      Cancel request
                    </Button>
                  )}
                </div>

                {requestMatches && requestMatches.length > 0 && (
                  <ul className="mt-5 grid gap-3">
                    {requestMatches.map((match) => (
                      <li key={match.ride._id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface-muted p-4">
                        <div className="min-w-0">
                          <p className="font-extrabold text-primary">
                            {match.ride.source} → {match.ride.destination}
                          </p>
                          <p className="mt-1 text-sm text-text-muted">
                            {formatTime(match.ride.date)} · {match.ride.seatsAvailable} seats · ₹{match.ride.price}
                            {match.detourKm !== null ? ` · ${match.detourKm} km detour` : ""}
                          </p>
                          {typeof match.ride.driver === "object" && (
                            <p className="mt-1 text-sm font-bold text-text-muted">
                              {match.ride.driver?.name} · rated {match.ride.driver?.rating ?? "new"}
                            </p>
                          )}
                        </div>
                        {request.status === "open" && !request.matchedRide && (
                          <Button type="button" onClick={() => sendToDriver(request._id, match.ride._id)} loading={busyId === request._id}>
                            Request seat
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {requestMatches && requestMatches.length === 0 && (
                  <p className="mt-4 text-sm text-text-muted">
                    No drivers on this route yet. We will keep your request open.
                  </p>
                )}
              </Card>
            );
          })}
        </section>
      )}

      <Link
        className="mt-8 inline-flex items-center text-sm font-bold text-accent no-underline transition hover:text-accent-hover"
        to="/app/dashboard"
      >
        Back to Dashboard
      </Link>
    </main>
  );
}

export default RequestRide;