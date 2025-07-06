import mongoose from "mongoose";
import { fileURLToPath } from "url";
import Rating from "../models/ratingModel.js";
import Course from "../models/courseModel.js";
import Chapter from "../models/chapterModel.js";
import Lesson from "../models/lessonModel.js";
import User from "../models/userModel.js";
import Progress from "../models/progressModel.js";
import Enrollment from "../models/enrollmentModel.js";

import {
  cloudinaryDeleteImage,
  cloudinaryUploadImage,
  uploadCertificateToCloudinary,
} from "../utils/cloudinary.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

import { deleteVideo } from "../utils/mux.js";
import fs from "fs";
import path from "path";
import generateCertificateFile from "../utils/generateCertificateFile.js";

import cacheService from "../utils/cacheService.js";
import ApiFeatures from "../utils/apiFeature.js";
import verifyToken from "../utils/verifyToken.js";
import extractToken from "../utils/extractToken.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createCourse = catchAsync(async (req, res, next) => {
  const { title } = req.body;
  const user = req.user;

  if (user.role != "teacher") {
    return next(new AppError("You must be a teacher to create a course", 403));
  }
  if (!title) {
    return next(
      new AppError("You must provide title to start create course", 400)
    );
  }

  const course = await Course.create({
    title,

    instructor: user._id,
  });

  user.createdCourses.push(course._id);
  await user.save();
  res.status(200).json({ data: course });
});

export const editCourse = catchAsync(async (req, res, next) => {
  const {
    title,
    subtitle,
    level,
    category,
    description,
    price,
    free,
    requirements,
    willLearn,
  } = req.body;
  const { courseId } = req.params;
  const user = req.user;
  let curPath;

  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError("No course found with this id", 404));
  }
  if (
    course.instructor.toString() !== user._id.toString() &&
    user.role != "admin"
  ) {
    return next(new AppError("unauthraized", 403));
  }

  if (req.file) {
    if (course.image?.public_id) {
      await cloudinaryDeleteImage(course.image.public_id);
    }
    let imgPath = req.file.filename;
    curPath = path.join(__dirname, `../public/uploads/images/${imgPath}`);

    const result = await cloudinaryUploadImage(curPath);

    course.image = {
      public_id: result?.public_id,
      url: result?.secure_url,
    };
  }

  course.title = title ? title : course.title;
  course.description = description ? description : course.description;
  course.requirements = requirements ? requirements : course.requirements;
  course.willLearn = willLearn ? willLearn : course.willLearn;
  course.subtitle = subtitle ? subtitle : course.subtitle;
  course.level = level ? level : course.level;
  course.category = category ? category : course.category;

  if (free === true || free === "true") {
    course.price = 0;
    course.free = true;
  } else {
    course.price = price ? price : course.price;
    course.free = false;
  }

  await course.save({ validateBeforeSave: true });
  const cacheKey = `course:${courseId}`;
  await cacheService.del(cacheKey);

  const message = "course updated successfuly";

  res.status(200).json({ data: { course, message } });

  if (curPath) {
    console.log("deleting file...");
    fs.unlink(curPath, (err) => {
      if (err) {
        console.log("error while delete image", err);
      } else {
        console.log("file deleting success");
      }
    });
  }
});

export const publishCourse = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;
  const isAuthorized =
    user.createdCourses.some((id) => id.equals(courseId)) ||
    user.role === "admin";
  if (!isAuthorized) {
    return res.status(403).json({ message: "Unauthorized" });
  }
  const course = await Course.findById(courseId);

  if (!course) {
    return next(new AppError("No course found with this ID", 404));
  }
  let message = "Course is already published";

  if (course.status == "published") {
    res.status(200).json({ data: { course, message } });
  }

  // check if there lessons in every chapter

  course.status = "published";
  await course.save({ runValidators: true, new: true });

  const cacheKey = `course:${courseId}`;
  await cacheService.del(cacheKey);
  message = "Course is published successfuly";

  res.status(200).json({ data: { course, message } });
});

