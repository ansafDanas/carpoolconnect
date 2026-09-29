// Live smoke test of the admin moderation flow end to end.
// Run with: node scripts/smokeAdminModeration.js
const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5000/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@carpoolconnect.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error("Set ADMIN_PASSWORD in the environment first (the value printed by seed:admin).");
  process.exit(1);
}

const call = async (path, { method = "GET", token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

const stamp = Date.now();
const reg = async (label, roles) =>
  call("/auth/register", {
    method: "POST",
    body: {
      name: label,
      // Slug the label: a label with a space would not be a valid email.
      email: `${label.toLowerCase().replace(/[^a-z0-9]/g, "")}${stamp}@example.test`,
      password: "secret123",
      roles,
    },
  });

const login = await call("/auth/login", {
  method: "POST",
  body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
});

if (login.status !== 200) {
  console.error("Admin login failed:", login.json.message);
  process.exit(1);
}

const adminToken = login.json.data?.token || login.json.token;
const adminUser = login.json.data || login.json.user;
const adminId = adminUser?._id;
console.log(`Admin signed in: ${ADMIN_EMAIL} roles=[${adminUser?.roles}]`);

const reports = await call("/admin/reports", { token: adminToken });
console.log(`GET /admin/reports -> HTTP ${reports.status} open=${reports.json.openCount}`);

const users = await call("/admin/users", { token: adminToken });
console.log(`GET /admin/users  -> HTTP ${users.status} total=${users.json.count}`);

// Register cannot grant admin, whatever the client sends.
const sneaky = await reg("Sneaky Admin", ["driver", "admin"]);
const sneakyRoles = sneaky.json.data?.roles || sneaky.json.user?.roles || [];
console.log(
  sneakyRoles.includes("admin")
    ? "FAIL  registration granted admin"
    : "PASS  registration cannot self-assign admin"
);

// Full report lifecycle: file, then act on it as admin.
const rider = await reg("Mod Rider", ["passenger"]);
const riderToken = rider.json.token;
const offender = await reg("Mod Offender", ["driver"]);
const offenderId = offender.json.data?._id || offender.json.user?._id;

const filed = await call(`/social/report/${offenderId}`, {
  method: "POST",
  token: riderToken,
  body: { reason: "unsafe_behaviour", details: "Smoke test report" },
});
console.log(`POST /social/report -> HTTP ${filed.status} ${filed.json.message || ""}`);

if (filed.status === 201) {
  const reportId = filed.json.data?._id;

  const before = await call("/admin/reports", { token: adminToken });
  const seen = before.json.data?.some((r) => r._id === reportId);
  console.log(`${seen ? "PASS" : "FAIL"}  report appears in the admin queue`);

  const dismissed = await call(`/admin/reports/${reportId}`, {
    method: "PATCH",
    token: adminToken,
    body: { action: "dismissed", note: "Smoke test dismissal" },
  });
  console.log(`dismiss report     -> HTTP ${dismissed.status} ${dismissed.json.message || ""}`);

  const after = await call("/admin/reports", { token: adminToken });
  const stillOpen = after.json.data?.some((r) => r._id === reportId && r.status === "open");
  console.log(`${stillOpen ? "FAIL" : "PASS"}  dismissed report leaves the open queue`);

  // Re-resolving a closed report must be refused, not silently repeated.
  const again = await call(`/admin/reports/${reportId}`, {
    method: "PATCH",
    token: adminToken,
    body: { action: "suspended" },
  });
  console.log(`${again.status === 400 ? "PASS" : "FAIL"}  closed report cannot be re-actioned (HTTP ${again.status})`);
}

// An admin must not be able to suspend themselves out of the platform.
const selfSuspend = await call(`/admin/users/${adminId}/suspension`, {
  method: "PATCH",
  token: adminToken,
  body: { suspended: true, reason: "self-suspend smoke test" },
});
console.log(`${selfSuspend.status === 400 ? "PASS" : "FAIL"}  self-suspension blocked (HTTP ${selfSuspend.status})`);

console.log("\nAdmin smoke test finished.");