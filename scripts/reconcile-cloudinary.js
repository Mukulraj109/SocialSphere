#!/usr/bin/env node
/**
 * Dry-run Cloudinary orphan check against MongoDB media URLs.
 *
 * Usage (from SocialSphere/):
 *   node -r dotenv/config scripts/reconcile-cloudinary.js
 *   node -r dotenv/config scripts/reconcile-cloudinary.js --delete
 *
 * Requires MONGODB_URI, DB_NAME, and Cloudinary env vars.
 * Without --delete, only prints suspected orphans (assets in the
 * configured cloud that are not referenced by any User/Video doc).
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import {
  cloudinary,
  ensureConfigured,
  publicIdFromUrl,
} from "../src/utils/cloudinary.js";

dotenv.config();

const shouldDelete = process.argv.includes("--delete");
const FOLDER_PREFIX = process.env.CLOUDINARY_RECONCILE_PREFIX || "";

function collectIds(urls) {
  const ids = new Set();
  for (const url of urls) {
    const id = publicIdFromUrl(url);
    if (id) ids.add(id);
  }
  return ids;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  if (!ensureConfigured()) {
    console.error("Cloudinary is not configured");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI.replace(/\/$/, "");
  const dbName = process.env.DB_NAME || "socialsphere";
  await mongoose.connect(`${uri}/${dbName}`);

  const db = mongoose.connection.db;
  const users = await db.collection("users").find({}).project({ avatar: 1, coverImage: 1 }).toArray();
  const videos = await db
    .collection("videos")
    .find({})
    .project({ thumbnail: 1, videoFile: 1, captions: 1 })
    .toArray();

  const referenced = collectIds([
    ...users.flatMap((u) => [u.avatar, u.coverImage]),
    ...videos.flatMap((v) => [
      v.thumbnail,
      v.videoFile,
      ...(v.captions || []).map((c) => c.file),
    ]),
  ]);

  console.log(`Referenced Cloudinary public_ids in Mongo: ${referenced.size}`);

  const orphans = [];
  for (const resourceType of ["image", "video", "raw"]) {
    let nextCursor;
    do {
      const result = await cloudinary.api.resources({
        resource_type: resourceType,
        type: "upload",
        max_results: 100,
        next_cursor: nextCursor,
        prefix: FOLDER_PREFIX || undefined,
      });
      for (const asset of result.resources || []) {
        if (!referenced.has(asset.public_id)) {
          orphans.push({ public_id: asset.public_id, resource_type: resourceType, url: asset.secure_url });
        }
      }
      nextCursor = result.next_cursor;
    } while (nextCursor);
  }

  console.log(`Suspected orphans: ${orphans.length}`);
  for (const orphan of orphans) {
    console.log(`- [${orphan.resource_type}] ${orphan.public_id}`);
  }

  if (shouldDelete && orphans.length) {
    for (const orphan of orphans) {
      try {
        await cloudinary.uploader.destroy(orphan.public_id, {
          resource_type: orphan.resource_type,
        });
        console.log(`Deleted ${orphan.public_id}`);
      } catch (err) {
        console.warn(`Failed to delete ${orphan.public_id}`, err?.message || err);
      }
    }
  } else if (orphans.length) {
    console.log("Dry-run only. Re-run with --delete to destroy listed assets.");
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
