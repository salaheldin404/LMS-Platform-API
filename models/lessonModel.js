import mongoose from "mongoose";
const { Schema, model } = mongoose;
const lessonSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      minLength: [3, "Lesson title must be at least 3 characters"],
    },

    video: {
      assetId: {
        type: String,
        required: function () {
          return this.course && this.course.status === "publish";
        },
      },
      playbackId: {
        type: String,
        required: function () {
          return this.course && this.course.status === "publish";
        },
      },
      playbackUrl: {
        type: String,
        required: function () {
          return this.course && this.course.status === "publish";
        },
      },
      duration: {
        type: Number, // Duration in seconds
        required: function () {
          return this.course && this.course.status === "publish";
        },
      },
    },
    chapter: {
      type: Schema.Types.ObjectId,
      ref: "Chapter",
      required: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
    },
    order: {
      type: Number,
      required: true,
    },
    locked: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, toObject: { virtuals: true }, toJSON: { virtuals: true } }
);

// Indexing fields
lessonSchema.index({ chapter: 1 }); // Index on chapter
lessonSchema.index({ course: 1 }); // Index on course
lessonSchema.index({ order: 1 }); // Index on order
// Optional compound index if needed
lessonSchema.index({ chapter: 1, order: 1 }); // Compound index on chapter and order

lessonSchema.virtual("formattedDuration").get(function () {
  const minutes = Math.floor(this.video.duration / 60);
  const seconds = Math.floor(this.video.duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

const Lesson = mongoose.models.Lesson || model("Lesson", lessonSchema);
export default Lesson;
