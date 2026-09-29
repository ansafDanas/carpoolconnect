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

function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers(response.data.data || []);
    } catch (requestError) {
      console.warn("Admin users request failed", requestError.response?.status || "network");
      setError(
        requestError.response?.data?.message ||
          "Unable to load admin users."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // The initial request synchronizes the page with protected API data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  return (
    <section className="space-y-6 sm:space-y-8">
      <PageHeader
        className="mb-0"
        eyebrow="Administration"
        title="Users"
        description="Review registered users and their account details."
      />

      {loading && <LoadingState message="Loading users..." />}
      {!loading && error && (
        <Alert tone="error" role="alert" className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <span>{error}</span>
          <Button type="button" variant="secondary" className="min-h-9 shrink-0 rounded-lg px-3 py-1.5 text-xs" onClick={fetchUsers}>
            Try again
          </Button>
        </Alert>
      )}

      {!loading && !error && (
        <Card className="overflow-hidden p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-accent">Directory</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-primary">Registered users</h2>
              <p className="mt-1 text-sm text-text-muted">Account roles, contact details, and profile ratings.</p>
            </div>
            <Badge tone="info" className="shrink-0">{users.length}</Badge>
          </div>

          {users.length === 0 ? (
            <EmptyState title="No users found." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/80" tabIndex="0">
              <table className="min-w-[760px] w-full border-collapse text-left">
                <caption className="sr-only">Registered users</caption>
                <thead className="bg-surface-muted">
                  <tr>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Name</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Email</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Roles</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Phone</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Rating</th>
                    <th scope="col" className="whitespace-nowrap border-b border-border px-4 py-3 text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">Joined</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {users.map((user) => (
                    <tr key={user._id} className="transition-colors hover:bg-primary-soft/35">
                      <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm font-bold text-primary">{user.name || "-"}</td>
                      <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">{user.email}</td>
                      <td className="border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">
                        <div className="flex min-w-max flex-wrap gap-1.5">
                          {(user.roles?.length ? user.roles : ["passenger"]).map(
                            (role) => (
                              <Badge key={role} tone={role}>
                                {role}
                              </Badge>
                            )
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">{user.phone || "-"}</td>
                      <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">{user.rating ?? "-"}</td>
                      <td className="whitespace-nowrap border-b border-border/70 px-4 py-3.5 text-sm text-text-muted">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </section>
  );
}

export default AdminUsers;
