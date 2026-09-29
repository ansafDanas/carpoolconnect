import Ride from "../models/Ride.js";
import Booking from "../models/Booking.js";
import RideRequest from "../models/RideRequest.js";
import User from "../models/User.js";
import {
  sendRideCancellationEmail,
  sendRideCompletionEmail,
} from "../services/emailService.js";
import { createNotification } from "./notificationController.js";
import { calculateFuelCost, getFuelPrice } from "../services/fuelService.js";
import {
  validateDistanceConsistency,
  validatePin,
} from "../services/placeValidation.js";
import { autoCompleteDueRides } from "../services/rideLifecycleService.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MAX_LOCATION_LENGTH = 100;
const MAX_VEHICLE_LENGTH = 100;
// A normal car cannot carry 20 people. This blocks obviously fake offers.
const MAX_SEATS = 8;

const toPoint = (value) => {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  return { type: "Point", coordinates: [longitude, latitude] };
};

const validateRideFields = (fields, { partial = false } = {}) => {
  const errors = [];
  const has = (field) => Object.prototype.hasOwnProperty.call(fields, field);

  if (!partial || has("source")) {
    if (typeof fields.source !== "string" || !fields.source.trim()) {
      errors.push("Source is required");
    } else if (fields.source.trim().length > MAX_LOCATION_LENGTH) {
      errors.push("Source must be 100 characters or fewer");
    }
  }

  if (!partial || has("destination")) {
    if (typeof fields.destination !== "string" || !fields.destination.trim()) {
      errors.push("Destination is required");
    } else if (fields.destination.trim().length > MAX_LOCATION_LENGTH) {
      errors.push("Destination must be 100 characters or fewer");
    }
  }

  if (!partial || has("date")) {
    const date = fields.date ? new Date(fields.date) : null;

    if (!date || Number.isNaN(date.getTime())) {
      errors.push("Date must be valid");
    } else if (date <= new Date()) {
      errors.push("Date must be in the future");
    }
  }

  if (!partial || has("seatsAvailable")) {
    if (!Number.isInteger(fields.seatsAvailable) || fields.seatsAvailable < 1) {
      errors.push("Available seats must be a positive whole number");
    } else if (fields.seatsAvailable > MAX_SEATS) {
      errors.push(`You can offer at most ${MAX_SEATS} seats on a personal car`);
    }
  }

  if (!partial || has("price")) {
    if (typeof fields.price !== "number" || !Number.isFinite(fields.price) || fields.price < 0) {
      errors.push("Price must be a non-negative number");
    }
  }

  if (has("vehicle") && fields.vehicle !== undefined && fields.vehicle !== "") {
    if (typeof fields.vehicle !== "string") {
      errors.push("Vehicle must be a string");
    } else if (fields.vehicle.trim().length > MAX_VEHICLE_LENGTH) {
      errors.push("Vehicle must be 100 characters or fewer");
    }
  }

  if (has("status") && !["active", "completed", "cancelled"].includes(fields.status)) {
    errors.push("Status is invalid");
  }

  return errors;
};

export const createRide = async (req, res) => {
  try {
    const {
      source,
      destination,
      date,
      seatsAvailable,
      price,
      vehicle,
      maxDetourKm,
      sourceCoordinates,
      destinationCoordinates,
      distanceKm,
    } = req.body;

    if (
      !source ||
      !destination ||
      !date ||
      seatsAvailable === undefined ||
      price === undefined
    ) {
      return res.status(400).json({
        message: "Please provide all required ride details",
      });
    }

    const validationErrors = validateRideFields(
      { source, destination, date, seatsAvailable, price, vehicle }
    );

    if (validationErrors.length) {
      return res.status(400).json({
        message: validationErrors[0],
      });
    }

    const sourcePoint = toPoint(sourceCoordinates);
    const destinationPoint = toPoint(destinationCoordinates);

    if (sourceCoordinates && !sourcePoint) {
      return res.status(400).json({
        message: "Source coordinates are invalid",
      });
    }

    if (destinationCoordinates && !destinationPoint) {
      return res.status(400).json({
        message: "Destination coordinates are invalid",
      });
    }

    const detourLimit = maxDetourKm === undefined ? 5 : Number(maxDetourKm);

    if (!Number.isFinite(detourLimit) || detourLimit < 0 || detourLimit > 50) {
      return res.status(400).json({
        message: "Max detour must be between 0 and 50 km",
      });
    }

    // A pin must sit near the place the driver actually typed, and the
    // declared distance must agree with the two pins. Without this, a
    // driver could post fake endpoints to make their detour look small.
    const startCheck = validatePin({ text: source, point: sourcePoint });
    if (!startCheck.ok) {
      return res.status(400).json({ message: startCheck.reason });
    }

    const endCheck = validatePin({ text: destination, point: destinationPoint });
    if (!endCheck.ok) {
      return res.status(400).json({ message: endCheck.reason });
    }

    const distanceCheck = validateDistanceConsistency({
      startPoint: sourcePoint,
      endPoint: destinationPoint,
      distanceKm,
    });
    if (!distanceCheck.ok) {
      return res.status(400).json({ message: distanceCheck.reason });
    }

    // Work out the honest fuel cost from the driver's own mileage so the
    // rider is shown a real split rather than an invented fare.
    const driver = await User.findById(req.user._id).select("vehicleInfo.mileageKmpl");
    const mileage = driver?.vehicleInfo?.mileageKmpl || 15;
    const fuel = await getFuelPrice({});
    const fuelMath = calculateFuelCost({
      distanceKm: Number(distanceKm) || 0,
      mileageKmpl: mileage,
      petrolPrice: fuel.petrol,
    });

    // Create the ride
    const ride = await Ride.create({
      driver: req.user._id,
      source: source.trim(),
      destination: destination.trim(),
      date,
      seatsAvailable,
      price,
      vehicle: typeof vehicle === "string" ? vehicle.trim() : vehicle,
      maxDetourKm: detourLimit,
      sourcePoint: sourcePoint ?? undefined,
      destinationPoint: destinationPoint ?? undefined,
      distanceKm: fuelMath.distanceKm,
      fuelCost: fuelMath.fuelCost,
      fuelPriceAtPosting: fuelMath.petrolPrice,
    });

    res.status(201).json({
      message: "Ride created successfully",
      ride,
    });
  } catch (error) {
    console.error("Create ride error:", error);

    res.status(500).json({
      message: "Server error while creating ride",
    });
  }
};

