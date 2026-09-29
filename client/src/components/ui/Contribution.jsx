import { useMemo, useState } from "react";
import { Coffee, Fuel, TrendingDown, Users } from "lucide-react";

import { cn, formatRupees } from "../../lib/utils";
import { Button } from "./Button";
import RatingBadge from "./RatingBadge";

/** Contributions move in friendly ₹5 steps, matching the server quote. */
const ROUNDING_STEP = 5;

/** Round a raw split onto the nearest ₹5 so it is easy to read out. */
const toFriendlyAmount = (amount) =>
  amount > 0 ? Math.round(amount / ROUNDING_STEP) * ROUNDING_STEP : 0;

/**
 * ============================================================================
 * The fuel-sharing economics of the product, rendered honestly.
 * ----------------------------------------------------------------------------
 * A passenger never pays a "fare". The slider floor IS the real fuel split
 * calculated from distance, mileage and today's petrol price -- it cannot be
 * slid below. Anything above that floor is labelled "coffee", never a tip.
 *
 * This mirrors server/services/fuelService.js `buildContributionQuote`, where
 * `fuelPortion = min(requested, friendlyFuelShare)` and everything above the
 * split becomes `coffeeAmount`. Moving the slider therefore only ever changes
 * the coffee; the fuel portion is fixed by the trip itself. The UI states this
 * outright rather than leaving the passenger to work it out.
 * ============================================================================
 */
