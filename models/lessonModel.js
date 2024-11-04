import mongoose from "mongoose";
const { Schema, model } = mongoose;
const lessonSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },

    video: {
      assetId: { type: String, required: true },
      playbackId: { type: String, required: true },
      playbackUrl: { type: String, required: true },
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
    
  },
  { timestamps: true }
);


// Indexing fields
lessonSchema.index({ chapter: 1 }); // Index on chapter
lessonSchema.index({ course: 1 });  // Index on course
lessonSchema.index({ order: 1 });   // Index on order
// Optional compound index if needed
lessonSchema.index({ chapter: 1, order: 1 }); // Compound index on chapter and order

const Lesson = mongoose.models.Lesson || model("Lesson", lessonSchema);
export default Lesson;