export const deleteCourse = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;

  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError("No course found with this id", 404));
  }
  if (!course.instructor.equals(user._id) && user.role != "admin") {
    return next(new AppError("unauthorized", 403));
  }
  if (course.image?.public_id) {
    await cloudinaryDeleteImage(course.image.public_id);
  }

  const chapters = await Chapter.find({ course: courseId });

  // For each chapter, delete all lessons associated with it
  for (let chapter of chapters) {
    const lessons = await Lesson.find({ chapter: chapter._id });

    for (let lesson of lessons) {
      if (lesson.video && lesson.video.assetId) {
        await deleteVideo(lesson.video.assetId);
      }

      await lesson.remove();
    }

    await chapter.remove();
  }

  console.log(user.createdCourses, "created courses");
  // delete the course
  await course.remove();
  // delete course from created course for the user
  user.createdCourses = user.createdCourses.filter(
    (c) => c.toString() != courseId.toString()
  );
  await user.save();

  const cacheKey = `course:${courseId}`;
  await cacheService.del(cacheKey);
  res.status(200).json({ message: "course deleted successfuly" });
});

export const getAllCourses = catchAsync(async (req, res, next) => {
  console.log(req.query, "req server");
  const features = new ApiFeatures(
    Course.find({ status: "published" }).populate({
      path: "instructor",
      select: "username profilePicture role instructorRating",
    }),
    req
  )
    .filter()
    .search()
    .sort()
    .paginate()
    .limitFields();

  const { pagination, results } = await features.getResults();

  res.status(200).json({
    status: "success",
    data: results,
    pagination,
  });
});
// export const getAllCourses = catchAsync(async (req, res, next) => {
//   const queryObj = { ...req.query };

//   const cacheKey = `courses:catalog:${JSON.stringify(queryObj)}`;
//   let pagination = {};
//   let courses = await cacheService.get(cacheKey);
//   // let courses;

//   if (!courses) {
//     const excludeFields = ["page", "sort", "limit", "fields"];
//     excludeFields.forEach((el) => delete queryObj[el]);

//     let queryStr = JSON.stringify(queryObj);
//     queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

//     let query = Course.find(JSON.parse(queryStr))
//       .populate({
//         path: "instructor",
//         select: "username profilePicture role instructorRating",
//       })
//       .lean();

//     // sorting
//     if (req.query.sort) {
//       const sortBy = req.query.sort.split(",").join(" ");
//       query = query.sort(sortBy);
//     } else {
//       query = query.sort("-createdAt");
//     }

//     // limit fields
//     if (req.query.fields) {
//       const fields = req.query.fields.split(",").join(" ");
//       query = query.select(fields);
//     } else {
//       query = query.select("-__v -students");
//     }

//     // add pagenation
//     // pagination
//     const limit = Math.max(1, parseInt(req.query.limit) || 10);
//     const page = Math.max(1, parseInt(req.query.page) || 1);
//     const skip = (page - 1) * limit;
//     courses = await query.skip(skip).limit(limit);

//     let totalCourses = courses?.length;

//     pagination = {
//       currentPage: page,
//       totalPages: Math.ceil(totalCourses / limit),
//       totalCourses,
//     };
//     for (const course of courses) {
//       if (course.instructor) {
//         const instructorId = course.instructor._id;

//         const { averageRatings, totalRatings } =
//           await Course.getInstructorAverageRating(instructorId);

//         course.instructor.instructorRating = {
//           totalRatings,
//           averageRatings,
//         };
//       }
//     }
//     if (courses.length > 0) {
//       await cacheService.set(
//         cacheKey,
//         courses,
//         cacheService.CACHE_DURATION.CATALOG
//       );
//     }
//   }

//   res.status(200).json({ data: courses, pagination });
// });

// use for visit profile of instructor
export const getInstructorCourses = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  if (!userId) {
    return next(new AppError("Instructor ID is required"));
  }
  const token = extractToken(req);
  const decoded = token ? verifyToken(token) : null;

  const checkAccess = decoded?.id == userId;

  const filter = {
    instructor: userId,
  };

  if (!checkAccess) {
    filter.status = "published";
  }

  console.log(filter);

  const features = new ApiFeatures(
    Course.find(filter).select("-chapters -requirements").populate({
      path: "instructor",
      select: "instructorRating username profilePicture",
    }),
    req
  )
    .filter()
    .search()
    .sort()
    .paginate()
    .limitFields();

  const { pagination, results } = await features.getResults();

  res.status(200).json({
    status: "success",
    data: results,
    pagination,
  });
});

