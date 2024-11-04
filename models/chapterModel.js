import mongoose from "mongoose";
const { Schema, models, model } = mongoose;

const chapterSchema = new Schema({
  title: {
    type: String,
    required: true,
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
});

const Chapter = models.Chapter || model("Chapter", chapterSchema);

export default Chapter;