export const getRides = async (req, res) => {
  try {
    // Lazily close out departed rides so they can be reviewed instead of
    // sitting active forever and blocking the trust loop.
    await autoCompleteDueRides().catch(() => {});

    const { source, destination } = req.query;
    const filters = {
      status: "active",
      date: { $gte: new Date() },
    };

    if (source) {
      filters.source = {
        $regex: new RegExp(`^${escapeRegex(source.trim())}$`, "i"),
      };
    }

    if (destination) {
      filters.destination = {
        $regex: new RegExp(`^${escapeRegex(destination.trim())}$`, "i"),
      };
    }

    const rides = await Ride.find(filters)
      .populate("driver", "name email")
      .sort({ date: 1 });

    res.status(200).json({
      count: rides.length,
      rides,
    });
  } catch (error) {
    console.error("Get rides error:", error);
    res.status(500).json({
      message: "Server error while fetching rides",
    });
  }
};

export const getMyRides = async (req, res) => {
  try {
    const rides = await Ride.find({
      driver: req.user._id,
    }).sort({ date: 1 });

    res.status(200).json({
      success: true,
      count: rides.length,
      data: rides,
    });
  } catch (error) {
    console.error("Get my rides error:", error);

    res.status(500).json({
      success: false,
      message: "Server error while fetching your rides",
    });
  }
};

export const getRideById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid ride ID",
      });
    }

    const ride = await Ride.findById(id).populate(
      "driver",
      "name email"
    );

    if (!ride) {
      return res.status(404).json({
        message: "Ride not found",
      });
    }

    res.status(200).json({
      ride,
    });
  } catch (error) {
    console.error("Get ride by id error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid ride ID",
      });
    }

    res.status(500).json({
      message: "Server error while fetching ride",
    });
  }
};

