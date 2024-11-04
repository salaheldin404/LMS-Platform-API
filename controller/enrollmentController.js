import Enrollment from "../models/enrollmentModel.js";
import Course from "../models/courseModel.js";
import User from "../models/userModel.js";
import Progress from "../models/progressModel.js";

import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const enrollInCourse = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;

  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError("Course not found", 404));
  }
  // if (user.role != "student") {
  //   return next(new AppError("only students can enroll in courses", 403));
  // }
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

export const createCheckoutSession = catchAsync(async (req, res, next) => {
  const user = req.user;
  const { courseId } = req.params;

  const course = await Course.findById(courseId);

  if (!course) {
    return next(new AppError("No course found with this id", 404));
  }
  const customer = await stripe.customers.create({
    metadata: {
      userId: user._id,
      email: user.email,
      course: course._id,
    },
  });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    shipping_address_collection: {
      allowed_countries: ["EG", "US"],
    },
    success_url: `${process.env.FRONTEND_URL}/enrollments`,
    cancel_url: `${process.env.FRONTEND_URL}/enrollments`,
    customer: customer.id,
    mode: "payment",
    client_reference_id: courseId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: course.title,
            description: course.description,
            images: [course.image.url]
          },
          unit_amount: course.price * 100,
        },
        quantity: 1,
      },
    ],
  });

  res.status(200).json({ session });
});
