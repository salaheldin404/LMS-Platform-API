import Lesson from "../models/lessonModel.js";
import Enrollment from "../models/enrollmentModel.js";
import Course from "../models/courseModel.js";
import Chapter from "../models/chapterModel.js";
import Progress from "../models/progressModel.js";
import User from "../models/userModel.js";

import AppError from "../utils/appError.js";
// import Mux from "@mux/mux-node";
import fs from "fs";
import dotenv from "dotenv";
import {
  cloudinaryUploadVideo,
  cloudinaryDeleteVideo,
} from "../utils/cloudinary.js";

import { uploadVideo, deleteVideo } from "../utils/mux.js";
import mongoose from "mongoose";
import catchAsync from "../utils/catchAsync.js";
import cacheService from "../utils/cacheService.js";
dotenv.config({ path: "./config.env" });
export const getLessons = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;
  // const courseIdObj = mongoose.Types.ObjectId(courseId);
  const checkPermission =
    user.enrolledCourses?.some((id) => id.equals(courseId)) ||
    user.createdCourses?.some((id) => id.equals(courseId)) ||
    user.role == "admin";

  // console.log(user.createdCourse, courseIdObj);

  const lessons = await Lesson.find({ course: courseId });
  const progress = await Progress.findOne({ course: courseId, user: user._id });
  console.log(checkPermission, lessons, "check permission");

  const lessonData = lessons.map((lesson) => {
    const completedLesson = progress
      ? progress.completedLessons.find(
          (comp) => comp.lessonId?.toString() == lesson._id.toString()
        )
      : null;
    const unlockedLesson = progress
      ? progress.unlockedLessons.find((unlock) => unlock._id.equals(lesson._id))
      : null;
    console.log({ completedLesson, progress: progress?.completedLessons });
    const lessonInfo = {
      _id: lesson._id,
      title: lesson.title,
      locked: unlockedLesson ? false : true,
      chapter: lesson.chapter,
      course: lesson.course,
      completed: completedLesson ? true : false,
      order: lesson.order,
    };

    // Include video information if the user is enrolled
    if (checkPermission && !lessonInfo.locked) {
      console.log(checkPermission, "check");
      lessonInfo.video = lesson.video; // Include the video info
    }

    return lessonInfo;
  });
  res.status(200).json({ data: lessonData });
});

export const getLesson = catchAsync(async (req, res, next) => {
  const { lessonId } = req.params;
  const user = req.user;

  const lesson = await Lesson.findById(lessonId).populate("course", "_id");
  if (!lesson) {
    next(new AppError("No lesson found with this ID", 404));
  }
  const courseId = lesson.course._id;

  // const progress = await Progress.findOne({
  //   user: user._id,
  //   course: lesson.course._id,
  // });
  const isEnrolled = (user.enrolledCourses || []).some((id) =>
    id.equals(courseId)
  );
  const isCreator = (user.createdCourses || []).some((id) =>
    id.equals(courseId)
  );
  console.log({ isEnrolled, isCreator})
  const isAdmin = user.role === "admin";
  const hasPermission = isEnrolled || isCreator || isAdmin;

  // const unlockLesson = progress?.unlockedLessons.find((unlock) =>
  //   unlock._id.equals(lesson._id)
  // );
  if (!hasPermission) {
    lesson.video = undefined;
  }

  res.status(200).json({ data: lesson });
});

