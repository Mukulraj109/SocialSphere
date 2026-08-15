import mongoose from "mongoose";
import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { assertObjectId } from "../utils/ownership.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  assertObjectId(channelId, "channelId");

  if (channelId.toString() === req.user._id.toString()) {
    throw new ApiError(400, "you cannot subscribe to yourself");
  }

  const channel = await User.findById(channelId);
  if (!channel) {
    throw new ApiError(404, "channel not found");
  }

  const existing = await Subscription.findOne({
    channel: channelId,
    subscriber: req.user._id,
  });

  let isSubscribed;
  if (existing) {
    await Subscription.findByIdAndDelete(existing._id);
    isSubscribed = false;
  } else {
    try {
      await Subscription.create({
        channel: channelId,
        subscriber: req.user._id,
      });
      isSubscribed = true;
    } catch (error) {
      if (error?.code === 11000) {
        isSubscribed = true;
      } else {
        throw error;
      }
    }
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { isSubscribed }, "success"));
});

const getChannelSubscriber = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  assertObjectId(channelId, "channelId");

  if (channelId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only view your own subscribers");
  }

  const channelSubscribers = await Subscription.aggregate([
    { $match: { channel: new mongoose.Types.ObjectId(`${channelId}`) } },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
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
    {
      $project: {
        subscriber: 1,
        createdAt: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, channelSubscribers, "channel's subscribers fetched"));
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  assertObjectId(channelId, "channelId");

  if (channelId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only view your own subscriptions");
  }

  const subscribedChannels = await Subscription.aggregate([
    {
      $match: { subscriber: new mongoose.Types.ObjectId(`${channelId}`) },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
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
    {
      $project: {
        channel: 1,
        createdAt: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, subscribedChannels, "success"));
});

export { toggleSubscription, getChannelSubscriber, getSubscribedChannels };
