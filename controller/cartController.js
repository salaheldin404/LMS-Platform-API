import Cart from "../models/cartModel.js";
import Course from "../models/courseModel.js";

import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

// Population configuration reused across functions
const cartPopulation = {
  path: "items.course",
  select: "title price image.url instructor slug description",
  populate: {
    path: "instructor",
    select: "username profilePicture.url",
  },
  options: { skipRatingPopulate: true },
};

// Helper function to fetch a populated cart consistently
const getPopulatedCart = async (userId) => {
  return await Cart.findOne({ user: userId })
    .populate(cartPopulation)
    .select("items totalAmount");
};

export const addToCart = catchAsync(async (req, res, next) => {
  const { courseId } = req.body;
  const userId = req.user._id;

  console.log(courseId, "course id add to cart");
  const [course, cart] = await Promise.all([
    Course.findById(courseId),
    Cart.findOne({ user: userId }).select("items totalAmount"),
  ]);

  if (!course) {
    return next(new AppError("No course found with this id", 404));
  }

  if (!cart) {
    // const newCart = new Cart({
    //   user: user._id,
    //   items: [{ course: courseId }],
    // });
    // await newCart.calcTotalAmount();
    // await newCart.save();
    const newCart = createNewCart(userId, [{ course: courseId }]);
    return res.status(200).json({
      status: "success",
      data: newCart,
    });
  } else {
    // Use .equals() for accurate ObjectId comparison
    const courseExists = cart.items.some((item) =>
      item.course.equals(courseId)
    );
    if (courseExists) {
      return next(new AppError("Course already exists in the cart", 400));
    }
    cart.items.push({ course: courseId });
    await cart.calcTotalAmount();
    await cart.save();
  }

  const populatedCart = await getPopulatedCart(userId._id);
  return res.status(201).json({
    status: "success",
    data: populatedCart,
  });
});

export const removeFromCart = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;

  const cart = await Cart.findOne({ user: user._id }).select(
    "items totalAmount"
  );

  if (!cart) {
    return next(new AppError("no cart found with this user", 404));
  }

  const courseExists = cart.items.some((item) => item.course.equals(courseId));
  if (!courseExists) {
    return next(new AppError("Course does not exist in the cart", 400));
  }

  cart.items.pull({ course: courseId });
  await cart.calcTotalAmount();
  await cart.save();

  const populatedCart = await getPopulatedCart(user._id);
  return res.status(200).json({
    status: "success",
    data: populatedCart,
  });
});

export const getUserCart = catchAsync(async (req, res, next) => {
  const user = req.user;

  const cart = await getPopulatedCart(user._id);
  if (!cart) {
    return next(new AppError("No cart found for this user", 404));
  }

  return res.status(200).json({
    status: "success",
    data: cart,
  });
});

export const setCart = catchAsync(async (req, res, next) => {
  const { items } = req.body;
  const userId = req.user._id;

  let cart = await Cart.findOne({ user: user._id }).select("items totalAmount");

  if (!cart) {
    cart = await createNewCart(userId, items);
  } else {
    await updateExistingCart(cart, items);
  }
  return res.status(200).json({
    status: "success",
    data: cart,
  });
});

// Helper function to create new cart
const createNewCart = async (userId, items) => {
  const newCart = new Cart({
    user: userId,
    items,
  });

  await newCart.calcTotalAmount();
  await newCart.save();
  return newCart;
};
// Helper function to update existing cart
const updateExistingCart = async (cart, items) => {
  // Filter items that exist in the new items array
  const itemIds = new Set(items.map((id) => id.toString()));
  cart.items = cart.items.filter((item) => itemIds.has(item.course.toString()));

  await cart.calcTotalAmount();
  await cart.save();
  return cart;
};

export const clearCart = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  cart.items = [];
  cart.totalAmount = 0;
  await cart.save();

  return res.status(200).json({
    status: "success",
    data: {
      cart,
    },
  });
});
