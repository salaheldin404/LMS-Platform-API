import mongoose from "mongoose";

const { Schema, model } = mongoose;
const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [
      {
        course: {
          type: Schema.Types.ObjectId,
          ref: "Course",
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

cartSchema.index({ user: 1, "items.course": 1 }, { unique: true });

cartSchema.methods.calcTotalAmount = async function () {
  try {
    const courseIds = this.items.map((item) => item.course);
    if (!courseIds.length) {
      this.totalAmount = 0;
      return this.totalAmount;
    }
    const courses = await mongoose.model("Course").find({
      _id: { $in: courseIds },
    });

    this.totalAmount = courses.reduce((total, curr) => total + curr.price, 0);
    await this.save();
    return this.totalAmount;
  } catch (error) {
    console.error("Error calculating total amount:", error);
    throw new Error("Could not calculate total amount");
  }
};

const Cart = mongoose.models.Cart || model("Cart", cartSchema);

export default Cart;
