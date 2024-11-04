import mongoose from "mongoose";
const { Schema, model } = mongoose;
const enrollmentSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    progress: {
      type: Schema.Types.ObjectId,
      ref: "Progress",
    },
  },
  { timestamps: true }
);

const Enrollment =
  mongoose.models.Enrollment || model("Enrollment", enrollmentSchema);

export default Enrollment;
