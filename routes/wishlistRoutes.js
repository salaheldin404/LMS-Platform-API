import express from "express";

import { protectRoute } from "../middlewares/protect.js";
import {
  addToWishlist,
  removeFromWishlist,
  getWishlist,
} from "../controller/wishlistController.js";

const router = express.Router();

router.use(protectRoute);
router.get("/", getWishlist);

router.post("/:courseId", addToWishlist);
router.delete("/:courseId", removeFromWishlist);

export default router;