// const mux = new Mux(process.env.MUX_TOKEN_ID, process.env.MUX_TOKEN_SECRET);
export const createLesson = async (req, res, next) => {
  const { courseId, chapterId } = req.params;
  const { title, locked } = req.body;
  // const videoFile = req.file;
  const user = req.user;
  let result;

  if (user.role != "teacher") {
    return next(new AppError("Only teachers can create lessons", 403));
    // return res.status(403).json({ message: "unauthorized" });
  }
  if (!title || !chapterId || !courseId) {
    return next(
      new AppError("You must provide title,chapter and courseId ", 400)
    );
    // return res.status(400).json({
    //   message: "You must provide title,chapter ,and video",
    // });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const course = await Course.findById(courseId).session(session);
    if (!course) {
      return next(new AppError("No course found with this ID", 404));
    }

    const chapterExists = await Chapter.findById(chapterId).session(session);

    if (!chapterExists) {
      return next(new AppError("No chapter found with this ID", 404));
    }
    const existingLessons = await Lesson.find({ chapter: chapterId })
      .sort({
        order: 1,
      })
      .lean()
      .session(session);

    const newOrder =
      existingLessons.length > 0
        ? existingLessons[existingLessons.length - 1].order + 1
        : 1;

    // result = await cloudinaryUploadVideo(videoFile.path);
    // console.log({ cloudinary: result });
    // const asset = await uploadVideo(result.secure_url);

    const newLesson = new Lesson({
      title,
      // video: {
      //   assetId: asset.id,
      //   playbackId: asset.playback_ids[0].id,
      //   playbackUrl: `https://stream.mux.com/${asset.playback_ids[0].id}.m3u8`,
      // },
      course: courseId,
      chapter: chapterId,
      order: newOrder,
      locked: locked,
    });
    await newLesson.save({ session });
    chapterExists.lessons.push(newLesson._id);
    await chapterExists.save({ session });
    if (locked === false || !locked) {
      const progressRecords = await Progress.find({ course: courseId });
      const updates = progressRecords.map(async (progress) => {
        progress.unlockedLessons.push(newLesson._id);
        await progress.save({ session });
      });
      await Promise.all(updates);
    }
    const cacheKey = `course:${courseId}`;
    await cacheService.del(cacheKey);

    await session.commitTransaction();
    res
      .status(201)
      .json({ data: newLesson, message: "Lesson created successfully" });
  } catch (error) {
    await session.abortTransaction();
    console.log(error.message, "from create lesson");
    return res.status(500).json({
      message: "Error creating lesson, please try again",
      error: error.message,
    });
  } finally {
    session.endSession();
    // if (result) {
    //   await cloudinaryDeleteVideo(result.public_id);
    // }
    // console.log(videoFile, "is delete...");
    // if (videoFile?.path) {
    //   fs.unlink(videoFile.path, (err) => {
    //     if (err) {
    //       console.error(`Failed to delete local video file: ${err.message}`);
    //     } else {
    //       console.log("Local video file deleted successfully");
    //     }
    //   });
    // }
  }
};

export const deleteLesson = async (req, res, next) => {
  const { lessonId, courseId, chapterId } = req.params;

  if (!lessonId || !courseId || !chapterId) {
    return res
      .status(400)
      .json({ message: "lessonId,courseId,chapterId are required" });
  }
  try {
    const lesson = await Lesson.findById(lessonId).populate(
      "course",
      "instructor"
    );
    if (!lesson) {
      next(new AppError("no lesson found with this id", 404));
    }
    const chapter = await Chapter.findById(lesson.chapter).populate(
      "lessons",
      "title video "
    );
    if (!chapter) {
      next(new AppError("no chapter found with this id", 404));
    }
    console.log({ chapter: chapter.lessons }, "from delete course");
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      if (lesson.video && lesson.video?.assetId) {
        await deleteVideo(lesson.video.assetId).catch((error) =>
          console.log(error, "error from delete video")
        );
      }
      await lesson.remove({ session });
      chapter.lessons = chapter.lessons.filter(
        (item) => item._id.toString() !== lesson._id.toString()
      );

      await chapter.save({ session });
      const cacheKey = `course:${courseId}`;
      await cacheService.del(cacheKey);

      await session.commitTransaction();
      session.endSession();

      console.log(chapter.lessons, "chapter lessonss");

      return res
        .status(200)
        .json({ message: "lesson deleted successfuly", data: chapter.lessons });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.log(error);
      res.status(500).json({
        message: "Error deleting lesson, please try again",
        error: error.message,
      });
    }
  } catch (error) {
    console.log(error, "from delete lesson");
    return res.status(500).json({
      message: "Error deleting lesson, please try again",
      error: error.message,
    });
  }
};