export const getCoursesForCurrentInstructor = catchAsync(
  async (req, res, next) => {
    const user = req.user;
    const features = new ApiFeatures(
      Course.find({ instructor: user._id }).populate(
        "instructor",
        "username profilePicture instructorRating"
      ),
      req
    )
      .filter()
      .search()
      .sort()
      .paginate()
      .limitFields();

    const { pagination, results } = await features.getResults();
    // const courses = await Course.find({ instructor: user._id })
    //   .populate({
    //     path: "instructor",
    //     select: "username profilePicture",
    //   })
    //   .lean();
    // const totalStudents = courses.reduce((total, course) => {
    //   // Make sure the 'students' field exists and is an array.
    //   if (course.students && Array.isArray(course.students)) {
    //     return total + course.students.length;
    //   }
    //   return total;
    // }, 0);
    // const { averageRatings, totalRatings } =
    //   await Course.getInstructorAverageRating(user._id);

    res.status(200).json({ data: results, pagination });
  }
);

// cann access course helper function

// Function to check if the user can access the course
const canAccessCourse = (course, user) => {
  if (course.status !== "draft") {
    return true;
  }
  if (!user) {
    return false;
  }
  console.log(course.instructor, "instructor ");
  console.log(user, "user");
  if (
    user.role === "admin" ||
    course.instructor?._id?.toString() === user._id.toString()
  ) {
    return true;
  }
  return false;
};
export const getCourseById = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;
  const cacheKey = `course:${courseId}`;

  let cachedData = await cacheService.get(cacheKey);
  // let cachedData;
  if (!user.createdCourses.includes(courseId)) {
    return next(new AppError("Unauthorized", 403));
  }
  if (cachedData) {
    if (!canAccessCourse(cachedData, user)) {
      return next(new AppError("course is not available", 404));
    }

    return res.status(200).json({ data: cachedData });
  }
  const course = await Course.findById(courseId)
    .populate({
      path: "instructor",
      select: "username profilePicture.url ",
    })
    .populate({
      path: "ratings",
      select: "user rating comment",
    })
    .populate({
      path: "chapters",
      select: "title lessons order",
      options: { sort: { order: 1 } },
      populate: {
        path: "lessons",
        select: "title order locked formattedDuration video",
        options: { sort: { order: 1 } },
      },
    });
  if (!course) {
    return next(new AppError("no course found with this id", 404));
  }

  if (!canAccessCourse(course, user)) {
    return next(new AppError("course is not available", 404));
  }

  await cacheService.set(cacheKey, course, cacheService.CACHE_DURATION.COURSE);
  res.status(200).json({ data: course });
});

export const getCourseBySlug = catchAsync(async (req, res, next) => {
  const { slug } = req.params;
  const user = req.user;

  // Define course population structure
  const coursePopulateOptions = [
    {
      path: "instructor",
      select: "username profilePicture.url instructorRating biography headline",
    },

    {
      path: "chapters",
      select: "title lessons order",
      options: { sort: { order: 1 } },
      populate: {
        path: "lessons",
        select: "title order locked formattedDuration video",
        options: { sort: { order: 1 } },
      },
    },
  ];
  const course = await Course.findOne({ slug })
    .select("-students")
    .populate(coursePopulateOptions);
  if (!course) {
    return next(new AppError("no course found with this slug", 404));
  }

  if (!canAccessCourse(course, user)) {
    return next(new AppError("course is not available", 404));
  }
  const courseData = processCourseData(course);

  res.status(200).json({ data: courseData });
});
function processCourseData(course) {
  const courseData = course.toObject();

  courseData.chapters.forEach((chapter) => {
    chapter.lessons.forEach((lesson) => {
      if (lesson.locked) {
        delete lesson.video;
      }
    });
  });

  return courseData;
}

