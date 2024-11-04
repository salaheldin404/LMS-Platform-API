import Lesson from "../models/lessonModel.js";

const checkPermission = async (req, res, next) => {
  const { lessonId } = req.params;
  const user = req.user;
  try {
    const lesson = await Lesson.findById(lessonId).select('course')
    if (!lesson) {
      return res.status(404).json({ message: "No lesson found with this ID" });
    }
    const courseId = lesson.course.toString()
    if (
      !user.createdCourses?.includes(courseId) &&
      !user.enrolledCourses?.includes(courseId) &&
      !user.role === "admin"
    ) {
      return res
        .status(403)
        .json({ message: "You are not authorized to view this lesson" });
    }
    next();
  } catch (error) {
    console.log(error, "from get lesson");
    return res.status(500).json({
      message: "Error get lesson, please try again",
      error: error.message,
    });
  }
};

export default checkPermission