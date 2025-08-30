import Mux from "@mux/mux-node";
import dotenv from "dotenv";
dotenv.config({ path: "./config.env" });

const mux = new Mux(process.env.MUX_TOKEN_ID, process.env.MUX_TOKEN_SECRET);

// Poll for asset readiness with retry logic
const getAssetWithRetry = async (assetId, retries = 10) => {
  for (let i = 0; i < retries; i++) {
    const asset = await mux.video.assets.retrieve(assetId);

    if (asset.status === "ready") {
      return asset;
    }

    // Wait 2 seconds between checks
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Asset processing timeout");
};
export const uploadVideo = async (cloudinary_path) => {
  const upload = await mux.video.assets.create({
    playback_policy: "public",
    input: cloudinary_path,
  });

  const processedAsset = await getAssetWithRetry(upload.id);
  return processedAsset;
};

export const deleteVideo = async (id) => {
  await mux.video.assets.delete(id);
};
