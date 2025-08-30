import User from "../models/userModel.js";
import Progress from "../models/progressModel.js";
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

import bcrypt from "bcryptjs";
import cacheService from "../utils/cacheService.js";
import mongoose from "mongoose";
import Course from "../models/courseModel.js";
import ApiFeatures from "../utils/apiFeature.js";
import extractToken from "../utils/extractToken.js";
import verifyToken from "../utils/verifyToken.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getAllCertificatesForUser = catchAsync(async (req, res, next) => {
  const user = req.user;

  // const currentUser = await User.findById(user._id)
  //   .populate("certificates.course", "title image.url")
  //   .select("certificates");

  // Populate the course field in certificates with title and image.public_id
  await user.populate({
    path: "certificates.course",
    select: "title image.url slug",
    options: { skipRatingPopulate: true },
  });

  const certificatesWithSignedUrls = user.certificates.map((cert) => {
    return {
      course: cert.course,
      certificateUrl: getSignedCertificateUrl(cert.certificateUrl.public_id),
      issuedAt: cert.issuedAt,
    };
  });

  res.status(200).json({ certificates: certificatesWithSignedUrls });
});

export const getCertificateByCourseId = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;
  const certificate = user.certificates.find(
    (certificate) => certificate.course.toString() === courseId
  );
  console.log(certificate, "certificate");
  if (!certificate) {
    return next(new AppError("No certificate found with this id", 404));
  }
  res.status(200).json({ data: { url: certificate.certificateUrl.url } });
});

export const getAllUsers = catchAsync(async (req, res, next) => {
  const user = req.user;
  // if (user.role != "admin") {
  //   return next(new AppError("unauthorized", 403));
  // }

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

export const getInstructorProfile = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const token = extractToken(req);
  const decoded = token ? verifyToken(token) : null;

  const checkAccess = decoded?.id == userId;
  if (!userId) {
    return next(new AppError("Instructor ID is required"));
  }

  // Validate if userId is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return next(new AppError("Invalid instructor ID format", 400));
  }

  // Check cache first
  const cacheKey = `instructor:${userId}:basic_profile`;
  // let instructorData = await cacheService.get(cacheKey);
  let instructorData;
  if (!instructorData) {
    const user = await User.findById(userId)
      .select(
        "username socialLinks socialMedia instructorRating headline biography profilePicture role"
      )
      .lean();

    if (!user) {
      return next(new AppError("no user found with this id", 404));
    }
    if (user.role !== "teacher") {
      return next(
        new AppError(
          "This profile is not accessible - user is not an instructor",
          403
        )
      );
    }
    const matchFields = {
      instructor: mongoose.Types.ObjectId(userId),
    };
    if (!checkAccess) {
      matchFields.status = "published";
    }

    // Calculate total students using enrollmentsCount
    const stats = await Course.aggregate([
      {
        $match: matchFields,
      },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: "$enrollmentsCount" },
          totalCourses: { $sum: 1 },
        },
      },
    ]);

    instructorData = {
      ...user,
      totalStudents: stats[0]?.totalStudents || 0,
      totalCourses: stats[0]?.totalCourses || 0,
    };

    await cacheService.set(
      cacheKey,
      instructorData,
      cacheService.CACHE_DURATION.CATALOG
    );
  }

  res.status(200).json({ status: "success", data: instructorData });
});

/* 

  -- username
  -- profile image
  -- headline
  -- enrolled courses count 
  -- completed courses 
  -- active courses 


*/
export const getUserProfile = catchAsync(async (req, res, next) => {
  const user = req.user;

  const activeCourses = await Progress.countDocuments({
    user: user._id,
    progressPercentage: { $lt: 100 },
  });

  // const enrolledCourses = await Progress.find({ user: user._id })
  //   .populate("course", "image.url title slug")
  //   .select("-unlockedLessons -completedLessons");

  const data = {
    username: user.username,
    profileImage: user.profilePicture.url,
    headline: user.headline,
    // enrolledCourses: enrolledCourses,
    enrolledCoursesCount: user.enrolledCourses.length,
    completedCoursesCount: user.completedCourses.length,
    activeCourses,
  };

  res.status(200).json({ data });
});

