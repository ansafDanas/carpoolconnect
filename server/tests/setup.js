import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { beforeAll, afterAll, afterEach } from "vitest";
import app from "../app.js";
import User from "../models/User.js";
import Ride from "../models/Ride.js";
import Booking from "../models/Booking.js";
import Notification from "../models/Notification.js";
import Review from "../models/Review.js";
import RideRequest from "../models/RideRequest.js";
import Message from "../models/Message.js";
import Report from "../models/Report.js";
import FuelPrice from "../models/FuelPrice.js";
import generateToken from "../utils/generateToken.js";
import { resetRateLimits } from "../middleware/rateLimitMiddleware.js";

if (!process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not set. The app auth mechanism requires a JWT secret for tests."
  );
}

let memoryServer;
const suiteId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

export const createdUserIds = [];
export const createdRideIds = [];
export const createdBookingIds = [];

export const makeUniqueEmail = (label = "test") =>
  `${label}_${suiteId}_${Math.random().toString(16).slice(2, 10)}@example.com`;

// Import lazily-bound model so cleanup can always clear reset grants.
import PasswordResetToken from "../models/PasswordResetToken.js";

export const cleanupCreatedRecords = async () => {
  const userIds = [...createdUserIds];
  const rideIds = [...createdRideIds];
  const bookingIds = [...createdBookingIds];

  if (userIds.length) {
    await PasswordResetToken.deleteMany({ user: { $in: userIds } });
  }

  if (rideIds.length || bookingIds.length) {
    await Review.deleteMany({
      $or: [
        { ride: { $in: rideIds } },
        { booking: { $in: bookingIds } },
        ...(userIds.length
          ? [{ reviewer: { $in: userIds } }, { reviewee: { $in: userIds } }]
          : []),
      ],
    });
  }

  if (userIds.length || rideIds.length || bookingIds.length) {
    await Notification.deleteMany({
      $or: [
        ...(userIds.length ? [{ recipient: { $in: userIds } }] : []),
        ...(rideIds.length ? [{ relatedRide: { $in: rideIds } }] : []),
        ...(bookingIds.length ? [{ relatedBooking: { $in: bookingIds } }] : []),
      ],
    });
  }

  if (userIds.length || rideIds.length) {
    await RideRequest.deleteMany({
      $or: [
        ...(userIds.length ? [{ rider: { $in: userIds } }] : []),
        ...(rideIds.length ? [{ matchedRide: { $in: rideIds } }] : []),
      ],
    });
  }

  if (userIds.length || rideIds.length || bookingIds.length) {
    await Message.deleteMany({
      $or: [
        ...(userIds.length
          ? [{ sender: { $in: userIds } }, { recipient: { $in: userIds } }]
          : []),
        ...(bookingIds.length ? [{ booking: { $in: bookingIds } }] : []),
      ],
    });

    await Report.deleteMany({
      $or: [
        ...(userIds.length
          ? [{ reporter: { $in: userIds } }, { reportedUser: { $in: userIds } }]
          : []),
        ...(rideIds.length ? [{ ride: { $in: rideIds } }] : []),
      ],
    });
  }

  await FuelPrice.deleteMany({ city: /^testcity/ });

  if (bookingIds.length) {
    await Booking.deleteMany({ _id: { $in: bookingIds } });
    createdBookingIds.length = 0;
  }

  if (rideIds.length) {
    await Ride.deleteMany({ _id: { $in: rideIds } });
    createdRideIds.length = 0;
  }

  if (userIds.length) {
    await User.deleteMany({ _id: { $in: userIds } });
    createdUserIds.length = 0;
  }
};

beforeAll(async () => {
  if (process.env.MONGO_TEST_URI) {
    await mongoose.connect(process.env.MONGO_TEST_URI);
    return;
  }

  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri("carpoolconnect_test"));
});

afterEach(async () => {
  // The limiter is process-local and keyed by IP, so without this every test
  // would share one budget and later cases would fail with a spurious 429.
  resetRateLimits();
  await cleanupCreatedRecords();
});

afterAll(async () => {
  await cleanupCreatedRecords();

  if (process.env.DROP_TEST_DATABASE === "true") {
    await mongoose.connection.dropDatabase();
  }

  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
  }
});

export {
  app,
  generateToken,
  User,
  Ride,
  Booking,
  Notification,
  Review,
  RideRequest,
  Message,
  Report,
  FuelPrice,
  PasswordResetToken,
};