function ContributionSlider({
  fuelCost = 0,
  fuelShare = 0,
  seats = 1,
  value,
  onChange,
  disabled = false,
  paymentStatus = "unpaid",
  onPay,
  paying = false,
}) {
  const people = Math.max(1, Number(seats) || 1);
  const totalFuel = Number(fuelCost) || 0;

  // The floor is the honest split. Fall back to deriving it from the trip's
  // fuel cost when the booking has not stored its own snapshot.
  const rawSplit = Number(fuelShare) || (totalFuel > 0 ? totalFuel / people : 0);
  const base = toFriendlyAmount(rawSplit);

  // A trip posted before fuel data existed has no meaningful floor to show.
  const hasFuelData = base > 0;

  const [localValue, setLocalValue] = useState(value ?? base);
  const [lastValue, setLastValue] = useState(value);
  const max = Math.max(base * 3, base + 100, ROUNDING_STEP * 10);

  // Adopt a new authoritative value from the server (e.g. after paying) by
  // adjusting state during render rather than in an effect, which would
  // otherwise render twice for every change.
  if (value !== undefined && value !== lastValue) {
    setLastValue(value);
    setLocalValue(value);
  }

  const current = Math.min(max, Math.max(base, Number(value ?? localValue) || 0));

  // The fuel portion is capped at the split; the remainder is the coffee.
  const fuelPortion = Math.min(current, base);
  const coffee = Math.max(0, current - base);

  const tone = useMemo(() => {
    if (coffee === 0) {
      return { label: "Fuel covered — no money moves", className: "text-text-muted" };
    }
    if (coffee <= 50) {
      return { label: "Fuel plus a coffee", className: "text-leaf" };
    }
    return { label: "Generous, thank you", className: "text-marigold-hover" };
  }, [coffee]);

  // Clamped to the fuel split as well as the ceiling, so the floor can never
  // be undercut from the UI.
  const handle = (next) => {
    const clamped = Math.min(max, Math.max(base, Number(next) || 0));
    setLocalValue(clamped);
    onChange?.(clamped);
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf">
            Your fuel contribution
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-primary">
            {formatRupees(current)}
          </p>
        </div>
        {paymentStatus === "paid" ? (
          <span className="rating-chip rating-high">Settled</span>
        ) : (
          <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-text-muted">
            Demo — no money moves
          </span>
        )}
      </header>

      {!hasFuelData ? (
        <p className="mt-4 rounded-xl bg-surface-muted px-3.5 py-3 text-xs leading-5 text-text-muted">
          This ride was posted before fuel costs were recorded, so there is no fuel
          split to work from. Any amount you choose is treated as a thank-you for
          the driver&apos;s fuel.
        </p>
      ) : null}

      <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl bg-surface-muted p-3 text-center">
          <dt className="flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <Fuel className="size-3" aria-hidden="true" />
            Fuel
          </dt>
          <dd className="mt-1 text-base font-bold text-primary">{formatRupees(fuelPortion)}</dd>
          <p className="mt-0.5 text-[10px] leading-4 text-text-muted">your share</p>
        </div>
        <div className="rounded-xl bg-surface-muted p-3 text-center">
          <dt className="flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <Users className="size-3" aria-hidden="true" />
            Split
          </dt>
          <dd className="mt-1 text-base font-bold text-primary">{formatRupees(base)}</dd>
          <p className="mt-0.5 text-[10px] leading-4 text-text-muted">
            {people} {people === 1 ? "seat" : "seats"} &middot; {formatRupees(totalFuel)} total
          </p>
        </div>
        <div className="rounded-xl bg-marigold-soft p-3 text-center">
          <dt className="flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-marigold-hover">
            <Coffee className="size-3" aria-hidden="true" />
            Coffee
          </dt>
          <dd className="mt-1 text-base font-bold text-primary">{formatRupees(coffee)}</dd>
          <p className="mt-0.5 text-[10px] leading-4 text-marigold-hover/80">optional</p>
        </div>
      </dl>

      <div className="mt-5">
        <label className="sr-only" htmlFor="contribution-slider">
          Add an optional coffee on top of your fuel split
        </label>
        <input
          id="contribution-slider"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-muted accent-leaf disabled:cursor-not-allowed"
          disabled={disabled || paymentStatus === "paid"}
          max={max}
          min={base}
          onChange={(event) => handle(event.target.value)}
          step={ROUNDING_STEP}
          type="range"
          value={current}
        />
        <div className="mt-2 flex items-center justify-between text-xs font-medium text-text-muted">
          <span>
            {formatRupees(base)} &middot; fuel split
            {hasFuelData ? " (minimum)" : ""}
          </span>
          <span>{formatRupees(max)}</span>
        </div>
        <p className={cn("mt-3 text-sm font-semibold", tone.className)}>{tone.label}</p>
        <p className="mt-1 text-xs leading-5 text-text-muted">
          The fuel split is the floor and cannot be reduced. Anything you add above it
          is a coffee for your driver — never a fare, and never driver earnings.
        </p>
      </div>

      {paymentStatus !== "paid" && onPay ? (
        <Button
          className="mt-5"
          fullWidth
          loading={paying}
          loadingText="Settling…"
          disabled={disabled}
          onClick={() => onPay(current)}
        >
          Confirm contribution of {formatRupees(current)}
        </Button>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-text-muted">
        You contribute toward the fuel this trip actually costs. It is not a fare, and the
        driver does not earn revenue from it.
      </p>
    </section>
  );
}

/**
 * The driver's side of the same transaction, deliberately framed as money
 * saved on a trip they were driving anyway — never as earnings.
 */
function DriverSavings({ summary, className }) {
  if (!summary) return null;
  const positive = Number(summary.netSaved) > 0;

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        positive ? "border-leaf/25 bg-success-soft" : "border-border bg-surface-muted",
        className
      )}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf">
        <TrendingDown className="size-3.5" aria-hidden="true" />
        Your side of the deal
      </p>
      <p className="mt-2 font-display text-lg font-bold leading-snug text-primary">
        {summary.summary}
      </p>
      <p className="mt-1.5 text-xs leading-5 text-text-muted">
        Fuel used {formatRupees(summary.fuelCost)} · covered{" "}
        {formatRupees(summary.contributionAmount)}
      </p>
    </div>
  );
}

/** Compact person row: avatar, name, trust signals, optional action. */
function PersonCard({ person, subtitle, rating, ratingCount, isVerified, extra, action }) {
  const name = person?.name || "Traveller";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
      {person?.profileImage ? (
        <img
          alt=""
          className="size-11 shrink-0 rounded-full object-cover"
          loading="lazy"
          src={person.profileImage}
        />
      ) : (
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary"
          aria-hidden="true"
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-primary">
          {name}
          {isVerified ? (
            <span className="text-[11px] font-semibold text-leaf">Verified</span>
          ) : null}
        </p>
        {subtitle ? <p className="truncate text-xs text-text-muted">{subtitle}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <RatingBadge rating={rating} count={ratingCount} size="sm" />
          {extra}
        </div>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { ContributionSlider, DriverSavings, PersonCard };
export default ContributionSlider;