export const getSearchCourses = catchAsync(async (req, res, next) => {
  const { keyword, page = 1, limit = 10 } = req.query;
  // Create index hint for optimization
  const searchIndex = "title_text_description_text";
  const cacheKey = `courses:search:${keyword}`;
  const cachedData = await cacheService.get(cacheKey);
  if (cachedData) {
    return res.status(200).json({ data: cachedData });
  }

  const searchRegex = new RegExp(keyword, "i");
  const query = keyword
    ? {
        $or: [{ title: searchRegex }, { description: searchRegex }],
      }
    : {};

  const [courses, totalCourses] = await Promise.all([
    await Course.find(query)
      .hint(searchIndex)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean(),
    await Course.countDocuments(query),
  ]);

  if (!courses.length) {
    return next(new AppError("no course found with this keyword", 404));
  }
  const result = {
    courses,
    totalCourses,
    totalPages: Math.ceil(totalCourses / limit),
  };
  await cacheService.set(cacheKey, result, cacheService.CACHE_DURATION.SEARCH);

  res.status(200).json(result);
});

export const addRatingToCourse = catchAsync(async (req, res, next) => {
  const { rate, comment } = req.body;
  const { courseId } = req.params;
  const user = req.user;

  if (rate < 1 || rate > 5) {
    return next(new AppError("Invalid Rate, must be between 1 and 5", 400));
  }
  const cacheKey = `course:${courseId}`;

  const course = await getCourseFromCacheOrDB(courseId, cacheKey);

  if (!course) {
    return next(new AppError("no course found with this id", 404));
  }

  // check if user enrolled in the course
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

export async function updateInstructorAverageRating(instructorId) {
  const result = await Course.aggregate([
    { $match: { instructor: mongoose.Types.ObjectId(instructorId) } },
    {
      $group: {
        _id: null,
        totalRatings: { $sum: "$ratingsSummary.totalRatings" },
        weightedRatingSum: {
          $sum: {
            $multiply: [
              "$ratingsSummary.averageRating",
              "$ratingsSummary.totalRatings",
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        averageRatings: {
          $cond: [
            { $eq: ["$totalRatings", 0] },
            0,
            {
              $round: [{ $divide: ["$weightedRatingSum", "$totalRatings"] }, 1],
            },
          ],
        },
        totalRatings: 1,
      },
    },
  ]);
  const { averageRatings, totalRatings } = result[0] || {
    averageRatings: 0,
    totalRatings: 0,
  };

  await User.findByIdAndUpdate(instructorId, {
    instructorRating: { averageRatings, totalRatings },
  });
}

// update course rating summary helper function

export async function updateCourseRatingSummary(courseId) {
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError("no course found with this id", 404));
  }

  const result = await Rating.aggregate([
    { $match: { course: mongoose.Types.ObjectId(courseId) } },
    {
      $group: {
        _id: null,
        totalRatings: { $sum: 1 },
        sumRatings: { $sum: "$rate" },
        avgRating: {
          $avg: "$rate",
        },
      },
    },
    {
      $project: {
        _id: 0,
        averageRating: {
          $round: ["$avgRating", 1],
        },
        totalRatings: 1,
      },
    },
  ]);

  const { averageRating, totalRatings } = result[0] || {
    averageRating: 0,
    totalRatings: 0,
  };

  const updatedCourse = await Course.findByIdAndUpdate(
    courseId,
    {
      $set: {
        "ratingsSummary.averageRating": averageRating,
        "ratingsSummary.totalRatings": totalRatings,
      },
    },
    { new: true, runValidators: true }
  );

  return updatedCourse;
}

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

// get course from cache or database helper function
export async function getCourseFromCacheOrDB(courseId, cacheKey) {
  let cachedCourse = await cacheService.get(cacheKey);
  if (cachedCourse) return cachedCourse;

  let foundCourse = await Course.findById(courseId);
  if (foundCourse) {
    await cacheService.set(
      cacheKey,
      foundCourse,
      cacheService.CACHE_DURATION.COURSE
    );
  }

  return foundCourse;
}

export const removeRatingFromCourse = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;

  const cacheKey = `course:${courseId}`;
  let course = await cacheService.get(cacheKey);

  if (!course) {
    course = await Course.findById(courseId);
    if (!course) {
      return next(new AppError("No course found with this id", 404));
    }
    await cacheService.set(
      cacheKey,
      course,
      cacheService.CACHE_DURATION.COURSE
    );
  }

  const deleteRating = await Rating.findOneAndDelete({
    user: user._id,
    course: courseId,
  });
  if (!deleteRating) {
    return next(new AppError("No rating found with this id", 404));
  }

  const updatedCourse = await updateCourseRatingSummary(courseId);

  res.status(200).json({
    message: "Rating deleted successfully",
    averageRating: updatedCourse.ratingsSummary.averageRating,
  });
});

export const generateCertifcate = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { courseId } = req.params;
  const progress = await Progress.findOne({
    user: user._id,
    course: courseId,
  }).populate("completedLessons");

  if (!progress || progress.progressPercentage < 100) {
    return next(new AppError("user has not completed the course yet", 400));
  }
  const lastCompletedLesson =
    progress.completedLessons[progress.completedLessons.length - 1];

  const completionDate = lastCompletedLesson.completionDate || new Date();

  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError("No course found with this id", 404));
  }
  if (user.certificates.some((c) => c.course.toString() == course._id)) {
    return next(
      new AppError("User already has a certificate for this course", 400)
    );
  }
  const filePath = await generateCertificateFile(
    user.username,
    course.title,
    completionDate,
    res
  );

  const cloudinaryResult = await uploadCertificateToCloudinary(filePath);

  user.certificates.push({
    course: course._id,
    certificateUrl: {
      public_id: cloudinaryResult.public_id,
      url: cloudinaryResult.secure_url,
    },
    issuedAt: new Date(),
  });
  await user.save();

  res.status(200).json({
    message: "certificate generated successfuly",
    data: { url: cloudinaryResult.secure_url },
  });
});

