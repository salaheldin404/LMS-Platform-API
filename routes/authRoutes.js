import express from "express";

import {
  login,
  signup,
  logout,
  refreshToken,
  forgetPassword,
  resetPassword,
  getCurrentUser,
} from "../controller/authController.js";
import { protectRoute } from "../middlewares/protect.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/refreshToken", refreshToken);
router.post("/forgotPassword", forgetPassword);
router.post("/resetPassword/:token", resetPassword);

router.get("/me", protectRoute, getCurrentUser);
export default router;
