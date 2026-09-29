import User from "../models/User.js";
import {
  isCloudinaryConfigured,
  uploadImage,
} from "../config/cloudinary.js";

const normalizeVehicleInfo = (vehicleInfo) => {
  if (!vehicleInfo || typeof vehicleInfo !== "object") {
    return {};
  }

  return vehicleInfo.toObject ? vehicleInfo.toObject() : { ...vehicleInfo };
};

const SUPPORTED_SELF_ROLES = ["passenger", "driver"];

// Self-declared profile fields. Roles are deliberately excluded so this
// endpoint can never be used for privilege escalation.
const PROFILE_FIELDS = [
  "bio",
  "conversationStarter",
  "vibeTags",
  "languages",
  "gender",
  "womenOnly",
];

// A single account can be a driver, a passenger, or both. Roles are additive
// and self-service so one email works for both sides of a commute.
export const updateMyRoles = async (req, res) => {
  try {
    const requested = Array.isArray(req.body?.roles)
      ? req.body.roles
      : typeof req.body?.role === "string"
        ? [req.body.role]
        : null;

    if (!requested) {
      return res.status(400).json({
        success: false,
        message: "Provide roles as an array",
      });
    }

    const normalized = [
      ...new Set(
        requested
          .map((role) => (role === "rider" ? "passenger" : role))
          .filter((role) => SUPPORTED_SELF_ROLES.includes(role))
      ),
    ];

    if (!normalized.length) {
      return res.status(400).json({
        success: false,
        message: "Choose at least one of: passenger, driver",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Admin access is never granted or removed through this endpoint.
    const preservedAdmin = user.roles?.includes("admin") ? ["admin"] : [];
    user.roles = [...new Set([...preservedAdmin, ...normalized])];

    const saved = await user.save();

    return res.json({
      success: true,
      message: "Roles updated",
      data: saved,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)[0]?.message || "Invalid roles",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while updating roles",
    });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while fetching profile",
    });
  }
};

export const updateMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const existingVehicleInfo = normalizeVehicleInfo(user.vehicleInfo);
    const incomingVehicleInfo =
      req.body.vehicleInfo && typeof req.body.vehicleInfo === "object"
        ? req.body.vehicleInfo
        : {};
    const hasVehicleUpdates = Object.keys(incomingVehicleInfo).some(
      (key) => key !== "image" && incomingVehicleInfo[key] !== undefined
    );
    const canDrive = Array.isArray(user.roles) && user.roles.includes("driver");

    // Vehicle details only make sense for accounts that can actually drive.
    if (hasVehicleUpdates && !canDrive) {
      return res.status(400).json({
        success: false,
        message:
          "Enable the driver role before adding vehicle details to your profile.",
      });
    }

    user.name = req.body.name ?? user.name;
    user.phone = req.body.phone ?? user.phone;

    for (const field of PROFILE_FIELDS) {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    }

    if (canDrive) {
      user.vehicleInfo = {
        ...existingVehicleInfo,
        ...incomingVehicleInfo,
        image: existingVehicleInfo.image || "",
      };
    }

    const updatedUser = await user.save();

    return res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)[0]?.message || "Invalid profile data",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while updating profile",
    });
  }
};

const uploadUserImage = async (req, res, imageField, folder) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please select an image to upload.",
    });
  }

  if (!isCloudinaryConfigured) {
    return res.status(503).json({
      success: false,
      message: "Image uploads are not configured on the server.",
    });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const result = await uploadImage(req.file.buffer, folder);

    if (imageField === "profileImage") {
      user.profileImage = result.secure_url;
    } else {
      const existingVehicleInfo = normalizeVehicleInfo(user.vehicleInfo);
      user.vehicleInfo = {
        ...existingVehicleInfo,
        image: result.secure_url,
      };
    }

    const updatedUser = await user.save();

    return res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Image upload failed",
    });
  }
};

export const uploadProfileImage = (req, res) =>
  uploadUserImage(
    req,
    res,
    "profileImage",
    "carpoolconnect/profiles",
    "profile image upload"
  );

export const uploadVehicleImage = (req, res) =>
  uploadUserImage(
    req,
    res,
    "vehicleInfo.image",
    "carpoolconnect/vehicles",
    "vehicle image upload"
  );