export const getCourseStats = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;

  if (!user.createdCourses.includes(courseId)) {
    return next(new AppError("Not authorize", 403));
  }

  const cacheKey = `course:stats:${courseId}`;
  let course = await cacheService.get(cacheKey);
  if (!course) {
    course = await Course.findById(courseId).populate("chapters");
    if (!course) {
      return next(new AppError("no course found with this id", 404));
    }
    await cacheService.set(
      cacheKey,
      course,
      cacheService.CACHE_DURATION.COURSE
    );
  }

  const totalEnrollments = await Enrollment.countDocuments({
    course: courseId,
  });
  const completedCount = await Progress.countDocuments({
    course: courseId,
    progressPercentage: 100,
  });
  const completionRate = totalEnrollments
    ? ((completedCount / totalEnrollments) * 100).toFixed(1)
    : 0;
  const totalLessons = course.chapters.reduce(
    (sum, chapter) => sum + chapter.lessons.length,
    0
  );

  res.status(200).json({
    data: {
      title: course.title,
      subtitle: course.subtitle,
      image: course.image,
      price: course.price,
      totalLessons,
      completedCount,
      completionRate: `${completionRate}%`,
      averageRatings: course.ratingsSummary.averageRating,
      totalRatings: course.ratingsSummary.totalRatings,
      totalEnrollments,
      instructor: {
        username: user.username,
        profilePicture: user.profilePicture,
      },
    },
  });
});

export const getCourseProgressStats = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { courseId } = req.params;

  if (!user.createdCourses.includes(courseId)) {
    return next(new AppError("not authorize", 403));
  }
  const progressRecords = await Progress.find({ course: courseId });

  const progressDistribution = {
    notStarted: 0, // 0%
    started: 0, // 1-25%
    inProgress: 0, // 26-75%
    nearlyDone: 0, // 76-99%
    completed: 0, // 100%
  };

  progressRecords.forEach((record) => {
    const progress = record.progressPercentage;
    if (progress == 0) progressDistribution.notStarted++;
    else if (progress <= 25) progressDistribution.started;
    else if (progress <= 75) progressDistribution.inProgress++;
    else if (progress < 100) progressDistribution.nearlyDone++;
    else progressDistribution.completed++;
  });

  const averageProgress = progressRecords.length
    ? (
        progressRecords.reduce(
          (acc, record) => acc + record.progressPercentage,
          0
        ) / progressRecords.length
      ).toFixed(1)
    : 0;

  res.status(200).json({
    data: {
      progressDistribution,
      averageProgress,
      totalStudents: progressRecords.length,
    },
  });
});

export const getUserProgressForCourse = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { courseId } = req.params;

  if (
    !user.enrolledCourses.includes(courseId) &&
    !user.createdCourses.includes(courseId)
  ) {
    console.log("not auth from progress");
    return next(new AppError("Not authorize", 403));
  }
  const progress = await Progress.findOne({
    course: courseId,
    user: user._id,
  }).select("progressPercentage completedLessons");
  res.status(200).json({ data: progress });
});
