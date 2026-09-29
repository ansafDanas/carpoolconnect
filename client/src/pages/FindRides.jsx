/* eslint-disable react-hooks/set-state-in-effect -- data loading in an effect is the established pattern in this codebase */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Car, Compass, SlidersHorizontal, X } from "lucide-react";

import api from "../api/axios";
import { useComingSoon } from "../components/ComingSoon";
import { RideCard, RideCardSkeleton } from "../components/RideCard";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { toLocalDateInputValue } from "../utils/format";

const MAX_SEATS = 8;

/**
 * Dedicated Find Rides screen.
 *
 * This is a *browse* surface backed by the canonical `GET /rides` listing,
 * which the backend already scopes to `status: "active"` and
 * `date >= now`, sorted soonest-first.
 *
 * The extra narrowing here (partial place names, a specific day, and a party
 * size) is deliberately applied on top of that list rather than pushed into
 * the request. `GET /rides` does accept `source` and `destination`, but it
 * matches them as anchored whole-string regexes; sending "Kochi" through it
 * would return nothing, because rides store places as "Kochi, Kerala". The
 * user-facing search is a partial match, so the two semantics cannot both be
 * satisfied by one query.
 *
 * The real ranking engine — least detour, time fit, driver trust, blocked
 * drivers and women-only preferences — lives behind the ride request flow.
 * Posting a request hands the decision to that engine instead of guessing at
 * it here, so the page links straight to it.
 */
function FindRides() {
  const { openComingSoon } = useComingSoon();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({
    from: searchParams.get("from") || "",
    to: searchParams.get("to") || "",
    date: searchParams.get("date") || "",
    passengers: searchParams.get("passengers") || "1",
    hideFull: true,
  });

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get("/rides");
      setRides(Array.isArray(response.data.rides) ? response.data.rides : []);
      setError("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "We could not load rides right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();

    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.date) params.set("date", filters.date);
    if (filters.passengers && filters.passengers !== "1") {
      params.set("passengers", filters.passengers);
    }

    setSearchParams(params, { replace: true });
  };

  const clearFilters = () => {
    setFilters({ from: "", to: "", date: "", passengers: "1", hideFull: true });
    setSearchParams({}, { replace: true });
  };

  const results = useMemo(() => {
    const origin = filters.from.trim().toLowerCase();
    const destination = filters.to.trim().toLowerCase();
    const requestedSeats = Number(filters.passengers) || 1;

    return rides
      .filter((ride) => {
        if (ride.status !== "active") return false;
        if (new Date(ride.date) <= new Date()) return false;

        if (origin && !String(ride.source).toLowerCase().includes(origin)) return false;
        if (
          destination &&
          !String(ride.destination).toLowerCase().includes(destination)
        ) {
          return false;
        }
        if (filters.date && toLocalDateInputValue(ride.date) !== filters.date) return false;

        // A ride that cannot carry the group is not a compatible match.
        if (Number(ride.seatsAvailable) < requestedSeats) return false;
        if (filters.hideFull && Number(ride.seatsAvailable) <= 0) return false;

        return true;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [filters, rides]);

  const hasFilters = Boolean(
    filters.from || filters.to || filters.date || filters.passengers !== "1"
  );

  // Carry this search into the request flow so a rider can hand the ranking
  // over to the matching engine instead of retyping the journey.
  const requestHref = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.from) params.set("pickup", filters.from);
    if (filters.to) params.set("drop", filters.to);
    if (filters.date) params.set("date", filters.date);
    if (filters.passengers && filters.passengers !== "1") {
      params.set("seats", filters.passengers);
    }
    const query = params.toString();

    return query ? `/app/request-ride?${query}` : "/app/request-ride";
  }, [filters]);

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-leaf">
            Passenger tools
          </p>
          <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-primary sm:text-[2.125rem]">
            Find rides
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
            Rides going your way, ordered by departure. Every result shows the real fuel
            contribution, never a fare.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => openComingSoon("advancedFilters")}
        >
          <SlidersHorizontal aria-hidden="true" />
          Advanced filters
        </Button>
      </header>

      <form
        onSubmit={applyFilters}
        className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5"
        aria-label="Filter rides"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            id="filter-from"
            label="From"
            value={filters.from}
            onChange={(event) => setFilter("from", event.target.value)}
            placeholder="Kochi"
          />
          <Input
            id="filter-to"
            label="To"
            value={filters.to}
            onChange={(event) => setFilter("to", event.target.value)}
            placeholder="Calicut"
          />
          <Input
            id="filter-date"
            label="Date"
            type="date"
            min={toLocalDateInputValue()}
            value={filters.date}
            onChange={(event) => setFilter("date", event.target.value)}
          />
          <Select
            id="filter-passengers"
            label="Passengers"
            value={filters.passengers}
            onChange={(event) => setFilter("passengers", event.target.value)}
          >
            {Array.from({ length: MAX_SEATS }, (_, index) => index + 1).map(
              (count) => (
                <option key={count} value={count}>
                  {count} passenger{count === 1 ? "" : "s"}
                </option>
              )
            )}
          </Select>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm">
            <Compass aria-hidden="true" />
            Apply filters
          </Button>

          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={filters.hideFull}
              onChange={(event) => setFilter("hideFull", event.target.checked)}
              className="size-4 rounded accent-leaf"
            />
            Hide fully booked rides
          </label>

          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-primary hover:underline"
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear
            </button>
          ) : null}
        </div>
      </form>

      {error ? (
        <Alert tone="error" title="We could not load rides">
          <p>{error}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={load}>
            Try again
          </Button>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-bold text-primary">
          {loading
            ? "Loading rides…"
            : `${results.length} compatible ride${results.length === 1 ? "" : "s"}`}
        </h2>
        {!loading && results.length > 0 ? (
          <p className="text-xs text-text-muted">Soonest departure first</p>
        ) : null}
      </div>

      {loading ? (
        <div className="grid gap-3">
          <RideCardSkeleton />
          <RideCardSkeleton />
          <RideCardSkeleton />
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={Car}
          title={hasFilters ? "No rides match that search" : "No rides are open right now"}
          description={
            hasFilters
              ? "Try a wider date, a nearby town, or fewer passengers. Drivers post new routes every day."
              : "Nobody has an upcoming ride posted yet. Offer your own route, or post a request and let drivers come to you."
          }
          action={
            hasFilters ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
                <Button asChild>
                  <Link to={requestHref}>
                    Post a request instead
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild>
                  <Link to={requestHref}>
                    Post a request
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link to="/app/offer-ride">Offer your route</Link>
                </Button>
              </div>
            )
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {results.map((ride) => (
            <RideCard key={ride._id} ride={ride} />
          ))}
        </div>
      )}
    </div>
  );
}

export default FindRides;
