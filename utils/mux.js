import Mux from "@mux/mux-node";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config({ path: "./config.env" });

const mux = new Mux(process.env.MUX_TOKEN_ID, process.env.MUX_TOKEN_SECRET);

export const uploadVideo = async (cloudinary_path) => {
  // const file = fs.createReadStream(path);
  const upload = await mux.video.assets.create({
    playback_policy: "public",
    input: cloudinary_path,
  });

  console.log({ upload });
  return upload;
};

export const deleteVideo = async (id) => {
  await mux.video.assets.delete(id);
};
