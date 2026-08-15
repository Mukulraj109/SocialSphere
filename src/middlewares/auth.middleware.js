import JWT from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

const verifyJWT = asyncHandler(async (req, _res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError(401, "Unauthorized request. No token provided.");
  }

  try {
    const decoded = JWT.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded?._id).select("-password -refreshToken");
    if (!user) {
      throw new ApiError(401, "User no longer exists.");
    }
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, "Invalid or expired access token.");
  }
});

const optionalJWT = asyncHandler(async (req, _res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return next();
  }

  try {
    const decoded = JWT.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded?._id).select("-password -refreshToken");
    if (user) {
      req.user = user;
    }
  } catch {
    throw new ApiError(401, "Invalid or expired access token.");
  }
  next();
});

export { verifyJWT, optionalJWT };
