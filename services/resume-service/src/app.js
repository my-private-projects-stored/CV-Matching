import express from "express";
import { correlationMiddleware, errorHandlerMiddleware } from "@cvm/shared";
import { createAuthExtractor } from "./middleware/auth-context.js";
import Resume from "./models/Resume.js";
import { createInternalRoutes } from "./routes/internal.routes.js";
import { createResumeRoutes } from "./routes/resume.routes.js";
import { createEmbeddingClient } from "./services/embedding-client.js";
import { createParsingClient } from "./services/parsing-client.js";
import { createResumeVectorStore } from "./services/qdrant-client.js";
import { createResumeService } from "./services/resume.service.js";

export function createApp({
  ResumeModel = Resume,
  minioStorage = null,
  parsingClient = createParsingClient(),
  embeddingClient = createEmbeddingClient(),
  vectorStore = createResumeVectorStore(null),
  redisClient = null,
  redisBus = null,
  jwtSecret = process.env.JWT_SECRET || "dev-secret",
  gatewaySecret = process.env.GATEWAY_INTERNAL_SECRET || "dev-gateway-secret",
  internalToken = process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
  canRecruiterAccessResume,
} = {}) {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "resume-service", request_id: req.requestId });
  });

  app.use(createAuthExtractor({ jwtSecret, gatewaySecret, redisBus }));

  const defaultRecruiterCheck = async (recruiterId, resumeId, candidateId) => {
    const baseUrl = process.env.INTERNAL_ACCESS_CHECK_URL;
    if (!baseUrl) return false;
    try {
      const resp = await fetch(
        `${baseUrl}?recruiterId=${encodeURIComponent(recruiterId)}&resumeId=${encodeURIComponent(resumeId)}&candidateId=${encodeURIComponent(candidateId)}`,
        { headers: { "x-internal-token": internalToken } }
      );
      if (!resp.ok) return false;
      const body = await resp.json();
      return Boolean(body?.allowed);
    } catch {
      return false;
    }
  };

  const resumeService = createResumeService({
    ResumeModel,
    minioStorage,
    parsingClient,
    embeddingClient,
    vectorStore,
    redisClient,
    canRecruiterAccessResume: canRecruiterAccessResume || defaultRecruiterCheck,
  });

  app.use("/api/resumes", createResumeRoutes(resumeService));
  app.use("/internal", createInternalRoutes(resumeService, internalToken));

  app.use(errorHandlerMiddleware);
  return app;
}
