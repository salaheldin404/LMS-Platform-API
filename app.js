import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import enrollmentRoutes from "./routes/enrollmentRoutes.js";
import lessonRoutes from "./routes/lessonRoutes.js";
import chapterRoutes from "./routes/chapterRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import ratingRoutes from "./routes/ratingRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";

import globalError from "./controller/errorController.js";

import AppError from "./utils/appError.js";
import helmet from "helmet";
import hpp from "hpp";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import { rateLimit } from "express-rate-limit";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json({ limit: "10kb" }));

app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

const apiLimiter = rateLimit({
  maximum: 200,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});

// app.use("/api", apiLimiter);

app.use(mongoSanitize());
app.use(helmet.xssFilter());
app.use(
  hpp({
    whitelist: ["category", "level"],
  })
);

app.use(compression());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/courses", courseRoutes);
app.use("/api/v1/enrollments", enrollmentRoutes);
app.use("/api/v1/lessons", lessonRoutes);
app.use("/api/v1/chapters", chapterRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/ratings", ratingRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

app.use("*", (req, res, next) => {
  next(new AppError("Route not found", 404));
});

app.use(globalError);
export default app;
