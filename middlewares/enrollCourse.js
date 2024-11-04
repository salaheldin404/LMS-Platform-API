import Enrollment from "../models/enrollmentModel.js";

export const checkEnrolled = async (req, res, next) => {
  const { courseId } = req.params;
  const user = req.user;

  try {
    const enroll = await Enrollment.findOne({
      user: user._id,
      course: courseId,
    });
    if (!enroll && !user.createdCourses.includes(courseId)) {
      return res.status(403).json({ message: "unauthorized" });
    }
    next();
  } catch (error) {
    console.log(error, "from checkEnrolled");
    return res.status(500).json({
      message: "Error checking enrollment, please try again",
      error: error.message,
    });
  }
};