export const getUserEnrolledCourses = catchAsync(async (req, res, next) => {
  const user = req.user;
  const features = new ApiFeatures(
    Progress.find({ user: user._id })
      .populate({
        path: "course",
        select: "image.url title slug",
        options: { skipRatingPopulate: true },
      })
      .select("course progressPercentage"),
    req.query
  )
    .filter()
    .search()
    .sort()
    .paginate()
    .limitFields();

  const { pagination, results } = await features.getResults();

  res.status(200).json({ data: results, pagination });
});

// Middleware to clear instructor profile cache when their data is updated
export const clearInstructorProfileCache = catchAsync(
  async (req, res, next) => {
    const { userId } = req.params;

    if (userId) {
      await cacheService.del(`instructor:${userId}:basic_profile`);
    }

    next();
  }
);

export const updateUserSocialMedia = catchAsync(async (req, res, next) => {
  const { socialMedia } = req.body;
  const user = req.user;
  const { userId } = req.params;
  console.log(socialMedia, "socialMedia");
  await body("socialMedia")
    .exists()
    .withMessage("Social media data is required")
    .bail() // Stop validation chain if previous validation fails
    .isObject()
    .withMessage("Social media must be an object")
    .custom((value) => {
      const validPlatforms = ["github", "linkedin", "facebook", "instagram"];
      const invalidKeys = Object.keys(value).filter(
        (key) => !validPlatforms.includes(key)
      );
      return invalidKeys.length === 0;
    })
    .withMessage("Invalid social media platforms")
    .run(req);

  const errors = validationResult(req);
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

  if (user._id.toString() != userId) {
    return next(new AppError("unauthorized", 403));
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { socialMedia },
    { new: true, runValidators: true, context: "query" }
  )
    .select("socialMedia")
    .lean({ virtuals: false });

  if (!updatedUser) {
    return next(new AppError("user not found", 404));
  }
  res.status(200).json({ data: updatedUser });
});

export const updateUser = catchAsync(async (req, res, next) => {
  const { username, biography, headline } = req.body;
  const { userId } = req.params;
  const user = req.user;
  if (!username && !req.file) {
    return next(new AppError("Please provide email or username", 400));
  }

  if (user._id.toString() !== userId) {
    return next(new AppError("unauthorized", 403));
  }
  await Promise.all([
    body("username")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 2, max: 30 })
      .withMessage("Username must be between 2-30 characters")
      .escape()
      .run(req),
    body("biography")
      .optional()
      .isString()
      .trim()
      // .isLength({ min: 20, max: 500 })
      // .withMessage("Biography must be between 20-500 characters")
      .escape()
      .run(req),
    body("headline")
      .optional()
      .isString()
      .trim()
      .isLength({ max: 60 })
      .withMessage("Headline cannot exceed 60 characters")
      .escape()
      .run(req),
  ]);

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
  const updateData = {};
  if (username) {
    updateData.username = username;
  }
  if (profilePicture) {
    updateData.profilePicture = profilePicture;
  }
  if (biography !== undefined) {
    // If biography is only whitespace, clear it by setting an empty string
    updateData.biography = biography.trim().length ? biography : "";
  }
  if (headline !== undefined) {
    // If headline is only whitespace, clear it by setting an empty string
    updateData.headline = headline.trim().length ? headline : "";
  }
  const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
    context: "query", // Ensures validators work correctly
  })
    .select(" username email profilePicture biography headline")
    .lean();
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

export const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user._id;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return next(new AppError("Please provide all fields.", 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new AppError('"New passwords do not match.', 400));
  }

  const user = await User.findById(userId).select("+password");
  console.log({ userId });
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  console.log(user.password, "user password");
  const isPasswordCorrect = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isPasswordCorrect) {
    return next(new AppError("Current password is incorrect", 401));
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  user.password = hashedPassword;
  user.passwordChangeAt = Date.now();

  await user.save({ runValidators: true });

  res.status(200).json({
    status: "success",
    message: "Password updated successfully.",
  });
});
