import express from "express";
import {
  createChapter,
  getChapters,
  getChapterById,
  editChapter,
  deleteChapter,
  updateChapterOrder,
} from "../controller/chapterController.js";

import { protectRoute } from "../middlewares/protect.js";
import { protectChapter } from "../middlewares/protectContent.js";
import lessonRoutes from "./lessonRoutes.js";
const router = express.Router({ mergeParams: true });

router.use(protectRoute);
router.get("/", getChapters);
router.get("/:chapterId", getChapterById);

router.post("/", protectChapter, createChapter);
router.patch("/change-order", protectChapter, updateChapterOrder);
router.patch("/:chapterId", protectChapter, editChapter);
router.delete("/:chapterId", protectChapter, deleteChapter);

router.use("/:chapterId/lessons", lessonRoutes);

export default router;
