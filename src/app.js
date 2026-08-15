import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoose from "mongoose";
import crypto from "crypto";
import { getCorsOrigins, isProd, cloudinaryConfigured } from "./config/env.js";
import { requireCsrfHeader } from "./middlewares/csrf.middleware.js";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";

const app = express();

app.set("trust proxy", 1);

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const allowedOrigins = getCorsOrigins();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, !isProd);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-CSRF-Token",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(requireCsrfHeader);
app.use("/api/", apiLimiter);

app.get("/health", async (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  const uploadsReady = cloudinaryConfigured();
  const status = dbReady ? 200 : 503;
  return res.status(status).json({
    success: dbReady,
    status: dbReady ? "ok" : "degraded",
    db: dbReady ? "up" : "down",
    uploads: uploadsReady ? "up" : "disabled",
    timestamp: new Date().toISOString(),
  });
});

import userRouter from "./routes/user.routes.js";
import videoRouter from "./routes/video.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import communityRouter from "./routes/community.routes.js";
import commentRouter from "./routes/comment.routes.js";
import likeRouter from "./routes/like.routes.js";

app.use("/api/v1/users", userRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/playlists", playlistRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/communities", communityRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/likes", likeRouter);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    requestId: req.requestId,
  });
});

app.use((err, req, res, _next) => {
  let statusCode =
    err.statusCode || (err.message === "Not allowed by CORS" ? 403 : 500);
  let message = err.message || "Internal Server Error";

  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path || "id"}`;
  } else if (
    err.name === "MulterError" ||
    err.message?.startsWith("Unsupported file type")
  ) {
    statusCode = 400;
    message = err.message;
  } else if (err.code === 11000) {
    statusCode = 409;
    message = "Duplicate value";
  }

  if (statusCode === 500 && process.env.NODE_ENV === "production") {
    message = "Internal Server Error";
  }

  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: err.errors || [],
    requestId: req.requestId,
  });
});

export default app;
