import mongoose from "mongoose";
import { ApiError } from "./ApiError.js";

export function assertObjectId(id, label = "id") {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
}

export function requireOwner(resourceOwnerId, userId, message = "Forbidden") {
  if (!resourceOwnerId || !userId) {
    throw new ApiError(403, message);
  }
  if (resourceOwnerId.toString() !== userId.toString()) {
    throw new ApiError(403, message);
  }
}

export function sanitizeUser(user) {
  if (!user) return user;
  const obj = typeof user.toObject === "function" ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.refreshToken;
  return obj;
}

export const ALLOWED_VIDEO_SORT = new Set([
  "createdAt",
  "updatedAt",
  "views",
  "duration",
  "title",
]);
