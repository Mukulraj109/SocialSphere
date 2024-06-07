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





export default router