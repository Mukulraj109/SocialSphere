import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const replacement =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const uri = process.env.MONGODB_URI.replace(/\/$/, "");
await mongoose.connect(`${uri}/${process.env.DB_NAME}`);
const result = await mongoose.connection.db.collection("videos").updateMany(
  { videoFile: { $regex: "commondatastorage\\.googleapis\\.com" } },
  { $set: { videoFile: replacement, duration: 5 } }
);
console.log("replaced google sample urls:", result.modifiedCount);
await mongoose.disconnect();
