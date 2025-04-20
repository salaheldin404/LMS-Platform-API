import mongoose from "mongoose";
const { Schema, model } = mongoose;
import slugify from "slugify";
import AppError from "../utils/appError.js";

const courseSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: [60, "Title cannot exceed 60 characters"],
      index: true,
    },
    subtitle: {
      type: String,
      trim: true,
      maxLength: [120, "Subtitle cannot exceed 120 characters"],
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    description: {
      type: String,
      required: function () {
        return this.status === "published";
      },
      trim: true,
      minLength: [20, "Description must be at least 20 characters"],
      maxLength: [1000, "Description cannot exceed 1000 characters"],
    },
    willLearn: [
      {
        type: String,
        minLength: [1, "Learning field cannot be empty"],
        maxLength: [120, "Learning field cannot exceed 120 characters"],
      },
    ],
    requirements: [
      {
        type: String,
        minLength: [1, "Requirement field cannot be empty"],
        maxLength: [120, "Requirement cannot exceed 120 characters"],
      },
    ],
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

    chapters: {
      type: [{ type: Schema.Types.ObjectId, ref: "Chapter" }],
      validate: {
        validator: function (v) {
          return this.status !== "published" || (v && v.length > 0);
        },
        message: "At least one chapter is required when published.",
      },
    },
    students: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    category: {
      type: String,
      enum: ["programming", "design", "marketing", "business"],
      index: true,
      required: function () {
        return this.status === "published";
      },
    },

    enrollmentsCount: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
    },
    free: {
      type: Boolean,
      default: false,
    },
    image: {
      type: Object,
      default: {
        public_id: null,
        url: null,
      },
      required: function () {
        return this.status === "published";
      },
    },
    level: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      required: function () {
        return this.status === "published";
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

// courseSchema.virtual('instructor')

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

// Auto-set free status
courseSchema.pre("save", function (next) {
  if (this.isModified("price")) {
    this.free = this.price === 0;
  }
  next();
});

courseSchema.pre("save", async function (next) {
  if (this.status === "published") {
    // Populate chapters and their lessons
    await this.populate({
      path: "chapters",
      populate: {
        path: "lessons",
      },
    });

    // Check each chapter for at least one lesson
    for (const chapter of this.chapters) {
      if (!chapter.lessons || chapter.lessons.length === 0) {
        return next(
          new AppError(
            `Chapter "${chapter.title}" must have at least one lesson when the course is published.`,
            400
          )
        );
        // throw new Error(
        //   `Chapter "${chapter.title}" must have at least one lesson when the course is published.`
        // );
      }

      // Iterate through each lesson in the chapter
      for (const lesson of chapter.lessons) {
        // Check if the lesson exists (in case a referenced lesson was deleted)
        if (!lesson) {
          return next(
            new AppError(
              `A referenced lesson in chapter "${chapter.title}" is missing.`,
              400
            )
          );
          // throw new Error(
          //   `A referenced lesson in chapter "${chapter.title}" is missing.`
          // );
        }

        // Check if the lesson has a video asset with all required fields
        if (
          !lesson.video ||
          !lesson.video.assetId ||
          !lesson.video.playbackId ||
          !lesson.video.playbackUrl
        ) {
          return next(
            new AppError(
              `Lesson "${lesson.title}" in chapter "${chapter.title}" is missing a video asset.`,
              400
            )
          );
          // throw new Error(
          //   `Lesson "${lesson.title}" in chapter "${chapter.title}" is missing a video asset.`
          // );
        }
      }
    }
  }
});

// courseSchema.pre("find", function (next) {
//   this.populate({
//     path: "ratings",
//     select: "rate comment user createdAt",
//   });
//   next();
// });
courseSchema.pre("findOne", function (next) {
  this.populate({
    path: "chapters",
    select: "title lessons order ",
    options: { sort: { order: 1 } },
    populate: {
      path: "lessons",
      select: "title order video locked",
      options: { sort: { order: 1 } },
    },
  });

  next();
});

courseSchema.statics.getInstructorAverageRating = async function (
  instructorId
) {
  const result = await this.aggregate([
    { $match: { instructor: instructorId } },

    {
      $group: {
        _id: null,
        totalRatingsSum: { $sum: "$ratingsSummary.totalRatings" },
        weightedRatingSum: {
          $sum: {
            $multiply: [
              "$ratingsSummary.averageRating",
              "$ratingsSummary.totalRatings",
            ],
          },
        },
      },
    },
  ]);

  if (result.length === 0 || result[0].totalRatingsSum === 0) {
    return 0;
  }

  const averageRatings =
    result[0].weightedRatingSum / result[0].totalRatingsSum;
  const totalRatings = result[0].totalRatingsSum;

  return { averageRatings, totalRatings };
};

const Course = mongoose.models.Course || model("Course", courseSchema);

export default Course;
