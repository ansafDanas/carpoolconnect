# Production Hosting Checklist (CarpoolConnect)

**Nothing here has been deployed.** These are the exact steps to run yourself.
Pick **one** backend platform from Section B; the frontend is separate (Section C).

---

## Section A — Values you must supply first

Nothing below works until these exist. **Never commit any of them.**

| Variable | Where it goes | Notes |
|---|---|---|
| `MONGO_URI` | Atlas → Backend | See Section A1 |
| `JWT_SECRET` | Backend env | Long random string, Section A2 |
| `CLIENT_URL` | Backend env | Frontend's public origin, no trailing slash |
| `CORS_ORIGINS` | Backend env | Frontend origin, comma-separated |
| `VITE_API_URL` | Frontend build env | **Must end in `/api`**, baked in at build time |

### A1. Atlas database access

1. Atlas → **Network Access** → *Allow access from anywhere* (`0.0.0.0/0`).
   Required because Render/Railway/your machine all have dynamic egress IPs.
   To narrow it later, add only your host provider's static outbound IPs.
2. Atlas → **Database Access** → *Add New Database User*
   - Authentication: **Password**
   - Roles: **Read and write to any database**
3. Atlas → **Database** → *Connect* → **Drivers** → copy the **Node.js** URI.
4. Replace `<db_password>` in it. Keep `retryWrites=true&w=majority`.

**Rotate the credential now.** The current password has been present in local
`.env` files during development and must be treated as exposed. In Atlas:
*Database Access → Edit user → Change password*. Never print it or commit it.

### A2. Generate a JWT secret

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Paste into the backend env as `JWT_SECRET`. Regenerating it logs everyone out.

---

## Section B — Backend (choose ONE)

The server is a plain Express app that starts with `npm start` and listens on
`process.env.PORT`. It has **no build step and no `build` script**.

### Option B1 — Render (recommended)

1. <https://dashboard.render.com> → **New → Web Service** → connect the repo.
2. **Root Directory:** `server`
3. **Runtime:** Node
4. **Build Command:** `npm install`
5. **Start Command:** `npm start`
6. **Health Check Path:** `/api/health`
7. **Environment:** add `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `CORS_ORIGINS`.
8. **Create.** Note the URL: `https://<service>.onrender.com`.

⚠️ **Free tier sleeps.** After ~15 min idle the instance stops and the in-process
ride scheduler pauses with it. Auto-complete still runs on the next request that
hits the public ride list, so rides are never stuck, but completion is not prompt.
Use a paid instance for reliable 15-minute scheduling.

### Option B2 — Railway

1. <https://railway.app/new> → **Deploy from GitHub repo**.
2. **Root Directory:** `server` (Settings → Service → Source).
3. **Start Command:** `npm start` (Settings → Deploy).
4. **Variables:** add the four backend vars (no secrets in files).
5. **Generate Domain:** Networking → *Generate Domain*.
6. **Healthcheck:** set to `/api/health`.

### Option C — Frontend (Vercel or Netlify)

Build settings are identical except the output directory.

| Setting | Vercel | Netlify |
|---|---|---|
| Root directory | `client` | `client` |
| Build command | `npm run build` | `npm run build` |
| Output directory | `dist` | `dist` |
| Env var | `VITE_API_URL` | `VITE_API_URL` |

**Vercel:** <https://vercel.com/new> → import repo → Framework preset **Vite** →
set `VITE_API_URL` → Deploy.

**Netlify:** <https://app.netlify.com/start> → import repo → set the values above
→ Deploy.

> `VITE_API_URL` is compiled into the JS bundle **at build time**. Adding it to
> the dashboard after a deploy has no effect — you must redeploy.

---


## Section D — Wire the two halves together

After both are live, with backend `https://api.example.com` and frontend
`https://carpool.example.com`:

1. Frontend `VITE_API_URL` = `https://api.example.com/api` (note `/api`), redeploy.
2. Backend `CLIENT_URL` = `https://carpool.example.com` (no `/api`, no `/`).
3. Backend `CORS_ORIGINS` = `https://carpool.example.com`, redeploy/restart.
4. Confirm:
   - `https://api.example.com/api/health` → `{"success":true,...}`
   - Open the frontend, sign in, and check DevTools → Network has **no CORS errors**.

**Order matters:** the backend refuses to start in production without a non-local
`CLIENT_URL`, and the frontend build fails without `VITE_API_URL`. Set them before
first deploy, not after.

---

## Section E — Post-deploy verification

```powershell
# 1. Health + security headers (expect 200, x-content-type-options, no x-powered-by)
curl.exe -i https://api.example.com/api/health

# 2. Missing token is rejected
curl.exe -i https://api.example.com/api/bookings

# 3. Rate limiting (expect 429 after 10 tries)
1..12 | ForEach-Object { curl.exe -s -o NUL -w "%{http_code} " `
  -X POST https://api.example.com/api/auth/login `
  -H "Content-Type: application/json" -d '{\"email\":\"x@y.com\",\"password\":\"bad\"}' }
```

Then in the browser: register → verify email → sign in → offer a ride →
request a ride → book → trip chat → complete → review both ways.
On mobile width, confirm the **More** sheet reaches Messages, Reviews and People.

**Production startup refusals (all deliberate):**

| Message | Cause |
|---|---|
| `CLIENT_URL must be set in production...` | `CLIENT_URL` missing |
| `Production CLIENT_URL must not point at localhost.` | Left a dev URL in |
| `Production MONGO_URI must not point to localhost.` | Local URI in prod |
| `Missing required environment variables: CORS_ORIGINS` | Not set |
| `MONGO_TEST_URI must not be configured in production.` | Test URI leaked in |

---

## Section F — Free-tier and scaling notes

- **The rate limiter is in-process.** On more than one instance each keeps its
  own window, so the effective limit multiplies by instance count. For a
  multi-instance deploy, replace it with a shared store (Redis) or enable
  platform-level throttling.
- **The ride scheduler is in-process.** One instance sweeps every 15 minutes;
  extra instances are harmless because completion uses a conditional write and
  cannot double-complete. The public ride listing is a second safety net, so a
  sleeping instance still gets rides closed out.
- **Free tiers sleep.** Expect a cold start of 30–60s after idle, and a database
  connection must resume too.
- **Location privacy is enforced on reads**, so no separate config is needed.

---

## Section G — Manual steps still outstanding

1. **Rotate the Atlas database password** (Section A1). Not done here, and it
   cannot be — the credential must not be printed or committed.
2. **Confirm the two-way review model.** The obsolete `Review { booking: 1 }`
   unique index has been dropped from the live database; the correct
   `{ booking: 1, reviewer: 1 }` guard remains. All 5 existing reviews are intact.
3. **`.env` is already gitignored and untracked** — verified, nothing to do here.
