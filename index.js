import dotenv from "dotenv";
import connectDB from "./utils/connectDB.js";
import app from "./app.js";
dotenv.config({ path: "./config.env" });

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

startServer();
