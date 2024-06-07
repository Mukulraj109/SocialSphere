import { Router } from "express";
import { changeCurrentPassword, getCurrentUser, getUserChannelDetails, getWatchHistory, login, logout, refreshAccessToken, register, updateAvatar, updateCoverImage, updateUserDetail } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 }
]), register);



router.route("/login").post(login);
router.route("/logout").post(verifyJWT, logout)
router.route("/refresh-access-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/update-user-detail").post(verifyJWT, updateUserDetail)
router.route("/update-avatar").post(verifyJWT, upload.single("avatar"), updateAvatar)
router.route("/update-cover-image").post(verifyJWT, upload.single("coverImage"), updateCoverImage)
router.route("/channel/:username").get(verifyJWT, getUserChannelDetails)
router.route("/watch-history").get(verifyJWT, getWatchHistory)
router.route("/current-user").get(verifyJWT, getCurrentUser )




export default router