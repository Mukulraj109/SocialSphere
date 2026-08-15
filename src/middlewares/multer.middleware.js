import multer from "multer";
import path from "path";
import { ApiError } from "../utils/ApiError.js";
import fs from "fs";
import crypto from "crypto";

const TEMP_DIR = "./public/temp";

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
]);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, TEMP_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : "";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${safeExt}`);
  },
});

function fileFilter(allowed) {
  return (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      return cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  };
}

export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 5,
  },
});

export const uploadImages = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter: fileFilter(IMAGE_MIME),
});

const CAPTION_MIME = new Set([
  "text/vtt",
  "text/plain",
  "application/octet-stream",
]);

export const uploadVideoAssets = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "thumbnail") {
      return fileFilter(IMAGE_MIME)(req, file, cb);
    }
    if (file.fieldname === "videoFile") {
      return fileFilter(VIDEO_MIME)(req, file, cb);
    }
    if (file.fieldname === "captions") {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext && ext !== ".vtt") {
        return cb(new ApiError(400, "Captions must be a .vtt file"));
      }
      if (!CAPTION_MIME.has(file.mimetype)) {
        return cb(new ApiError(400, `Unsupported caption type: ${file.mimetype}`));
      }
      return cb(null, true);
    }
    cb(new ApiError(400, "Unexpected upload field"));
  },
});

export const cleanupUploadedFiles = (req) => {
  const files = [
    ...(req.file ? [req.file] : []),
    ...Object.values(req.files || {}).flat(),
  ];

  for (const file of files) {
    if (file?.path) {
      fs.promises.unlink(file.path).catch(() => {});
    }
  }
};

export const cleanupUploadOnError = (err, req, _res, next) => {
  cleanupUploadedFiles(req);
  next(err);
};
