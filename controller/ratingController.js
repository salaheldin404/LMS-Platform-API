import mongoose from "mongoose";
import Rating from "../models/ratingModel.js";

import cacheService from "../utils/cacheService.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

import {
  updateInstructorAverageRating,
  updateCourseRatingSummary,
  getCourseFromCacheOrDB,
} from "./courseController.js";
import extractToken from "../utils/extractToken.js";
import verifyToken from "../utils/verifyToken.js";
import User from "../models/userModel.js";

// use for both add or update rating
export const addRatingToCourse = catchAsync(async (req, res, next) => {
  const { rate, comment } = req.body;
  const { courseId } = req.params;
  const user = req.user;
  if (!rate) {
    return next(new AppError("Rate is required", 400));
  }
  if (rate < 1 || rate > 5) {
    return next(new AppError("Invalid Rate, must be between 1 and 5", 400));
  }
  const cacheKey = `course:${courseId}`;

  const course = await getCourseFromCacheOrDB(courseId, cacheKey);

  if (!course) {
    return next(new AppError("no course found with this id", 404));
  }

  // check if user not enrolled in the course
  if (!user.enrolledCourses.includes(courseId)) {
    return next(
      new AppError("you must enrolled in the course to add rate", 400)
    );
  }
  // check if the user rate  own course
  if (user.createdCourses.includes(courseId)) {
    return next(new AppError("you can't add rate to your course", 400));
  }

  const ratingUpdateResult = await addOrUpdateRating(
    user._id,
    courseId,
    rate,
    comment
  );

  const existingRating = ratingUpdateResult.lastErrorObject.updatedExisting;

  const [updatedCourse] = await Promise.all([
    updateCourseRatingSummary(courseId),
    updateInstructorAverageRating(course.instructor),
  ]);

  await cacheService.del(cacheKey);
  await cacheService.del(`course:stats:${courseId}`);
  // Send the response
  res.status(200).json({
    message: existingRating
      ? "Rating updated successfully"
      : "Rating added successfully",
    averageRating: updatedCourse.ratingsSummary.averageRating,
    totalRating: updatedCourse.ratingsSummary.totalRating,
  });
});

export const getAllRatingsForCourse = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const token = extractToken(req);
  const decoded = token && verifyToken(token);
  const user = await User.findById(decoded?.id).select("-password");

  const ratings = await Rating.find({ course: courseId })
    .populate("user", "username profilePicture.url")
    .sort({ createdAt: -1, rate: -1 });
  if (user) {
    // Find the index of the logged-in user's rating
    const userRatingIndex = ratings.findIndex(
      (rating) => rating.user._id.toString() === user._id.toString()
    );

    // If the user's rating exists, move it to the beginning
    if (userRatingIndex !== -1) {
      const userRating = ratings.splice(userRatingIndex, 1)[0];
      ratings.unshift(userRating);
    }
  }

  res.status(200).json({ data: ratings });
});

export const getUserRatingForCourse = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;
  const rating = await Rating.findOne({
    course: courseId,
    user: user._id,
  }).select("rate comment");
  if (!rating) {
    return res.status(200).json({ data: null });
  }
  res.status(200).json({ data: rating });
});

export const deleteUserRatingFromCourse = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;
  const cacheKey = `course:${courseId}`;
  const statsCacheKey = `course:stats:${courseId}`;
  const rating = await Rating.findOneAndDelete({
    user: user._id,
    course: courseId,
  }).populate("course", "instructor");

  if (!rating) {
    return next(new AppError("No rating found with this id", 404));
  }

  const instructorId = rating.course.instructor._id;
  // Update related data in parallel
  await Promise.all([
    updateInstructorAverageRating(instructorId),
    updateCourseRatingSummary(courseId),
  ]);

  await Promise.all([
    cacheService.del(cacheKey),
    cacheService.del(statsCacheKey),
  ]);

  res.status(204).json({ data: null });
});

export const getRatingPercentages = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const courseObjectId = mongoose.Types.ObjectId(courseId);

  // Define the rating scale as a constant for maintainability
  const RATING_SCALE = [5, 4, 3, 2, 1];

  // Initialize percentages object with all possible ratings set to "0.00"
  const percentages = Object.fromEntries(
    RATING_SCALE.map((star) => [star, { count: 0, percentage: "0.00" }])
  );

  // Single aggregation to get total ratings and distribution
  const result = await Rating.aggregate([
    { $match: { course: courseObjectId } },
    {
      $facet: {
        total: [{ $count: "count" }],
        distribution: [
          { $group: { _id: { $floor: "$rate" }, count: { $sum: 1 } } },
          { $match: { _id: { $gte: 1, $lte: 5 } } },
        ],
      },
    },
  ]);

  // Extract total ratings, defaulting to 0 if no ratings exist
  const totalRatings = result[0].total[0]?.count || 0;
  const distribution = result[0].distribution;

  // If there are ratings, calculate percentages for each star
  if (totalRatings > 0) {
    distribution.forEach((item) => {
      const star = item._id.toString(); // _id is a number, but object keys are coerced to strings
      const count = item.count;
      const percentage = (count / totalRatings) * 100;
      percentages[star] = { percentage: percentage.toFixed(2), count };
    });
  }

  res.status(200).json({ data: percentages });
});

// add or update rating helper function
async function addOrUpdateRating(userId, courseId, rate, comment) {
  return await Rating.findOneAndUpdate(
    {
      course: courseId,
      user: userId,
    },
    { rate, comment },
    { new: true, upsert: true, rawResult: true }
  );
}
