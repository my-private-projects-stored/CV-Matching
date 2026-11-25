import express from "express";
import { correlationMiddleware, errorHandlerMiddleware } from "@cvm/shared";
import { createAuthExtractor } from "./middleware/auth-context.js";
import AuditLog from "./models/AuditLog.js";
import SystemConfig from "./models/SystemConfig.js";
import { createConfigRoutes } from "./routes/config.routes.js";
import { createOpsAnalyticsRoutes } from "./routes/ops-analytics.routes.js";
import { createAnalyticsService } from "./services/analytics.service.js";
import { createConfigService } from "./services/config.service.js";
import { createOpsService } from "./services/ops.service.js";

export function createApp({
  SystemConfigModel = SystemConfig,
  AuditLogModel = AuditLog,
  redisClient = null,
  redisBus = null,
  qdrantClient = null,
  embeddingClient = null,
  recordLoader = null,
  mongoPing = null,
  analyticsProvider = { loadSnapshot: async () => ({ users: [], resumes: [], jobs: [], applications: [] }) },
  listLlmEvents = null,
  clusterTargets,
  probeFn = null,
  jwtSecret = process.env.JWT_SECRET || "dev-secret",
  gatewaySecret = process.env.GATEWAY_INTERNAL_SECRET || "dev-gateway-secret",
} = {}) {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "config-analytics-service", request_id: req.requestId });
  });

  app.use(createAuthExtractor({ jwtSecret, gatewaySecret, redisBus }));

  const configService = createConfigService({
    SystemConfigModel,
    AuditLogModel,
    redisBus,
  });

  const opsService = createOpsService({
    AuditLogModel,
    redisClient,
    qdrantClient,
    embeddingClient,
    recordLoader,
    mongoPing,
    clusterTargets,
    probeFn,
  });

  const analyticsService = createAnalyticsService({
    dataProvider: analyticsProvider,
  });

  app.get("/api/status", async (_req, res, next) => {
    try {
      const [features, language, scoringWeights, maintenanceMode, llmConfig, privacyConfig, apiKeys] = await Promise.all([
        configService.getConfig("featureConfig"),
        configService.getConfig("languageConfig"),
        configService.getConfig("scoringWeights"),
        configService.getConfig("maintenanceMode"),
        configService.getConfig("llmConfig"),
        configService.getConfig("privacyConfig"),
        configService.getConfig("apiKeysConfig"),
      ]);
      const hasApiKey = Boolean(
        llmConfig?.provider === "ollama" ||
          llmConfig?.api_key ||
          process.env.GEMINI_API_KEY ||
          apiKeys?.google ||
          apiKeys?.openai ||
          apiKeys?.anthropic ||
          apiKeys?.openrouter ||
          apiKeys?.deepseek
      );
      res.json({
        status: "ready",
        llm_configured: hasApiKey,
        llm_healthy: hasApiKey,
        llm_provider: llmConfig?.provider || "gemini",
        llm_health_checked_at: null,
        llm_health_stale: false,
        privacy_mode: privacyConfig?.privacy_mode || "hybrid",
        has_master_resume: false,
        database_stats: {
          total_resumes: 0,
          total_jobs: 0,
          total_improvements: 0,
          has_master_resume: false,
        },
        features,
        language,
        scoringWeights,
        maintenanceMode,
      });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/config", createConfigRoutes(configService, { listLlmEvents }));

  const opsRouter = createOpsAnalyticsRoutes({ configService, opsService, analyticsService });
  app.use("/api/config-analytics", opsRouter);
  app.use("/api/admin", opsRouter);
  app.use("/api/owner", opsRouter);

  app.use(errorHandlerMiddleware);
  return app;
}
