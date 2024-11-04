import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
export const protectRoute = async (req, res, next) => {
  let token;
  console.log('test')
  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }
    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECERET);
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
    console.log(error, "from protect middleware");
    return res.status(401).json({ message: "Not authorized" });
  }
};
