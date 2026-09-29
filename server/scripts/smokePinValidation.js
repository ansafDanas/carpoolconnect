// Live smoke test for the pin-validation rules against a running API.
// Run with: node scripts/smokePinValidation.js
const BASE = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5000/api";

const KM = { latitude: 9.9312, longitude: 76.2673 };
const AL = { latitude: 9.4981, longitude: 76.3388 };
const CHENNAI = { latitude: 13.0827, longitude: 80.2707 };
const KOZHIKODE = { latitude: 11.2588, longitude: 75.7804 };
const VADAKARA = { latitude: 11.6102, longitude: 75.6533 };

const api = async (path, { token, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

const stamp = Date.now();
const reg = await api("/auth/register", {
  body: {
    name: "Pin Smoke",
    email: `pinsmoke${stamp}@example.test`,
    password: "secret123",
    roles: ["driver"],
  },
});

// register returns the token at the top level; login nests it under data.
const token = reg.json.token || reg.json.data?.token;

if (!token) {
  console.error("Could not create the smoke-test driver:", reg.json.message);
  process.exit(1);
}
const when = new Date(Date.now() + 2 * 86400000).toISOString();

const cases = [
  {
    label: "realistic Kochi -> Alappuzha",
    expect: true,
    body: { source: "Kochi", destination: "Alappuzha", distanceKm: 78, sourceCoordinates: KM, destinationCoordinates: AL },
  },
  {
    label: "pin 1,000 km away from the typed place",
    expect: false,
    body: { source: "Kochi", destination: "Alappuzha", distanceKm: 78, sourceCoordinates: CHENNAI, destinationCoordinates: AL },
  },
  {
    label: "claims 5 km across 78 km of pins",
    expect: false,
    body: { source: "Kochi", destination: "Alappuzha", distanceKm: 5, sourceCoordinates: KM, destinationCoordinates: AL },
  },
  {
    label: "place name we do not recognise",
    expect: true,
    // Vadakara -> Kozhikode is ~41 km in a straight line, ~48 km by road.
    body: { source: "Vadakara", destination: "Kozhikode", distanceKm: 48, sourceCoordinates: VADAKARA, destinationCoordinates: KOZHIKODE },
  },
  {
    label: "two pins dropped on top of each other",
    expect: false,
    // Both pins in Alappuzha, about 100 m apart.
    body: { source: "Alappuzha", destination: "Alappuzha", distanceKm: 0.1, sourceCoordinates: AL, destinationCoordinates: { latitude: 9.4990, longitude: 76.3395 } },
  },
  {
    label: "pin outside India",
    expect: false,
    body: { source: "Kochi", destination: "Alappuzha", distanceKm: 78, sourceCoordinates: { latitude: 51.5074, longitude: -0.1278 }, destinationCoordinates: AL },
  },
];

let failures = 0;

for (const testCase of cases) {
  const { status, json } = await api("/rides", {
    token,
    body: { date: when, seatsAvailable: 3, price: 0, ...testCase.body },
  });

  const accepted = status === 201;
  const pass = accepted === testCase.expect;
  if (!pass) failures += 1;

  const detail = json.message ? ` - ${json.message}` : "";
  console.log(`${pass ? "PASS" : "FAIL"}  ${testCase.label} -> HTTP ${status}${detail}`);
}

console.log(failures === 0 ? "\nAll pin validation checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);