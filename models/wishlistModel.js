import mongoose from "mongoose";
const { Schema, model } = mongoose;

const wishlistSchema = new Schema(
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
  },
  { timestamps: true }
);

const Wishlist = mongoose.models.Wishlist || model("Wishlist", wishlistSchema);

export default Wishlist;