export const updateRide = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
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

    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You can only update your own rides",
      });
    }

    if (["completed", "cancelled"].includes(ride.status)) {
      return res.status(400).json({
        message: "Completed or cancelled rides cannot be modified",
      });
    }

    const allowedFields = [
      "source",
      "destination",
      "date",
      "seatsAvailable",
      "price",
      "vehicle",
      "status",
      "maxDetourKm",
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid ride fields provided",
      });
    }

    const validationErrors = validateRideFields(updates, { partial: true });

    if (validationErrors.length) {
      return res.status(400).json({
        message: validationErrors[0],
      });
    }

    if (typeof updates.source === "string") updates.source = updates.source.trim();
    if (typeof updates.destination === "string") updates.destination = updates.destination.trim();
    if (typeof updates.vehicle === "string") updates.vehicle = updates.vehicle.trim();

    const previousStatus = ride.status;

    if (["cancelled", "completed"].includes(updates.status)) {
      updates.trackingActive = false;
    }

    Object.assign(ride, updates);
    const updatedRide = await ride.save();
    await updatedRide.populate("driver", "name email");

    let bookings = [];

    if (
      previousStatus !== updatedRide.status &&
      ["cancelled", "completed"].includes(updatedRide.status)
    ) {
      bookings = await Booking.find({
        ride: updatedRide._id,
        status: { $in: ["active", "pending", "confirmed"] },
      });

      if (updatedRide.status === "cancelled") {
        const seatsToRestore = bookings.reduce(
          (total, booking) => total + (booking.seats || 1),
          0
        );
        const bookingIds = bookings.map((booking) => booking._id);

        if (bookingIds.length) {
          await Booking.updateMany(
            { _id: { $in: bookingIds } },
            { $set: { status: "cancelled" } }
          );
        }

        // A request matched to a ride that no longer runs must be released,
        // otherwise the rider keeps a "matched" pointer to a dead trip.
        await RideRequest.updateMany(
          { matchedRide: updatedRide._id, status: "matched" },
          { $set: { status: "open" }, $unset: { matchedRide: 1 } }
        );

        if (seatsToRestore > 0) {
          const restoredRide = await Ride.findOneAndUpdate(
            { _id: updatedRide._id },
            { $inc: { seatsAvailable: seatsToRestore } },
            { returnDocument: "after" }
          );
          updatedRide.seatsAvailable = restoredRide.seatsAvailable;
        }
      }

      const notificationType =
        updatedRide.status === "cancelled"
          ? "ride_cancelled"
          : "ride_completed";
      const notificationTitle =
        updatedRide.status === "cancelled"
          ? "Ride cancelled"
          : "Ride completed";
      const notificationMessage =
        updatedRide.status === "cancelled"
          ? "A ride you booked has been cancelled."
          : "A ride you booked has been completed.";

      await Promise.allSettled(
        bookings.map(async (booking) => {
          const passenger = await User.findById(booking.passenger).select("name email");

          if (updatedRide.status === "cancelled") {
            await sendRideCancellationEmail({
              passengerEmail: passenger?.email,
              passengerName: passenger?.name,
              driverName: updatedRide.driver?.name || "Driver",
              source: updatedRide.source,
              destination: updatedRide.destination,
              date: updatedRide.date,
              seats: booking.seats,
              rideReference: updatedRide._id.toString(),
            });
          } else {
            await sendRideCompletionEmail({
              passengerEmail: passenger?.email,
              passengerName: passenger?.name,
              driverName: updatedRide.driver?.name || "Driver",
              source: updatedRide.source,
              destination: updatedRide.destination,
              date: updatedRide.date,
              rideReference: updatedRide._id.toString(),
            });
          }

          return createNotification({
            recipient: booking.passenger,
            type: notificationType,
            title: notificationTitle,
            message: notificationMessage,
            relatedRide: updatedRide._id,
            relatedBooking: booking._id,
          });
        })
      );
    }

    res.status(200).json({
      message: "Ride updated successfully",
      ride: updatedRide,
    });
  } catch (error) {
    console.error("Update ride error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid ride ID",
      });
    }

    res.status(500).json({
      message: "Server error while updating ride",
    });
  }
};

export const deleteRide = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
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

    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You can only delete your own rides",
      });
    }

    if (ride.status === "completed") {
      return res.status(400).json({
        message: "Completed rides cannot be cancelled",
      });
    }

    if (ride.status === "cancelled") {
      return res.status(400).json({
        message: "Ride is already cancelled",
      });
    }

    const activeBookings = await Booking.find({
      ride: ride._id,
      status: { $in: ["active", "pending", "confirmed"] },
    });

    const seatsToRestore = activeBookings.reduce(
      (total, booking) => total + (booking.seats || 1),
      0
    );

    ride.status = "cancelled";
    ride.trackingActive = false;
    if (seatsToRestore > 0) {
      ride.seatsAvailable += seatsToRestore;
    }
    await ride.save();

    // Release any request that was matched to this ride, so no rider is left
    // holding a "matched" reference to a trip that will not run.
    await RideRequest.updateMany(
      { matchedRide: ride._id, status: "matched" },
      { $set: { status: "open" }, $unset: { matchedRide: 1 } }
    );

    await Promise.allSettled(
      activeBookings.map(async (booking) => {
        booking.status = "cancelled";
        await booking.save();

        const passenger = await User.findById(booking.passenger).select("name email");

        try {
          await sendRideCancellationEmail({
            passengerEmail: passenger?.email,
            passengerName: passenger?.name,
            driverName: req.user?.name || "Driver",
            source: ride.source,
            destination: ride.destination,
            date: ride.date,
            seats: booking.seats,
            rideReference: ride._id.toString(),
          });
        } catch (e) {
          console.error("Cancellation email error:", e);
        }

        return createNotification({
          recipient: booking.passenger,
          type: "ride_cancelled",
          title: "Ride cancelled",
          message: "A ride you booked has been cancelled.",
          relatedRide: ride._id,
          relatedBooking: booking._id,
        });
      })
    );

    await ride.populate("driver", "name email");

    res.status(200).json({
      message: "Ride cancelled successfully",
      ride,
      rideId: id,
      cancelledBookingCount: activeBookings.length,
    });
  } catch (error) {
    console.error("Delete ride error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid ride ID",
      });
    }

    res.status(500).json({
      message: "Server error while deleting ride",
    });
  }
};