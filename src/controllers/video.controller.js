import asyncHandler from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary, destroyOnCloudinary } from "../utils/cloudinary.js";
import { cleanupUploadedFiles } from "../middlewares/multer.middleware.js";
import { Comment } from "../models/comment.model.js";
import { Playlist } from "../models/playlist.model.js";
import {
  assertObjectId,
  requireOwner,
  ALLOWED_VIDEO_SORT,
} from "../utils/ownership.js";

const ownerProjection = {
  path: "owner",
  select: "username fullName avatar",
};

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const videoQuery = { isPublished: true };

  if (userId) {
    assertObjectId(userId, "userId");
    videoQuery.owner = userId;
    if (req.user?._id?.toString() === userId.toString()) {
      delete videoQuery.isPublished;
    }
  }

  if (query) {
    const escaped = String(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 100);
    videoQuery.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } },
    ];
  }

  const sortField = ALLOWED_VIDEO_SORT.has(sortBy) ? sortBy : "createdAt";
  const direction = sortType === "asc" ? 1 : -1;
  const sortCriteria = { [sortField]: direction, _id: direction };

  const [videos, total] = await Promise.all([
    Video.find(videoQuery)
      .populate(ownerProjection)
      .sort(sortCriteria)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Video.countDocuments(videoQuery),
  ]);

  return res.status(200).json(
    new ApiResponse(200, videos, "videos fetched", {
      page: pageNum,
      limit: limitNum,
      total,
      hasMore: pageNum * limitNum < total,
    })
  );
});

const publishVideo = asyncHandler(async (req, res) => {
  const { title, description, captionLanguage, captionLabel } = req.body;
  const videoLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
  const captionsLocalPath = req.files?.captions?.[0]?.path;

  if (!title?.trim()) {
    cleanupUploadedFiles(req);
    throw new ApiError(400, "title is missing");
  }
  if (!thumbnailLocalPath) {
    cleanupUploadedFiles(req);
    throw new ApiError(400, "thumbnail not uploaded");
  }
  if (!videoLocalPath) {
    cleanupUploadedFiles(req);
    throw new ApiError(400, "video is missing");
  }

  const publishedThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
  if (!publishedThumbnail?.url) {
    cleanupUploadedFiles(req);
    throw new ApiError(500, "error while uploading thumbnail");
  }

  const publishedVideo = await uploadOnCloudinary(videoLocalPath);
  if (!publishedVideo?.url) {
    await destroyOnCloudinary(publishedThumbnail.url, "image");
    cleanupUploadedFiles(req);
    throw new ApiError(500, "error while uploading video");
  }

  let captions = [];
  if (captionsLocalPath) {
    const publishedCaptions = await uploadOnCloudinary(captionsLocalPath, {
      resourceType: "raw",
    });
    if (!publishedCaptions?.url && !publishedCaptions?.secure_url) {
      await Promise.all([
        destroyOnCloudinary(publishedThumbnail.url, "image"),
        destroyOnCloudinary(publishedVideo.url, "video"),
      ]);
      cleanupUploadedFiles(req);
      throw new ApiError(500, "error while uploading captions");
    }
    captions = [
      {
        language: (captionLanguage || "en").toString().slice(0, 16),
        label: (captionLabel || "Captions").toString().slice(0, 64),
        file: publishedCaptions.secure_url || publishedCaptions.url,
      },
    ];
  }

  const video = await Video.create({
    title: title.trim(),
    description: description || "",
    thumbnail: publishedThumbnail.url,
    videoFile: publishedVideo.url,
    duration: publishedVideo.duration || 0,
    owner: req.user._id,
    isPublished: true,
    captions,
  });

  await video.populate(ownerProjection);

  return res
    .status(200)
    .json(new ApiResponse(200, video, "video uploaded successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  assertObjectId(videoId, "videoId");

  const video = await Video.findById(videoId).populate(ownerProjection);
  if (!video) {
    throw new ApiError(404, "video not found");
  }

  const isOwner =
    req.user && video.owner?._id?.toString() === req.user._id.toString();
  if (!video.isPublished && !isOwner) {
    throw new ApiError(404, "video not found");
  }

  let isLiked = false;
  let isSubscribed = false;
  const likesCount = await Like.countDocuments({ video: videoId });

  if (req.user) {
    const channelId = video.owner?._id || video.owner;
    const [like, sub] = await Promise.all([
      Like.findOne({ video: videoId, likedBy: req.user._id }),
      channelId
        ? Subscription.findOne({ channel: channelId, subscriber: req.user._id })
        : null,
    ]);
    isLiked = Boolean(like);
    isSubscribed = Boolean(sub);
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      { ...video.toObject(), isLiked, isSubscribed, likesCount },
      "video fetched"
    )
  );
});

const recordVideoView = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  assertObjectId(videoId, "videoId");

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "video not found");
  }

  const isOwner =
    req.user && video.owner?.toString() === req.user._id.toString();
  if (!video.isPublished && !isOwner) {
    throw new ApiError(404, "video not found");
  }

  const updated = await Video.findByIdAndUpdate(
    videoId,
    { $inc: { views: 1 } },
    { new: true }
  ).populate(ownerProjection);

  if (req.user) {
    try {
      await User.findByIdAndUpdate(req.user._id, [
        {
          $set: {
            watchHistory: {
              $slice: [
                {
                  $concatArrays: [
                    [updated._id],
                    {
                      $filter: {
                        input: { $ifNull: ["$watchHistory", []] },
                        as: "item",
                        cond: { $ne: ["$$item", updated._id] },
                      },
                    },
                  ],
                },
                50,
              ],
            },
          },
        },
      ]);
    } catch {
      /* history tracking must not block playback */
    }
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { views: updated.views }, "view recorded"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  assertObjectId(videoId, "videoId");

  const existing = await Video.findById(videoId);
  if (!existing) {
    throw new ApiError(404, "video not found");
  }
  requireOwner(existing.owner, req.user._id, "You can only update your own videos");

  const updates = {};
  if (title?.trim()) updates.title = title.trim();
  if (typeof description === "string") updates.description = description;

  const previousThumbnail = existing.thumbnail;
  const thumbnailLocalPath = req.file?.path;
  if (thumbnailLocalPath) {
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnail) {
      throw new ApiError(400, "thumbnail upload failed");
    }
    updates.thumbnail = thumbnail.url;
  }

  if (!Object.keys(updates).length) {
    throw new ApiError(400, "nothing to update");
  }

  const video = await Video.findByIdAndUpdate(
    videoId,
    { $set: updates },
    { new: true }
  ).populate(ownerProjection);

  if (updates.thumbnail && previousThumbnail && previousThumbnail !== updates.thumbnail) {
    await destroyOnCloudinary(previousThumbnail, "image");
  }

  return res.status(200).json(new ApiResponse(200, video, "updated"));
});

