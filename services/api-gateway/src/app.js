import cors from "cors";
import express from "express";
import { correlationMiddleware, errorHandlerMiddleware } from "@cvm/shared";
import { createGatewayAuthMiddleware } from "./middleware/gateway-auth.js";
import { createMaintenanceGuard } from "./middleware/maintenance.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { registerProxyRoutes } from "./routes/proxy.js";

/**
 * Create the Express app for API Gateway.
 * IMPORTANT: Never register express.json() globally before http-proxy-middleware
 * so JSON bodies and multipart/form-data file streams pass through untouched.
 */
export function createApp({
  targets = {
    authService: process.env.AUTH_SERVICE_URL || "http://localhost:5001",
    resumeService: process.env.RESUME_SERVICE_URL || "http://localhost:5002",
    jobService: process.env.JOB_SERVICE_URL || "http://localhost:5003",
    applicationService: process.env.APPLICATION_SERVICE_URL || "http://localhost:5004",
    recommendationService: process.env.RECOMMENDATION_SERVICE_URL || "http://localhost:5005",
    aiEnrichmentService: process.env.AI_ENRICHMENT_SERVICE_URL || "http://localhost:5006",
    notificationService: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:5007",
    configAnalyticsService: process.env.CONFIG_ANALYTICS_SERVICE_URL || "http://localhost:5008",
  },
  jwtSecret = process.env.JWT_SECRET || "dev-secret",
  gatewaySecret = process.env.GATEWAY_INTERNAL_SECRET || "dev-gateway-secret",
  redisClient = null,
  subscriberClient = null,
  redisBus = null,
  rateLimitConfig = {},
  initialMaintenanceConfig = {},
  corsOrigin = process.env.CORS_ORIGIN || true,
} = {}) {
  const app = express();

  app.use(correlationMiddleware);
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );

  const maintenance = createMaintenanceGuard({
    initialConfig: initialMaintenanceConfig,
    subscriberClient,
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "api-gateway",
      maintenance: maintenance.getState(),
      request_id: req.requestId,
    });
  });

  app.use(
    createRateLimiter({
      redisClient,
      ...rateLimitConfig,
    })
  );

  app.use(
    createGatewayAuthMiddleware({
      jwtSecret,
      gatewaySecret,
      redisBus,
    })
  );

  app.use(maintenance.middleware);

  registerProxyRoutes(app, targets);

  app.use((req, res) => {
    res.status(404).json({
      message: "Route not found",
      error_code: "not_found",
      ...(req.requestId ? { request_id: req.requestId } : {}),
    });
  });

  app.use(errorHandlerMiddleware);

  app.locals.maintenance = maintenance;
  return app;
}
