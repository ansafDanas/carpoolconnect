import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import PageHeader from "../components/ui/PageHeader";
import LocationPicker from "../components/LocationPickerLoader";
import {
  toLocalDateInputValue,
  toLocalTimeInputValue,
} from "../utils/format";

function OfferRide() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    source: "",
    destination: "",
    date: "",
    time: "",
    seatsAvailable: "",
    price: "",
    vehicle: "",
    maxDetourKm: "5",
  });
  const [sourcePin, setSourcePin] = useState(null);
  const [destinationPin, setDestinationPin] = useState(null);

  // Straight-line distance in km, used only as a starting estimate for the
  // fuel cost. Derived rather than stored, so it can never drift.
  const haversineKm = (a, b) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.latitude)) *
        Math.cos(toRad(b.latitude)) *
        Math.sin(dLng / 2) ** 2;
    return Math.round(2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))) * 10) / 10;
  };

  const estimatedDistance =
    sourcePin && destinationPin ? haversineKm(sourcePin, destinationPin) : null;
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectTimer = useRef(null);
  const today = toLocalDateInputValue();
  const currentTime = toLocalTimeInputValue();

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.source.trim() || !formData.destination.trim()) {
      setError("Please enter both a source and destination.");
      return;
    }

    // Without a pin on the map, matching cannot rank this ride by detour.
    if (!sourcePin || !destinationPin) {
      setError(
        "Drop a pin for your start and end point so riders can see how little detour you would add."
      );
      return;
    }

    if (!formData.date || !formData.time) {
      setError("Please choose a date and time for the ride.");
      return;
    }

    const seats = Number(formData.seatsAvailable);
    const price = Number(formData.price);
    const rideDate = new Date(`${formData.date}T${formData.time}`);

    if (!Number.isInteger(seats) || seats < 1) {
      setError("Available seats must be at least 1.");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      setError("Suggested contribution cannot be negative.");
      return;
    }

    if (Number.isNaN(rideDate.getTime()) || rideDate <= new Date()) {
      setError("Please choose a date and time in the future.");
      return;
    }

    setLoading(true);

    try {
      await api.post(
        "/rides",
        {
          source: formData.source.trim(),
          destination: formData.destination.trim(),
          date: rideDate.toISOString(),
          seatsAvailable: seats,
          price,
          vehicle: formData.vehicle.trim(),
          maxDetourKm: Number(formData.maxDetourKm),
          distanceKm: Number(formData.distanceKm) || estimatedDistance || 0,
          sourceCoordinates: sourcePin,
          destinationCoordinates: destinationPin,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSuccess("Ride created successfully!");

      redirectTimer.current = setTimeout(() => {
        navigate("/app/my-rides");
      }, 1000);
    } catch (requestError) {
      console.warn("Offer ride request failed", requestError.response?.status || "network");
      setError(
        requestError.response?.data?.message ||
          "Failed to create ride. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[860px] px-4 py-12 sm:px-6 sm:py-16 lg:px-0">
      <PageHeader
        className="max-w-[39rem]"
        eyebrow="Driver tools"
        title="Offer a Ride"
        description="Share your journey and help someone get where they need to go."
      />

      {error && (
        <Alert className="mb-6" tone="error" role="alert">
          {error}
        </Alert>
      )}

      {success && (
        <Alert className="mb-6" tone="success">
          {success}
        </Alert>
      )}

      <Card as="section" className="p-5 sm:p-8" aria-label="Ride details form">
        <form className="grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={handleSubmit} noValidate>
          <Input
            id="source"
            name="source"
            label="Source"
            type="text"
            value={formData.source}
            onChange={handleChange}
            placeholder="e.g. Kochi"
            required
            error={
              error && !formData.source.trim()
                ? "Source is required."
                : undefined
            }
          />

          <Input
            id="destination"
            name="destination"
            label="Destination"
            type="text"
            value={formData.destination}
            onChange={handleChange}
            placeholder="e.g. Alappuzha"
            required
            error={
              error && !formData.destination.trim()
                ? "Destination is required."
                : undefined
            }
          />

          <Input
            id="date"
            name="date"
            label="Date"
            type="date"
            min={today}
            value={formData.date}
            onChange={handleChange}
            required
          />

          <Input
            id="time"
            name="time"
            label="Time"
            type="time"
            min={formData.date === today ? currentTime : undefined}
            value={formData.time}
            onChange={handleChange}
            required
          />

          <Input
            id="seatsAvailable"
            name="seatsAvailable"
            label="Available Seats"
            type="number"
            min="1"
            value={formData.seatsAvailable}
            onChange={handleChange}
            required
          />

          <Input
            id="price"
            name="price"
            label="Suggested Contribution"
            type="number"
            min="0"
            value={formData.price}
            onChange={handleChange}
            required
            helperText="A suggested contribution toward the shared journey."
          />

          <div className="sm:col-span-2">
            <Input
              id="vehicle"
              name="vehicle"
              label="Vehicle"
              type="text"
              value={formData.vehicle}
              onChange={handleChange}
              placeholder="e.g. Honda City"
            />
          </div>

          <div className="sm:col-span-2">
            <LocationPicker
              hint="This is where your journey starts. Riders near here will see your ride first."
              label="Start point"
              onChange={setSourcePin}
              required
              value={sourcePin}
            />
          </div>

          <div className="sm:col-span-2">
            <LocationPicker
              hint="Where you are heading. Pin the drop so we can work out any detour."
              label="End point"
              onChange={setDestinationPin}
              required
              tone="clay"
              value={destinationPin}
            />
          </div>

          <div className="sm:col-span-2">
            <Input
              id="distanceKm"
              name="distanceKm"
              label="Trip distance (km)"
              type="number"
              min="0"
              max="2000"
              step="0.1"
              value={formData.distanceKm}
              onChange={handleChange}
              helperText={
                estimatedDistance
                  ? `We estimated about ${estimatedDistance} km from your pins. Correct it if your route is longer.`
                  : "Used to work out the honest fuel cost for riders. Leave blank and we will estimate it from your pins."
              }
            />
          </div>

          <div className="sm:col-span-2">
            <Input
              id="maxDetourKm"
              name="maxDetourKm"
              label="Max detour you will accept (km)"
              type="number"
              min="0"
              max="50"
              value={formData.maxDetourKm}
              onChange={handleChange}
              helperText="Riders whose pickup adds more than this are not shown to you."
            />
          </div>

          <div className="flex flex-col items-start gap-4 pt-1 sm:col-span-2 sm:flex-row sm:items-center">
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? "Creating Ride..." : "Create Ride"}
            </Button>
            <Link
              className="inline-flex items-center text-sm font-bold text-accent no-underline transition hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              to="/app/dashboard"
            >
              Cancel / Back to Dashboard
            </Link>
          </div>
        </form>
      </Card>
    </main>
  );
}

export default OfferRide;
