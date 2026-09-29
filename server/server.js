import "dotenv/config";

import mongoose from "mongoose";
import app from "./app.js";
import connectDB from "./config/db.js";
import {
  startRideLifecycleScheduler,
  stopRideLifecycleScheduler,
} from "./services/rideLifecycleService.js";

const PORT = Number(process.env.PORT || 5000);

const validateRuntimeEnvironment = () => {
  const isTestEnvironment = process.env.NODE_ENV === "test";
  const requiredVariables = isTestEnvironment
    ? []
    : ["MONGO_URI", "JWT_SECRET"];

  if (process.env.NODE_ENV === "production") {
    requiredVariables.push("CORS_ORIGINS");
  }

  const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable]
  );

  if (missingVariables.length) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(", ")}`
    );
  }

  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (/localhost|127\.0\.0\.1/i.test(process.env.MONGO_URI)) {
    throw new Error("Production MONGO_URI must not point to localhost.");
  }

  // Without this the reset email would silently contain a localhost link that
  // no recipient could ever open, so fail loudly at boot instead.
  if (!process.env.CLIENT_URL) {
    throw new Error(
      "CLIENT_URL must be set in production so password reset links point at the real site."
    );
  }

  if (/localhost|127\.0\.0\.1/i.test(process.env.CLIENT_URL)) {
    throw new Error("Production CLIENT_URL must not point at localhost.");
  }

  if (process.env.MONGO_TEST_URI) {
    throw new Error("MONGO_TEST_URI must not be configured in production.");
  }
};

const startServer = async () => {
  validateRuntimeEnvironment();
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Ride completion must not depend on somebody browsing the ride list, so the
  // lifecycle runs on a timer inside the process.
  startRideLifecycleScheduler();

  const shutdown = async (signal) => {
    console.log(`${signal} received; shutting down`);
    stopRideLifecycleScheduler();
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
};

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  });
}

export default app;