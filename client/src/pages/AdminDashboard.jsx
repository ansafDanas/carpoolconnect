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
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { formatDate } from "../utils/format";

const emptyData = {
  users: [],
  rides: [],
  bookings: [],
};

const tableCellClass = "border-b border-border/70 px-4 py-3.5 align-middle text-sm text-text-muted last:border-b-0";

function AdminDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removingRideId, setRemovingRideId] = useState("");
  const [pendingCancellation, setPendingCancellation] = useState(null);

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
      };
      const [usersResponse, ridesResponse, bookingsResponse] =
        await Promise.all([
          api.get("/admin/users", { headers }),
          api.get("/admin/rides", { headers }),
          api.get("/admin/bookings", { headers }),
        ]);

      setData({
        users: usersResponse.data.data || [],
        rides: ridesResponse.data.data || [],
        bookings: bookingsResponse.data.data || [],
      });
    } catch (requestError) {
      console.warn("Admin dashboard request failed", requestError.response?.status || "network");
      setError(
        requestError.response?.data?.message ||
          "Unable to load the admin dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // The initial request synchronizes the dashboard with protected API data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAdminData();
  }, [fetchAdminData]);

  const removeRide = async (ride) => {
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
      await fetchAdminData();
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

  const passengerName = (booking) =>
    typeof booking.passenger === "object"
      ? booking.passenger?.name
      : "Unknown passenger";

  const bookingRide = (booking) =>
    typeof booking.ride === "object" ? booking.ride : null;

  const activeRideCount = data.rides.filter((ride) => ride.status === "active").length;

  return (
    <section className="space-y-6 sm:space-y-8">
      <PageHeader
        className="mb-0"
        eyebrow="Administration"
        title="Admin dashboard"
        description="Review platform activity and manage rides without changing booking history."
      />

      {loading && <LoadingState message="Loading admin data..." />}
      {!loading && error && (
        <Alert tone="error" role="alert" className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <span>{error}</span>
          <Button type="button" variant="secondary" className="min-h-9 shrink-0 rounded-lg px-3 py-1.5 text-xs" onClick={fetchAdminData}>Try again</Button>
        </Alert>
      )}
      {notice && <Alert tone="success" className="flex items-center gap-3">{notice}</Alert>}

      {!loading && !error && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Overview statistics">
            <AdminStat label="Users" value={data.users.length} detail="Registered accounts" icon="users" />
            <AdminStat label="Rides" value={data.rides.length} detail="Platform journeys" icon="rides" />
            <AdminStat label="Bookings" value={data.bookings.length} detail="Passenger requests" icon="bookings" />
            <AdminStat label="Active rides" value={activeRideCount} detail="Currently operating" icon="active" />
          </section>

          <AdminSection title="Users" count={data.users.length} caption="Registered users">
            {data.users.length === 0 ? <EmptyState title="No users found." /> : (
              <AdminTable columns={["Name", "Email", "Roles", "Phone", "Rating", "Joined"]} caption="Registered users">
                {data.users.map((user) => (
                  <tr key={user._id} className="transition-colors hover:bg-primary-soft/35">
                    <td className={`${tableCellClass} whitespace-nowrap font-bold text-primary`}>{user.name || "-"}</td>
                    <td className={`${tableCellClass} whitespace-nowrap`}>{user.email}</td>
                    <td className={tableCellClass}>
                      <div className="flex min-w-max flex-wrap gap-1.5">{(user.roles?.length ? user.roles : ["passenger"]).map((role) => <Badge key={role} tone={role}>{role}</Badge>)}</div>
                    </td>
                    <td className={`${tableCellClass} whitespace-nowrap`}>{user.phone || "-"}</td>
                    <td className={`${tableCellClass} whitespace-nowrap`}>{user.rating ?? "-"}</td>
                    <td className={`${tableCellClass} whitespace-nowrap`}>{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </AdminSection>

          <AdminSection title="Rides" count={data.rides.length} caption="Platform rides">
            {data.rides.length === 0 ? <EmptyState title="No rides found." /> : (
              <AdminTable columns={["Route", "Driver", "Date", "Status", "Seats", "Action"]} caption="Platform rides">
                {data.rides.map((ride) => (
                  <tr key={ride._id} className="transition-colors hover:bg-primary-soft/35">
                    <td className={`${tableCellClass} min-w-56 font-bold`}><Link className="text-primary underline decoration-accent/45 underline-offset-4 hover:text-accent-hover" to={`/admin/rides/${ride._id}`}>{ride.source} to {ride.destination}</Link></td>
                    <td className={`${tableCellClass} whitespace-nowrap`}>{driverName(ride)}</td>
                    <td className={`${tableCellClass} whitespace-nowrap`}>{formatDate(ride.date)}</td>
                    <td className={`${tableCellClass} whitespace-nowrap`}><Badge tone={ride.status}>{ride.status}</Badge></td>
                    <td className={`${tableCellClass} whitespace-nowrap`}>{ride.seatsAvailable}</td>
                    <td className={`${tableCellClass} whitespace-nowrap`}>
                      {ride.status === "active" ? <Button type="button" variant="danger" className="min-h-9 rounded-lg px-3 py-1.5 text-xs" onClick={() => setPendingCancellation(ride)} loading={removingRideId === ride._id}>Cancel ride</Button> : "-"}
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </AdminSection>

          <AdminSection title="Bookings" count={data.bookings.length} caption="Platform bookings">
            {data.bookings.length === 0 ? <EmptyState title="No bookings found." /> : (
              <AdminTable columns={["Passenger", "Route", "Driver", "Seats", "Status", "Created"]} caption="Platform bookings">
                {data.bookings.map((booking) => {
                  const ride = bookingRide(booking);
                  return (
                    <tr key={booking._id} className="transition-colors hover:bg-primary-soft/35">
                      <td className={`${tableCellClass} whitespace-nowrap font-bold text-primary`}>{passengerName(booking)}</td>
                      <td className={`${tableCellClass} min-w-56`}>{ride ? `${ride.source} to ${ride.destination}` : "Ride unavailable"}</td>
                      <td className={`${tableCellClass} whitespace-nowrap`}>{ride ? driverName(ride) : "-"}</td>
                      <td className={`${tableCellClass} whitespace-nowrap`}>{booking.seats}</td>
                      <td className={`${tableCellClass} whitespace-nowrap`}><Badge tone={booking.status}>{booking.status}</Badge></td>
                      <td className={`${tableCellClass} whitespace-nowrap`}>{formatDate(booking.createdAt)}</td>
                    </tr>
                  );
                })}
              </AdminTable>
            )}
          </AdminSection>
        </>
      )}
      <ConfirmDialog
        open={Boolean(pendingCancellation)}
        title="Cancel this ride?"
        description={pendingCancellation ? `Cancel the ${pendingCancellation.source} to ${pendingCancellation.destination} ride? Active bookings will be cancelled and passengers notified.` : ""}
        confirmLabel="Cancel ride"
        loading={Boolean(removingRideId)}
        onCancel={() => setPendingCancellation(null)}
        onConfirm={() => removeRide(pendingCancellation)}
      />
    </section>
  );
}

function AdminStat({ label, value, detail, icon }) {
  const iconPaths = {
    users: <><circle cx="9" cy="7" r="3" /><path d="M3 20v-1a5 5 0 0 1 10 0v1M16 3.5a3 3 0 0 1 0 5.8M16 14a5 5 0 0 1 5 5v1" /></>,
    rides: <><path d="M4 17h16l-1.5-7A3.5 3.5 0 0 0 15.08 7H8.92A3.5 3.5 0 0 0 5.5 10L4 17Z" /><path d="M3 17v2a1 1 0 0 0 1 1h1m14 0h1a1 1 0 0 0 1-1v-2M8 12h8" /><circle cx="7.5" cy="17.5" r="1" /><circle cx="16.5" cy="17.5" r="1" /></>,
    bookings: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 3v4M16 3v4M8 11h8M8 15h5" /></>,
    active: <><path d="M12 21a9 9 0 1 0-9-9" /><path d="M12 7v5l3.5 2" /><path d="M4 4 2 6l2 2" /></>,
  };

  return (
    <Card as="article" className="relative overflow-hidden p-5">
      <div className="absolute right-0 top-0 h-20 w-20 translate-x-7 -translate-y-7 rounded-full bg-accent/10" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-text-muted">{label}</p>
          <strong className="mt-2 block text-3xl font-extrabold tracking-tight text-primary">{value}</strong>
          <p className="mt-1 text-sm text-text-muted">{detail}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary" aria-hidden="true">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">{iconPaths[icon]}</svg>
        </span>
      </div>
    </Card>
  );
}

function AdminTable({ columns, children, caption }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/80" tabIndex="0">
      <table className="min-w-[720px] w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-muted">
          <tr>{columns.map((column) => <th key={column} scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">{column}</th>)}</tr>
        </thead>
        <tbody className="bg-white">{children}</tbody>
      </table>
    </div>
  );
}

function AdminSection({ title, count, caption, children }) {
  return (
    <Card as="section" className="overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-accent">Management</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-primary">{title}</h2>
        </div>
        <Badge tone="info" className="shrink-0">{count}</Badge>
      </div>
      {children}
      <p className="sr-only">{caption}</p>
    </Card>
  );
}

export default AdminDashboard;
