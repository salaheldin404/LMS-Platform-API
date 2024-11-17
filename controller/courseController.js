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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const cacheService = new CacheService();

export const createCourse = catchAsync(async (req, res, next) => {
  const { title, description, price } = req.body;
  const user = req.user;
  let curPath;
  let image = {};
  if (user.role != "teacher") {
    return next(new AppError("You must be a teacher to create a course", 403));
  }
  if (!title || !description || !price) {
    return next(
      new AppError("You must provide title, description, and price", 400)
    );
  }

  if (req.file) {
    let imgPath = req.file.filename;
    curPath = path.join(__dirname, `../public/uploads/${imgPath}`);
    const result = await cloudinaryUploadImage(curPath);
    image = {
      public_id: result.public_id,
      url: result.secure_url,
    };
  }
  const course = await Course.create({
    title,
    description,
    price,
    instructor: user._id,
    image,
  });
  user.createdCourses.push(course._id);
  await user.save();
  res.status(200).json({ data: course });

  if (curPath) {
    fs.unlink(curPath, (err) => {
      if (err) {
        console.log(err, "error delete image");
      }
    });
  }
});

export const editCourse = catchAsync(async (req, res, next) => {
  const { title, description, price } = req.body;
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
    curPath = path.join(__dirname, `../public/uploads/${imgPath}`);
    const result = await cloudinaryUploadImage(curPath);
    course.image = {
      public_id: result.public_id,
      url: result.secure_url,
    };
  }

  course.title = title ? title : course.title;
  course.description = description ? description : course.description;
  course.price = price ? price : course.price;

  await course.save({ validateBeforeSave: true });
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

  // delete the course
  await course.remove();
  res.status(200).json({ message: "course deleted successfuly" });
});

export const getAllCourses = catchAsync(async (req, res, next) => {
  const queryObj = { ...req.query };

  const cacheKey = `courses:catalog:${JSON.stringify(queryObj)}`;

  let courses = await cacheService.get(cacheKey);
  if (!courses) {
    const excludeFields = ["page", "sort", "limit", "fields"];
    excludeFields.forEach((el) => delete queryObj[el]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    let query = Course.find(JSON.parse(queryStr));

    // sorting
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // limit fields
    if (req.query.fields) {
      const fields = req.query.fields.split(",").join(" ");
      query = query.select(fields);
    } else {
      query = query.select("-__v -students");
    }

    // add pagenation
    // pagination
    const limit = Math.max(1, parseInt(req.query.limit) || 10);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const skip = (page - 1) * limit;
    courses = await query.skip(skip).limit(limit);
    if (courses.length > 0) {
      await cacheService.set(
        cacheKey,
        courses,
        cacheService.CACHE_DURATION.CATALOG
      );
    }
  }

  // const courses = await query.skip(skip).limit(limit);
  res.status(200).json({ data: courses });
});

export const getCoursesForCurrentInstructor = catchAsync(
  async (req, res, next) => {
    const user = req.user;

    const courses = await Course.find({ instructor: user._id });

    res.status(200).json({ data: courses });
  }
);

export const getCourseById = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;

  const cacheKey = `course:${courseId}`;

  let cachedData = await cacheService.get(cacheKey);
  if (cachedData) {
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
    });
  if (!course) {
    return next(new AppError("no course found with this id", 404));
  }
  await cacheService.set(cacheKey, course, cacheService.CACHE_DURATION.COURSE);
  res.status(200).json({ data: course });
});

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

const updateCourseRatingSummary = async (courseId) => {
  const [ratingSummary] = await Rating.aggregate([
    {
      $match: {
        course: mongoose.Types.ObjectId(courseId),
        rate: { $gte: 1, $lte: 5 },
      },
    },
    {
      $group: {
        _id: "$course",
        averageRating: { $avg: "$rate" },
        totalRatings: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        averageRating: { $round: ["$averageRating", 2] },
        totalRatings: 1,
      },
    },
  ])
    .hint({ course: 1, rate: 1 })
    .exec();

  return await Course.findByIdAndUpdate(
    courseId,
    {
      $set: {
        "ratingsSummary.averageRating": ratingSummary?.averageRating || 0,
        "ratingsSummary.totalRatings": ratingSummary?.totalRatings || 0,
      },
    },
    {
      new: true,
      select: "ratingsSummary",
      lean: true,
    }
  );
};

export const addRatingToCourse = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const { rate } = req.body;
  const user = req.user;

  if (rate < 1 || rate > 5) {
    return next(new AppError("rate must be between 1 and 5", 400));
  }
  const cacheKey = `course:${courseId}`;

  const [course, existingRating] = await Promise.all([
    cacheService.get(cacheKey).then(async (cachedCourse) => {
      if (cachedCourse) return cachedCourse;
      const foundCourse = await Course.findById(courseId).lean();
      if (foundCourse) {
        await cacheService.set(
          cacheKey,
          foundCourse,
          cacheService.CACHE_DURATION.COURSE
        );
      }

      return foundCourse;
    }),
    Rating.findOne({
      user: user._id,
      course: courseId,
    })
      .select("_id")
      .lean(),
  ]);

  if (!course) {
    return next(new AppError("no course found with this id", 404));
  }

  if (user.createdCourses.includes(courseId)) {
    return next(new AppError("you can't add rating to your own course", 400));
  }
  if (!user.enrolledCourses.includes(courseId)) {
    return next(new AppError("you are not enrolled in this course", 403));
  }
  const [, updatedCourse] = await Promise.all([
    Rating.findOneAndUpdate(
      {
        user: user._id,
        course: courseId,
      },
      { rate },
      { new: true, upsert: true }
    ),
    updateCourseRatingSummary(courseId),
  ]);

  await cacheService.del(cacheKey);
  res.status(200).json({
    message: existingRating
      ? "Rating updated successfully"
      : "Rating added successfully",
    averageRating: updatedCourse.ratingsSummary.averageRating,
    totalRating: updatedCourse.ratingsSummary.totalRating,
  });
});

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

export const checkCourseIsCompleted = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;
  const course = await Course.findById(courseId);

  if (!course) {
    return next(new AppError("No course found with this id", 404));
  }

  const lessons = await Lesson.find({ course: courseId, completed: false });

  if (lessons.length > 0) {
    return next(new AppError("course is not completed", 400));
  }
});

// http://localhost:4000/api/v1/courses/6710875ecb8d3d772a756f53/generate-certificate
export const generateCertifcate = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { courseId } = req.params;
  const progress = await Progress.findOne({
    user: user._id,
    course: courseId,
  }).populate("completedLessons");

  if (!progress || progress.percentageCompleted < 100) {
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
    return next(new AppError("not authorize", 403));
  }

  const cacheKey = `course:${courseId}`;
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
    percentageCompleted: 100,
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
      courseTitle: course.title,
      totalLessons,
      completedCount,
      completionRate: `${completionRate}%`,
      averageRating: course.ratingsSummary.averageRating,
      totalRating: course.ratingsSummary.totalRatings,
      totalEnrollments,
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
    const progress = record.percentageCompleted;
    if (progress == 0) progressDistribution.notStarted++;
    else if (progress <= 25) progressDistribution.started;
    else if (progress <= 75) progressDistribution.inProgress++;
    else if (progress < 100) progressDistribution.nearlyDone++;
    else progressDistribution.completed++;
  });

  const averageProgress = progressRecords.length
    ? (
        progressRecords.reduce(
          (acc, record) => acc + record.percentageCompleted,
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
