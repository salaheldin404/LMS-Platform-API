import User from "../models/userModel.js";

import AppError from "../utils/appError.js";
import catchAsync from "../utils/catchAsync.js";

import {
  cloudinaryDeleteImage,
  cloudinaryUploadImage,
  getSignedCertificateUrl,
} from "../utils/cloudinary.js";

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { body, validationResult } from "express-validator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getAllCertificatesForUser = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const user = req.user;

  if (!user._id.equals(userId)) {
    return next(new AppError("unauthorized", 403));
  }

  console.log(user.certificates, "user.certificates");

  const certificatesWithSignedUrls = user.certificates.map((cert) => {
    return {
      course: cert.course,
      certificateUrl: getSignedCertificateUrl(cert.certificateUrl.public_id),
    };
  });

  res.status(200).json({ certificates: certificatesWithSignedUrls });
});

export const getAllUsers = catchAsync(async (req, res, next) => {
  const user = req.user;
  if (user.role != "admin") {
    return next(new AppError("unauthorized", 403));
  }

  const users = await User.find();
  res.status(200).json({ data: users });
});

export const getUserById = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const user = await User.findById(userId)
    .select("-__v -enrolledCourses -completedCourses -certificates")
    .populate("createdCourses");
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (user.role != "teacher") {
    return next(new AppError("user is not an instructor", 403));
  }

  res.status(200).json({ data: user });
});

export const updateUser = catchAsync(async (req, res, next) => {
  const { email, username } = req.body;
  const { userId } = req.params;
  const user = req.user;
  if (!email && !username && !req.file) {
    return next(new AppError("Please provide email or username", 400));
  }

  if (user._id.toString() != userId) {
    return next(new AppError("unauthorized", 403));
  }
  await Promise.all([
    body("email").isEmail().normalizeEmail().optional().run(req),
    body("username").isString().trim().optional().run(req),
  ]);
  // await body("email").isEmail().normalizeEmail().optional().run(req);
  // await body("username").isString().trim().optional().run(req);
  const errors = validationResult(req);
  console.log(errors, "error");
  if (!errors.isEmpty()) {
    return next(
      new AppError(
        errors
          .array()
          .map((err) => err.msg)
          .join(", "),
        400
      )
    );
  }
  const profilePicture = await handleProfilePicture(
    req.file,
    user.profilePicture
  );
  console.log(req.file, "req.file");
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { email, username, profilePicture },
    {
      new: true,
      runValidators: true,
    }
  );
  console.log({ profilePicture }, "profilePicture");
  if (!updatedUser) {
    return next(new AppError("user not found", 404));
  }
  res.status(200).json({ data: updatedUser });
});

const handleProfilePicture = async (file, existingProfilePic) => {
  if (file && file.path) {
    try {
      const imagePath = path.join(
        __dirname,
        "../public/uploads/images",
        file.filename
      );
      const result = await cloudinaryUploadImage(imagePath);
      console.log(result.secure_url, "cloudinary");
      if (existingProfilePic?.public_id) {
        await cloudinaryDeleteImage(existingProfilePic.public_id);
      }
      await fs.promises.unlink(imagePath);
      return {
        public_id: result.public_id,
        url: result.secure_url,
      };
    } catch (error) {
      console.log(error, "error");
      throw new AppError("Error updating profile picture", 500); // Adjust the error message as needed
    }
  }
  return undefined;
};

export const deleteUser = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { userId } = req.params;
  if (user.role != "admin") {
    return next(new AppError("unauthorized", 403));
  }

  const deletedUser = await User.findByIdAndDelete(userId);
  if (!deletedUser) {
    return next(new AppError("user not found", 404));
  }
  res.status(200).json({ message: "user deleted successfully" });
});
