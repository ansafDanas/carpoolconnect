import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      req.user = await User.findById(decoded.id).select("+role");

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Not authorized, user not found",
        });
      }

      // A suspended account cannot use the platform at all. This is the
      // enforcement that makes an upheld report actually mean something.
      if (req.user.isSuspended) {
        return res.status(403).json({
          success: false,
          code: "ACCOUNT_SUSPENDED",
          message:
            req.user.suspendedReason ||
            "This account has been suspended. Contact support if you think this is a mistake.",
        });
      }

      const storedRoles = Array.isArray(req.user.roles) ? req.user.roles : [];
      req.user.role = storedRoles.includes("admin")
        ? "admin"
        : storedRoles.includes("driver")
          ? "driver"
          : storedRoles.includes("passenger")
            ? "passenger"
            : req.user.role || "passenger";
      return next();
    }

    return res.status(401).json({
      success: false,
      message: "Not authorized, no token",
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, token failed",
    });
  }
};

const authorizeRoles = (...allowedRoles) => (req, res, next) => {
  const rawRoles = Array.isArray(req.user?.roles)
    ? req.user.roles
    : req.user?.role
      ? [req.user.role]
      : [];

  const userRoles = rawRoles.map((role) =>
    role === "rider" ? "passenger" : role
  );

  if (!userRoles.some((role) => allowedRoles.includes(role))) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized for this action",
    });
  }

  return next();
};

export { protect, authorizeRoles };