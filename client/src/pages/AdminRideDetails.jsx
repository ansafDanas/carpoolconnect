import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";
import { formatDate, formatTime } from "../utils/format";

function BackToRidesLink() {
  return (
    <Link className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-bold text-primary transition-colors hover:text-accent-hover" to="/admin/rides">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
      </svg>
      Back to Rides
    </Link>
  );
}

function AdminRideDetails() {
  const { id } = useParams();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchRide = async () => {
      try {
        const response = await api.get(`/rides/${id}`);
        setRide(response.data.ride);
      } catch (requestError) {
        console.warn("Admin ride request failed", requestError.response?.status || "network");
        setError(
          requestError.response?.status === 404
            ? "Ride not found."
            : requestError.response?.data?.message ||
              "Unable to load ride details."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchRide();
  }, [id]);

  return (
    <section className="space-y-6 sm:space-y-8">
      <BackToRidesLink />

      {loading && <LoadingState message="Loading ride details..." />}
      {!loading && error && (
        <EmptyState
          title={error}
          description="We could not find the ride requested."
          action={<BackToRidesLink />}
        />
      )}

      {!loading && !error && ride && (
        <>
          <PageHeader
            className="mb-0"
            eyebrow="Administration"
            title={`${ride.source} to ${ride.destination}`}
            description="Read-only ride information for platform administration."
          />
          <Card className="overflow-hidden p-5 sm:p-6">
            <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-accent">Ride status</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-primary">{ride.driver?.name || "Unknown driver"}</h2>
                <p className="mt-2 text-sm text-text-muted">Driver assigned to this platform journey.</p>
              </div>
              <Badge tone={ride.status} className="w-fit shrink-0">{ride.status}</Badge>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <RideDetail label="Source" value={ride.source} />
              <RideDetail label="Destination" value={ride.destination} />
              <RideDetail label="Date" value={formatDate(ride.date)} />
              <RideDetail label="Time" value={formatTime(ride.date)} />
              <RideDetail label="Available seats" value={ride.seatsAvailable} />
              <RideDetail label="Suggested contribution" value={`₹${ride.price}`} />
              <RideDetail label="Vehicle" value={ride.vehicle || "Vehicle not specified"} />
              <RideDetail label="Tracking" value={ride.trackingActive ? "Active" : "Inactive"} />
            </dl>
          </Card>
        </>
      )}
    </section>
  );
}

function RideDetail({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/80 bg-surface-muted px-4 py-3.5">
      <dt className="text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">{label}</dt>
      <dd className="mt-2 break-words text-base font-bold text-primary">{value}</dd>
    </div>
  );
}

export default AdminRideDetails;
