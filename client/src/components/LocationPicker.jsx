import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Kerala default so the map opens somewhere useful for most users.
const DEFAULT_CENTER = [9.9312, 76.2673];

const pinIcon = L.divIcon({
  className: "cc-pin",
  html: '<span class="cc-pin__dot"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const toPoint = (value) =>
  value &&
  Number.isFinite(Number(value.latitude)) &&
  Number.isFinite(Number(value.longitude))
    ? [Number(value.latitude), Number(value.longitude)]
    : null;

// Clicking anywhere on the map drops or moves the pin.
function ClickToPlace({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function Recentre({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, Math.max(map.getZoom(), 13));
    }
  }, [map, position]);
  return null;
}

function LocationPicker({
  label,
  hint,
  value,
  onChange,
  required = false,
  tone = "leaf",
}) {
  const position = toPoint(value);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [showManual, setShowManual] = useState(false);

  const handlePick = useCallback(
    (next) => {
      setLocateError("");
      onChange(next);
    },
    [onChange]
  );

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocateError("This device cannot share its location.");
      return;
    }

    setLocating(true);
    setLocateError("");

    navigator.geolocation.getCurrentPosition(
      (result) => {
        handlePick({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocateError("Could not get your location. Tap the map instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const manualValues = useMemo(
    () => ({
      latitude: value?.latitude ?? "",
      longitude: value?.longitude ?? "",
    }),
    [value]
  );

  const applyManual = (field, raw) => {
    const next = {
      latitude: field === "latitude" ? raw : manualValues.latitude,
      longitude: field === "longitude" ? raw : manualValues.longitude,
    };

    if (next.latitude === "" || next.longitude === "") {
      onChange(null);
      return;
    }

    const latitude = Number(next.latitude);
    const longitude = Number(next.longitude);

    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return;
    }

    handlePick({ latitude, longitude });
  };

  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="mb-1 block text-xs font-extrabold uppercase tracking-[0.12em] text-text-muted">
        {label}
        {required && <span aria-hidden="true" className="text-accent"> *</span>}
      </legend>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="h-56 w-full">
          <MapContainer
            center={position || DEFAULT_CENTER}
            zoom={position ? 13 : 11}
            scrollWheelZoom
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickToPlace onPick={handlePick} />
            <Recentre position={position} />
            {position && (
              <Marker
                draggable
                icon={pinIcon}
                position={position}
                eventHandlers={{
                  dragend(event) {
                    handlePick({
                      latitude: event.target.getLatLng().lat,
                      longitude: event.target.getLatLng().lng,
                    });
                  },
                }}
              />
            )}
          </MapContainer>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-xs font-semibold text-text-muted">
            {position ? (
              <span className={tone === "clay" ? "text-clay" : "text-leaf"}>
                Pinned at {position[0].toFixed(4)}, {position[1].toFixed(4)}
              </span>
            ) : (
              "Tap the map to drop a pin"
            )}
          </p>

          <div className="flex gap-2">
            <button
              className="rounded-xl border border-border px-3 py-1.5 text-xs font-extrabold text-primary transition hover:bg-surface-muted"
              disabled={locating}
              onClick={useMyLocation}
              type="button"
            >
              {locating ? "Locating..." : "Use my location"}
            </button>
            <button
              className="rounded-xl border border-border px-3 py-1.5 text-xs font-extrabold text-text-muted transition hover:bg-surface-muted"
              onClick={() => setShowManual((current) => !current)}
              type="button"
            >
              {showManual ? "Hide" : "Enter manually"}
            </button>
          </div>
        </div>
      </div>

      {showManual && (
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-surface-muted p-3">
          <label className="grid gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Latitude</span>
            <input
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-leaf"
              inputMode="decimal"
              onChange={(event) => applyManual("latitude", event.target.value)}
              value={manualValues.latitude}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Longitude</span>
            <input
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-leaf"
              inputMode="decimal"
              onChange={(event) => applyManual("longitude", event.target.value)}
              value={manualValues.longitude}
            />
          </label>
        </div>
      )}

      {(hint || locateError) && (
        <p className={`text-xs leading-5 ${locateError ? "text-danger" : "text-text-muted"}`}>
          {locateError || hint}
        </p>
      )}
    </fieldset>
  );

}

export default LocationPicker;
