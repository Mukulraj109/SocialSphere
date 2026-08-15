/**
 * Seed demo users, videos, likes, and comments into MongoDB.
 *
 * Usage (from SocialSphere/):
 *   npm run seed
 *
 * Requires MONGODB_URI + DB_NAME in .env.
 * Cloudinary keys are NOT required — uses public sample media HTTPS URLs.
 *
 * Demo logins (password for all): Password123!
 *   aurora / aurora@demo.socialsphere
 *   river / river@demo.socialsphere
 *   nova / nova@demo.socialsphere
 *   kai / kai@demo.socialsphere
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../src/models/user.model.js";
import { Video } from "../src/models/video.model.js";
import { Like } from "../src/models/like.model.js";
import { Comment } from "../src/models/comment.model.js";

dotenv.config();

const DEMO_PASSWORD = "Password123!";
const DEMO_USERNAMES = ["aurora", "river", "nova", "kai"];

const SAMPLE_VIDEOS = [
  {
    file: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumb: "https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: 5,
  },
  {
    file: "https://www.w3schools.com/html/mov_bbb.mp4",
    thumb: "https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: 10,
  },
  {
    file: "https://download.samplelib.com/mp4/sample-5s.mp4",
    thumb: "https://images.pexels.com/photos/3062541/pexels-photo-3062541.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: 5,
  },
  {
    file: "https://download.samplelib.com/mp4/sample-10s.mp4",
    thumb: "https://images.pexels.com/photos/2387793/pexels-photo-2387793.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: 10,
  },
  {
    file: "https://download.samplelib.com/mp4/sample-15s.mp4",
    thumb: "https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: 15,
  },
  {
    file: "https://download.samplelib.com/mp4/sample-20s.mp4",
    thumb: "https://images.pexels.com/photos/210019/pexels-photo-210019.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: 20,
  },
  {
    file: "https://download.samplelib.com/mp4/sample-30s.mp4",
    thumb: "https://images.pexels.com/photos/1117132/pexels-photo-1117132.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: 30,
  },
  {
    file: "https://filesamples.com/samples/video/mp4/sample_640x360.mp4",
    thumb: "https://images.pexels.com/photos/313782/pexels-photo-313782.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: 30,
  },
  {
    file: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
    thumb: "https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: 10,
  },
  {
    file: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    thumb: "https://images.pexels.com/photos/2694434/pexels-photo-2694434.jpeg?auto=compress&cs=tinysrgb&w=800",
    duration: 5,
  },
];

const AVATARS = [
  "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=200",
  "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200",
  "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200",
  "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=200",
];

const VIDEO_META = [
  { title: "Golden Hour Cuts", description: "Soft light studies from a weekend shoot." },
  { title: "City After Rain", description: "Reflections, neon, and quiet streets." },
  { title: "Studio Warm-Up", description: "Behind the scenes of a creator session." },
  { title: "Motion Draft 03", description: "Rough cut — feedback welcome." },
  { title: "Weekend Market Walk", description: "Handheld documentary snippets." },
  { title: "Color Grade Tests", description: "Terracotta vs cool teal look-dev." },
  { title: "Night Drive Loop", description: "Dashboard cam with ambient score ideas." },
  { title: "Portrait Session BTS", description: "Lighting setups that actually worked." },
  { title: "Editorial Montage", description: "Fraunces titles over grainy footage." },
  { title: "Final Frame", description: "Closing shots from the spring project." },
];

async function main() {
  if (!process.env.MONGODB_URI || !process.env.DB_NAME) {
    console.error("MONGODB_URI and DB_NAME are required");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI.replace(/\/$/, "");
  await mongoose.connect(`${uri}/${process.env.DB_NAME}`);
  console.log("Connected to", process.env.DB_NAME);

  const existing = await User.find({ username: { $in: DEMO_USERNAMES } }).select("_id");
  const existingIds = existing.map((u) => u._id);

  if (existingIds.length) {
    const demoVideos = await Video.find({ owner: { $in: existingIds } }).select("_id");
    const videoIds = demoVideos.map((v) => v._id);
    await Promise.all([
      Like.deleteMany({
        $or: [{ likedBy: { $in: existingIds } }, { video: { $in: videoIds } }],
      }),
      Comment.deleteMany({
        $or: [{ owner: { $in: existingIds } }, { video: { $in: videoIds } }],
      }),
      Video.deleteMany({ owner: { $in: existingIds } }),
      User.deleteMany({ _id: { $in: existingIds } }),
    ]);
    console.log("Cleared previous demo users and related data");
  }

  const userSpecs = [
    { username: "aurora", email: "aurora@demo.socialsphere", fullName: "Aurora Chen" },
    { username: "river", email: "river@demo.socialsphere", fullName: "River Okonkwo" },
    { username: "nova", email: "nova@demo.socialsphere", fullName: "Nova Patel" },
    { username: "kai", email: "kai@demo.socialsphere", fullName: "Kai Mendoza" },
  ];

  const users = [];
  for (let i = 0; i < userSpecs.length; i++) {
    const user = await User.create({
      ...userSpecs[i],
      password: DEMO_PASSWORD,
      avatar: AVATARS[i],
      coverImage: SAMPLE_VIDEOS[i].thumb,
    });
    users.push(user);
  }
  console.log(`Created ${users.length} demo users`);

  const now = Date.now();
  const videos = [];
  for (let i = 0; i < SAMPLE_VIDEOS.length; i++) {
    const media = SAMPLE_VIDEOS[i];
    const meta = VIDEO_META[i];
    const owner = users[i % users.length];
    const video = await Video.create({
      title: meta.title,
      description: meta.description,
      thumbnail: media.thumb,
      videoFile: media.file,
      duration: media.duration,
      views: 40 + i * 37 + (i % 3) * 120,
      isPublished: true,
      owner: owner._id,
    });
    const stamped = new Date(now - i * 36e5 * 8);
    await Video.collection.updateOne(
      { _id: video._id },
      { $set: { createdAt: stamped, updatedAt: stamped } }
    );
    videos.push(video);
  }
  console.log(`Created ${videos.length} demo videos`);

  const likes = [];
  for (let i = 0; i < videos.length; i++) {
    for (let j = 0; j < users.length; j++) {
      if ((i + j) % 2 === 0) {
        likes.push({ video: videos[i]._id, likedBy: users[j]._id });
      }
    }
  }
  if (likes.length) {
    await Like.insertMany(likes, { ordered: false }).catch(() => undefined);
  }
  console.log(`Created ~${likes.length} likes`);

  const commentBodies = [
    "This grade is gorgeous.",
    "The pacing in the middle lands perfectly.",
    "Would love a longer cut of this.",
    "Audio mix feels studio-ready.",
    "Bookmarking for reference.",
  ];

  let commentCount = 0;
  for (let i = 0; i < videos.length; i++) {
    const rootAuthor = users[(i + 1) % users.length];
    const root = await Comment.create({
      content: commentBodies[i % commentBodies.length],
      video: videos[i]._id,
      owner: rootAuthor._id,
      parentComment: null,
    });
    commentCount += 1;

    if (i % 2 === 0) {
      await Comment.create({
        content: "Totally agree — that transition is sharp.",
        video: videos[i]._id,
        owner: users[(i + 2) % users.length]._id,
        parentComment: root._id,
      });
      commentCount += 1;
    }

    if (i % 3 === 0) {
      await Comment.create({
        content: "Subscribed after this one.",
        video: videos[i]._id,
        owner: users[(i + 3) % users.length]._id,
        parentComment: null,
      });
      commentCount += 1;
    }
  }
  console.log(`Created ${commentCount} comments`);

  console.log("\nDemo ready. Log in with any of:");
  for (const u of userSpecs) {
    console.log(`  ${u.username} / ${DEMO_PASSWORD}`);
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
