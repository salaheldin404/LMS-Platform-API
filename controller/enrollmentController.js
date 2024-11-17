import Enrollment from "../models/enrollmentModel.js";
import Course from "../models/courseModel.js";
import User from "../models/userModel.js";
import Progress from "../models/progressModel.js";

import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

import Stripe from "stripe";
import mongoose from "mongoose";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const enrollInCourse = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;

  const course = await Course.findById(courseId).populate(
    "chapters",
    "lessons"
  );
  if (!course) {
    return next(new AppError("Course not found", 404));
  }

  const existEnrollment = await Enrollment.findOne({
    user: user._id,
    course: course._id,
  });
  if (existEnrollment) {
    return res.status(400).json({ message: "Already enrolled" });
  }
  const newProgress = new Progress({
    user: user._id,
    course: course._id,
    completedLessons: [],
    unlockedLessons: [],
  });
  const firstLesson = course.chapters[0].lessons[0];
  if (firstLesson) {
    newProgress.unlockedLessons.push(firstLesson);
  }
  await newProgress.save();

  const newEnrollment = new Enrollment({
    user: user._id,
    course: course._id,
    progress: newProgress._id,
  });
  await newEnrollment.save();

  user.enrolledCourses.push(course._id);
  await user.save();

  course.enrollmentsCount += 1;
  course.students.push(user._id);
  await course.save();
  res.status(200).json({
    data: newEnrollment,
    message: "Successfully enrolled in the course",
  });
});

export const unenrollFromCourse = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;

  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError("Course not found", 404));
  }
  if (user.role !== "student") {
    return next(new AppError("unauthorized", 403));
  }
  const existEnroll = await Enrollment.findOne({
    user: user._id,
    course: course._id,
  });
  if (!existEnroll) {
    return next(new AppError("You are not enrolled in this course", 404));
  }

  user.enrollInCourse = user.enrollInCourse?.filter(
    (c) => c._id.toString() != courseId
  );
  course.students = course.students?.filter(
    (student) => student._id.toString() != user._id.toString()
  );
  course.enrollmentsCount -= 1;

  await existEnroll.remove();
  await course.save();
  await user.save();
  res.status(200).json({ message: "unenrolled success" });
});

export const getEnrolledStudents = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;

  const course = await Course.findById(courseId).populate("students");
  if (!course) {
    return next(new AppError("Course not found", 404));
  }
  if (!course.instructor.equals(user._id) && user.role !== "admin") {
    return next(new AppError("Unauthorized", 403));
  }

  res.status(200).json({ data: course.students });
});

export const validateCourseItems = catchAsync(async (req, res, next) => {
  const { cartItems } = req.body;
  if (!Array.isArray(cartItems) || cartItems.length == 0) {
    return next(new AppError("Invalid cart items", 400));
  }
  const validId = cartItems.every((id) => mongoose.isValidObjectId(id));
  if (!validId) {
    return next(new AppError("Invalid cart items", 400));
  }
  next();
});

const createLineItems = (courses) => {
  return courses.map((course) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: course.title,
        description: course.description,
        images: [course.image.url],
      },
      unit_amount: course.price * 100,
    },
    quantity: 1,
  }));
};

export const createCheckoutSession = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { cartItems } = req.body;

  const courses = await Course.find(
    { _id: { $in: cartItems } },
    "title description image.url price"
  ).lean();

  if (!courses.length) {
    return next(new AppError("No courses found with the provided IDs", 404));
  }
  if (courses.length !== cartItems.length) {
    return next(new AppError("Some courses were not found", 404));
  }
  const [customer, lineItems] = await Promise.all([
    stripe.customers.create({
      metadata: {
        userId: user._id,
        email: user.email,
        cart_items_data: JSON.stringify(cartItems),
      },
    }),
    createLineItems(courses),
  ]);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    shipping_address_collection: {
      allowed_countries: ["EG", "US"],
    },
    success_url: `${process.env.FRONTEND_URL}/enrollments`,
    cancel_url: `${process.env.FRONTEND_URL}/enrollments`,
    customer: customer.id,
    mode: "payment",
    client_reference_id: user._id.toString(),
    line_items: lineItems,
  });

  res.status(200).json({ session });
});