const upsertVideoCaptions = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { captionLanguage, captionLabel } = req.body;
  assertObjectId(videoId, "videoId");

  const existing = await Video.findById(videoId);
  if (!existing) {
    cleanupUploadedFiles(req);
    throw new ApiError(404, "video not found");
  }
  requireOwner(existing.owner, req.user._id, "You can only update your own videos");

  const captionsPath = req.file?.path;
  if (!captionsPath) {
    throw new ApiError(400, "captions file is required");
  }

  const uploaded = await uploadOnCloudinary(captionsPath, { resourceType: "raw" });
  if (!uploaded?.url && !uploaded?.secure_url) {
    throw new ApiError(500, "captions upload failed");
  }

  const previousFiles = (existing.captions || []).map((c) => c.file);
  const captions = [
    {
      language: (captionLanguage || "en").toString().slice(0, 16),
      label: (captionLabel || "Captions").toString().slice(0, 64),
      file: uploaded.secure_url || uploaded.url,
    },
  ];

  const video = await Video.findByIdAndUpdate(
    videoId,
    { $set: { captions } },
    { new: true }
  ).populate(ownerProjection);

  await Promise.all(
    previousFiles.map((url) => destroyOnCloudinary(url, "raw"))
  );

  return res
    .status(200)
    .json(new ApiResponse(200, video, "captions updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  assertObjectId(videoId, "videoId");

  const existing = await Video.findById(videoId);
  if (!existing) {
    throw new ApiError(404, "video not found");
  }
  requireOwner(existing.owner, req.user._id, "You can only delete your own videos");

  await Promise.all([
    Like.deleteMany({ video: videoId }),
    Comment.deleteMany({ video: videoId }),
    Playlist.updateMany({}, { $pull: { video: videoId } }),
    User.updateMany({}, { $pull: { watchHistory: videoId } }),
  ]);

  await Video.findByIdAndDelete(videoId);

  await Promise.all([
    destroyOnCloudinary(existing.thumbnail, "image"),
    destroyOnCloudinary(existing.videoFile, "video"),
    ...(existing.captions || []).map((c) => destroyOnCloudinary(c.file, "raw")),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "video deleted successfully"));
});

const toggleIsPublished = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  assertObjectId(videoId, "videoId");

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "video not found");
  }
  requireOwner(video.owner, req.user._id, "You can only publish your own videos");

  video.isPublished = !video.isPublished;
  await video.save();

  return res.json(new ApiResponse(200, video, "updated"));
});

export {
  getAllVideos,
  publishVideo,
  getVideoById,
  recordVideoView,
  updateVideo,
  upsertVideoCaptions,
  deleteVideo,
  toggleIsPublished,
};
