import mongoose from "mongoose";
const { Schema, model } = mongoose;
import slugify from "slugify";

const courseSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: [200, "Title cannot exceed 200 characters"],
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxLength: [200, "Description cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      index: true,
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
    categories: [
      {
        type: String,
        enum: ["programming", "design", "marketing", "business"],
        index: true,
      },
    ],
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
    ratingsSummary: {
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
        index: true,
      },
      totalRatings: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  { timestamps: true, toObject: { virtuals: true }, toJSON: { virtuals: true } }
);

courseSchema.index({ title: "text", description: "text" });
courseSchema.index({ price: 1, "ratingsSummary.averageRating": -1 });

courseSchema.virtual("ratings", {
  ref: "Rating",
  localField: "_id",
  foreignField: "course",
});

courseSchema.virtual("enrollments", {
  ref: "Enrollment",
  localField: "_id",
  foreignField: "course",
});

courseSchema.pre("save", async function (next) {
  if (!this.isModified("title")) return next();

  this.slug = slugify(this.title, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
  next();
});

courseSchema.pre("find", function (next) {
  this.populate({
    path: "ratings",
    select: "rate",
  });
  next();
});
courseSchema.pre("findOne", function (next) {
  this.populate({
    path: "chapters",
    select: "title lessons order",
    options: { sort: { order: 1 } },
    populate: {
      path: "lessons",
      select: "title order",
      options: { sort: { order: 1 } },
    },
  });

  next();
});

const Course = mongoose.models.Course || model("Course", courseSchema);

export default Course;
