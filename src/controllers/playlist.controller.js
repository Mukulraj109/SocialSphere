import mongoose from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { assertObjectId, requireOwner } from "../utils/ownership.js";
import { getPagination, paginationMeta } from "../utils/pagination.js";

function videoLookupFor(requesterId) {
  return {
    from: "videos",
    localField: "video",
    foreignField: "_id",
    as: "video",
    pipeline: [
      {
        $match: {
          $or: [
            { isPublished: true },
            ...(requesterId
              ? [{ owner: new mongoose.Types.ObjectId(requesterId) }]
              : []),
          ],
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          thumbnail: 1,
          duration: 1,
          views: 1,
          owner: 1,
          isPublished: 1,
          createdAt: 1,
        },
      },
    ],
  };
}

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name?.trim()) {
    throw new ApiError(400, "Name is required");
  }
  if (name.trim().length > 120) {
    throw new ApiError(400, "playlist name is too long");
  }

  const playlist = await Playlist.create({
    name: name.trim(),
    description: (description || "").slice(0, 2000),
    owner: req.user._id,
    video: [],
  });

  return res.status(200).json(new ApiResponse(200, playlist, "playlist created"));
});

const addVideos = asyncHandler(async (req, res) => {
  const { videoId, playlistId } = req.params;
  assertObjectId(videoId, "videoId");
  assertObjectId(playlistId, "playlistId");

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "playlist not found");
  }
  requireOwner(playlist.owner, req.user._id);

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "video not found");
  }

  if (!playlist.video.map(String).includes(String(videoId))) {
    playlist.video.push(videoId);
    await playlist.save();
  }

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "video added successfully"));
});

const getPlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  assertObjectId(playlistId, "playlistId");

  const existing = await Playlist.findById(playlistId);
  if (!existing) {
    throw new ApiError(404, "playlist not found");
  }
  requireOwner(existing.owner, req.user._id, "You can only view your own playlists");

  const playlist = await Playlist.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(playlistId) } },
    { $lookup: videoLookupFor(req.user._id) },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, playlist[0], "playlist fetched"));
});

const getUserPlaylist = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  assertObjectId(userId, "userId");

  if (userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only view your own playlists");
  }

  const { page, limit, skip } = getPagination(req.query);
  const match = { owner: new mongoose.Types.ObjectId(userId) };

  const playlist = await Playlist.aggregate([
    { $match: match },
    { $sort: { createdAt: -1, _id: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $lookup: videoLookupFor(req.user._id) },
  ]);
  const total = await Playlist.countDocuments(match);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        playlist,
        "playlist fetched",
        paginationMeta(page, limit, total)
      )
    );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  assertObjectId(playlistId, "playlistId");

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "playlist not found");
  }
  requireOwner(playlist.owner, req.user._id);

  await Playlist.findByIdAndDelete(playlistId);
  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "playlist delete successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  assertObjectId(playlistId, "playlistId");

  const existing = await Playlist.findById(playlistId);
  if (!existing) {
    throw new ApiError(404, "playlist not found");
  }
  requireOwner(existing.owner, req.user._id);

  const { name, description } = req.body;
  if (!name?.trim()) {
    throw new ApiError(400, "name is required");
  }

  const playlist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $set: {
        name: name.trim().slice(0, 120),
        description: (description || "").slice(0, 2000),
      },
    },
    { new: true }
  );

  return res.status(200).json(new ApiResponse(200, playlist, "playlist updated"));
});

const removePlaylistVideo = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  assertObjectId(playlistId, "playlistId");
  assertObjectId(videoId, "videoId");

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "playlist not found");
  }
  requireOwner(playlist.owner, req.user._id);

  playlist.video = playlist.video.filter((item) => item.toString() !== videoId);
  await playlist.save();

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "video removed successfully"));
});

export {
  createPlaylist,
  addVideos,
  getPlaylist,
  getUserPlaylist,
  deletePlaylist,
  updatePlaylist,
  removePlaylistVideo,
};
