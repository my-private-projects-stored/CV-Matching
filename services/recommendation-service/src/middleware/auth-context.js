import jwt from "jsonwebtoken";
import { canonicalizeRole, createHttpError, hasAnyRole } from "@cvm/shared";

export function createAuthExtractor({
  jwtSecret = process.env.JWT_SECRET || "dev-secret",
  gatewaySecret = process.env.GATEWAY_INTERNAL_SECRET || "dev-gateway-secret",
  redisBus = null,
} = {}) {
  return async function extractAuth(req, _res, next) {
    try {
      req.auth = null;

      const incomingSecret = req.headers["x-gateway-secret"];
      const gatewayUserId = req.headers["x-user-id"];
      if (gatewaySecret && incomingSecret === gatewaySecret && gatewayUserId) {
        req.auth = {
          id: String(gatewayUserId),
          role: canonicalizeRole(req.headers["x-user-role"]) || String(req.headers["x-user-role"] || ""),
          email: String(req.headers["x-user-email"] || ""),
        };
        return next();
      }

      const authHeader = req.headers.authorization;
      const token =
        typeof authHeader === "string" && authHeader.startsWith("Bearer ")
          ? authHeader.slice(7).trim()
          : null;

      if (!token) {
        return next();
      }

      let decoded;
      try {
        decoded = jwt.verify(token, jwtSecret);
      } catch {
        return next(createHttpError(401, "Invalid or expired token", "invalid_token"));
      }

      const userId = String(decoded?.id || decoded?.sub || "");
      const jti = decoded?.jti ? String(decoded.jti) : null;

      if (redisBus && typeof redisBus.isBlacklisted === "function") {
        if (await redisBus.isBlacklisted({ jti, userId })) {
          return next(createHttpError(401, "Token has been revoked", "token_revoked"));
        }
      }

      req.auth = {
        id: userId,
        role: canonicalizeRole(decoded?.role) || String(decoded?.role || ""),
        email: String(decoded?.email || ""),
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireAuth(req, _res, next) {
  if (!req.auth?.id) {
    return next(createHttpError(401, "Authentication required", "authentication_required"));
  }
  return next();
}

export function requireRole(...allowedRoles) {
  return function roleGuard(req, _res, next) {
    if (!req.auth?.id) {
      return next(createHttpError(401, "Authentication required", "authentication_required"));
    }
    if (!hasAnyRole(req.auth.role, allowedRoles)) {
      return next(createHttpError(403, "Insufficient permissions", "forbidden"));
    }
    return next();
  };
}
