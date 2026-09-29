import Message from "../models/Message.js";
import Booking from "../models/Booking.js";
import Ride from "../models/Ride.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import Review from "../models/Review.js";

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const publicProfileFields =
  "name profileImage rating ratingCount bio conversationStarter vibeTags languages isVerified womenOnly roles vehicleInfo.make vehicleInfo.model vehicleInfo.color vehicleInfo.plateNumber vehicleInfo.mileageKmpl createdAt";

// A public profile is the product here: people ride with other people.
export const getPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(userId).select(publicProfileFields);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const completedAsDriver = await Ride.countDocuments({
      driver: user._id,
      status: "completed",
    });

    const reviews = await Review.find({ reviewee: user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("reviewer", "name profileImage rating")
      .lean();

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        profileImage: user.profileImage,
        rating: user.rating,
        ratingCount: user.ratingCount,
        bio: user.bio,
        conversationStarter: user.conversationStarter,
        vibeTags: user.vibeTags,
        languages: user.languages,
        isVerified: user.isVerified,
        womenOnly: user.womenOnly,
        roles: user.roles,
        vehicleInfo: {
          make: user.vehicleInfo?.make,
          model: user.vehicleInfo?.model,
          color: user.vehicleInfo?.color,
          plateNumber: user.vehicleInfo?.plateNumber,
          mileageKmpl: user.vehicleInfo?.mileageKmpl,
        },
        completedRides: completedAsDriver,
        reviews,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while loading profile",
    });
  }
};

const loadChatBooking = async (bookingId, userId) => {
  if (!isValidId(bookingId)) {
    return { error: { status: 400, message: "Invalid booking ID" } };
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return { error: { status: 404, message: "Booking not found" } };
  }

  const ride = await Ride.findById(booking.ride);
  if (!ride) {
    return { error: { status: 404, message: "Ride not found" } };
  }

  const isPassenger = booking.passenger.toString() === userId.toString();
  const isDriver = ride.driver.toString() === userId.toString();

  if (!isPassenger && !isDriver) {
    return { error: { status: 403, message: "This is not your trip" } };
  }

  return { booking, ride };
};

// Chat unlocks only for a confirmed trip between the two people.
export const getMessages = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { booking, error } = await loadChatBooking(bookingId, req.user._id);

    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    if (booking.status !== "confirmed") {
      return res.status(403).json({
        success: false,
        message: "Chat opens once the booking is confirmed",
      });
    }

    const messages = await Message.find({ booking: booking._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    res.status(200).json({ success: true, count: messages.length, data: messages });
  } catch (chatError) {
    res.status(500).json({
      success: false,
      message: "Server error while loading messages",
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";

    if (!body) {
      return res.status(400).json({ success: false, message: "Message cannot be empty" });
    }

    if (body.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Message must be 500 characters or fewer",
      });
    }

    const { booking, ride, error } = await loadChatBooking(bookingId, req.user._id);

    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    if (booking.status !== "confirmed") {
      return res.status(403).json({
        success: false,
        message: "Chat opens once the booking is confirmed",
      });
    }

    const recipient =
      booking.passenger.toString() === req.user._id.toString()
        ? ride.driver
        : booking.passenger;

    const message = await Message.create({
      booking: booking._id,
      sender: req.user._id,
      recipient,
      body,
    });

    if (!booking.chatUnlockedAt) {
      booking.chatUnlockedAt = new Date();
      await booking.save();
    }

    res.status(201).json({ success: true, data: message });
  } catch (sendError) {
    res.status(500).json({
      success: false,
      message: "Server error while sending message",
    });
  }
};

export const markMessagesRead = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { booking, error } = await loadChatBooking(bookingId, req.user._id);

    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    await Message.updateMany(
      { booking: booking._id, recipient: req.user._id, readAt: null },
      { $set: { readAt: new Date() } }
    );

    res.status(200).json({ success: true });
  } catch (readError) {
    res.status(500).json({
      success: false,
      message: "Server error while marking messages read",
    });
  }
};

