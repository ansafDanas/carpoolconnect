import express from "express";
import {
  createRide,
  deleteRide,
  getMyRides,
  getRideById,
  getRides,
  updateRide,
} from "../controllers/rideController.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get all active rides
router.get("/", getRides);

// Get rides created by the current user
router.get("/my-rides", protect, authorizeRoles("driver"), getMyRides);

// Get one ride by id
router.get("/:id", getRideById);

// Create a new ride
router.post("/", protect, authorizeRoles("driver"), createRide);

// Update a ride (owner only)
router.patch("/:id", protect, authorizeRoles("driver"), updateRide);

// Delete a ride (owner only)
router.delete("/:id", protect, authorizeRoles("driver"), deleteRide);

export default router;