export const updateLesson = catchAsync(async (req, res, next) => {
  const { lessonId, courseId, chapterId } = req.params;
  const { title, locked } = req.body;
  const videoFile = req.file;

  if (!lessonId || !courseId || !chapterId) {
    return next(new AppError("Missing parameters", 400));
  }
  console.log({ lessonId, courseId, chapterId });
  let result;

  const lesson = await Lesson.findOne({
    course: courseId,
    _id: lessonId,
    chapter: chapterId,
  });

  if (!lesson) {
    return next(new AppError("no lesson found with this id", 404));
    // return res.status(404).json({ message: "no lesson found with this id " });
  }
  console.log({ lesson });

  lesson.title = title || lesson.title;
  lesson.locked = locked || lesson.locked;

  if (videoFile) {
    result = await cloudinaryUploadVideo(videoFile.path);
    if (lesson.video && lesson.video.assetId) {
      await deleteVideo(lesson.video.assetId);
    }

    const asset = await uploadVideo(result.secure_url);
    console.log(asset.duration, "lesson duration");
    lesson.video = {
      assetId: asset.id,
      playbackId: asset.playback_ids[0].id,
      playbackUrl: `https://stream.mux.com/${asset.playback_ids[0].id}.m3u8`,
      duration: asset.duration,
    };
  }
  await lesson.save();
  const cacheKey = `course:${courseId}`;
  await cacheService.del(cacheKey);
  res.status(200).json({ data: lesson, message: "lesson updated successfuly" });

  if (result) {
    await cloudinaryDeleteVideo(result.public_id);
  }
  if (videoFile) {
    // Delete the old video file asynchronously
    fs.unlink(videoFile.path, (err) => {
      if (err) {
        console.error(`Failed to delete local video file: ${err.message}`);
      } else {
        console.log("Local video file deleted successfully");
      }
    });
  }
});

export const unlockLesson = catchAsync(async (req, res, next) => {
  const { lessonId } = req.params;
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    return next(new AppError("No lesson found with this id", 404));
  }
  const progressRecords = await Progress.find({ course: lesson.course });
  const updates = progressRecords.map(async (progress) => {
    if (!progress.unlockedLessons.includes(lessonId)) {
      progress.unlockedLessons.push(lessonId);
      await progress.save();
    }
  });
  await Promise.all(updates);
  res.status(200).json({ message: "Lesson unlocked successfuly" });
});

export const lockLesson = catchAsync(async (req, res, next) => {
  const { lessonId } = req.params;

  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    return next(new AppError("no lesson found with this id", 404));
  }
  const progressRecords = await Progress.find({ course: lesson.course });
  const updates = progressRecords.map(async (progress) => {
    if (progress.unlockedLessons.includes(lessonId)) {
      progress.unlockedLessons = progress.unlockedLessons.filter(
        (id) => id.toString() !== lessonId
      );
      await progress.save();
    }
  });

  await Promise.all(updates);
  res.status(200).json({ message: "Lesson locked successfuly" });
});

// export const markLessonComplete = catchAsync(async (req, res, next) => {
//   const { lessonId } = req.params;
//   const user = req.user;
//   if (!lessonId) {
//     return next(new AppError("Missing parameters", 400));
//   }

//   const lesson = await Lesson.findById(lessonId);
//   if (!lesson) {
//     return next(new AppError("No lesson found with this id", 404));
//   }
//   const courseId = lesson.course;
//   let progress = await Progress.findOne({
//     user: user._id,
//     course: courseId,
//   });
//   if (!progress) {
//     progress = new Progress({
//       user: user._id,
//       course: courseId,
//       completedLessons: [],
//       unlockedLessons: [],
//     });
//   }

