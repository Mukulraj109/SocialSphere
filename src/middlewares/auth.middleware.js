import JWT from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

const verifyJWT = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

  // Log cookies for debugging (optional, remove in prod)
  console.log("🔐 Received cookies:", req.cookies);

  if (!token) {
    throw new ApiError(401, "Unauthorized request. No token provided.");
  }

  try {
    const decoded = JWT.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded?._id);
    if (!user) {
      throw new ApiError(401, "User no longer exists.");
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);
    throw new ApiError(401, "Invalid or expired access token.");
  }
});

export { verifyJWT };
