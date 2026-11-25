import jwt from "jsonwebtoken";
import { canonicalizeRole, createHttpError } from "@cvm/shared";

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
      const bearerToken =
        typeof authHeader === "string" && authHeader.startsWith("Bearer ")
          ? authHeader.slice(7).trim()
          : null;
      const queryToken = req.query?.token ? String(req.query.token).trim() : null;
      const token = bearerToken || queryToken;

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

export function requireInternalToken(internalToken) {
  return function internalGuard(req, _res, next) {
    const provided = req.headers["x-internal-token"] || req.headers["x-worker-token"];
    if (!internalToken || provided !== internalToken) {
      return next(createHttpError(403, "Forbidden internal endpoint", "forbidden_internal"));
    }
    return next();
  };
}
