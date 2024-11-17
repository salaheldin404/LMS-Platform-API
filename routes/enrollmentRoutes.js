import express from "express";
import { protectRoute } from "../middlewares/protect.js";
import {
  createCheckoutSession,
  enrollInCourse,
  getEnrolledStudents,
  unenrollFromCourse,
  validateCourseItems,
} from "../controller/enrollmentController.js";

const router = express.Router();

router.use(protectRoute);

router.post("/checkout-session/", validateCourseItems, createCheckoutSession);
router.route("/:courseId").post(enrollInCourse).delete(unenrollFromCourse);
// router.post("/:courseId", enrollInCourse);
// router.delete("/:courseId", unenrollFromCourse);
router.get("/me/:courseId", getEnrolledStudents);
export default router;
