import express from "express";
import {
  acceptRideRequest,
  cancelRideRequest,
  createRideRequest,
  declineRideRequest,
  getMatchesForRequest,
  getMatchesForRide,
  getMatchingSummary,
  getMyRideRequests,
  sendRequestToRide,
} from "../controllers/rideRequestController.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Rider posts what they need.
router.post("/", protect, authorizeRoles("passenger"), createRideRequest);

// Rider sees their own requests.
router.get("/mine", protect, authorizeRoles("passenger"), getMyRideRequests);

router.get("/summary", protect, getMatchingSummary);

// Ranked drivers for one of the rider's requests.
router.get(
  "/:id/matches",
  protect,
  authorizeRoles("passenger"),
  getMatchesForRequest
);

// Rider targets one specific offer.
router.post(
  "/:id/send",
  protect,
  authorizeRoles("passenger"),
  sendRequestToRide
);

// Rider cancels their own request.
router.patch(
  "/:id/cancel",
  protect,
  authorizeRoles("passenger"),
  cancelRideRequest
);

// Driver inbox for one of their offers.
router.get(
  "/ride/:rideId/matches",
  protect,
  authorizeRoles("driver"),
  getMatchesForRide
);

// Driver accepts or declines an incoming request.
router.patch(
  "/:id/accept",
  protect,
  authorizeRoles("driver"),
  acceptRideRequest
);

router.patch(
  "/:id/decline",
  protect,
  authorizeRoles("driver"),
  declineRideRequest
);

export default router;