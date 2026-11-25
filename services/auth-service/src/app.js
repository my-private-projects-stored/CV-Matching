import cookieParser from "cookie-parser";
import express from "express";
import { correlationMiddleware, errorHandlerMiddleware } from "@cvm/shared";
import { createAuthExtractor } from "./middleware/auth-context.js";
import AuditLog from "./models/AuditLog.js";
import User from "./models/User.js";
import { createAuthRoutes } from "./routes/auth.routes.js";
import { createCandidateProfileRoutes } from "./routes/candidate-profile.routes.js";
import { createInternalRoutes } from "./routes/internal.routes.js";
import { createUserRoutes } from "./routes/user.routes.js";
import { createAuthService } from "./services/auth.service.js";

export function createApp({
  UserModel = User,
  AuditLogModel = AuditLog,
  redisClient = null,
  redisBus = null,
  jwtSecret = process.env.JWT_SECRET || "dev-secret",
  jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-refresh-secret",
  gatewaySecret = process.env.GATEWAY_INTERNAL_SECRET || "dev-gateway-secret",
  internalToken = process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
  piiEncryptionKey = process.env.PII_ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  canRecruiterReadCandidateProfile,
} = {}) {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "auth-service", request_id: req.requestId });
  });

  app.use(createAuthExtractor({ jwtSecret, gatewaySecret, redisBus }));

  const defaultAccessCheck = async (recruiterId, candidateId) => {
    const baseUrl = process.env.INTERNAL_ACCESS_CHECK_URL;
    if (!baseUrl) return false;
    try {
      const resp = await fetch(
        `${baseUrl}?recruiterId=${encodeURIComponent(recruiterId)}&candidateId=${encodeURIComponent(candidateId)}`,
        { headers: { "x-internal-token": internalToken } }
      );
      if (!resp.ok) return false;
      const body = await resp.json();
      return Boolean(body?.allowed);
    } catch {
      return false;
    }
  };

  const authService = createAuthService({
    UserModel,
    AuditLogModel,
    redisClient,
    redisBus,
    jwtSecret,
    jwtRefreshSecret,
    piiEncryptionKey,
    canRecruiterReadCandidateProfile: canRecruiterReadCandidateProfile || defaultAccessCheck,
  });

  app.use("/api/auth", createAuthRoutes(authService));
  app.use("/api/users", createUserRoutes(authService));
  app.use("/api/candidate-profile", createCandidateProfileRoutes(authService));
  app.use("/internal", createInternalRoutes(authService, internalToken));

  app.use(errorHandlerMiddleware);
  return app;
}
