import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { cloudinaryConfigured } from "../config/env.js";

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  if (!cloudinaryConfigured()) {
    return false;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.API_KEY,
    api_secret: process.env.API_SECRET,
  });
  configured = true;
  return true;
}

function cleanupLocal(localFilePath) {
  if (localFilePath && fs.existsSync(localFilePath)) {
    try {
      fs.unlinkSync(localFilePath);
    } catch {
      /* ignore */
    }
  }
}

function publicIdFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const withoutQuery = url.split("?")[0];
    const parts = withoutQuery.split("/");
    const uploadIndex = parts.findIndex((p) => p === "upload");
    if (uploadIndex === -1) return null;
    const afterUpload = parts.slice(uploadIndex + 1);
    const withoutVersion = afterUpload[0]?.startsWith("v")
      ? afterUpload.slice(1)
      : afterUpload;
    const joined = withoutVersion.join("/");
    return joined.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}

function isCloudinaryUrl(url) {
  if (!url || typeof url !== "string") return false;
  return /res\.cloudinary\.com\//.test(url) && publicIdFromUrl(url);
}

const uploadOnCloudinary = async (localFilePath, options = {}) => {
  try {
    if (!localFilePath) return null;
    if (!ensureConfigured()) {
      cleanupLocal(localFilePath);
      return null;
    }
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: options.resourceType || "auto",
      ...options.extra,
    });
    cleanupLocal(localFilePath);
    return response;
  } catch (error) {
    cleanupLocal(localFilePath);
    return null;
  }
};

const destroyOnCloudinary = async (url, resourceType = "image") => {
  try {
    if (!ensureConfigured()) return false;
    if (!isCloudinaryUrl(url)) return false;
    const publicId = publicIdFromUrl(url);
    if (!publicId) return false;
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    if (result?.result && result.result !== "ok" && result.result !== "not found") {
      console.warn("[cloudinary] destroy unexpected result", publicId, result.result);
    }
    return true;
  } catch (err) {
    console.warn("[cloudinary] destroy failed", url, err?.message || err);
    return false;
  }
};

export {
  uploadOnCloudinary,
  destroyOnCloudinary,
  publicIdFromUrl,
  isCloudinaryUrl,
  cloudinary,
  ensureConfigured,
};
