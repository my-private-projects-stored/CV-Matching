import express from "express";
import { correlationMiddleware, errorHandlerMiddleware } from "@cvm/shared";
import { createAuthExtractor } from "./middleware/auth-context.js";
import { createRecommendationRoutes } from "./routes/recommendation.routes.js";
import { createRecommendationService } from "./services/recommendation.service.js";

function createHttpCatalogClients({
  jobServiceUrl = process.env.JOB_SERVICE_URL || "http://localhost:5003",
  resumeServiceUrl = process.env.RESUME_SERVICE_URL || "http://localhost:5002",
  internalToken = process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
} = {}) {
  const jobCatalogClient = {
    async listActiveJobs(params = {}) {
      const qs = new URLSearchParams();
      if (params.query) qs.set("search", params.query);
      if (params.category) qs.set("category", params.category);
      if (params.location) qs.set("location", params.location);
      if (params.page) qs.set("page", String(params.page));
      if (params.limit) qs.set("limit", String(params.limit));

      const resp = await fetch(`${jobServiceUrl}/api/jobs?${qs.toString()}`);
      if (!resp.ok) return { jobs: [], pagination: { page: 1, limit: 20, total: 0 } };
      return resp.json();
    },
    async getJobById(jobId) {
      const resp = await fetch(`${jobServiceUrl}/internal/jobs/${encodeURIComponent(jobId)}`, {
        headers: { "x-internal-token": internalToken },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.job || null;
    },
  };

  const resumeCatalogClient = {
    async getResumeById(resumeId) {
      const resp = await fetch(`${resumeServiceUrl}/internal/resumes/${encodeURIComponent(resumeId)}`, {
        headers: { "x-internal-token": internalToken },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.resume || null;
    },
    async listCandidateResumes() {
      return [];
    },
  };

  return { jobCatalogClient, resumeCatalogClient };
}

export function createApp({
  qdrantClient = null,
  redisBus = null,
  jobCatalogClient = null,
  resumeCatalogClient = null,
  qdrantTimeoutMs = 1500,
  jwtSecret = process.env.JWT_SECRET || "dev-secret",
  gatewaySecret = process.env.GATEWAY_INTERNAL_SECRET || "dev-gateway-secret",
} = {}) {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "recommendation-service", request_id: req.requestId });
  });

  app.use(createAuthExtractor({ jwtSecret, gatewaySecret, redisBus }));

  const defaults = createHttpCatalogClients();
  const recommendationService = createRecommendationService({
    qdrantClient,
    redisBus,
    jobCatalogClient: jobCatalogClient || defaults.jobCatalogClient,
    resumeCatalogClient: resumeCatalogClient || defaults.resumeCatalogClient,
    qdrantTimeoutMs,
  });

  const recRouter = createRecommendationRoutes(recommendationService);
  app.use("/api/recommendations", recRouter);
  app.use("/api/vectors", recRouter);

  app.use(errorHandlerMiddleware);
  return app;
}