//   const completedIndex = progress.completedLessons.findIndex((prog) =>
//     prog.lessonId.equals(lesson._id)
//   );
//   const allLessons = await Lesson.find({ course: courseId })
//     .sort({ order: 1 })
//     .lean();
//   if (completedIndex == -1) {
//     progress.completedLessons.push({
//       lessonId: lesson._id,
//       completionDate: new Date(),
//     });
//     const completedLessons = progress.completedLessons.length;

//     progress.progressPercentage = (completedLessons / allLessons.length) * 100;
//     await progress.save();
//   } else {
//     progress.completedLessons = progress.completedLessons.filter(
//       (l) => l.lessonId.toString() !== lesson._id.toString()
//     );
//     progress.progressPercentage =
//       (progress.completedLessons.length / allLessons.length) * 100;
//     await progress.save();
//   }

//   if (
//     progress.progressPercentage == 100 &&
//     !user.completedCourses.includes(courseId)
//   ) {
//     user.completedCourses.push(courseId);
//     await user.save();
//   }

//   res.status(200).json({
//     message: "Lesson marked as complete",
//     progress: progress.progressPercentage,
//   });
// });

export const markLessonComplete = catchAsync(async (req, res, next) => {
  const { lessonId } = req.params;
  const user = req.user;

  // Validate input parameters
  if (!lessonId) {
    return next(new AppError("Missing parameters", 400));
  }
  // Find lesson and verify it exists
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) {
    return next(new AppError("No lesson found with this id", 404));
  }
  const courseId = lesson.course;

  // Find or create progress document (in one operation)
  let progress = await Progress.findOneAndUpdate(
    { user: user._id, course: courseId },
    { $setOnInsert: { completedLessons: [], unlockedLessons: [] } },
    { new: true, upsert: true }
  );
  console.log(progress, "progress");

  // Check if lesson is already completed
  const lessonIsCompleted = progress.completedLessons.some((prog) =>
    prog.lessonId.equals(lesson._id)
  );
  // Fetch all lessons once (outside any conditionals)
  const allLessonsCount = await Lesson.countDocuments({ course: courseId });
  // Update the progress document based on completion status
  if (!lessonIsCompleted) {
    // Add lesson to completed lessons
    await Progress.updateOne(
      { _id: progress._id },
      {
        $push: {
          completedLessons: {
            lessonId: lesson._id,
            completionDate: new Date(),
          },
        },
      }
    );
    progress.completedLessons.push({
      lessonId: lesson._id,
      completionDate: new Date(),
    });
  } else {
    // Remove lesson from completed lessons
    await Progress.updateOne(
      { _id: progress._id },
      {
        $pull: {
          completedLessons: { lessonId: lesson._id },
        },
      }
    );
    progress.completedLessons = progress.completedLessons.filter(
      (l) => !l.lessonId.equals(lesson._id)
    );
  }

  // Calculate new progress percentage
  const completedCount = progress.completedLessons.length;
  const progressPercentage = (completedCount / allLessonsCount) * 100;

  // Update progress percentage
  await Progress.updateOne(
    { _id: progress._id },
    { $set: { progressPercentage } }
  );

  // Handle course completion
  if (progressPercentage === 100 && !user.completedCourses.includes(courseId)) {
    await User.updateOne(
      { _id: user._id },
      { $addToSet: { completedCourses: courseId } }
    );
  }

  return res.status(200).json({
    message: lessonIsCompleted
      ? "Lesson marked as incomplete"
      : "Lesson marked as complete",
    progress: progressPercentage,
  });
});

export const updateLessonOrder = catchAsync(async (req, res, next) => {
  const { chapterId, courseId } = req.params;
  const { lessonIds } = req.body;

  if (!lessonIds || !Array.isArray(lessonIds)) {
    return next(new AppError("invalid request data", 400));
  }

  for (let i = 0; i < lessonIds.length; i++) {
    await Lesson.findOneAndUpdate(
      { _id: lessonIds[i], chapter: chapterId },
      { order: i + 1 }
    );
  }

  const cacheKey = `course:${courseId}`;
  await cacheService.del(cacheKey);
  res.status(200).json({ message: "Lessons reordered successfully" });
});
