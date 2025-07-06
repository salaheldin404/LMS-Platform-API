import express from "express";
import upload from "../utils/multerConfig.js";
import { protectRoute } from "../middlewares/protect.js";
import {
  createLesson,
  deleteLesson,
  updateLesson,
  getLessons,
  getLesson,
  unlockLesson,
  markLessonComplete,
  updateLessonOrder,
  lockLesson,
} from "../controller/lessonController.js";

import { protectLesson } from "../middlewares/protectContent.js";
const router = express.Router({ mergeParams: true });

router.use(protectRoute);

// /courses/:courseId/chapters/:chapterId/lessons
router.get("/course/:courseId", getLessons);
router.get("/:lessonId", getLesson);

router.post("/unlock/:lessonId", protectLesson, unlockLesson);
router.post("/lock/:lessonId", protectLesson, lockLesson);

router.post("/", protectLesson, upload.single("video"), createLesson);
router.delete("/:lessonId", protectLesson, deleteLesson);
// /chapters/:chapterId/lessons/change-order
router.patch("/change-order", protectLesson, updateLessonOrder);
// /chapters/:chapterId/lessons/:lessonId

router.patch("/:lessonId", protectLesson, upload.single("video"), updateLesson);
router.patch("/:lessonId/complete", markLessonComplete);

export default router;
