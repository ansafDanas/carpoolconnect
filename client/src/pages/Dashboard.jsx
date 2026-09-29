/* eslint-disable react-hooks/set-state-in-effect -- data loading in an effect is the established pattern in this codebase */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Car,
  ChevronDown,
  Clock3,
  ListFilter,
  Map as MapIcon,
  MapPin,
  Route,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useComingSoon } from "../components/ComingSoon";
import { RideSearchPanel } from "../components/RideSearchPanel";
import DashboardMapLoader from "../components/DashboardMapLoader";
import { RideCard, RideCardSkeleton } from "../components/RideCard";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { formatDate, formatTime } from "../utils/format";
import { formatRupees, statusLabel, cn } from "../lib/utils";

/** Kerala corridors people actually share, used as search shortcuts. */
const POPULAR_ROUTES = [
  { from: "Kochi", to: "Calicut" },
  { from: "Kochi", to: "Thrissur" },
  { from: "Kochi", to: "Trivandrum" },
  { from: "Kochi", to: "Kottayam" },
];

const RECENT_SEARCH_KEY = "cc_recent_searches";
const RECENT_SEARCH_LIMIT = 4;

const SORTS = [
  { key: "soonest", label: "Soonest" },
  { key: "cheapest", label: "Lowest contribution" },
  { key: "seats", label: "Most seats" },
];

/** Persist the last few searches locally so they survive a reload. */
function readRecentSearches() {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCH_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_SEARCH_LIMIT) : [];
  } catch {
    return [];
  }
}

function writeRecentSearch(entry) {
  try {
    const existing = readRecentSearches().filter(
      (item) =>
        !(
          item.from.toLowerCase() === entry.from.toLowerCase() &&
          item.to.toLowerCase() === entry.to.toLowerCase()
        )
    );

    window.localStorage.setItem(
      RECENT_SEARCH_KEY,
      JSON.stringify([entry, ...existing].slice(0, RECENT_SEARCH_LIMIT))
    );
  } catch {
    // A private-mode browser simply loses the shortcut; not worth surfacing.
  }
}

function clearRecentSearches() {
  try {
    window.localStorage.removeItem(RECENT_SEARCH_KEY);
  } catch {
    // Ignore: clearing a convenience list is never worth an error.
  }
}


