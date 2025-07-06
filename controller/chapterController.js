import mongoose from "mongoose";

import Chapter from "../models/chapterModel.js";
import Course from "../models/courseModel.js";
import Lesson from "../models/lessonModel.js";

import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import cacheService from "../utils/cacheService.js";
import { deleteVideo } from "../utils/mux.js";

export const createChapter = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const { title } = req.body;

  const course = await Course.findById(courseId);
  const cacheKey = `course:${courseId}`;

  if (!course) {
    return next(new AppError("No course found with this ID", 404));
  }

  const existingChapters = await Chapter.find({ course: courseId }).sort({
    order: 1,
  });
  const newOrder =
    existingChapters.length > 0
      ? existingChapters[existingChapters.length - 1].order + 1
      : 1;
  const chapter = new Chapter({
    title,
    order: newOrder,
    course: courseId,
  });
  await chapter.save();
  course.chapters.push(chapter);
  await course.save({ runValidators: false });
  // Clear the cache for the course
  await cacheService.del(cacheKey);
  // await cacheService.set(cacheKey, course, cacheService.CACHE_DURATION.COURSE);

  console.log(course, chapter, "data");
  res.status(200).json({ data: chapter, message: "Chapter created" });
});

export const getChapters = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const chapters = await Chapter.find({ course: courseId }).sort({ order: 1 });
  res.status(200).json({ data: chapters });
});

export const getChapterById = catchAsync(async (req, res, next) => {
  const { chapterId } = req.params;

  const chapter = await Chapter.findById(chapterId);

  if (!chapter) {
    return next(new AppError("no chapter found with this id", 404));
  }
  res.status(200).json({ data: chapter });
});

export const editChapter = catchAsync(async (req, res, next) => {
  const { chapterId } = req.params;
  const { title, order } = req.body;

  const chapter = await Chapter.findById(chapterId).populate(
    "course",
    "instructor"
  );
  if (!chapter) {
    return next(new AppError("No chapter found with this ID", 404));
  }

  chapter.title = title || chapter.title;
  chapter.order = order || chapter.order;
  await chapter.save();
  // Clear the cache for the course
  const cacheKey = `course:${chapter.course._id}`;
  await cacheService.del(cacheKey);
  res.status(200).json({ data: chapter });
});

export const deleteChapter = async (req, res) => {
  const { chapterId } = req.params;
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const chapter = await Chapter.findById(chapterId);
    if (!chapter) {
      return res
        .status(404)
        .json({ message: "no chapter found with this id " });
    }
    const course = await Course.findById(chapter.course).session(session);
    if (!course) {
      return res
        .status(404)
        .json({ message: "No course found for this chapter" });
    }
    course.chapters = course.chapters.filter(
      (item) => item.toString() != chapterId.toString()
    );
    await course.save({ session });
    const lessons = await Lesson.find({ chapter: chapterId });
    for (let lesson of lessons) {
      if (lesson.video && lesson.video.assetId) {
        await deleteVideo(lesson.video.assetId);
      }
      await lesson.remove({ session });
    }

    await chapter.remove({ session });

    await session.commitTransaction();
    session.endSession();
    // remove course from cache
    const cacheKey = `course:${chapter.course}`;
    await cacheService.del(cacheKey);
    res.status(200).json({ message: "chapter deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.log(error);
    res.status(500).json({
      message: "Error deleting chapter, please try again",
      error: error.message,
    });
  }
};

export const updateChapterOrder = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const { chapterIds } = req.body;
  const cacheKey = `course:${courseId}`;
  if (!chapterIds || !Array.isArray(chapterIds)) {
    return next(new AppError("invalid request data"));
  }

  for (let i = 0; i < chapterIds.length; i++) {
    await Chapter.findOneAndUpdate(
      { _id: chapterIds[i], course: courseId },
      { order: i + 1 }
    );
  }
  await cacheService.del(cacheKey);

  res.status(200).json({ message: "chapter order updated successfully" });
});
