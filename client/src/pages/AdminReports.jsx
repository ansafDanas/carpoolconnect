/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import Alert from "../components/ui/Alert";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import LoadingState from "../components/ui/LoadingState";
import PageHeader from "../components/ui/PageHeader";
import RatingBadge from "../components/ui/RatingBadge";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import { formatDate } from "../utils/format";

const REASON_LABEL = {
  unsafe_behaviour: "Unsafe behaviour",
  harassment: "Harassment",
  no_show: "No-show",
  wrong_vehicle: "Wrong vehicle",
  overcharging: "Overcharging",
  fake_profile: "Fake profile",
  other: "Other",
};

const FILTERS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
];

function AdminReports() {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [filter, setFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [pending, setPending] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = filter ? `?status=${filter}` : "";
      const response = await api.get(`/admin/reports${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setReports(response.data.data || []);
      setOpenCount(response.data.openCount || 0);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to load reports."
      );
    } finally {
      setLoading(false);
    }
  }, [filter, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (report, action) => {
    setBusyId(report._id);
    setError("");
    setNotice("");

    try {
      const response = await api.patch(
        `/admin/reports/${report._id}`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPending(null);
      setNotice(response.data.message);
      await load();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not action this report."
      );
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="space-y-6 sm:space-y-8">
      <PageHeader
        className="mb-0"
        eyebrow="Safety"
        title="Reports"
        description="Read what happened and take action. Upholding a report can suspend an account immediately."
      />

      {error && <Alert tone="error" role="alert">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            className={`rounded-full px-4 py-2 text-sm font-extrabold transition ${
              filter === item.value
                ? "bg-primary text-white"
                : "bg-surface text-text-muted hover:bg-surface-muted"
            }`}
            key={item.value}
            onClick={() => setFilter(item.value)}
            type="button"
          >
            {item.label}
            {item.value === "open" && openCount > 0 && (
              <span className="ml-2 rounded-full bg-clay px-2 py-0.5 text-[11px] text-white">
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <LoadingState message="Loading reports..." />}

      {!loading && reports.length === 0 && (
        <EmptyState
          title={filter === "open" ? "Nothing open" : "No reports here"}
          description="Reports raised by riders and drivers land here for review."
        />
      )}

      {!loading && reports.length > 0 && (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card className="p-5" key={report._id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-clay">
                    {REASON_LABEL[report.reason] || report.reason}
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    Reported {formatDate(report.createdAt)}
                    {report.ride
                      ? ` · ${report.ride.source} → ${report.ride.destination}`
                      : ""}
                  </p>
                </div>
                <Badge
                  tone={
                    report.status === "open"
                      ? "warning"
                      : report.status === "actioned"
                        ? "success"
                        : "info"
                  }
                >
                  {report.status}
                </Badge>
              </div>

              {report.details && (
                <p className="mt-4 rounded-2xl bg-surface-muted p-4 text-sm leading-6 text-primary">
                  {report.details}
                </p>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-text-muted">
                    Reported by
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-primary">
                    {report.reporter?.name || "Unknown"}
                  </p>
                  <RatingBadge
                    className="mt-1"
                    count={report.reporter?.ratingCount}
                    rating={report.reporter?.rating}
                    size="sm"
                  />
                </div>
                <div className="rounded-2xl border border-border p-3">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-text-muted">
                    Account reported
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-primary">
                    {report.reportedUser?.name || "Unknown"}
                    {report.reportedUser?.isSuspended && (
                      <span className="ml-2 text-[11px] font-bold text-danger">
                        suspended
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <RatingBadge
                      count={report.reportedUser?.ratingCount}
                      rating={report.reportedUser?.rating}
                      size="sm"
                    />
                    {(report.reportedUser?.roles || []).map((role) => (
                      <Badge key={role} tone={role}>{role}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              {report.status === "open" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => setPending({ report, action: "dismissed" })}
                    type="button"
                    variant="secondary"
                  >
                    Dismiss
                  </Button>
                  <Button
                    onClick={() => setPending({ report, action: "warned" })}
                    type="button"
                    variant="secondary"
                  >
                    Warn
                  </Button>
                  <Button
                    loading={busyId === report._id}
                    onClick={() => setPending({ report, action: "suspended" })}
                    type="button"
                    variant="danger"
                  >
                    Suspend account
                  </Button>
                </div>
              ) : (
                <p className="mt-4 rounded-2xl bg-surface-muted p-3 text-xs font-bold text-text-muted">
                  {report.resolution?.action === "suspended"
                    ? "Account suspended"
                    : report.resolution?.action === "warned"
                      ? "Account warned"
                      : "Report dismissed"}
                  {report.resolution?.at
                    ? ` on ${formatDate(report.resolution.at)}`
                    : ""}
                  {report.resolution?.note ? ` · ${report.resolution.note}` : ""}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        confirmLabel={
          pending?.action === "suspended" ? "Suspend account" : "Confirm"
        }
        description={
          pending?.action === "suspended"
            ? `${pending?.report.reportedUser?.name} will be blocked from using the platform and any active rides will be cancelled.`
            : pending?.action === "warned"
              ? `${pending?.report.reportedUser?.name} will be notified that a report was upheld.`
              : "This report will be closed with no action."
        }
        loading={Boolean(busyId)}
        onCancel={() => setPending(null)}
        onConfirm={() => resolve(pending.report, pending.action)}
        open={Boolean(pending)}
        title={
          pending?.action === "suspended"
            ? "Suspend this account?"
            : pending?.action === "warned"
              ? "Warn this account?"
              : "Dismiss this report?"
        }
      />
    </section>
  );

}

export default AdminReports;
