import express from "express";

import { protectRoute } from "../middlewares/protect.js";
import {
  addRatingToCourse,
  deleteUserRatingFromCourse,
  getAllRatingsForCourse,
  getRatingPercentages,
  getUserRatingForCourse,
} from "../controller/ratingController.js";
const router = express.Router();

router.get("/:courseId", getAllRatingsForCourse);
router.get("/percentage/:courseId", getRatingPercentages);

router.use(protectRoute);
router.post("/:courseId", addRatingToCourse);

router.get("/user/:courseId", getUserRatingForCourse);
router.delete("/user/:courseId", deleteUserRatingFromCourse);

export default router;
