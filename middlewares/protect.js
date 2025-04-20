import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import extractToken from "../utils/extractToken.js";
import verifyToken from "../utils/verifyToken.js";
export const protectRoute = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({
        message: "The user belonging to this token does no longer exist.",
      });
    }
    if (user.changePasswordAfter(decoded.iat)) {
      return res.status(401).json({
        message: "User recently changed password. Please login again.",
      });
    }
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Session expired. Please log in again." });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(403).json({ message: "Invalid token." });
    }

    console.log(error, "from protect middleware");
    return res.status(401).json({ message: "Not authorized" });
  }
};
