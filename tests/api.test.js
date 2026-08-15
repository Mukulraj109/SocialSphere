import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.ACCESS_TOKEN_SECRET = "test-access-secret-at-least-32-chars!!";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-at-least-32-chars!";
process.env.REFRESH_TOKEN_EXPIRY = "7d";
process.env.DB_NAME = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";
process.env.NODE_ENV = "test";
process.env.CORS_ORIGIN = "http://localhost:5173";

let app;
let mongo;

const csrf = { "X-Requested-With": "XMLHttpRequest" };

async function registerAgent(username, email) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/v1/users/register")
    .set(csrf)
    .field("username", username)
    .field("email", email)
    .field("password", "password123")
    .field("fullName", "Test User");
  expect(res.status).toBe(201);
  return { agent, user: res.body.data };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri().replace(/\/$/, "");
  process.env.MONGODB_URI = uri;
  await mongoose.connect(`${uri}/${process.env.DB_NAME}`);
  app = (await import("../src/app.js")).default;
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
});

describe("SocialSphere API", () => {
  it("returns health status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("registers and sets auth cookies", async () => {
    const res = await request(app)
      .post("/api/v1/users/register")
      .set(csrf)
      .field("username", "creator1")
      .field("email", "creator1@example.com")
      .field("password", "password123")
      .field("fullName", "Creator One");

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.headers["set-cookie"]).toBeTruthy();
  });

  it("rejects register without required fields", async () => {
    const res = await request(app)
      .post("/api/v1/users/register")
      .set(csrf)
      .field("username", "onlyuser");

    expect(res.status).toBe(400);
  });

  it("rejects mutating requests without CSRF header", async () => {
    const res = await request(app)
      .post("/api/v1/users/login")
      .send({ email: "a@b.com", password: "password123" });

    expect(res.status).toBe(403);
  });

  it("prevents non-owners from deleting videos", async () => {
    const { agent: ownerAgent } = await registerAgent("owneruser", "owner@example.com");
    const { agent: otherAgent } = await registerAgent("otheruser", "other@example.com");

    const { Video } = await import("../src/models/video.model.js");
    const { User } = await import("../src/models/user.model.js");
    const owner = await User.findOne({ username: "owneruser" });

    const video = await Video.create({
      title: "Owned video",
      description: "desc",
      videoFile: "https://example.com/v.mp4",
      thumbnail: "https://example.com/t.jpg",
      duration: 12,
      owner: owner._id,
      isPublished: true,
    });

    const res = await otherAgent
      .post(`/api/v1/videos/delete/${video._id}`)
      .set(csrf);
    expect(res.status).toBe(403);
  });

  it("returns empty playlist array for new users", async () => {
    const { agent, user } = await registerAgent("playlistuser", "playlist@example.com");
    const res = await agent.get(`/api/v1/playlists/get-user-playlist/${user._id}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it("blocks playlist IDOR reads", async () => {
    const { agent: owner, user: ownerUser } = await registerAgent(
      "plowner",
      "plowner@example.com"
    );
    const { agent: other } = await registerAgent("plviewer", "plviewer@example.com");

    const created = await owner
      .post("/api/v1/playlists/")
      .set(csrf)
      .send({ name: "Private list" });
    expect(created.status).toBe(200);

    const res = await other.get(
      `/api/v1/playlists/get-playlist/${created.body.data._id}`
    );
    expect(res.status).toBe(403);

    const list = await other.get(
      `/api/v1/playlists/get-user-playlist/${ownerUser._id}`
    );
    expect(list.status).toBe(403);
  });

  it("records video views", async () => {
    const { agent, user } = await registerAgent("viewer1", "viewer1@example.com");
    const { Video } = await import("../src/models/video.model.js");
    const video = await Video.create({
      title: "Viewed video",
      description: "desc",
      videoFile: "https://example.com/v.mp4",
      thumbnail: "https://example.com/t.jpg",
      duration: 12,
      owner: user._id,
      isPublished: true,
      views: 0,
    });

    const res = await agent.post(`/api/v1/videos/view/${video._id}`).set(csrf);
    expect(res.status).toBe(200);
    expect(res.body.data.views).toBe(1);
  });

  it("invalidates refresh token after password change", async () => {
    const { agent } = await registerAgent("pwduser", "pwd@example.com");

    const change = await agent
      .post("/api/v1/users/change-password")
      .set(csrf)
      .send({ currentPassword: "password123", newPassword: "password456" });
    expect(change.status).toBe(200);

    const refresh = await agent
      .post("/api/v1/users/refresh-access-token")
      .set(csrf);
    expect(refresh.status).toBe(401);
  });

  it("supports one-level nested comment replies and cascade delete", async () => {
    const { agent, user } = await registerAgent("commenter", "commenter@example.com");
    const { Video } = await import("../src/models/video.model.js");
    const video = await Video.create({
      title: "Comment video",
      description: "desc",
      videoFile: "https://example.com/v.mp4",
      thumbnail: "https://example.com/t.jpg",
      duration: 12,
      owner: user._id,
      isPublished: true,
    });

    const root = await agent
      .post(`/api/v1/comments/create/${user._id}/${video._id}`)
      .set(csrf)
      .send({ content: "Root comment" });
    expect(root.status).toBe(200);
    const rootId = root.body.data._id;

    const reply = await agent
      .post(`/api/v1/comments/create/${user._id}/${video._id}`)
      .set(csrf)
      .send({ content: "Reply comment", parentComment: rootId });
    expect(reply.status).toBe(200);
    expect(reply.body.data.parentComment).toBe(rootId);

    const deep = await agent
      .post(`/api/v1/comments/create/${user._id}/${video._id}`)
      .set(csrf)
      .send({ content: "Too deep", parentComment: reply.body.data._id });
    expect(deep.status).toBe(400);

    const list = await agent.get(`/api/v1/comments/vid-comments/${video._id}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].replies).toHaveLength(1);

    const del = await agent
      .post(`/api/v1/comments/delete-comment/${rootId}`)
      .set(csrf);
    expect(del.status).toBe(200);
    expect(del.body.data.deleted).toBe(2);

    const { Comment } = await import("../src/models/comment.model.js");
    const remaining = await Comment.countDocuments({ video: video._id });
    expect(remaining).toBe(0);
  });
});
