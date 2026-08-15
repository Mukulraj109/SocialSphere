import { ApiError } from "../utils/ApiError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Require a custom header on cookie-authenticated mutating requests.
 * Simple cross-site form posts cannot set custom headers, mitigating CSRF
 * when cookies use SameSite=None in production.
 */
export function requireCsrfHeader(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const header =
    req.get("X-Requested-With") ||
    req.get("x-requested-with") ||
    req.get("X-CSRF-Token") ||
    req.get("x-csrf-token");

  if (!header) {
    return next(
      new ApiError(403, "Missing CSRF protection header (X-Requested-With)")
    );
  }

  return next();
}
