import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { generateTokenAndSetCookies } from "../lib/generateToken.js";
import sendEmail from "../utils/email.js";

import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
export const signup = catchAsync(async (req, res, next) => {
  const { email, password, username } = req.body;
  if (!email || !password || !username) {
    return next(new AppError("fill all fields", 400));
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new AppError("Invalid email address", 400));
  }

  const existEmail = await User.findOne({ email });
  const existUsername = await User.findOne({ username });
  if (existEmail) {
    return next(new AppError("email is already exist", 400));
  }
  if (existUsername) {
    return next(new AppError("username is already exist", 400));
  }
  const salt = await bcrypt.genSalt(10);
  const hasedPassword = await bcrypt.hash(password, salt);
  const newUser = new User({
    email,
    username,
    password: hasedPassword,
  });
  await newUser.save();
  newUser.password = undefined;
  const token = generateTokenAndSetCookies(res, newUser._id);
  res.status(200).json({ data: { user: newUser, token } });
});

export const login = catchAsync(async (req, res, next) => {
  const { password, email } = req.body;

  if (!email || !password) {
    return next(new AppError("please fill all fields", 400));
  }

  const userExist = await User.findOne({ email }).select("+password");
  if (!userExist) {
    return next(new AppError("Invalid credentials", 400));
  }
  const isPasswordCorrect = await bcrypt.compare(password, userExist.password);
  if (!isPasswordCorrect) {
    return next(new AppError("Invalid credentials", 400));
  }
  const token = generateTokenAndSetCookies(res, userExist._id);
  userExist.password = undefined;
  res.status(200).json({ data: { user: userExist, token } });
});

export const logout = catchAsync(async (req, res, next) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.cookie("refreshToken", "", { maxAge: 0 });
  res.status(200).json({ message: "logout success" });
});

export const refreshToken = catchAsync(async (req, res, next) => {
  const refreshTokenCookies = req.cookies.refreshToken;

  if (!refreshTokenCookies) {
    return next(new AppError("Token is missing", 401));
  }

  let decode;
  try {
    // 3. Verify the refresh token
    decode = jwt.verify(refreshTokenCookies, process.env.REFRESH_TOKEN_SECRET);
  } catch (error) {
    // Handle invalid or expired refresh token
    return next(new AppError("Invalid or expired token", 403));
  }
  // 4. Check if the decoded token contains the user ID
  if (!decode || !decode.id) {
    return next(new AppError("Invalid token payload", 403));
  }

  const user = await User.findById(decode.id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  if (user.changePasswordAfter(decode.iat)) {
    return next(new AppError("User recently changed password", 401));
  }
  const accessToken = generateTokenAndSetCookies(res, user._id);
  res.status(200).json({ data: accessToken });
});

export const forgetPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  try {
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const resetToken = user.createResetToken();
    await user.save({ validateBeforeSave: false });
    const url = `${process.env.FRONTEND_URL}/resetPassword/${resetToken}`;
    await sendEmail({
      email: user.email,
      subject: "Reset Password",
      message: `If you didn't forget your password, please ignore this email!`,
      resetUrl: url,
    });
    res.status(200).json({ message: "Reset token sent to your email" });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    console.log(error);
    return next(new AppError("There was an error sending the email", 500));
    // res.status(500).json({ message: error.msg });
  }
});

// delete this function not important
export const checkResetToken = async (req, res, next) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new AppError("Invalid or expired token", 400));
  }
  next();
};

export const resetPassword = catchAsync(async (req, res, next) => {
  const { password, passwordConfirm } = req.body;

  if (!password || !passwordConfirm) {
    return next(new AppError("Please fill all fields.", 400));
  }

  if (password !== passwordConfirm) {
    return next(new AppError("password doesnt' match", 400));
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new AppError("Invalid or expired token", 400));
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  user.password = hashedPassword;

  user.passwordResetExpires = undefined;
  user.passwordResetToken = undefined;

  await user.save({ validateBeforeSave: true });

  const token = generateTokenAndSetCookies(res, user._id);
  const userData = {
    _id: user._id,
    email: user.email,
    role: user.role,
    username: user.username,
  };
  res.status(200).json({ data: { userData, token } });
});

export const getCurrentUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user?._id)
    .populate("enrolledCourses createdCourses")
    .select("-password");

  res.status(200).json({ data: user });
});

export const getActiveSession = catchAsync(async (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) {
    return res.status(204).end();
  }
  let decode;
  try {
    decode = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return next(new AppError("Invalid token", 403));
  }

  const user = await User.findById(decode.id).select("-password -__v");
  if (!user) {
    res.clearCookie("jwt");
    return next(new AppError("User not found", 404));
  }
  res.status(200).json({ data: user });
});
