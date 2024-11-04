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
  getSearchCourses,
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

router.post("/:courseId/generate-certificate", generateCertifcate);


router.post("/:courseId/rate", addRatingToCourse);

router.use("/:courseId/chapters", chapterRouter);

export default router;
