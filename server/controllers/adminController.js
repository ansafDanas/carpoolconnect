import Booking from "../models/Booking.js";
import Ride from "../models/Ride.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import { sendRideCancellationEmail } from "../services/emailService.js";
import { createNotification } from "./notificationController.js";

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const SUSPENSION_REASONS = {
  unsafe_behaviour: "Unsafe behaviour during a trip",
  harassment: "Harassment or abuse",
  no_show: "Repeatedly not showing up",
  wrong_vehicle: "Deliberately misrepresenting the vehicle",
  overcharging: "Overcharging or pressuring for payment",
  fake_profile: "Fake or impersonated profile",
};

// Safety reports, newest first, with both parties resolved for the admin.
export const getAdminReports = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status && ["open", "reviewed", "dismissed", "actioned"].includes(status)) {
      filter.status = status;
    }

    const reports = await Report.find(filter)
      .populate("reporter", "_id name email rating")
      .populate("reportedUser", "_id name email roles rating isSuspended")
      .populate("ride", "_id source destination date status")
      .sort({ createdAt: -1 })
      .limit(200);

    const openCount = await Report.countDocuments({ status: "open" });

    res.status(200).json({
      success: true,
      count: reports.length,
      openCount,
      data: reports,
    });
  } catch (error) {
    console.error("Admin reports error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching reports",
    });
  }
};

// The action an admin takes on a report. Suspension is the only real
// enforcement, and it immediately blocks the account everywhere.
export const resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, note } = req.body || {};

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid report ID" });
    }

    if (!["dismissed", "warned", "suspended"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Choose one of: dismissed, warned, suspended",
      });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    if (report.status !== "open") {
      return res.status(400).json({
        success: false,
        message: `This report was already ${report.status}`,
      });
    }

    const reported = await User.findById(report.reportedUser);
    if (!reported) {
      return res.status(404).json({ success: false, message: "Reported user not found" });
    }

    // An admin must never be able to suspend another admin.
    if (reported.roles?.includes("admin")) {
      return res.status(400).json({
        success: false,
        message: "Admin accounts cannot be suspended from this screen",
      });
    }

    if (action === "suspended") {
      reported.isSuspended = true;
      reported.suspendedReason =
        SUSPENSION_REASONS[report.reason] || "Safety report upheld";
      reported.suspendedAt = new Date();
      await reported.save();

      // Close out anything they had in flight so riders are not stranded.
      await Ride.updateMany(
        { driver: reported._id, status: "active" },
        { $set: { status: "cancelled", trackingActive: false } }
      );
    } else if (action === "warned") {
      await createNotification({
        recipient: reported._id,
        type: "account_warning",
        title: "A safety report was upheld",
        message:
          SUSPENSION_REASONS[report.reason] ||
          "A report about one of your trips was upheld.",
        relatedRide: report.ride,
      }).catch(() => {});
    }

    report.status = action === "dismissed" ? "dismissed" : "actioned";
    report.resolution = {
      action,
      note: typeof note === "string" ? note.trim().slice(0, 300) : "",
      by: req.user._id,
      at: new Date(),
    };
    await report.save();

    await report.populate([
      { path: "reporter", select: "_id name email rating" },
      { path: "reportedUser", select: "_id name email roles rating isSuspended" },
      { path: "ride", select: "_id source destination date status" },
    ]);

    res.status(200).json({
      success: true,
      message: `Report ${action}`,
      data: report,
    });
  } catch (error) {
    console.error("Resolve report error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resolving report",
    });
  }
};

// Lift or apply a suspension directly, without going through a report.
export const setUserSuspension = async (req, res) => {
  try {
    const { userId } = req.params;
    const { suspended, reason } = req.body || {};

    if (!isValidId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (typeof suspended !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "suspended must be true or false",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.roles?.includes("admin")) {
      return res.status(400).json({
        success: false,
        message: "Admin accounts cannot be suspended",
      });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot suspend your own account",
      });
    }

    user.isSuspended = suspended;
    user.suspendedReason = suspended
      ? typeof reason === "string"
        ? reason.trim().slice(0, 200)
        : "Suspended by an administrator"
      : "";
    user.suspendedAt = suspended ? new Date() : undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: suspended ? "Account suspended" : "Account reinstated",
      data: {
        _id: user._id,
        isSuspended: user.isSuspended,
        suspendedReason: user.suspendedReason,
      },
    });
  } catch (error) {
    console.error("Set suspension error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating account status",
    });
  }
};
export const getAdminUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select("_id name email roles phone rating isSuspended suspendedReason createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching users",
    });
  }
};

export const getAdminRides = async (req, res) => {
  try {
    const rides = await Ride.find({})
      .populate("driver", "_id name email roles rating")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: rides.length,
      data: rides,
    });
  } catch (error) {
    console.error("Admin rides error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching rides",
    });
  }
};

export const getAdminBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate("passenger", "_id name email roles")
      .populate({
        path: "ride",
        select:
          "_id source destination date seatsAvailable price vehicle status trackingActive driver",
        populate: {
          path: "driver",
          select: "_id name email roles",
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error("Admin bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching bookings",
    });
  }
};

export const cancelRideAsAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ride ID",
      });
    }

    const ride = await Ride.findById(id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    if (ride.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Ride is already cancelled",
      });
    }

    if (ride.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Completed rides cannot be cancelled",
      });
    }

    const activeBookings = await Booking.find({
      ride: ride._id,
      status: { $in: ["pending", "confirmed"] },
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

    await Promise.allSettled(
      activeBookings.map(async (booking) => {
        booking.status = "cancelled";
        await booking.save();

        const passenger = await User.findById(booking.passenger).select("name email");

        await sendRideCancellationEmail({
          passengerEmail: passenger?.email,
          passengerName: passenger?.name,
          driverName: ride.driver?.name || "Driver",
          source: ride.source,
          destination: ride.destination,
          date: ride.date,
          seats: booking.seats,
          rideReference: ride._id.toString(),
        });

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

    await ride.populate("driver", "_id name email roles rating");

    res.status(200).json({
      success: true,
      message: "Ride cancelled successfully",
      ride,
      cancelledBookingCount: activeBookings.length,
    });
  } catch (error) {
    console.error("Admin ride cancellation error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid ride ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while cancelling ride",
    });
  }
};
