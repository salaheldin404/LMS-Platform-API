import Lesson from "../models/lessonModel.js";
import Chapter from "../models/chapterModel.js";
export const protectLesson = async (req, res, next) => {
  const user = req.user;
  const { lessonId, courseId } = req.params;
  console.log(user);
  console.log({ lessonId, courseId });
  try {
    let course;
    if (lessonId) {
      console.log("checking");
      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        return res
          .status(404)
          .json({ message: "no lesson found with this id" });
      }
      console.log(lesson, "lesson");
      course = lesson.course;
    } else if (courseId) {
      course = courseId;
    }
    console.log(course, "courseid");
    const isAuthorized =
      user.createdCourses.some((id) => id.equals(course)) ||
      user.role === "admin";

    if (!isAuthorized) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const protectChapter = async (req, res, next) => {
  const user = req.user;
  const { chapterId, courseId } = req.params;

  try {
    let course;
    if (chapterId) {
      const chapter = await Chapter.findById(chapterId);
      if (!chapter) {
        return res
          .status(404)
          .json({ message: "no chapter found with this id" });
      }
      course = chapter.course;
      // console.log('course from chapter',{course,chapter,chapterId})
    } else if (courseId) {
      course = courseId;
      console.log(course,'from course id')
    }
    // console.log(course,'course')
    const isAuthorized =
      user.createdCourses.some((id) => id.equals(course)) ||
      user.role === "admin";
    if (!isAuthorized) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
