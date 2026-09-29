# CarpoolConnect

A carpooling platform: riders find shared rides, drivers offer seats, and the
cost of a trip is worked out from real fuel economics rather than a fare.

The project is a small monorepo:

- `client/` - React + Vite frontend
- `server/` - Express + Mongoose API
- `tools/` - zero-dependency Chrome DevTools Protocol helpers used for visual QA

## Running the app

The server needs a `.env` (see `server/.env.example`) and the client needs
`VITE_API_URL` for production builds (see `client/.env.example`).

## Running the server tests

```bash
cd server
npm test
```

### The suite needs a local MongoDB

**The test suite connects to a real MongoDB instance. It does not start its
own database.** `tests/setup.js` reads `MONGO_TEST_URI` and connects directly
to whatever that points at, so a `mongod` must be running and listening on that
address before you run the tests:

```bash
mongod --dbpath <some-writable-path>
```

If nothing is listening you will see every test file fail during setup with a
Mongoose connection timeout, which looks like a code failure but is not one.

Set up the test environment with:

```bash
cp .env.test.example .env.test
```

`npm test` loads `.env.test` automatically (it passes `--env-file=.env.test`),
so there is nothing else to wire up. `.env.test` is gitignored; the committed
`.env.test.example` documents the four variables the suite uses:

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_TEST_URI` | yes | Database the suite connects to. Point it at a throwaway database, not application data. |
| `JWT_SECRET` | yes | `tests/setup.js` throws without it, because the app signs real JWTs. |
| `NODE_ENV` | yes | `test`, which stops `server.js` opening a listening socket. |
| `DROP_TEST_DATABASE` | no | `true` drops the test database after the run. |

The tests deliberately use a real database rather than mocks, so that indexes,
uniqueness constraints and aggregation are genuinely exercised. Point
`MONGO_TEST_URI` at a database you are happy to have dropped.

`mongodb-memory-server` is present as a fallback for when `MONGO_TEST_URI` is
unset. The current configuration does not use it and it has not been verified
in this environment; treat it as untested rather than as a working substitute.
