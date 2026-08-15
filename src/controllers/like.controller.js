import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Community } from "../models/community.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { assertObjectId } from "../utils/ownership.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";

async function toggleLike({ filter, createPayload }) {
  const existing = await Like.findOne(filter);
  if (existing) {
    await Like.findByIdAndDelete(existing._id);
    return false;
  }

  try {
    await Like.create(createPayload);
    return true;
  } catch (error) {
    if (error?.code === 11000) {
      return true;
    }
    throw error;
  }
}

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  assertObjectId(videoId, "videoId");

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "video not found");
  }

  const isVideoLiked = await toggleLike({
    filter: { video: videoId, likedBy: req.user._id },
    createPayload: { video: videoId, likedBy: req.user._id },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { isVideoLiked }, "video liked"));
});

const toggelCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  assertObjectId(commentId, "commentId");

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "comment not found");
  }

  const isCommentLiked = await toggleLike({
    filter: { comment: commentId, likedBy: req.user._id },
    createPayload: { comment: commentId, likedBy: req.user._id },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { isCommentLiked }, "like status"));
});

const toggleCommunityPostLike = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  assertObjectId(postId, "postId");

  const post = await Community.findById(postId);
  if (!post) {
    throw new ApiError(404, "post not found");
  }

  const isCommunityLiked = await toggleLike({
    filter: { community: postId, likedBy: req.user._id },
    createPayload: { community: postId, likedBy: req.user._id },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { isCommunityLiked }, "community like status"));
});

const getAllLikedVideos = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {
    likedBy: req.user._id,
    video: { $ne: null },
  };
  const [likedVideos, total] = await Promise.all([
    Like.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "video",
        select: "title description thumbnail duration views owner createdAt",
        populate: { path: "owner", select: "username fullName avatar" },
      }),
    Like.countDocuments(filter),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      likedVideos,
      "liked video fetched",
      paginationMeta(page, limit, total)
    )
  );
});

export {
  toggleVideoLike,
  toggelCommentLike,
  toggleCommunityPostLike,
  getAllLikedVideos,
};
