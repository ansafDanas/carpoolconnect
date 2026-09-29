import FuelPrice from "../models/FuelPrice.js";

// Seeded fallback so the app is usable before anyone sets a real price.
// Kerala petrol has moved around this band; admins can override any time.
const FALLBACK_PRICES = {
  kerala: { petrol: 107, diesel: 96.5 },
  "kerala-ernakulam": { petrol: 107, diesel: 96.5 },
};

const round2 = (value) => Math.round(value * 100) / 100;

// Reads the configured price for a city, falling back to the state record
// and then to a sane default so the UI never shows a broken number.
export const getFuelPrice = async ({ city = "kerala", state = "kerala" } = {}) => {
  const normalizedCity = String(city).trim().toLowerCase();
  const normalizedState = String(state).trim().toLowerCase();

  const record =
    (await FuelPrice.findOne({ city: normalizedCity }).lean()) ||
    (await FuelPrice.findOne({ state: normalizedState }).lean()) ||
    null;

  if (record) {
    return {
      petrol: record.petrolPricePerLitre,
      diesel: record.dieselPricePerLitre,
      city: record.city,
      state: record.state,
      updatedAt: record.updatedAt,
      isLive: true,
    };
  }

  const fallback =
    FALLBACK_PRICES[normalizedCity] || FALLBACK_PRICES[normalizedState] || FALLBACK_PRICES.kerala;

  return {
    petrol: fallback.petrol,
    diesel: fallback.diesel,
    city: normalizedCity,
    state: normalizedState,
    updatedAt: null,
    isLive: false,
  };
};

// L = distance / mileage  (litres burned)
// fuel cost = litres * price per litre
export const calculateFuelCost = ({ distanceKm, mileageKmpl, petrolPrice }) => {
  const distance = Number(distanceKm);
  const mileage = Number(mileageKmpl);
  const price = Number(petrolPrice);

  if (
    !Number.isFinite(distance) ||
    distance <= 0 ||
    !Number.isFinite(mileage) ||
    mileage <= 0 ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return { litres: 0, fuelCost: 0, distanceKm: 0, mileageKmpl: 0, petrolPrice: price || 0 };
  }

  const litres = distance / mileage;

  return {
    litres: round2(litres),
    fuelCost: round2(litres * price),
    distanceKm: round2(distance),
    mileageKmpl: round2(mileage),
    petrolPrice: round2(price),
  };
};

// What each person owes to simply cover the fuel, plus the optional
// "coffee" top-up. The floor is never below the honest fuel split.
export const buildContributionQuote = ({
  fuelCost,
  seats,
  contributionAmount,
  roundingStep = 5,
}) => {
  const total = Number(fuelCost) || 0;
  const people = Math.max(1, Number(seats) || 1);
  const fuelShare = round2(total / people);
  const requested = Number(contributionAmount);

  const base = Number.isFinite(requested) && requested > 0 ? requested : fuelShare;

  // Snap the fuel share to a friendly rupee amount so it is easy to read out.
  const friendlyFuelShare =
    fuelShare > 0 ? Math.round(fuelShare / roundingStep) * roundingStep : 0;

  // Whatever the rider chose is honoured exactly: the fuel portion is capped
  // at the friendly split and anything above it is the coffee top-up.
  const fuelPortion = Math.min(base, friendlyFuelShare);

  return {
    fuelCost: round2(total),
    seats: people,
    fuelShare,
    friendlyFuelShare,
    coffeeAmount: round2(Math.max(0, base - fuelPortion)),
    contributionAmount: round2(base),
    currency: "INR",
  };
};

// The driver's side is deliberately framed as money saved, not money earned.
export const buildDriverSavings = ({ fuelCost, contributionAmount }) => {
  const fuel = Number(fuelCost) || 0;
  const contributed = Number(contributionAmount) || 0;
  const netSaved = round2(contributed - fuel);

  return {
    fuelCost: round2(fuel),
    contributionAmount: round2(contributed),
    netSaved,
    // The full fuel cost is covered once the contribution is at least fuel.
    fullyCovered: contributed >= fuel && fuel > 0,
  };
};