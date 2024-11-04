import { fileURLToPath } from "url";
import Course from "../models/courseModel.js";
import Chapter from "../models/chapterModel.js";
import Lesson from "../models/lessonModel.js";
import User from "../models/userModel.js";

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

import Progress from "../models/progressModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;

  const courses = await query.skip(skip).limit(limit);
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

  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError("no course found with this id", 404));
  }

  res.status(200).json({ data: course });
});

export const getSearchCourses = catchAsync(async (req, res, next) => {
  const { keyword, page = 1, limit = 10 } = req.query;

  const query = {
    $or: [
      { title: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
    ],
  };

  const courses = await Course.find(query)
    .skip((page - 1) * limit)
    .limit(parseInt(limit));
  const totalCourses = await Course.countDocuments(query);

  if (!courses.length) {
    return next(new AppError("no course found with this keyword", 404));
  }

  res.status(200).json({
    data: courses,
    totalCourses,
    totalPages: Math.ceil(totalCourses / limit),
  });
});

export const addRatingToCourse = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const { rate } = req.body;
  const user = req.user;

  if (rate < 1 || rate > 5) {
    return next(new AppError("rate must be between 1 and 5", 400));
  }

  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError("no course found with this id", 404));
  }
  if (user.createdCourses.includes(courseId)) {
    return next(new AppError("you can't add rating to your own course", 400));
  }
  if (!user.enrolledCourses.includes(courseId)) {
    return next(new AppError("you are not enrolled in this course", 403));
  }
  const existRatingIndex = course.ratings.findIndex(
    (r) => r.user._id.toString() == user._id
  );

  if (existRatingIndex > -1) {
    course.ratings[existRatingIndex].rate = rate;
  } else {
    course.ratings.push({ user: user._id, rate });
  }
  const averageRating =
    course.ratings.reduce((acc, r) => acc + r.rate, 0) / course.ratings.length;

  course.averageRating = averageRating;

  await course.save();

  res.status(200).json({ message: "Rating added successfully", averageRating });
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
