import express from "express";
import {
  createReview,
  getReviewsForRide,
  getReviewsForUser,
} from "../controllers/reviewController.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Both the passenger and the driver on a trip can leave a review.
router.post(
  "/",
  protect,
  authorizeRoles("passenger", "driver"),
  createReview
);
router.get("/user/:userId", getReviewsForUser);
router.get("/ride/:rideId", getReviewsForRide);

export default router;
