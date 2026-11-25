import { verifyAccessToken } from "../services/auth.service.js";

export function requireAuth(req, _res, next) {
  try {
    const authorization = String(req.headers.authorization || "").trim();

    if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
      const error = new Error("Authorization token is required");
      error.statusCode = 401;
      throw error;
    }

    const token = authorization.slice("bearer ".length).trim();
    if (!token) {
      const error = new Error("Authorization token is required");
      error.statusCode = 401;
      throw error;
    }

    req.auth = verifyAccessToken(token);
    return next();
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 401;
      error.message = "Invalid or expired access token";
    }
    return next(error);
  }
}

export function requireRoles(...roles) {
  const allowedRoles = new Set();
  for (const rawRole of roles) {
    const normalized = String(rawRole || "").trim().toLowerCase();
    if (!normalized) continue;
    allowedRoles.add(normalized);
    // Keep "admin" and "tech_staff" as equivalent transitional aliases.
    if (normalized === "admin" || normalized === "tech_staff") {
      allowedRoles.add("admin");
      allowedRoles.add("tech_staff");
    }
  }

  return function requireRoleMiddleware(req, _res, next) {
    const role = String(req.auth?.role || "").trim().toLowerCase();
    if (!role) {
      const error = new Error("Authentication is required");
      error.statusCode = 401;
      return next(error);
    }

    if (!allowedRoles.has(role)) {
      const error = new Error("You do not have permission to perform this action");
      error.statusCode = 403;
      return next(error);
    }

    return next();
  };
}
