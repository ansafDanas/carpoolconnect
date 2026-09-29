import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";
import { useAuth } from "../context/AuthContext";
import { formatDate } from "../utils/format";

function AdminBookings() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/bookings", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setBookings(response.data.data || []);
    } catch (requestError) {
      console.warn("Admin bookings request failed", requestError.response?.status || "network");
      setError(
        requestError.response?.data?.message ||
          "Unable to load admin bookings."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // The initial request synchronizes the page with protected API data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchBookings();
  }, [fetchBookings]);

  const passengerName = (booking) =>
    typeof booking.passenger === "object"
      ? booking.passenger?.name
      : "Unknown passenger";

  const bookingRide = (booking) =>
    typeof booking.ride === "object" ? booking.ride : null;

  const driverName = (ride) =>
    typeof ride?.driver === "object" ? ride.driver?.name : "Unknown driver";

  return (
    <section className="space-y-6 sm:space-y-8">
      <PageHeader
        className="mb-0"
        eyebrow="Administration"
        title="Bookings"
        description="Review booking activity across the platform."
      />

      {loading && <LoadingState message="Loading bookings..." />}
      {!loading && error && (
        <Alert tone="error" role="alert" className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <span>{error}</span>
          <Button type="button" variant="secondary" className="min-h-9 shrink-0 rounded-lg px-3 py-1.5 text-xs" onClick={fetchBookings}>
            Try again
          </Button>
        </Alert>
      )}

      {!loading && !error && (
        <Card className="overflow-hidden p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-accent">Management</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-primary">Platform bookings</h2>
              <p className="mt-1 text-sm text-text-muted">Passenger requests and the rides they are connected to.</p>
            </div>
            <Badge tone="info" className="shrink-0">{bookings.length}</Badge>
          </div>

          {bookings.length === 0 ? (
            <EmptyState title="No bookings found." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/80" tabIndex="0">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <caption className="sr-only">Platform bookings</caption>
                <thead className="bg-surface-muted">
                  <tr>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Passenger</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Route</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Driver</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Seats</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Status</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Created</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {bookings.map((booking) => {
                    const ride = bookingRide(booking);
                    return (
                      <tr key={booking._id} className="transition-colors hover:bg-primary-soft/35">
                        <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm font-bold text-primary">{passengerName(booking)}</td>
                        <td className="min-w-56 border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">{ride ? `${ride.source} to ${ride.destination}` : "Ride unavailable"}</td>
                        <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">{ride ? driverName(ride) : "-"}</td>
                        <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">{booking.seats}</td>
                        <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted"><Badge tone={booking.status}>{booking.status}</Badge></td>
                        <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">{formatDate(booking.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </section>
  );
}

export default AdminBookings;
