import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const captionSchema = new mongoose.Schema(
  {
    language: { type: String, default: "en", trim: true },
    label: { type: String, default: "Captions", trim: true },
    file: { type: String, required: true },
  },
  { _id: false }
);

const videoSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    videoFile: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    captions: {
      type: [captionSchema],
      default: [],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);
videoSchema.index({ isPublished: 1, createdAt: -1 });
videoSchema.index({ owner: 1, isPublished: 1, createdAt: -1 });

export const Video = mongoose.model("Video", videoSchema);
