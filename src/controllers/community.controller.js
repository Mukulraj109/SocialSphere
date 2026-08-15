import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Community } from "../models/community.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { Like } from "../models/like.model.js";
import { assertObjectId, requireOwner } from "../utils/ownership.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";

const createCommunityPost = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content?.trim()) {
    throw new ApiError(400, "write something to post");
  }
  if (content.trim().length > 5000) {
    throw new ApiError(400, "post is too long");
  }

  const community = await Community.create({
    content: content.trim().slice(0, 5000),
    owner: req.user._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, community, "community post created successfully"));
});

const getAllCommunityPost = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }
  const { page, limit, skip } = getPagination(req.query);

  const communityPosts = await Community.aggregate([
    { $sort: { createdAt: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit },
    {
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
    },
  ]);
  const total = await Community.countDocuments();

  const likedPostIds = await Like.find({
    likedBy: userId,
    community: { $ne: null },
  }).distinct("community");

  const likedSet = new Set(likedPostIds.map((id) => id.toString()));

  const enrichedPosts = communityPosts.map((post) => ({
    ...post,
    isCommunityLiked: likedSet.has(post._id.toString()),
  }));

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        enrichedPosts,
        "All posts fetched",
        paginationMeta(page, limit, total)
      )
    );
});

const getChannelPost = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  assertObjectId(channelId, "channelId");
  const { page, limit, skip } = getPagination(req.query);
  const match = { owner: new mongoose.Types.ObjectId(channelId) };

  const post = await Community.aggregate([
    { $match: match },
    { $sort: { createdAt: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);
  const total = await Community.countDocuments(match);

  return res
    .status(200)
    .json(
      new ApiResponse(200, post, "post fetched", paginationMeta(page, limit, total))
    );
});

const deletePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  assertObjectId(postId, "postId");

  const existing = await Community.findById(postId);
  if (!existing) {
    throw new ApiError(404, "post not found");
  }
  requireOwner(existing.owner, req.user._id, "You can only delete your own posts");

  const deletedPost = await Community.findByIdAndDelete(postId);
  return res.status(200).json(new ApiResponse(200, deletedPost, "post deleted"));
});

const updatePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  assertObjectId(postId, "postId");

  if (!content?.trim()) {
    throw new ApiError(400, "write something to update");
  }

  const existing = await Community.findById(postId);
  if (!existing) {
    throw new ApiError(404, "post not found");
  }
  requireOwner(existing.owner, req.user._id, "You can only update your own posts");

  const updatedPost = await Community.findByIdAndUpdate(
    postId,
    { $set: { content: content.trim() } },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedPost, "post updated successfully"));
});

export {
  createCommunityPost,
  getAllCommunityPost,
  getChannelPost,
  deletePost,
  updatePost,
};
