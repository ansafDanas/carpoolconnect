import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Car,
  ChevronDown,
  MapPin,
  Search,
  Users,
} from "lucide-react";

import { toLocalDateInputValue } from "../utils/format";
import { useComingSoon } from "./ComingSoon";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

/** One control treatment for every field in the panel. */
const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-text transition placeholder:text-text-muted hover:border-leaf/40 focus-visible:border-leaf focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf/20";

/** Label sitting above a control, with room left for the leading icon. */
function FieldShell({ label, htmlFor, children }) {
  return (
    <div className="min-w-0">
      <label
        className="mb-1.5 block text-[13px] font-medium text-text-muted"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * The primary search surface. One Way / Round Trip / Daily Commute are
 * presented as modes, but only One Way is live: the other two are clearly
 * marked as coming soon rather than silently doing nothing.
 */

const MAX_PASSENGERS = 8;

/**
 * The four entries across the top are trip modes. Only One Way is live today;
 * the rest keep their place and explain themselves rather than silently
 * doing nothing.
 */
const MODES = [
  { key: "oneway", label: "One Way", icon: Car },
  { key: "roundtrip", label: "Round Trip", icon: ArrowLeftRight, comingSoon: true },
  { key: "daily", label: "Daily Commute", icon: CalendarDays, comingSoon: true },
];

function RideSearchPanel({ initialFrom = "", initialTo = "", className }) {
  const navigate = useNavigate();
  const { openComingSoon } = useComingSoon();

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [date, setDate] = useState(toLocalDateInputValue());
  const [passengers, setPassengers] = useState("1");
  const [mode, setMode] = useState("oneway");
  const [error, setError] = useState("");

  const today = toLocalDateInputValue();

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");

    const origin = from.trim();
    const destination = to.trim();

    if (!origin || !destination) {
      setError("Add both a starting place and a destination.");
      return;
    }

    if (origin.toLowerCase() === destination.toLowerCase()) {
      setError("Your start and destination cannot be the same place.");
      return;
    }

    const params = new URLSearchParams({
      from: origin,
      to: destination,
      date,
      passengers,
    });

    navigate(`/app/find-rides?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-xl border border-border bg-surface shadow-elevated",
        className
      )}
      aria-label="Search for a ride"
    >
      <div
        className="flex flex-wrap items-center gap-1 border-b border-border p-2"
        role="tablist"
        aria-label="Trip type"
      >
        {MODES.map((item) => {
          const ModeIcon = item.icon;

          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={mode === item.key}
              onClick={() => (item.comingSoon ? openComingSoon("default") : setMode(item.key))}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition",
                mode === item.key
                  ? "bg-leaf text-white"
                  : "text-text-muted hover:bg-surface-muted hover:text-text"
              )}
            >
              {mode === item.key ? (
                <Search className="size-4" aria-hidden="true" />
              ) : (
                <ModeIcon className="size-4" aria-hidden="true" />
              )}
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <div className="relative sm:col-span-1">
          <FieldShell label="From" htmlFor="search-from">
            <MapPin
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
              aria-hidden="true"
            />
            <input
              id="search-from"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              placeholder="Kochi, Kerala"
              autoComplete="off"
              className={INPUT_CLASS}
            />
          </FieldShell>

          <button
            type="button"
            onClick={swap}
            aria-label="Swap start and destination"
            className="absolute right-3 top-[30px] z-10 grid size-8 place-items-center rounded-full border border-border bg-surface text-leaf transition hover:bg-leaf-soft"
          >
            <ArrowLeftRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>

        <FieldShell label="To" htmlFor="search-to">
          <MapPin
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            id="search-to"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="Calicut, Kerala"
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </FieldShell>

        <FieldShell label="Date" htmlFor="search-date">
          <CalendarDays
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <input
            id="search-date"
            type="date"
            min={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={cn(INPUT_CLASS, "pr-2")}
          />
        </FieldShell>

        <FieldShell label="Passengers" htmlFor="search-passengers">
          <Users
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <select
            id="search-passengers"
            value={passengers}
            onChange={(event) => setPassengers(event.target.value)}
            className={cn(INPUT_CLASS, "appearance-none pr-8")}
          >
            {Array.from({ length: MAX_PASSENGERS }, (_, index) => index + 1).map(
              (count) => (
                <option key={count} value={count}>
                  {count} passenger{count === 1 ? "" : "s"}
                </option>
              )
            )}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
        </FieldShell>

        {error ? (
          <p className="text-sm font-medium text-danger sm:col-span-2" role="alert">
            {error}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <Button type="submit" size="lg" className="h-12 w-full" loadingText="Searching…">
            Search Rides
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </form>
  );
}

export { RideSearchPanel, MAX_PASSENGERS };
export default RideSearchPanel;
