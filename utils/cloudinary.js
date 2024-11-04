import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import fs from "fs/promises";

dotenv.config({ path: "./config.env" });
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const cloudinaryUploadImage = async (file) => {
  try {
    const options = {
      folder: "courses",
    };
    console.log({ file });
    const result = await cloudinary.uploader.upload(file, options);
    // console.log(result,'result ')
    return result;
  } catch (error) {
    console.log(error, "from cloudinaryUploadImage");
    return null;
  }
};

export const cloudinaryUploadVideo = async (file) => {
  try {
    const options = {
      folder: "courses",
      resource_type: "video",
    };
    const result = await cloudinary.uploader.upload(file, options);
    return result;
  } catch (error) {
    console.log(error, "from cloudinaryUploadVideo");
    return null;
  }
};

export const cloudinaryDeleteVideo = async (publicId) => {
  return await cloudinary.uploader
    .destroy(publicId, {
      invalidate: true,
      resource_type: "video",
    })
    .catch((err) => console.log(err, "from cloudinaryDeleteVideo"));
};

export const cloudinaryDeleteImage = async (publicId) => {
  return await cloudinary.uploader
    .destroy(publicId, {
      invalidate: true,
      resource_type: "image",
    })
    .catch((err) => console.log(err, "from cloudinaryDeleteImage"));
};

export const uploadCertificateToCloudinary = async (filePath) => {
  console.log(filePath);
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      resource_type: "raw",
      folder: "certificates",
      type: "private",
    });

    await fs.unlink(filePath);
    return result;
  } catch (error) {
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      console.log("error", error);
    }
    throw error;
  }
};

export const getSignedCertificateUrl = (publicId) => {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  const expirationTime = currentTime + 60; // Set expiration time for 60 seconds in the future
  console.log(expirationTime)
  return cloudinary.url(publicId, {
    type: "private",
    resource_type: "raw",
    sign_url: true,
    expires_at: expirationTime,
    
  });
};