export const reportUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, details, rideId } = req.body || {};

    if (!isValidId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot report yourself" });
    }

    const reported = await User.findById(userId).select("_id");
    if (!reported) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const allowed = [
      "unsafe_behaviour",
      "harassment",
      "no_show",
      "wrong_vehicle",
      "overcharging",
      "fake_profile",
      "other",
    ];

    if (!allowed.includes(reason)) {
      return res.status(400).json({ success: false, message: "Please choose a reason" });
    }

    const report = await Report.create({
      reporter: req.user._id,
      reportedUser: userId,
      ride: isValidId(rideId || "") ? rideId : undefined,
      reason,
      details: typeof details === "string" ? details.trim().slice(0, 500) : "",
    });

    res.status(201).json({ success: true, message: "Thanks, we will look into this", data: report });
  } catch (reportError) {
    res.status(500).json({
      success: false,
      message: "Server error while submitting report",
    });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "You cannot block yourself" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.blockedUsers.some((id) => id.toString() === userId)) {
      user.blockedUsers.push(userId);
      await user.save();
    }

    res.status(200).json({ success: true, message: "User blocked" });
  } catch (blockError) {
    res.status(500).json({ success: false, message: "Server error while blocking user" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isValidId(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.blockedUsers = user.blockedUsers.filter((id) => id.toString() !== userId);
    await user.save();

    res.status(200).json({ success: true, message: "User unblocked" });
  } catch (unblockError) {
    res.status(500).json({ success: false, message: "Server error while unblocking user" });
  }
};

// People you have travelled with before, strongest relationship first.
export const getRegularPartners = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("blockedUsers");
    const blocked = (user?.blockedUsers || []).map((id) => id.toString());

    // Trips where I was the passenger, plus trips on rides I offered.
    const ridesIOffered = await Ride.find({ driver: userId })
      .select("_id")
      .lean();

    const rideIds = ridesIOffered.map((ride) => ride._id);

    const bookings = await Booking.find({
      status: "confirmed",
      $or: [{ passenger: userId }, { ride: { $in: rideIds } }],
    })
      .select("passenger ride createdAt")
      .lean();

    if (!bookings.length) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    // One query for every ride referenced, instead of one per booking.
    const referencedRideIds = [
      ...new Set(bookings.map((booking) => booking.ride.toString())),
    ];
    const referencedRides = await Ride.find({ _id: { $in: referencedRideIds } })
      .select("_id driver")
      .lean();
    const driverByRide = new Map(
      referencedRides.map((ride) => [ride._id.toString(), ride.driver.toString()])
    );

    const counts = new Map();

    for (const booking of bookings) {
      const driverId = driverByRide.get(booking.ride.toString());
      if (!driverId) continue;

      const otherId =
        driverId === userId.toString()
          ? booking.passenger.toString()
          : driverId;

      if (otherId === userId.toString()) continue;

      const entry = counts.get(otherId) || { rides: 0, lastRideAt: null };
      entry.rides += 1;
      if (!entry.lastRideAt || booking.createdAt > entry.lastRideAt) {
        entry.lastRideAt = booking.createdAt;
      }
      counts.set(otherId, entry);
    }

    const candidates = [...counts.entries()]
      .filter(([id]) => !blocked.includes(id))
      .filter(([, entry]) => entry.rides >= 2)
      .sort((a, b) => b[1].rides - a[1].rides)
      .slice(0, 10);

    if (!candidates.length) {
      return res.status(200).json({ success: true, count: 0, data: [] });
    }

    const people = await User.find({
      _id: { $in: candidates.map(([id]) => id) },
    }).select(publicProfileFields);

    const data = people
      .map((person) => ({
        user: person.toObject(),
        sharedRides: counts.get(person._id.toString())?.rides || 0,
        lastRideAt: counts.get(person._id.toString())?.lastRideAt || null,
      }))
      .sort((a, b) => b.sharedRides - a.sharedRides);

    res.status(200).json({ success: true, count: data.length, data });
  } catch (partnerError) {
    res.status(500).json({
      success: false,
      message: "Server error while loading travel buddies",
    });
  }
};