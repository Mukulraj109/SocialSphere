import { User } from "../models/user.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary, destroyOnCloudinary, isCloudinaryUrl } from "../utils/cloudinary.js";
import { cleanupUploadedFiles } from "../middlewares/multer.middleware.js";
import JWT from "jsonwebtoken";
import mongoose from "mongoose";
import { cookieOptions } from "../config/env.js";
import { sanitizeUser } from "../utils/ownership.js";

const generateAccessAndRefreshToken = async (userOrId) => {
  try {
    const user =
      typeof userOrId === "object" && userOrId?._id
        ? userOrId
        : await User.findById(userOrId);
    if (!user) throw new ApiError(404, "user not found");
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch {
    throw new ApiError(500, "error while creating tokens");
  }
};

const register = asyncHandler(async (req, res) => {
  const { username, password, email, fullName } = req.body;

  if ([username, password, email, fullName].some((item) => !item?.trim())) {
    cleanupUploadedFiles(req);
    throw new ApiError(400, "all fields are required");
  }

  if (password.length < 8) {
    cleanupUploadedFiles(req);
    throw new ApiError(400, "password must be at least 8 characters");
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email.trim())) {
    cleanupUploadedFiles(req);
    throw new ApiError(400, "invalid email address");
  }

  const existedUser = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }],
  });

  if (existedUser) {
    cleanupUploadedFiles(req);
    throw new ApiError(400, "email or username already exist");
  }

  const avatarFilePath = req.files?.avatar?.[0]?.path;
  const coverImagePath = req.files?.coverImage?.[0]?.path;

  const avatar = await uploadOnCloudinary(avatarFilePath);
  const coverImage = await uploadOnCloudinary(coverImagePath);

  const user = await User.create({
    username: username.toLowerCase(),
    password,
    email: email.toLowerCase(),
    fullName,
    avatar:
      avatar?.url ||
      "https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg?auto=compress&cs=tinysrgb&w=200",
    coverImage: coverImage?.url || "",
  });

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user);
  const createdUser = user.toObject();
  delete createdUser.password;
  delete createdUser.refreshToken;

  return res
    .status(201)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(201, createdUser, "user registered successfully"));
});

const login = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }
  if (!password) {
    throw new ApiError(400, "password is required");
  }

  const user = await User.findOne({
    $or: [{ email: email?.toLowerCase() }, { username: username?.toLowerCase() }],
  });

  if (!user || !(await user.isPasswordCorrect(password))) {
    throw new ApiError(401, "invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user);
  const loggedInUser = user.toObject();
  delete loggedInUser.password;
  delete loggedInUser.refreshToken;

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, loggedInUser, "user logged in successfully"));
});

const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $unset: { refreshToken: 1 } },
    { new: true }
  );

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized user");
  }

  try {
    const decodedToken = JWT.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "user does not exist");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "refresh token is expired or used");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user);

    return res
      .status(200)
      .cookie("accessToken", accessToken, cookieOptions)
      .cookie("refreshToken", refreshToken, cookieOptions)
      .json(new ApiResponse(200, { ok: true }, "access token refreshed successfully"));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "all fields are required");
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, "password must be at least 8 characters");
  }

  const user = await User.findById(req.user._id);
  const isPasswordValid = await user.isPasswordCorrect(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError(400, "current password is incorrect");
  }

  user.password = newPassword;
  user.refreshToken = undefined;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "password updated successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched"));
});

const updateUserDetail = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName && !email) {
    throw new ApiError(400, "enter fields to update");
  }

  const updates = {};
  if (fullName) updates.fullName = fullName;
  if (email) {
    const taken = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: req.user._id },
    });
    if (taken) {
      throw new ApiError(409, "email already in use");
    }
    updates.email = email.toLowerCase();
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true }
  ).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(500, "error while updating User details");
  }

  return res.status(200).json(new ApiResponse(200, user, "account updated"));
});

const updateAvatar = asyncHandler(async (req, res) => {
  const avatarFilePath = req.file?.path;
  if (!avatarFilePath) {
    throw new ApiError(400, "upload avatar picture to update");
  }

  const previous = await User.findById(req.user?._id).select("avatar");
  const avatar = await uploadOnCloudinary(avatarFilePath);
  if (!avatar?.url) {
    throw new ApiError(500, "avatar upload failed");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { avatar: avatar.url } },
    { new: true }
  ).select("-password -refreshToken");

  if (previous?.avatar && isCloudinaryUrl(previous.avatar) && previous.avatar !== avatar.url) {
    await destroyOnCloudinary(previous.avatar, "image");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "avatar updated successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImagePath = req.file?.path;
  if (!coverImagePath) {
    throw new ApiError(400, "upload cover image to update");
  }

  const previous = await User.findById(req.user?._id).select("coverImage");
  const coverImage = await uploadOnCloudinary(coverImagePath);
  if (!coverImage?.url) {
    throw new ApiError(500, "error while uploading cover image");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { coverImage: coverImage.url } },
    { new: true }
  ).select("-password -refreshToken");

  if (
    previous?.coverImage &&
    isCloudinaryUrl(previous.coverImage) &&
    previous.coverImage !== coverImage.url
  ) {
    await destroyOnCloudinary(previous.coverImage, "image");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image uploaded successfully"));
});

const getUserChannelDetails = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username) {
    throw new ApiError(400, "Username is required");
  }

  const channel = await User.aggregate([
    { $match: { username: username.toLowerCase() } },
    {
      $lookup: {
        from: "subscriptions",
        let: { userId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$subscriber", "$$userId"] } } },
          { $count: "count" },
        ],
        as: "subscribedChannelCount",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        let: { userId: "$_id", viewerId: req.user?._id || null },
        pipeline: [
          { $match: { $expr: { $eq: ["$channel", "$$userId"] } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              isSubscribed: {
                $max: { $eq: ["$subscriber", "$$viewerId"] },
              },
            },
          },
        ],
        as: "subscriberStats",
      },
    },
    {
      $addFields: {
        subscribersCount: { $ifNull: [{ $first: "$subscriberStats.count" }, 0] },
        subscribedChannelCount: { $ifNull: [{ $first: "$subscribedChannelCount.count" }, 0] },
        isSubscribed: { $ifNull: [{ $first: "$subscriberStats.isSubscribed" }, false] },
      },
    },
    {
      $project: {
        username: 1,
        fullName: 1,
        avatar: 1,
        coverImage: 1,
        isSubscribed: 1,
        subscribersCount: 1,
        subscribedChannelCount: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "channel does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "user channel fetched"));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const history = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.user?._id) } },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistoryDetails",
        pipeline: [
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
                    avatar: 1,
                    fullName: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: { $first: "$owner" },
            },
          },
        ],
      },
    },
    {
      $set: {
        watchHistory: {
          $map: {
            input: "$watchHistory",
            as: "videoId",
            in: {
              $first: {
                $filter: {
                  input: "$watchHistoryDetails",
                  as: "video",
                  cond: { $eq: ["$$video._id", "$$videoId"] },
                },
              },
            },
          },
        },
      },
    },
    {
      $set: {
        watchHistory: {
          $filter: {
            input: "$watchHistory",
            as: "video",
            cond: { $ne: ["$$video", null] },
          },
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        history[0]?.watchHistory || [],
        "watch history fetched"
      )
    );
});

export {
  register,
  login,
  generateAccessAndRefreshToken,
  logout,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateUserDetail,
  updateAvatar,
  updateCoverImage,
  getUserChannelDetails,
  getWatchHistory,
  sanitizeUser,
};
