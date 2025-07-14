import { Router } from "express";
import { createCommunityPost, deletePost, getAllCommunityPost, getChannelPost, updatePost } from "../controllers/community.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT)

router.options('*', (req, res) => {
  res.sendStatus(200);
});

router.route("/").post(createCommunityPost);
router.route("/all-post").get(getAllCommunityPost);
router.route("/channel-post/:channelId").get(getChannelPost);
router.route("/delete-post/:postId").post(deletePost);
router.route("/update-post/:postId").post(updatePost)

export default router;