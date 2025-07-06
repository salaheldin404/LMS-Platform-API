import mongoose from "mongoose";
const { Schema, models, model } = mongoose;

const chapterSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      minLength: [3, "Chapter title must be at least 3 characters"],
      trim: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    lessons: [
      {
        type: Schema.Types.ObjectId,
        ref: "Lesson",
      },
    ],
    order: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

chapterSchema.virtual("duration").get(function () {
  const totalDuration = this.lessons.reduce(
    (total, lesson) => total + lesson?.video?.duration,
    0
  );
  return totalDuration;
});

chapterSchema.virtual("formattedDuration").get(function () {
  const totalDuration = this.duration;
  console.log({ totalDuration });

  const hours = Math.floor(totalDuration / 3600);
  const minutes = Math.floor((totalDuration % 3600) / 60);
  return `${hours}h ${minutes}m`;
});

const Chapter = models.Chapter || model("Chapter", chapterSchema);

export default Chapter;
