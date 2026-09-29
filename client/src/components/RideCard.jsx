/* eslint-disable react-refresh/only-export-components -- detectAmenities is a shared helper, not a component */
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Ban,
  Clock,
  Dog,
  Fuel,
  MapPin,
  Music,
  Snowflake,
  Users,
} from "lucide-react";

import { formatDate, formatTime } from "../utils/format";
import { formatRupees, statusLabel, statusTone } from "../lib/utils";
import { Badge, VerifiedBadge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Skeleton } from "./ui/LoadingState";
import { cn } from "../lib/utils";

/** Amenities are stored as free text today, so match known keywords only. */
function detectAmenities(vehicle) {
  const text = String(vehicle || "").toLowerCase();
  const found = [];

  if (/\b(ac|a\/c|air.?condition)\b/.test(text)) found.push({ label: "AC", icon: Snowflake });
  if (/\b(music|audio|bluetooth)\b/.test(text)) found.push({ label: "Music", icon: Music });
  if (/\b(non.?smoking|no.?smoke)\b/.test(text)) {
    found.push({ label: "Non-smoking", icon: Ban });
  }
  if (/\b(pet|animal)\b/.test(text)) found.push({ label: "Pet friendly", icon: Dog });

  return found.slice(0, 3);
}

/** Driver summary: photo, name, rating, and only genuine verification. */
export function DriverSummary({ driver, size = "md" }) {
  const name = driver?.name || "Driver";
  const avatarSize = size === "sm" ? "size-9" : "size-12";
  const initials = name.slice(0, 1).toUpperCase();

  return (
    <div className="flex min-w-0 items-center gap-3">
      {driver?.profileImage ? (
        <img
          alt=""
          className={cn("shrink-0 rounded-full object-cover", avatarSize)}
          loading="lazy"
          src={driver.profileImage}
        />
      ) : (
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full bg-primary-soft font-bold text-primary",
            avatarSize,
            size === "sm" ? "text-xs" : "text-sm"
          )}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}

      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-primary">{name}</span>
          {driver?.isVerified ? <VerifiedBadge /> : null}
        </p>
        {driver?.vehicleInfo?.make || driver?.vehicleInfo?.model ? (
          <p className="truncate text-xs text-text-muted">
            {[driver.vehicleInfo.make, driver.vehicleInfo.model]
              .filter(Boolean)
              .join(" ")}
            {driver.vehicleInfo.plateNumber ? ` · ${driver.vehicleInfo.plateNumber}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Horizontal route strip: departure time and place, joined to the destination.
 * Only real data is shown. The backend has no arrival-time field, so rather
 * than render a permanent placeholder dash the destination stands on its own.
 */
export function RouteStrip({ ride, className }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex min-w-0 flex-col text-center">
        <span className="text-sm font-bold text-text">{formatTime(ride.date)}</span>
        <span className="truncate text-xs text-text-muted" title={ride.source}>
          {ride.source}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center" aria-hidden="true">
        <span className="size-1.5 shrink-0 rounded-full bg-leaf" />
        <span className="mx-1.5 h-px flex-1 border-t border-dashed border-border" />
        <ArrowRight className="size-3.5 shrink-0 text-text-muted" />
        <span className="mx-1.5 h-px flex-1 border-t border-dashed border-border" />
        <span className="size-1.5 shrink-0 rounded-full bg-clay" />
      </div>

      <p
        className="min-w-0 shrink-0 truncate text-right text-sm font-bold text-text"
        title={ride.destination}
      >
        {ride.destination}
      </p>
    </div>
  );
}

/**
 * The workhorse result card. Shows driver trust, vehicle, journey, seat
 * availability and the honest fuel contribution. Never labels the amount a
 * fare, and never implies the driver earns from it.
 */
export function RideCard({ ride, onBook, booking = false, departed = false, className }) {
  const driver = typeof ride.driver === "object" ? ride.driver : null;
  const seatsLeft = Number(ride.seatsAvailable) || 0;
  const amenities = detectAmenities(ride.amenities || ride.vehicle);
  const contribution = Number(ride.contribution ?? ride.price) || 0;
  const isFull = seatsLeft <= 0;
  // `departed` is supplied by the list that already filtered on time, so this
  // component never reads the clock during render.
  const isPast = departed;

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-leaf/30 hover:shadow-elevated sm:p-5",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DriverSummary driver={driver} />

        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={statusTone(ride.status)}>{statusLabel(ride.status)}</Badge>
          {ride.womenOnly ? <Badge tone="accent">Women only</Badge> : null}
        </div>
      </div>

      <RouteStrip ride={ride} />

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <CalendarIcon />
          {formatDate(ride.date)}
        </div>
        {ride.distanceKm > 0 ? (
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5" aria-hidden="true" />
            {Math.round(Number(ride.distanceKm))} km
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          <Users className="size-3.5" aria-hidden="true" />
          {isFull ? "No seats left" : `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left`}
        </div>
        {amenities.map((amenity) => {
          const Icon = amenity.icon;
          return (
            <div key={amenity.label} className="flex items-center gap-1.5">
              <Icon className="size-3.5" aria-hidden="true" />
              {amenity.label}
            </div>
          );
        })}
      </dl>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Fuel contribution
          </p>
          <p className="font-display text-xl font-bold leading-tight text-primary">
            {formatRupees(contribution)}
            <span className="ml-1 text-xs font-normal text-text-muted">per seat</span>
          </p>
          {Number(ride.fuelCost) > 0 ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-text-muted">
              <Fuel className="size-3" aria-hidden="true" />
              {formatRupees(ride.fuelCost)} fuel, split {Math.max(1, ride.seats) || "the"} way
            </p>
          ) : null}
        </div>

        {onBook ? (
          <Button disabled={isFull || isPast || booking} onClick={() => onBook(ride)}>
            {isFull ? "Full" : isPast ? "Departed" : "Book seat"}
          </Button>
        ) : (
          <Button variant="secondary" asChild>
            <Link to={`/app/rides/${ride._id}`}>
              View ride
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}

function CalendarIcon() {
  return <Clock className="size-3.5" aria-hidden="true" />;
}

/** Matching placeholder used while results load. */
export function RideCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-11 w-28 rounded-xl" />
      </div>
    </div>
  );
}

export { detectAmenities };
