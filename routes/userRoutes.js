import express from "express";

import {
  deleteUser,
  getAllCertificatesForUser,
  getAllUsers,
  getUserById,
  updateUser,
} from "../controller/userController.js";

import { protectRoute } from "../middlewares/protect.js";

import upload from "../utils/multerConfig.js";
const router = express.Router();
router.get("/:userId", getUserById);
router.use(protectRoute);
router.get("/", getAllUsers);
router.get("/:userId/certificates", getAllCertificatesForUser);

router.delete("/:userId", deleteUser);

router.patch("/:userId", upload.single("profilePicture"), updateUser);

export default router;
