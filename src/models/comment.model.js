import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = Schema(
  {
    content: {
      type: String,
      required: true,
    },
    video: {
      type: Schema.Types.ObjectId,
      ref: "Video",
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.plugin(mongooseAggregatePaginate);
commentSchema.index({ video: 1, createdAt: -1 });
commentSchema.index({ video: 1, parentComment: 1, createdAt: 1 });

export const Comment = mongoose.model("Comment", commentSchema);