function Dashboard() {
  const { token, isPassenger, isDriver } = useAuth();

  const [rides, setRides] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentSearches, setRecentSearches] = useState([]);
  const [sort, setSort] = useState("soonest");
  const [mapView, setMapView] = useState(false);

  useEffect(() => {
    setRecentSearches(readRecentSearches());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);

    // The dashboard only needs light lists. If either call fails the other
    // still renders, so a single broken endpoint never blanks the page.
    const [ridesResult, bookingsResult] = await Promise.allSettled([
      api.get("/rides"),
      api.get("/bookings", { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (ridesResult.status === "fulfilled") {
      setRides(Array.isArray(ridesResult.value.data.rides) ? ridesResult.value.data.rides : []);
      setError("");
    } else {
      setError(
        ridesResult.reason.response?.data?.message ||
          "We could not load available rides. Please try again."
      );
    }

    if (bookingsResult.status === "fulfilled") {
      setBookings(
        Array.isArray(bookingsResult.value.data.bookings)
          ? bookingsResult.value.data.bookings
          : []
      );
    }

    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Record a search so the user can jump straight back to it from the sidebar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const to = params.get("to");

    if (!from || !to) return;

    writeRecentSearch({
      from,
      to,
      date: params.get("date") || "",
      passengers: params.get("passengers") || "1",
    });
  }, []);

  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter((booking) => booking.status === "confirmed")
        .sort((a, b) => new Date(a.ride?.date || 0) - new Date(b.ride?.date || 0)),
    [bookings]
  );

  // Every live ride, not a fixed four, so the map always reflects reality.
  const openRides = useMemo(
    () => rides.filter((ride) => ride.status === "active" && new Date(ride.date) > new Date()),
    [rides]
  );

  const availableRides = useMemo(() => {
    const contribution = (ride) => Number(ride.contribution ?? ride.price) || 0;
    const sorted = [...openRides];

    if (sort === "cheapest") {
      sorted.sort((a, b) => contribution(a) - contribution(b));
    } else if (sort === "seats") {
      sorted.sort((a, b) => (b.seatsAvailable || 0) - (a.seatsAvailable || 0));
    } else {
      sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    return sorted;
  }, [openRides, sort]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid min-w-0 gap-6">
        <HeroWithSearch />

        {mapView ? <DashboardMapLoader rides={openRides} /> : null}

        <PopularRoutes rides={openRides} />
        <AvailableRides
          rides={availableRides}
          loading={loading}
          error={error}
          isPassenger={isPassenger}
          mapView={mapView}
          onRetry={load}
          onSort={setSort}
          onToggleMap={() => setMapView((current) => !current)}
          sort={sort}
        />
      </div>

      <aside className="grid min-w-0 content-start gap-4">
        <DashboardMapLoader rides={openRides} />
        <UpcomingRide booking={upcomingBookings[0]} />
        <RecentSearches
          searches={recentSearches}
          onClear={() => {
            clearRecentSearches();
            setRecentSearches([]);
          }}
        />
        <OfferACard isDriver={isDriver} />
      </aside>
    </div>
  );
}

/**
 * The masthead. A photograph of an actual shared journey, the product promise,
 * and then the search panel sitting on the image, so the one thing a visitor
 * came to do is already in front of them.
 */
function HeroWithSearch() {
  return (
    <div>
      <section className="relative isolate overflow-hidden rounded-xl">
        <img
          src="/carpool-commute.webp"
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/45 to-black/10"
          aria-hidden="true"
        />

        <div className="px-6 pb-32 pt-8 sm:px-8 sm:pb-36 sm:pt-10">
          <h1 className="max-w-xl text-[1.75rem] font-bold leading-[1.15] tracking-[-0.02em] text-white sm:text-[2.5rem]">
            Share the journey.
            <br />
            Make travel better.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/85 sm:text-[15px]">
            Find reliable rides, share your trips, and connect with people going your way.
          </p>
        </div>
      </section>

      <div className="-mt-24 px-4 sm:-mt-28 sm:px-6">
        <RideSearchPanel />
      </div>
    </div>
  );
}

/**
 * One-tap corridor shortcuts. The count under each route is the real number
 * of live rides currently on that corridor, not a marketing number.
 */
function PopularRoutes({ rides = [] }) {
  const countFor = (route) =>
    rides.filter(
      (ride) =>
        ride.source?.toLowerCase().startsWith(route.from.toLowerCase()) &&
        ride.destination?.toLowerCase().startsWith(route.to.toLowerCase())
    ).length;

  return (
    <section aria-label="Popular routes">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-[-0.01em] text-text">Popular Routes</h2>
        <Link
          to="/app/find-rides"
          className="text-[13px] font-semibold text-leaf transition hover:underline"
        >
          View All
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-3 min-[1500px]:grid-cols-4">
        {POPULAR_ROUTES.map((route) => {
          const count = countFor(route);

          return (
            <li key={`${route.from}-${route.to}`}>
              <Link
                to={`/app/find-rides?from=${encodeURIComponent(
                  route.from
                )}&to=${encodeURIComponent(route.to)}`}
                className="flex h-full items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5 shadow-card transition hover:border-leaf/40 hover:shadow-elevated"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-leaf-soft text-leaf"
                  aria-hidden="true"
                >
                  <Route className="size-4" />
                </span>
                <span className="min-w-0">
                  {/* Wraps rather than truncates, so a long corridor name stays
                      readable in the two-up layout on narrower screens. */}
                  <span className="block text-[13px] font-semibold leading-tight text-text">
                    {route.from} → {route.to}
                  </span>
                  <span className="block text-[11px] text-text-muted">
                    {count > 0 ? `${count} ride${count === 1 ? "" : "s"}` : "No rides yet"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Live, bookable rides. Skeletons while loading, guidance when empty. */
function AvailableRides({
  rides,
  loading,
  error,
  isPassenger,
  mapView,
  onRetry,
  onSort,
  onToggleMap,
  sort,
}) {
  const { openComingSoon } = useComingSoon();

  return (
    <section aria-label="Available rides">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-[-0.015em] text-text">Available Rides</h2>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openComingSoon("advancedFilters")}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[13px] font-semibold text-text transition hover:bg-surface-muted"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            Filters
          </button>

          <div className="relative">
            <label className="sr-only" htmlFor="dashboard-sort">
              Sort rides
            </label>
            <ListFilter
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <select
              id="dashboard-sort"
              value={sort}
              onChange={(event) => onSort(event.target.value)}
              className="h-9 appearance-none rounded-lg border border-border bg-surface pl-9 pr-8 text-[13px] font-semibold text-text transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/30"
            >
              {SORTS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
          </div>

          <button
            type="button"
            onClick={onToggleMap}
            aria-pressed={mapView}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold transition",
              mapView
                ? "border-leaf bg-leaf text-white"
                : "border-border bg-surface text-text hover:bg-surface-muted"
            )}
          >
            <MapIcon className="size-3.5" aria-hidden="true" />
            Map View
          </button>
        </div>
      </div>

      {error ? (
        <Alert tone="error" title="We could not load rides">
          <p>{error}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={onRetry}>
            Try again
          </Button>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid gap-3">
          <RideCardSkeleton />
          <RideCardSkeleton />
        </div>
      ) : rides.length === 0 && !error ? (
        <EmptyState
          icon={Car}
          title="No rides are open right now"
          description="Nobody has posted an upcoming ride yet. Offer your own route, or post a request and let drivers come to you."
          action={
            isPassenger ? (
              <Button variant="secondary" asChild>
                <Link to="/app/request-ride">
                  <Route aria-hidden="true" />
                  Post a ride request
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-3">
          {rides.map((ride) => (
            <RideCard key={ride._id} ride={ride} />
          ))}
        </div>
      )}
    </section>
  );
}

/** The passenger's next confirmed trip, or a gentle nudge to book one. */
function UpcomingRide({ booking }) {
  const ride = booking?.ride;

  if (!ride) {
    return (
      <section className="rounded-xl border border-dashed border-border bg-surface p-4">
        <h2 className="text-[15px] font-bold text-text">Your Upcoming Ride</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-text-muted">
          You have no confirmed trip yet. Find a seat on someone&apos;s route and it will
          appear here.
        </p>
        <Button variant="primary" size="sm" className="mt-3 h-9" asChild>
          <Link to="/app/find-rides">
            Find a ride
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
    );
  }

  const driver = typeof ride.driver === "object" ? ride.driver : null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-[15px] font-bold text-text">Your Upcoming Ride</h2>
        <Link
          to="/app/my-bookings"
          className="text-[13px] font-semibold text-leaf transition hover:underline"
        >
          View All
        </Link>
      </header>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <span
              className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-leaf-soft text-leaf"
              aria-hidden="true"
            >
              <MapPin className="size-4" />
            </span>
            <p className="min-w-0 text-sm font-bold leading-snug text-text">
              {ride.source} → {ride.destination}
            </p>
          </div>
          <span className="rating-chip rating-high shrink-0">
            {statusLabel(booking.status)}
          </span>
        </div>

        <p className="ml-9 mt-1 text-xs text-text-muted">
          {formatDate(ride.date)} · {formatTime(ride.date)}
        </p>

        {driver ? (
          <Link
            to={`/app/people/${driver._id}`}
            className="mt-3 flex items-center gap-3 rounded-lg border border-border p-2.5 transition hover:bg-surface-muted"
          >
            {driver.profileImage ? (
              <img
                alt=""
                className="size-10 shrink-0 rounded-full object-cover"
                src={driver.profileImage}
              />
            ) : (
              <span
                className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary"
                aria-hidden="true"
              >
                {driver.name?.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-text">
                {driver.name}
              </span>
              <span className="block truncate text-[11px] text-text-muted">
                {driver.vehicleInfo?.make} {driver.vehicleInfo?.model}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          </Link>
        ) : null}

        <dl className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-2 py-1">
            <Users className="size-3.5" aria-hidden="true" />
            {booking.seats} seat{booking.seats === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-2 py-1">
            <Clock3 className="size-3.5" aria-hidden="true" />
            {formatRupees(booking.contributionAmount)}
          </span>
        </dl>
      </div>
    </section>
  );
}


/** Locally remembered searches, so a repeated route is one click away. */
function RecentSearches({ searches, onClear }) {
  if (!searches.length) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-[15px] font-bold text-text">Recent Searches</h2>
        <button
          type="button"
          onClick={onClear}
          className="text-[13px] font-semibold text-leaf transition hover:underline"
        >
          Clear
        </button>
      </header>

      <ul className="divide-y divide-border">
        {searches.map((search) => (
          <li key={`${search.from}-${search.to}`}>
            <Link
              to={`/app/find-rides?from=${encodeURIComponent(
                search.from
              )}&to=${encodeURIComponent(search.to)}&date=${search.date}&passengers=${
                search.passengers
              }`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-muted"
            >
              <Clock3 className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-text">
                  {search.from} → {search.to}
                </span>
                <span className="block text-[11px] text-text-muted">
                  {search.date ? formatDate(search.date) : "Any date"} ·{" "}
                  {search.passengers} passenger{search.passengers === "1" ? "" : "s"}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The driver-side prompt: empty seats, shared cost, less traffic. Deliberately
 * a white card with a photograph, not a glowing gradient panel.
 */
function OfferACard({ isDriver }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="flex gap-3 p-4">
        <img
          src="/carpool-commute.webp"
          alt=""
          className="size-20 shrink-0 rounded-lg object-cover"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />

        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-text">Offer a Ride</h2>
          <p className="mt-1 text-[13px] leading-5 text-text-muted">
            {isDriver
              ? "Fill your empty seats and share the fuel cost."
              : "Enable the driver role on your profile to share your own trips."}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <Button variant="primary" className="h-10 w-full" asChild>
          <Link to={isDriver ? "/app/offer-ride" : "/app/profile"}>
            {isDriver ? "Get Started" : "Enable driver role"}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  );
}

export default Dashboard;
