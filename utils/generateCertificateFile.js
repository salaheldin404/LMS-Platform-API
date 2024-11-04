import PDFDocument from "pdfkit";

import fs from "fs";
import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const formatDate = (date) => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const d = new Date(date);
  const month = months[d.getMonth()]; // Get month name
  const day = d.getDate(); // Get day of the month
  const year = d.getFullYear(); // Get full year

  return `${month} ${day}, ${year}`; // Format: "Month Day, Year"
};
const generateCertificateFile = async (
  userName,
  courseTitle,
  completionDate,
  res
) => {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
  });
  const certificateName = `${userName.replace(/\s+/g, "_")}_certificate.pdf`;
  

  const filePath = path.join(
    __dirname,
    "../public",
    "uploads",
    "certificates",
    certificateName
  );
  const imagePath = path.join(
    __dirname,
    "../public",
    "uploads",
    "images",
    "img-2.jpg"
  );
  const writeStream = fs.createWriteStream(filePath);
  writeStream.on("error", (err) => {
    console.log("error", err);
  });
  doc.pipe(writeStream);
  
  doc.image(imagePath, 0, 0, {
    width: doc.page.width,
    height: doc.page.height,
  });

  doc
    .fontSize(20)
    .font("Helvetica")
    .fillColor("white")

    .text(`Certification of Completion`, { align: "center" })
    .moveDown();

  doc
    .fontSize(18)
    .fillColor("white")
    .text(`This certifies that`, { align: "center" })
    .moveDown();

  doc
    .fontSize(33)
    .font("Helvetica-Bold")
    .fillColor("white")
    .text(userName.toUpperCase(), { align: "center" })
    .moveDown();
  doc
    .fontSize(16)
    .font("Helvetica")
    .fillColor("white")
    .text(`has successfully completed the course`, { align: "center" })
    .moveDown();

  doc
    .fontSize(25)
    .font("Helvetica-Bold")
    .fillColor("white")
    .text(courseTitle, { align: "center" })
    .moveDown();

  const formatedDate = formatDate(completionDate);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("white")
    .text(`Date of Completion: ${formatedDate}`, { align: "center" });

  doc.end();

  return new Promise((resolve, reject) => {
    writeStream.on("finish", () => {
      resolve(filePath);
    });
    writeStream.on("error", reject);
  });
};

export default generateCertificateFile;
