import jwt from "jsonwebtoken";
import { canonicalizeRole } from "@cvm/shared";

const SPOOFED_HEADERS = [
  "x-user-id",
  "x-user-role",
  "x-user-email",
  "x-token-jti",
  "x-gateway-secret",
];

function isPublicRoute(method, path) {
  const upperMethod = String(method || "GET").toUpperCase();
  if (upperMethod === "GET" && path === "/api/health") {
    return true;
  }

  if (
    upperMethod === "POST" &&
    (path === "/api/auth/login" ||
      path === "/api/auth/signup" ||
      path === "/api/auth/register" ||
      path === "/api/auth/refresh" ||
      path === "/api/auth/forgot-password" ||
      path === "/api/auth/reset-password")
  ) {
    return true;
  }

  if (upperMethod === "GET") {
    if (path === "/api/status" || path === "/api/config/language" || path === "/api/recommendations/search") {
      return true;
    }
    if (path === "/api/jobs") return true;
    if (/^\/api\/jobs\/[^/]+$/.test(path) && path !== "/api/jobs/mine") return true;
    if (path === "/api/company") return true;
    if (/^\/api\/company\/[^/]+$/.test(path) && path !== "/api/company/me") return true;
  }

  return false;
}

/**
 * Centralized JWT verification + Redis blacklist check (< 2ms) + trusted header injection.
 * Strips client-supplied x-user-* and x-gateway-secret headers on ingress.
 */
export function createGatewayAuthMiddleware({ jwtSecret, gatewaySecret, redisBus }) {
  return async function gatewayAuthMiddleware(req, res, next) {
    for (const header of SPOOFED_HEADERS) {
      delete req.headers[header];
    }
    req.auth = null;

    const path = (req.originalUrl || req.url || "").split("?")[0];
    const publicRoute = isPublicRoute(req.method, path);

    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;
    let queryToken = null;
    if (!bearerToken && path === "/api/notifications/stream" && req.originalUrl?.includes("?")) {
      const parsedUrl = new URL(req.originalUrl, "http://localhost");
      queryToken = parsedUrl.searchParams.get("token");
    }
    const token = bearerToken || queryToken;

    if (!token) {
      if (publicRoute) {
        return next();
      }
      return res.status(401).json({
        message: "Authentication required",
        error_code: "authentication_required",
        ...(req.requestId ? { request_id: req.requestId } : {}),
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      if (publicRoute) {
        return next();
      }
      return res.status(401).json({
        message: "Invalid or expired token",
        error_code: "invalid_token",
        ...(req.requestId ? { request_id: req.requestId } : {}),
      });
    }

    const userId = String(decoded?.id || decoded?.sub || "");
    const jti = decoded?.jti ? String(decoded.jti) : null;

    if (redisBus && typeof redisBus.isBlacklisted === "function") {
      const revoked = await redisBus.isBlacklisted({ jti, userId });
      if (revoked) {
        return res.status(401).json({
          message: "Token has been revoked",
          error_code: "token_revoked",
          ...(req.requestId ? { request_id: req.requestId } : {}),
        });
      }
    }

    const canonicalRole = canonicalizeRole(decoded?.role) || String(decoded?.role || "");
    const email = String(decoded?.email || "");

    req.auth = {
      id: userId,
      role: canonicalRole,
      email,
      jti: jti || "",
    };

    req.headers["x-user-id"] = userId;
    req.headers["x-user-role"] = canonicalRole;
    req.headers["x-user-email"] = email;
    if (jti) {
      req.headers["x-token-jti"] = jti;
    }
    if (gatewaySecret) {
      req.headers["x-gateway-secret"] = gatewaySecret;
    }

    return next();
  };
}
