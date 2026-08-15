import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import mongoose from "mongoose";
import { assertObjectId, requireOwner } from "../utils/ownership.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";

const ownerLookup = {
  $lookup: {
    from: "users",
    localField: "owner",
    foreignField: "_id",
    as: "owner",
    pipeline: [
      {
        $project: {
          username: 1,
          fullName: 1,
          avatar: 1,
        },
      },
    ],
  },
};

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content, parentComment } = req.body;

  assertObjectId(videoId, "videoId");
  if (!content?.trim()) {
    throw new ApiError(400, "comment cannot be empty");
  }
  if (content.trim().length > 2000) {
    throw new ApiError(400, "comment is too long");
  }

  const { Video } = await import("../models/video.model.js");
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "video not found");
  }

  let parentId = null;
  if (parentComment) {
    assertObjectId(parentComment, "parentComment");
    const parent = await Comment.findById(parentComment);
    if (!parent) {
      throw new ApiError(404, "parent comment not found");
    }
    if (parent.video.toString() !== videoId.toString()) {
      throw new ApiError(400, "parent comment belongs to a different video");
    }
    if (parent.parentComment) {
      throw new ApiError(400, "replies to replies are not allowed");
    }
    parentId = parent._id;
  }

  const comment = await Comment.create({
    content: content.trim(),
    video: videoId,
    owner: req.user._id,
    parentComment: parentId,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, comment, "comment added successfully"));
});

const getAllVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  assertObjectId(videoId, "videoId");
  const { page, limit, skip } = getPagination(req.query);
  const videoObjectId = new mongoose.Types.ObjectId(videoId);
  const rootMatch = {
    video: videoObjectId,
    $or: [{ parentComment: null }, { parentComment: { $exists: false } }],
  };

  const comments = await Comment.aggregate([
    { $match: rootMatch },
    { $sort: { createdAt: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit },
    ownerLookup,
    {
      $lookup: {
        from: "comments",
        let: { rootId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$parentComment", "$$rootId"] },
            },
          },
          { $sort: { createdAt: 1, _id: 1 } },
          ownerLookup,
          {
            $project: {
              content: 1,
              video: 1,
              owner: 1,
              parentComment: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ],
        as: "replies",
      },
    },
    {
      $project: {
        content: 1,
        video: 1,
        owner: 1,
        parentComment: 1,
        replies: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ]);
  const total = await Comment.countDocuments(rootMatch);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        comments,
        "comments fetched successfully",
        paginationMeta(page, limit, total)
      )
    );
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  assertObjectId(commentId, "commentId");

  const existing = await Comment.findById(commentId);
  if (!existing) {
    throw new ApiError(404, "comment not found");
  }
  requireOwner(existing.owner, req.user._id, "You can only delete your own comments");

  const idsToDelete = [existing._id];
  if (!existing.parentComment) {
    const children = await Comment.find({ parentComment: existing._id }).select("_id");
    idsToDelete.push(...children.map((c) => c._id));
  }

  await Like.deleteMany({ comment: { $in: idsToDelete } });
  await Comment.deleteMany({ _id: { $in: idsToDelete } });

  return res
    .status(200)
    .json(new ApiResponse(200, { deleted: idsToDelete.length }, "comment deleted successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  assertObjectId(commentId, "commentId");

  if (!content?.trim()) {
    throw new ApiError(400, "write something to update");
  }
  if (content.trim().length > 2000) {
    throw new ApiError(400, "comment is too long");
  }

  const existing = await Comment.findById(commentId);
  if (!existing) {
    throw new ApiError(404, "comment not found");
  }
  requireOwner(existing.owner, req.user._id, "You can only update your own comments");

  const updatedComment = await Comment.findByIdAndUpdate(
    commentId,
    { $set: { content: content.trim() } },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "comment updated successfully"));
});

export { addComment, getAllVideoComments, deleteComment, updateComment };
