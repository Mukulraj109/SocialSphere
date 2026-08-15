import { Router } from "express";
import {
  cleanupUploadOnError,
  uploadVideoAssets,
} from "../middlewares/multer.middleware.js";
import { validateFileSignatures } from "../middlewares/fileSignature.middleware.js";
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishVideo,
  recordVideoView,
  toggleIsPublished,
  updateVideo,
  upsertVideoCaptions,
} from "../controllers/video.controller.js";
import { verifyJWT, optionalJWT } from "../middlewares/auth.middleware.js";
import { uploadLimiter } from "../middlewares/rateLimit.middleware.js";

const router = Router();

router.route("/").get(optionalJWT, getAllVideos);

router.route("/publish-video").post(
  verifyJWT,
  uploadLimiter,
  uploadVideoAssets.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "videoFile", maxCount: 1 },
    { name: "captions", maxCount: 1 },
  ]),
  validateFileSignatures,
  cleanupUploadOnError,
  publishVideo
);

router.route("/vid/:videoId").get(optionalJWT, getVideoById);
router.route("/view/:videoId").post(optionalJWT, recordVideoView);
router
  .route("/update-video/:videoId")
  .post(
    verifyJWT,
    uploadLimiter,
    uploadVideoAssets.single("thumbnail"),
    validateFileSignatures,
    cleanupUploadOnError,
    updateVideo
  );
router
  .route("/captions/:videoId")
  .post(
    verifyJWT,
    uploadLimiter,
    uploadVideoAssets.single("captions"),
    validateFileSignatures,
    cleanupUploadOnError,
    upsertVideoCaptions
  );
router.route("/delete/:videoId").post(verifyJWT, deleteVideo);
router.route("/publish-status/:videoId").post(verifyJWT, toggleIsPublished);

export default router;
