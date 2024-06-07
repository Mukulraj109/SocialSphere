import { Router } from "express";
import {upload} from "../middlewares/multer.middleware.js"
import { deleteVideo, getAllVideos, getVideoById, publishVideo, toggleIsPublished, updateVideo } from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/").get(getAllVideos);

router.route("/publish-video").post( verifyJWT,
    upload.fields(
    [
        {name:"thumbnail", maxCount:1},
        {name:"videoFile", maxCount:1}
    ]
) ,publishVideo);

router.route("/vid/:videoId").get(getVideoById);

router.route("/update-video/:videoId").post(verifyJWT,upload.single("thumbnail"),updateVideo);

router.route("/delete/:videoId").post(verifyJWT, deleteVideo);
router.route("/publish-status/:videoId").post(verifyJWT, toggleIsPublished);

export default router