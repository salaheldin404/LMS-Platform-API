import express from "express";
import { protectRoute } from "../middlewares/protect.js";
import {
  createCheckoutSession,
  enrollInCourse,
  getEnrolledStudents,
  unenrollFromCourse,
} from "../controller/enrollmentController.js";

const router = express.Router();

router.use(protectRoute);

router.get("/checkout-session/:courseId", createCheckoutSession);
router.route("/:courseId").post(enrollInCourse).delete(unenrollFromCourse);
// router.post("/:courseId", enrollInCourse);
// router.delete("/:courseId", unenrollFromCourse);
router.get("/me/:courseId", getEnrolledStudents);
export default router;
