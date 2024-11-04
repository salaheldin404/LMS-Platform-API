import mongoose from "mongoose";
const { Schema, model } = mongoose;
const progressSchema = new Schema(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    completedLessons: [
      {
        lessonId: { type: Schema.Types.ObjectId, ref: "Lesson" },
        completionDate: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    unlockedLessons: [
      {
        type: Schema.Types.ObjectId,
        ref: "Lesson",
      },
    ],
    percentageCompleted: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

progressSchema.index({ user: 1, course: 1 }, { unique: true });

const Progress = mongoose.models.Progress || model("Progress", progressSchema);
export default Progress;
