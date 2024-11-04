import mongoose from "mongoose";
const { Schema, model } = mongoose;
const courseSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  
    chapters: [
      {
        type: Schema.Types.ObjectId,
        ref: "Chapter",
      },
    ],
    students: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    categories: [{ type: String }],
    enrollmentsCount: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: true,
    },
    image: {
      type: Object,
      default: {
        public_id: null,
        url: null,
      },
    },
    ratings: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        rate: Number,
      },
    ],
    averageRating: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

courseSchema.index({ price: 1, title: 1, averageRating: 1 });

const Course = mongoose.models.Course || model("Course", courseSchema);

export default Course;
