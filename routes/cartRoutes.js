import express from "express";

import { protectRoute } from "../middlewares/protect.js";
import {
  addToCart,
  clearCart,
  getUserCart,
  removeFromCart,
} from "../controller/cartController.js";

const router = express.Router();

router.use(protectRoute);

router.get("/me", getUserCart);
router.post("/", addToCart);
router.delete("/:courseId", removeFromCart);
router.delete("/", clearCart);
export default router;
