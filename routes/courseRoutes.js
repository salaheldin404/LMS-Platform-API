import express from "express";
import {
  addRatingToCourse,
  createCourse,
  deleteCourse,
  editCourse,
  generateCertifcate,
  getAllCourses,
  getCourseById,
  getCoursesForCurrentInstructor,
  getCourseStats,
  getSearchCourses,
  removeRatingFromCourse,
  getCourseProgressStats,
} from "../controller/courseController.js";
import { protectRoute } from "../middlewares/protect.js";
import upload from "../utils/multerConfig.js";

import chapterRouter from "./chapterRoutes.js";
const router = express.Router();

// api/v1/courses/courseId/chapters

// router.use('/:courseId/chapters/:chapterId/lessons',lessonRouter)
router.use(protectRoute);

router.get("/", getAllCourses);
router.get("/me", getCoursesForCurrentInstructor);
router.get("/search", getSearchCourses);
router.get("/:courseId", getCourseById);
router.post("/", upload.single("image"), createCourse);
router.patch("/:courseId", upload.single("image"), editCourse);
router.delete("/:courseId", deleteCourse);

router.get("/:courseId/stats", getCourseStats);
router.get("/:courseId/progress-stats", getCourseProgressStats);

router.post("/:courseId/generate-certificate", generateCertifcate);

router.post("/:courseId/rate", addRatingToCourse);
router.delete("/:courseId/rate", removeRatingFromCourse);

router.use("/:courseId/chapters", chapterRouter);

export default router;
