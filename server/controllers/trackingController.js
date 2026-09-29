import Booking from "../models/Booking.js";
import Ride from "../models/Ride.js";

const isValidRideId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const findRideForDriver = async (req, res) => {
  const { id } = req.params;

  if (!isValidRideId(id)) {
    res.status(400).json({
      message: "Invalid ride ID",
    });
    return null;
  }

  const ride = await Ride.findById(id);

  if (!ride) {
    res.status(404).json({
      message: "Ride not found",
    });
    return null;
  }

  if (ride.driver.toString() !== req.user._id.toString()) {
    res.status(403).json({
      message: "You can only manage tracking for your own rides",
    });
    return null;
  }

  return ride;
};

export const startTracking = async (req, res) => {
  try {
    const ride = await findRideForDriver(req, res);

    if (!ride) {
      return;
    }

    if (ride.status !== "active" || ride.date <= new Date()) {
      return res.status(400).json({
        message: "Tracking can only start for an active, upcoming ride",
      });
    }

    ride.trackingActive = true;
    await ride.save();

    res.status(200).json({
      success: true,
      trackingActive: ride.trackingActive,
      currentLocation: ride.currentLocation || null,
    });
  } catch (error) {
    console.error("Start tracking error:", error);
    res.status(500).json({
      message: "Server error while starting tracking",
    });
  }
};

export const stopTracking = async (req, res) => {
  try {
    const ride = await findRideForDriver(req, res);

    if (!ride) {
      return;
    }

    ride.trackingActive = false;
    await ride.save();

    res.status(200).json({
      success: true,
      trackingActive: ride.trackingActive,
      currentLocation: ride.currentLocation || null,
    });
  } catch (error) {
    console.error("Stop tracking error:", error);
    res.status(500).json({
      message: "Server error while stopping tracking",
    });
  }
};

export const updateLocation = async (req, res) => {
  try {
    const ride = await findRideForDriver(req, res);

    if (!ride) {
      return;
    }

    if (ride.status !== "active" || ride.date <= new Date()) {
      return res.status(400).json({
        message: "Location can only be updated for an active, upcoming ride",
      });
    }

    if (!ride.trackingActive) {
      return res.status(400).json({
        message: "Tracking is inactive",
      });
    }

    const { latitude, longitude, accuracy } = req.body;

    if (
      typeof latitude !== "number" ||
      latitude < -90 ||
      latitude > 90
    ) {
      return res.status(400).json({
        message: "Latitude must be a number between -90 and 90",
      });
    }

    if (
      typeof longitude !== "number" ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        message: "Longitude must be a number between -180 and 180",
      });
    }

    if (
      accuracy !== undefined &&
      (typeof accuracy !== "number" || accuracy < 0)
    ) {
      return res.status(400).json({
        message: "Accuracy must be a non-negative number",
      });
    }

    ride.currentLocation = {
      latitude,
      longitude,
      ...(accuracy === undefined ? {} : { accuracy }),
      updatedAt: new Date(),
    };
    await ride.save();

    res.status(200).json({
      success: true,
      trackingActive: ride.trackingActive,
      currentLocation: ride.currentLocation,
    });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({
      message: "Server error while updating location",
    });
  }
};

export const getLocation = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidRideId(id)) {
      return res.status(400).json({
        message: "Invalid ride ID",
      });
    }

    const ride = await Ride.findById(id);

    if (!ride) {
      return res.status(404).json({
        message: "Ride not found",
      });
    }

    const isDriver = ride.driver.toString() === req.user._id.toString();
    const hasBooking = await Booking.exists({
      ride: ride._id,
      passenger: req.user._id,
      status: { $in: ["pending", "confirmed"] },
    });

    if (!isDriver && !hasBooking) {
      return res.status(403).json({
        message: "You are not authorized to view this ride location",
      });
    }

    if (!ride.trackingActive) {
      return res.status(200).json({
        success: true,
        trackingActive: false,
        message: "Tracking is inactive",
        currentLocation: ride.currentLocation || null,
      });
    }

    if (!ride.currentLocation) {
      return res.status(200).json({
        success: true,
        trackingActive: true,
        message: "Location is not available yet",
        currentLocation: null,
      });
    }

    res.status(200).json({
      success: true,
      trackingActive: true,
      currentLocation: ride.currentLocation,
    });
  } catch (error) {
    console.error("Get location error:", error);

    res.status(500).json({
      message: "Server error while fetching ride location",
    });
  }
};