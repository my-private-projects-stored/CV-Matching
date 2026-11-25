import express from "express";
import { correlationMiddleware, errorHandlerMiddleware } from "@cvm/shared";
import { createAuthExtractor } from "./middleware/auth-context.js";
import AiGenerationEvent from "./models/AiGenerationEvent.js";
import InterviewQuestion from "./models/InterviewQuestion.js";
import {
  createEnrichmentRoutes,
  createLegacyResumeEnrichmentRoutes,
} from "./routes/enrichment.routes.js";
import { createInterviewRoutes } from "./routes/interview.routes.js";
import { createEnrichmentService } from "./services/enrichment.service.js";
import { createEnrichmentEventConsumer } from "./services/event-consumer.js";

export function createApp({
  AiGenerationEventModel = AiGenerationEvent,
  InterviewQuestionModel = InterviewQuestion,
  redisClient = null,
  subscriberClient = null,
  redisBus = null,
  llmProvider = null,
  dailyCandidateQuota = 10,
  jwtSecret = process.env.JWT_SECRET || "dev-secret",
  gatewaySecret = process.env.GATEWAY_INTERNAL_SECRET || "dev-gateway-secret",
} = {}) {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "ai-enrichment-service", request_id: req.requestId });
  });

  app.use(createAuthExtractor({ jwtSecret, gatewaySecret, redisBus }));

  const enrichmentService = createEnrichmentService({
    AiGenerationEventModel,
    InterviewQuestionModel,
    redisClient,
    redisBus,
    llmProvider,
    dailyCandidateQuota,
  });

  createEnrichmentEventConsumer({ enrichmentService, subscriberClient });

  app.use("/api/interviews", createInterviewRoutes(enrichmentService));
  app.use("/api/enrichment", createEnrichmentRoutes(enrichmentService));
  app.use("/api/resumes", createLegacyResumeEnrichmentRoutes(enrichmentService));

  app.use(errorHandlerMiddleware);
  return app;
}
