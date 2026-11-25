import express from "express";
import { correlationMiddleware, errorHandlerMiddleware } from "@cvm/shared";
import { createAuthExtractor } from "./middleware/auth-context.js";
import Company from "./models/Company.js";
import Job from "./models/Job.js";
import { createCompanyRoutes } from "./routes/company.routes.js";
import { createInternalRoutes } from "./routes/internal.routes.js";
import { createJobRoutes } from "./routes/job.routes.js";
import { createCompanyService } from "./services/company.service.js";
import { createEmbeddingClient } from "./services/embedding-client.js";
import { createJobService } from "./services/job.service.js";
import { createJobVectorStore } from "./services/qdrant-client.js";

export function createApp({
  CompanyModel = Company,
  JobModel = Job,
  minioStorage = null,
  embeddingClient = createEmbeddingClient(),
  vectorStore = createJobVectorStore(null),
  redisBus = null,
  jwtSecret = process.env.JWT_SECRET || "dev-secret",
  gatewaySecret = process.env.GATEWAY_INTERNAL_SECRET || "dev-gateway-secret",
  internalToken = process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
} = {}) {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "job-service", request_id: req.requestId });
  });

  app.use(createAuthExtractor({ jwtSecret, gatewaySecret, redisBus }));

  const companyService = createCompanyService({ CompanyModel, minioStorage });
  const jobService = createJobService({
    JobModel,
    CompanyModel,
    embeddingClient,
    vectorStore,
    redisBus,
  });

  app.use("/api/company", createCompanyRoutes(companyService));
  app.use("/api/jobs", createJobRoutes(jobService));
  app.use("/internal", createInternalRoutes(jobService, internalToken));

  app.use(errorHandlerMiddleware);
  return app;
}
