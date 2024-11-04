import Course from "../models/courseModel.js";
import Chapter from "../models/chapterModel.js";
const adminProtect = async (req, res, next) => {
  const user = req.user;
  const { chapterId, courseId } = req.params;

  if (user.role == "admin") {
    return next();
  }

  if (courseId) {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "no course found with this id" });
    }
    if (!course.instructor.equals(user._id)) {
      return res.status(403).json({ message: "unauthorized" });
    }
  }
  if (chapterId) {
    const chapter = await Chapter.findById(chapterId).populate(
      "course",
      "instructor"
    );
    if (!chapter) {
      return res.status(404).json({ message: "no course found with this id " });
    }
    if (!chapter.course.instructor.equals(user._id)) {
      return res.status(403).json({ message: "unauthorized" });
    }
  }

  next();
};

export default adminProtect;
