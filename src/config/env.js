import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

export const isProd = process.env.NODE_ENV === "production";

const REQUIRED = [
  "MONGODB_URI",
  "DB_NAME",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "REFRESH_TOKEN_EXPIRY",
];

const WEAK_SECRETS = new Set([
  "change_me_access_secret",
  "change_me_refresh_secret",
  "test-access-secret",
  "test-refresh-secret",
  "secret",
  "password",
]);

export function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (isProd) {
    for (const key of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]) {
      const value = process.env[key].trim();
      if (value.length < 32 || WEAK_SECRETS.has(value)) {
        throw new Error(
          `${key} is too weak for production. Use a random secret of at least 32 characters.`
        );
      }
    }

    if (!cloudinaryConfigured() && process.env.ALLOW_UPLOADS_DISABLED !== "true") {
      throw new Error(
        "Cloudinary credentials (CLOUD_NAME, API_KEY, API_SECRET) are required in production. Set ALLOW_UPLOADS_DISABLED=true to boot without uploads."
      );
    }
  }
}

export function getCorsOrigins() {
  const fromEnv = process.env.CORS_ORIGIN;
  if (fromEnv?.trim()) {
    return fromEnv
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://gleaming-jalebi-5e3c20.netlify.app",
  ];
}

export const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "None" : "Lax",
  maxAge: 10 * 24 * 60 * 60 * 1000,
  path: "/",
};

export function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUD_NAME?.trim() &&
      process.env.API_KEY?.trim() &&
      process.env.API_SECRET?.trim()
  );
}
