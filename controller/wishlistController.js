import Wishlist from "../models/wishlistModel.js";

import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import Course from "../models/courseModel.js";
const wishlistPopulation = {
  path: "items.course",

  populate: {
    path: "instructor",
    select: "username profilePicture.url",
  },
  // options: { skipRatingPopulate: true },
};

export const getWishlist = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const wishlist = await Wishlist.findOne({ user: userId }).populate(
    wishlistPopulation
  );
  res.status(200).json({ data: wishlist });
});

export const addToWishlist = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const userId = req.user._id;
  const course = await Course.findById(courseId);
  if (!course) {
    return next(new AppError("No course found with this id", 404));
  }

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    const newWishlist = new Wishlist({
      user: userId,
      items: [{ course: courseId }],
    });
    await newWishlist.save();
    return res.status(200).json({
      status: "success",
      data: newWishlist,
    });
  } else {
    const courseExists = wishlist.items.some((item) =>
      item.course.equals(courseId)
    );
    if (!courseExists) {
      wishlist.items.push({ course: courseId });
      await wishlist.save();
    }
  }

  return res.status(201).json({
    status: "success",
    data: wishlist,
  });
});

export const removeFromWishlist = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    return next(new AppError("no wishlist found with this user", 404));
  }

  const courseExists = wishlist.items.some((item) =>
    item.course.equals(courseId)
  );
  if (!courseExists) {
    return next(new AppError("Course does not exist in the wishlist", 400));
  }

  wishlist.items.pull({ course: courseId });
  await wishlist.save();

  return res.status(204).json({
    status: "success",
    data: null,
  });
});
