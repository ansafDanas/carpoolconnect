import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

function TrackingControls({ ride, onRideUpdate }) {
  const { token, user } = useAuth();
  const watchIdRef = useRef(null);
  const lastSentAtRef = useRef(0);
  const rideRef = useRef(ride);
  const trackingActive = Boolean(ride.trackingActive);
  const [status, setStatus] = useState(
    ride.trackingActive ? "Tracking active" : "Tracking stopped"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const driverId = typeof ride.driver === "object" ? ride.driver?._id : ride.driver;
  const isDriver = Boolean(user?._id && driverId === user._id);
  const displayedStatus =
    trackingActive && (status === "Tracking inactive" || status === "Tracking error")
      ? "Tracking active"
      : status === "Tracking error"
        ? "Tracking unavailable"
        : status;

  const clearLocationWatcher = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const handleLocation = async (position) => {
    const now = Date.now();
    const currentRide = rideRef.current;

    if (now - lastSentAtRef.current < 5000) {
      return;
    }

    lastSentAtRef.current = now;

    try {
      await api.post(
        `/rides/${currentRide._id}/location`,
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setStatus("Tracking active");
      setError("");
    } catch (requestError) {
      console.warn("Tracking request failed", requestError.response?.status || "network");
      setStatus("Tracking error");
      setError("Your location couldn't be shared right now. Please try again.");
    }
  };

  const handleLocationError = (locationError) => {
    let locationErrorMessage =
      "Your device couldn't provide your current location. Please check your location settings.";

    if (locationError.code === 1) {
      locationErrorMessage =
        "Location permission is blocked. Allow location access in your browser settings to start tracking.";
    }

    setStatus(rideRef.current.currentLocation ? "Tracking active" : locationErrorMessage);
    setError(locationErrorMessage);
  };

  const startLocationWatcher = () => {
    if (!navigator.geolocation) {
      setError(
        "Your device couldn't provide your current location. Please check your location settings."
      );
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleLocation,
      handleLocationError,
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );
  };

  const startTracking = async () => {
    setLoading(true);
    setError("");
    setStatus("Starting live tracking...");

    try {
      const response = await api.post(
        `/rides/${ride._id}/tracking/start`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setStatus("Tracking active");
      onRideUpdate?.({
        ...ride,
        trackingActive: response.data.trackingActive,
      });
    } catch (requestError) {
      console.warn("Tracking request failed", requestError.response?.status || "network");
      setStatus("Tracking error");
      setError("Unable to start live tracking right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const stopTracking = async () => {
    clearLocationWatcher();
    setLoading(true);
    setError("");

    try {
      const response = await api.post(
        `/rides/${ride._id}/tracking/stop`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setStatus("Tracking stopped");
      onRideUpdate?.({
        ...ride,
        trackingActive: response.data.trackingActive,
      });
    } catch (requestError) {
      console.warn("Tracking request failed", requestError.response?.status || "network");
      setStatus("Tracking error");
      setError("Unable to stop live tracking right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    rideRef.current = ride;
  }, [ride]);

  useEffect(() => {
    if (isDriver && trackingActive) {
      // Start the browser watcher when backend tracking is active.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startLocationWatcher();
    }

    return clearLocationWatcher;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDriver, trackingActive]);

  if (!isDriver || ride.status !== "active") {
    return null;
  }

  return (
    <section className="mt-5 grid gap-3 rounded-2xl border border-border/80 bg-surface-muted/70 p-4" aria-label="Live location controls">
      <div className="flex items-center gap-2 text-sm font-bold text-text-muted" role="status" aria-live="polite">
        <span
          className={trackingActive
            ? "h-2 w-2 rounded-full bg-success shadow-[0_0_0_4px_rgba(22,138,91,0.12)]"
            : "h-2 w-2 rounded-full bg-text-muted"}
          aria-hidden="true"
        />
        <span>{displayedStatus}</span>
      </div>

      {error && <p className="m-0 text-sm leading-6 text-danger" role="alert">{error}</p>}

      {trackingActive ? (
        <button
          className="inline-flex min-h-11 w-full items-center justify-center self-start rounded-2xl bg-danger px-4 py-2 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-danger/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-wait disabled:opacity-65 sm:w-auto"
          type="button"
          onClick={stopTracking}
          disabled={loading}
        >
          {loading ? "Stopping..." : "Stop Tracking"}
        </button>
      ) : (
        <button
          className="inline-flex min-h-11 w-full items-center justify-center self-start rounded-2xl bg-primary px-4 py-2 text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-65 sm:w-auto"
          type="button"
          onClick={startTracking}
          disabled={loading}
        >
          {loading ? "Starting live tracking..." : "Start Tracking"}
        </button>
      )}
    </section>
  );
}

export default TrackingControls;
