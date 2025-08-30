import express from "express";

import {
  changePassword,
  deleteUser,
  getAllCertificatesForUser,
  getAllUsers,
  getCertificateByCourseId,
  getInstructorProfile,
  getUserById,
  getUserEnrolledCourses,
  getUserProfile,
  updateUser,
  updateUserSocialMedia,
} from "../controller/userController.js";

import { protectRoute } from "../middlewares/protect.js";

import upload from "../utils/multerConfig.js";
const router = express.Router();

const meRouter = express.Router();
meRouter.use(protectRoute);
meRouter.get("/", getUserProfile);
meRouter.get("/enrolled-courses", getUserEnrolledCourses);
meRouter.get("/certificates", getAllCertificatesForUser);
meRouter.get("/certificate/:courseId", getCertificateByCourseId);

router.use("/me", meRouter);
router.get("/:userId", getInstructorProfile);

router.use(protectRoute);

router.get("/", getAllUsers);

// router.get("/me", getUserProfile);
// router.get("/me/certificates", getAllCertificatesForUser);
// router.get("/me/certificate/:courseId", getCertificateByCourseId);

router.delete("/:userId", deleteUser);

router.patch("/change-password", changePassword);
router.patch("/:userId", upload.single("profilePicture"), updateUser);
router.patch("/:userId/social", updateUserSocialMedia);

export default router;
