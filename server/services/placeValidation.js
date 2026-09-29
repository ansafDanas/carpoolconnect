import keralaLocalities from "../data/keralaLocalities.js";

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const distanceKm = (a, b) => {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
};

// India bounding box. Anything outside is a typo or an attempt to game
// the distance maths.
const INDIA_BOUNDS = { minLat: 6.5, maxLat: 35.5, minLng: 68, maxLng: 97 };

const MIN_TRIP_KM = 0.5;
const MAX_TRIP_KM = 2000;

// A road can be longer than a straight line, but not by an absurd amount.
const MAX_ROAD_TO_AIR_RATIO = 2.5;
const AIR_TOLERANCE_KM = 0.5;

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Callers hand us either a plain { latitude, longitude } pair (from a
// request body) or a GeoJSON point { coordinates: [lng, lat] } (from the
// database). Accept both so a validation bug can never silently reject a
// legitimate pin.
export const toLatLng = (point) => {
  if (!point) return null;

  if (Array.isArray(point.coordinates) && point.coordinates.length === 2) {
    const [longitude, latitude] = point.coordinates.map(Number);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
    return null;
  }

  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { latitude, longitude };
  }

  return null;
};

export const isInsideIndia = (point) => {
  const latLng = toLatLng(point);
  if (!latLng) return false;
  return (
    latLng.latitude >= INDIA_BOUNDS.minLat &&
    latLng.latitude <= INDIA_BOUNDS.maxLat &&
    latLng.longitude >= INDIA_BOUNDS.minLng &&
    latLng.longitude <= INDIA_BOUNDS.maxLng
  );
};

// Every locality whose name or alias matches the typed text, best first.
// Exact matches always beat substring matches, and a locality that merely
// contains the typed word (e.g. "edappally kochi" vs "kochi") scores
// lowest so the plain city wins.
export const findLocalityMatches = (text) => {
  const needle = normalize(text);
  if (!needle) return [];

  const matches = [];

  for (const place of keralaLocalities) {
    const candidates = [place.name, ...place.aliases].map(normalize);
    let bestScore = 0;

    for (const candidate of candidates) {
      if (!candidate) continue;

      let score = 0;
      if (needle === candidate) {
        score = 10000 + candidate.length;
      } else if (needle.includes(candidate)) {
        score = 5000 + candidate.length;
      } else if (candidate.includes(needle)) {
        score = candidate.length;
      }

      if (score > bestScore) {
        bestScore = score;
      }
    }

    if (bestScore > 0) {
      matches.push({ place, score: bestScore });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
};

// Best text-only match, ignoring where the pin actually is.
export const findLocality = (text) => findLocalityMatches(text)[0]?.place || null;

// Keep the user's own wording in messages rather than an internal
// match, so "That pin is 547 km from Kochi" makes sense to them.
const tidyTypedText = (text) => {
  const raw = String(text || "").trim();
  if (!raw) return "that place";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const displayName = (name) =>
  name ? name.charAt(0).toUpperCase() + name.slice(1) : name;

/**
 * Checks a pin against the place the user typed.
 * Returns a verdict rather than throwing, so the caller decides what to
 * reject: a known place with a far-away pin is a hard error, an unknown
 * place is only soft-checked.
 */
export const validatePin = ({ text, point }) => {
  const latLng = toLatLng(point);

  if (!latLng) {
    return { ok: true, checked: false, reason: "no pin" };
  }

  if (!isInsideIndia(latLng)) {
    return {
      ok: false,
      checked: true,
      reason: "That pin is outside India. Please pick your actual start or drop point.",
    };
  }

  // "Kochi" could mean the city or Fort Kochi. The first candidate is the
  // place the user most likely meant, and it is the one we talk to them
  // about, so the number in the message always matches the name in it.
  const candidates = findLocalityMatches(text);

  if (!candidates.length) {
    return { ok: true, checked: false, reason: "unrecognised place name" };
  }

  const primary = candidates[0].place;
  const primaryKm = distanceKm(primary, latLng);

  // Being generous: a pin is fine if it sits within the radius of the
  // place they named or of any other place that name could refer to.
  const acceptable = candidates.some(
    ({ place }) => distanceKm(place, latLng) <= place.radiusKm
  );

  if (!acceptable) {
    return {
      ok: false,
      checked: true,
      kmFromPlace: Math.round(primaryKm),
      place: tidyTypedText(text),
      reason: `That pin is about ${Math.round(primaryKm)} km from ${tidyTypedText(text)}. Please drop it closer, or correct the place name.`,
    };
  }

  const closest = Math.min(
    ...candidates.map(({ place }) => distanceKm(place, latLng))
  );

  return {
    ok: true,
    checked: true,
    kmFromPlace: Math.round(closest * 10) / 10,
    place: tidyTypedText(text),
  };
};

/**
 * A declared distance must agree with the two pins. This is the check
 * that stops someone claiming a 2 km trip between pins 200 km apart to
 * make their detour look small.
 */
export const validateDistanceConsistency = ({
  startPoint,
  endPoint,
  distanceKm: declaredKm,
}) => {
  const start = toLatLng(startPoint);
  const end = toLatLng(endPoint);

  if (!start || !end) {
    return { ok: true, airKm: null, reason: "pins missing" };
  }

  const airKm = distanceKm(start, end);

  if (airKm < MIN_TRIP_KM) {
    return {
      ok: false,
      airKm: Math.round(airKm * 100) / 100,
      reason: "Your two pins are almost on top of each other. Check you dropped the start and the end in the right places.",
    };
  }

  if (airKm > MAX_TRIP_KM) {
    return {
      ok: false,
      airKm: Math.round(airKm),
      reason: "Those pins are more than 2000 km apart. This looks like the wrong trip.",
    };
  }

  if (declaredKm === undefined || declaredKm === null || declaredKm === "") {
    return { ok: true, airKm: Math.round(airKm * 10) / 10, reason: "no distance given" };
  }

  const declared = Number(declaredKm);

  if (!Number.isFinite(declared) || declared < 0) {
    return { ok: false, airKm: Math.round(airKm * 10) / 10, reason: "Distance must be a positive number." };
  }

  // A real route can never be shorter than the straight line between
  // its endpoints, beyond a small tolerance for GPS drift.
  if (declared + AIR_TOLERANCE_KM < airKm) {
    return {
      ok: false,
      airKm: Math.round(airKm * 10) / 10,
      reason: `The distance you entered (${Math.round(declared)} km) is shorter than the straight line between your pins (${Math.round(airKm)} km). Please check the distance.`,
    };
  }

  if (declared > airKm * MAX_ROAD_TO_AIR_RATIO + 5) {
    return {
      ok: false,
      airKm: Math.round(airKm * 10) / 10,
      reason: "The distance you entered is far too long for the two points you pinned.",
    };
  }

  return { ok: true, airKm: Math.round(airKm * 10) / 10, reason: "consistent" };
};

export { distanceKm };