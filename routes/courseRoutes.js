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
  getInstructorCourses,
  publishCourse,
  getRatingPercentages,
  getCourseBySlug,
  getUserProgressForCourse,
} from "../controller/courseController.js";
import { protectRoute } from "../middlewares/protect.js";
import upload from "../utils/multerConfig.js";

import chapterRouter from "./chapterRoutes.js";
const router = express.Router();

// api/v1/courses/courseId/chapters

// router.use('/:courseId/chapters/:chapterId/lessons',lessonRouter)

router.get("/", getAllCourses);
router.get("/search", getSearchCourses);
router.get("/user/:userId", getInstructorCourses);

router.get("/me", protectRoute, getCoursesForCurrentInstructor);

router.get("/:courseId([0-9a-fA-F]{24})", protectRoute, getCourseById);
router.get("/:slug", getCourseBySlug);

router.use(protectRoute);
router.post("/", createCourse);
router.patch("/:courseId", upload.single("image"), editCourse);
router.delete("/:courseId", deleteCourse);

router.post("/:courseId/publish", publishCourse);
// router.post("/:courseId/rate", addRatingToCourse);

router.get("/:courseId/user-progress", getUserProgressForCourse);
router.get("/:courseId/stats", getCourseStats);
router.get("/:courseId/progress-stats", getCourseProgressStats);
// router.get("/:courseId/ratingPercentage", getRatingPercentages);
router.post("/:courseId/generate-certificate", generateCertifcate);

// router.delete("/:courseId/rate", removeRatingFromCourse);

router.use("/:courseId/chapters", chapterRouter);

export default router;
