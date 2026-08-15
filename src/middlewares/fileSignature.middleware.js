import fs from "fs";
import { ApiError } from "../utils/ApiError.js";
import { cleanupUploadedFiles } from "./multer.middleware.js";

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

const CAPTION_MIME = new Set(["text/vtt", "text/plain", "application/octet-stream"]);

function bufferStartsWith(buf, ascii) {
  const expected = Buffer.from(ascii, "ascii");
  return buf.length >= expected.length && buf.subarray(0, expected.length).equals(expected);
}

/**
 * Sniff file content. Returns a canonical mime or null when unknown.
 */
export function sniffFileSignature(buffer) {
  if (!buffer || buffer.length < 4) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (bufferStartsWith(buffer, "GIF87a") || bufferStartsWith(buffer, "GIF89a")) {
    return "image/gif";
  }
  if (
    bufferStartsWith(buffer, "RIFF") &&
    buffer.length >= 12 &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  // WebVTT (allow BOM + optional whitespace)
  const asText = buffer.subarray(0, Math.min(buffer.length, 64)).toString("utf8");
  if (/^\uFEFF?\s*WEBVTT(\s|$)/.test(asText)) {
    return "text/vtt";
  }

  // EBML (WebM / Matroska)
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    // Distinguish roughly: look for "webm" or "matroska" in early bytes
    const early = buffer.subarray(0, Math.min(buffer.length, 64)).toString("latin1");
    if (early.includes("webm")) return "video/webm";
    return "video/x-matroska";
  }

  // ISO BMFF (mp4 / quicktime) — "ftyp" at offset 4
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (["qt  ", "moov"].includes(brand) || brand.startsWith("qt")) {
      return "video/quicktime";
    }
    return "video/mp4";
  }

  return null;
}

function allowedForField(fieldname, sniffed) {
  if (["avatar", "coverImage", "thumbnail"].includes(fieldname)) {
    return IMAGE_MIME.has(sniffed);
  }
  if (fieldname === "videoFile") {
    return VIDEO_MIME.has(sniffed);
  }
  if (fieldname === "captions") {
    return sniffed === "text/vtt";
  }
  // Unknown field: accept only if sniffed matches claimed image/video sets
  return IMAGE_MIME.has(sniffed) || VIDEO_MIME.has(sniffed) || sniffed === "text/vtt";
}

function claimedCompatible(claimed, sniffed) {
  if (!claimed) return true;
  if (claimed === sniffed) return true;
  // Browsers sometimes send text/plain or octet-stream for .vtt
  if (sniffed === "text/vtt" && CAPTION_MIME.has(claimed)) return true;
  // mp4/quicktime brands overlap
  if (
    (claimed === "video/mp4" || claimed === "video/quicktime") &&
    (sniffed === "video/mp4" || sniffed === "video/quicktime")
  ) {
    return true;
  }
  // webm vs matroska both EBML
  if (
    (claimed === "video/webm" || claimed === "video/x-matroska") &&
    (sniffed === "video/webm" || sniffed === "video/x-matroska")
  ) {
    return true;
  }
  return false;
}

async function validateUploadedFile(file) {
  if (file.fieldname === "captions" && typeof file.size === "number" && file.size > 1024 * 1024) {
    throw new ApiError(400, "Caption file must be 1MB or smaller");
  }

  const fd = await fs.promises.open(file.path, "r");
  try {
    const buffer = Buffer.alloc(64);
    const { bytesRead } = await fd.read(buffer, 0, 64, 0);
    const header = buffer.subarray(0, bytesRead);
    const sniffed = sniffFileSignature(header);

    if (!sniffed) {
      throw new ApiError(400, `Unrecognized file content for ${file.fieldname}`);
    }
    if (!allowedForField(file.fieldname, sniffed)) {
      throw new ApiError(
        400,
        `File content (${sniffed}) is not allowed for field ${file.fieldname}`
      );
    }
    if (!claimedCompatible(file.mimetype, sniffed)) {
      throw new ApiError(
        400,
        `File content (${sniffed}) does not match claimed type (${file.mimetype})`
      );
    }
  } finally {
    await fd.close();
  }
}

export const validateFileSignatures = async (req, _res, next) => {
  try {
    const files = [
      ...(req.file ? [req.file] : []),
      ...Object.values(req.files || {}).flat(),
    ].filter(Boolean);

    for (const file of files) {
      if (!file.path) continue;
      await validateUploadedFile(file);
    }
    next();
  } catch (err) {
    cleanupUploadedFiles(req);
    next(err);
  }
};
