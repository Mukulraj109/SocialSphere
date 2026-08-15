import { Router } from "express";
import {
  changeCurrentPassword,
  getCurrentUser,
  getUserChannelDetails,
  getWatchHistory,
  login,
  logout,
  refreshAccessToken,
  register,
  updateAvatar,
  updateCoverImage,
  updateUserDetail,
} from "../controllers/user.controller.js";
import {
  cleanupUploadOnError,
  uploadImages,
} from "../middlewares/multer.middleware.js";
import { validateFileSignatures } from "../middlewares/fileSignature.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  authLimiter,
  uploadLimiter,
} from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.route("/register").post(
  authLimiter,
  uploadLimiter,
  uploadImages.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  validateFileSignatures,
  cleanupUploadOnError,
  register
);

router.route("/login").post(authLimiter, login);
router.route("/logout").post(verifyJWT, logout);
router.route("/refresh-access-token").post(authLimiter, refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/update-user-detail").post(verifyJWT, updateUserDetail);
router
  .route("/update-avatar")
  .post(
    verifyJWT,
    uploadLimiter,
    uploadImages.single("avatar"),
    validateFileSignatures,
    cleanupUploadOnError,
    updateAvatar
  );
router
  .route("/update-cover-image")
  .post(
    verifyJWT,
    uploadLimiter,
    uploadImages.single("coverImage"),
    validateFileSignatures,
    cleanupUploadOnError,
    updateCoverImage
  );
router.route("/channel/:username").get(verifyJWT, getUserChannelDetails);
router.route("/watch-history").get(verifyJWT, getWatchHistory);
router.route("/current-user").get(verifyJWT, getCurrentUser);

export default router;
