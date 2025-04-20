import mongoose from "mongoose";

const { Schema, model } = mongoose;

const ratingSchema = new Schema(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: String,
  },
  { timestamps: true }
);

ratingSchema.index({ course: 1, user: 1 }, { unique: true });
ratingSchema.index({ course: 1, rate: 1 });
ratingSchema.index({ course: 1 });

const Rating = mongoose.models.Rating || model("Rating", ratingSchema);

export default Rating;
