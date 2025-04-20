import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config({ path: "./config.env" });

export const generateTokenAndSetCookies = (res, id) => {
  const token = jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "4h",
  });
  const refreshToken = jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });

  const cookieOptions = (maxAge) => ({
    maxAge,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV == "production",
  });

  res.cookie("jwt", token, cookieOptions(1 * 24 * 60 * 60 * 1000));
  res.cookie(
    "refreshToken",
    refreshToken,
    cookieOptions(7 * 24 * 60 * 60 * 1000) // 7days
  );
  return token;
};
