import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import rideRoutes from "./routes/rideRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import trackingRoutes from "./routes/trackingRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import rideRequestRoutes from "./routes/rideRequestRoutes.js";
import socialRoutes from "./routes/socialRoutes.js";
import tripRoutes from "./routes/tripRoutes.js";

const app = express();

const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (configuredOrigins.includes(origin)) {
    return true;
  }

  return process.env.NODE_ENV !== "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
};

app.use(cors({
  origin: (origin, callback) => {
    callback(null, isAllowedOrigin(origin));
  },
}));

// Explicit limit so an unauthenticated caller cannot drive memory usage with
// large bodies before any route (and therefore any auth check) is reached.
app.use(express.json({ limit: "1mb" }));

// Baseline hardening headers. Deliberately no Content-Security-Policy here:
// the SPA loads Leaflet tiles and Cloudinary-hosted images, and a restrictive
// policy authored server-side would break the shipped frontend. CSP is better
// set at the hosting edge where it can be verified against real assets.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.removeHeader("X-Powered-By");
  next();
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/ride-requests", rideRequestRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/trip", tripRoutes);
app.use("/api/rides", trackingRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({
      success: false,
      message: "Malformed JSON request body",
    });
  }

  // A body past the configured limit is a client error, not a server fault.
  // Without this, body-parser's error would surface as a misleading 500.
  if (error.type === "entity.too.large" || error.status === 413) {
    return res.status(413).json({
      success: false,
      message: "Request body is too large",
    });
  }

  console.error("Unhandled API error:", error.message);
  return res.status(500).json({
    success: false,
    message: "Unexpected server error",
  });
});

export default app;
