import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, ZoomControl, useMap } from "react-leaflet";
import { Maximize2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { useComingSoon } from "./ComingSoon";
import { cn } from "../lib/utils";

/** Kerala's centre, used when a ride has not stored coordinates yet. */
const KERALA_CENTER = [10.1631, 76.5715];

/** A pin drawn in CSS so it inherits the product's own colour language. */
const pinIcon = (kind) =>
  L.divIcon({
    className: "cc-pin",
    html: `<span class="cc-pin__dot cc-pin__dot--${kind}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });

/** Keeps the viewport framed on whatever the caller is currently showing. */
function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], 11);
      return;
    }

    map.fitBounds(L.latLngBounds(points), { padding: [42, 42], maxZoom: 12 });
  }, [map, points]);

  return null;
}

/**
 * The right-rail map. Shows the origin/destination of the trips currently on
 * screen, drawn from real ride coordinates -- never a decorative placeholder.
 */
function DashboardMap({ rides = [], className }) {
  const { openComingSoon } = useComingSoon();

  const { pins, route, bounds } = useMemo(() => {
    const collected = [];

    rides.forEach((ride) => {
      const from = ride.sourcePoint?.coordinates;
      const to = ride.destinationPoint?.coordinates;

      // GeoJSON is [longitude, latitude]; Leaflet wants the opposite.
      if (Array.isArray(from) && from.length === 2) {
        collected.push({ ride, kind: "from", position: [from[1], from[0]] });
      }
      if (Array.isArray(to) && to.length === 2) {
        collected.push({ ride, kind: "to", position: [to[1], to[0]] });
      }
    });

    // Only the first ride with both ends is joined, so the line reads as one
    // trip rather than a scribble between unrelated journeys.
    const head = collected[0];
    const route = head
      ? collected.filter((pin) => pin.ride._id === head.ride._id).map((pin) => pin.position)
      : [];

    return { pins: collected, route, bounds: collected.map((pin) => pin.position) };
  }, [rides]);

  const center = bounds.length ? bounds[0] : KERALA_CENTER;
  const leadRide = pins[0]?.ride;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-surface shadow-card",
        className
      )}
      aria-label="Map of available rides"
    >
      <MapContainer
        center={center}
        zoom={9}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        className="h-[300px] w-full sm:h-[340px]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ZoomControl position="topright" />
        <FitBounds points={bounds} />

        {route.length > 1 ? (
          <Polyline
            positions={route}
            pathOptions={{ color: "#1a73e8", weight: 4, opacity: 0.9 }}
          />
        ) : null}

        {pins.map((pin) => (
          <Marker
            key={`${pin.ride._id}-${pin.kind}`}
            position={pin.position}
            icon={pinIcon(pin.kind)}
            title={`${pin.ride.source} → ${pin.ride.destination}`}
          />
        ))}
      </MapContainer>

      <button
        type="button"
        onClick={() => openComingSoon("mapExplore")}
        className="absolute right-3 top-3 z-10 inline-flex h-9 items-center gap-2 rounded-lg bg-surface px-3 text-[13px] font-semibold text-text shadow-card transition hover:bg-surface-muted"
      >
        <Maximize2 className="size-3.5" aria-hidden="true" />
        Expand Map
      </button>

      {leadRide?.distanceKm > 0 ? (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-leaf px-3 py-1.5 text-center text-white shadow-card">
          <p className="text-[13px] font-bold leading-tight">
            {Math.round(leadRide.distanceKm)} km
          </p>
        </div>
      ) : null}
    </section>
  );
}

export default DashboardMap;