import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { formatDate } from "../utils/format";
import { useAuth } from "../context/AuthContext";

function AdminRides() {
  const { token } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removingRideId, setRemovingRideId] = useState("");
  const [pendingCancellation, setPendingCancellation] = useState(null);

  const fetchRides = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/rides", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setRides(response.data.data || []);
    } catch (requestError) {
      console.warn("Admin rides request failed", requestError.response?.status || "network");
      setError(
        requestError.response?.data?.message ||
          "Unable to load admin rides."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // The initial request synchronizes the page with protected API data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRides();
  }, [fetchRides]);

  const cancelRide = async (ride) => {
    setRemovingRideId(ride._id);
    setError("");
    setNotice("");

    try {
      await api.delete(`/admin/rides/${ride._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setNotice("Ride cancelled successfully. Affected bookings were updated.");
      setPendingCancellation(null);
      await fetchRides();
    } catch (requestError) {
      console.warn("Admin ride action failed", requestError.response?.status || "network");
      setError(
        requestError.response?.data?.message ||
          "Unable to cancel this ride. Please try again."
      );
    } finally {
      setRemovingRideId("");
    }
  };

  const driverName = (ride) =>
    typeof ride.driver === "object" ? ride.driver?.name : "Unknown driver";

  return (
    <section className="space-y-6 sm:space-y-8">
      <PageHeader
        className="mb-0"
        eyebrow="Administration"
        title="Rides"
        description="Review platform rides and manage active cancellations."
      />

      {loading && <LoadingState message="Loading rides..." />}
      {!loading && error && (
        <Alert tone="error" role="alert" className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <span>{error}</span>
          <Button type="button" variant="secondary" className="min-h-9 shrink-0 rounded-lg px-3 py-1.5 text-xs" onClick={fetchRides}>
            Try again
          </Button>
        </Alert>
      )}
      {notice && <Alert tone="success" className="flex items-center gap-3">{notice}</Alert>}

      {!loading && !error && (
        <Card className="overflow-hidden p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-accent">Management</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-primary">Platform rides</h2>
              <p className="mt-1 text-sm text-text-muted">Open a route to inspect its read-only ride record.</p>
            </div>
            <Badge tone="info" className="shrink-0">{rides.length}</Badge>
          </div>

          {rides.length === 0 ? (
            <EmptyState title="No rides found." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/80" tabIndex="0">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <caption className="sr-only">Platform rides</caption>
                <thead className="bg-surface-muted">
                  <tr>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Route</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Driver</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Date</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Status</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Seats</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {rides.map((ride) => (
                    <tr key={ride._id} className="transition-colors hover:bg-primary-soft/35">
                      <td className="min-w-56 border-b border-border/70 px-4 py-3.5 text-sm font-bold"><Link className="text-primary underline decoration-accent/45 underline-offset-4 hover:text-accent-hover" to={`/admin/rides/${ride._id}`}>{ride.source} to {ride.destination}</Link></td>
                      <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">{driverName(ride)}</td>
                      <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">{formatDate(ride.date)}</td>
                      <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted"><Badge tone={ride.status}>{ride.status}</Badge></td>
                      <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">{ride.seatsAvailable}</td>
                      <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">
                        {ride.status === "active" ? (
                          <Button
                            type="button"
                            variant="danger"
                            className="min-h-9 rounded-lg px-3 py-1.5 text-xs"
                            onClick={() => setPendingCancellation(ride)}
                            disabled={removingRideId === ride._id}
                          >
                            {removingRideId === ride._id ? "Cancelling..." : "Cancel ride"}
                          </Button>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      <ConfirmDialog
        open={Boolean(pendingCancellation)}
        title="Cancel this ride?"
        description={pendingCancellation ? `Cancel the ${pendingCancellation.source} to ${pendingCancellation.destination} ride? Active bookings will be cancelled and passengers notified.` : ""}
        confirmLabel="Cancel ride"
        loading={Boolean(removingRideId)}
        onCancel={() => setPendingCancellation(null)}
        onConfirm={() => cancelRide(pendingCancellation)}
      />
    </section>
  );
}

export default AdminRides;
