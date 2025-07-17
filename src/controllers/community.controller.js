import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Community } from "../models/community.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { Like } from "../models/like.model.js";


const createCommunityPost = asyncHandler(async (req, res) => {
    const { content } = req.body;

    if (!content) {
        throw new ApiError(400, "write something to post")
    }

    const community = await Community.create(
        {
            content,
            owner: req.user._id
        }
    )

    if (!community) {
        throw new ApiError(400, "error while creating community post")
    }

    return res.status(200).json(new ApiResponse(200, community, "community post created successfully"));
})

const getAllCommunityPost = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  // Fetch all posts with owner populated
  const communityPosts = await Community.aggregate([
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
              avatar: 1
            }
          }
        ]
      }
    },
    {
      $sort: { createdAt: -1 }
    }
  ]);

  if (!communityPosts) {
    throw new ApiError(400, "Error while fetching posts");
  }

  // Get all post IDs liked by current user
  const likedPostIds = await Like.find({
    likedBy: userId,
    community: { $ne: null }
  }).distinct("community");

  const likedSet = new Set(likedPostIds.map(id => id.toString()));

  // Add `isCommunityLiked` field
  const enrichedPosts = communityPosts.map(post => ({
    ...post,
    isCommunityLiked: likedSet.has(post._id.toString())
  }));

  return res.status(200).json(new ApiResponse(200, enrichedPosts, "All posts fetched"));
});

const getChannelPost = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!channelId) {
        throw new ApiError(400, "channel id is missing")
    }

    const post = await Community.aggregate([
        {
            $match: { owner: new mongoose.Types.ObjectId(`${channelId}`) }
        }
    ])

    if (!post) {
        throw new ApiError(404, "post not found")
    }

    return res.status(200).json(new ApiResponse(200, post, "post fetched"));

})

const deletePost = asyncHandler(async (req, res) => {
    const { postId } = req.params;

    const deletedPost = await Community.findByIdAndDelete(postId)

    if (!deletedPost) {
        throw new ApiError(400, "error while deleting post")
    }

    return res.status(200).json(new ApiResponse(200, deletedPost, "post deleted"))
})

const updatePost = asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { content } = req.body;
    if (!postId) {
        throw new ApiError(400, "post id is missing")
    }

    if (!content) {
        throw new ApiError(400, "write something to update")
    }

    const updatedPost = await Community.findByIdAndUpdate(
        postId,
        {
            $set: {
                content
            }
        },
        {
            new: true
        }
    )

    if (!updatedPost) {
        throw new ApiError(404, "post not found, update failed")
    }

    return res.status(200).json(new ApiResponse(200, updatedPost, "post updated successfully"))
})

export { createCommunityPost, getAllCommunityPost, getChannelPost, deletePost, updatePost }