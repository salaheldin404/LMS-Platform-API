import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, path.join(__dirname, "../public/uploads/images"));
    } else if (file.mimetype.startsWith("video/")) {
      cb(null, path.join(__dirname, "../public/uploads/videos"));
    } else {
      cb(new Error("Unsupported file type"), false);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // console.log(file.fieldname, file.originalname);
    cb(
      null,
      `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`
    );
  },
});
const multerFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("video/")
    // file.mimetype.startsWith("application/pdf")
  ) {
    console.log({ file }, "multer");
    cb(null, true);
  } else {
    cb(new Error("Only image, video, and PDF files are allowed!"), false);
  }
};
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

export default upload;
