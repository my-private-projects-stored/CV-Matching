import express from "express";
import { correlationMiddleware, errorHandlerMiddleware } from "@cvm/shared";
import { createAuthExtractor } from "./middleware/auth-context.js";
import Application from "./models/Application.js";
import JobStatusMirror from "./models/JobStatusMirror.js";
import OutboxEvent from "./models/OutboxEvent.js";
import { createApplicationRoutes } from "./routes/application.routes.js";
import { createInternalRoutes } from "./routes/internal.routes.js";
import { createApplicationService } from "./services/application.service.js";
import { createJobMirrorSync } from "./services/job-mirror-sync.js";
import { createOutboxPublisher } from "./services/outbox-publisher.js";

export function createApp({
  ApplicationModel = Application,
  OutboxEventModel = OutboxEvent,
  JobStatusMirrorModel = JobStatusMirror,
  redisClient = null,
  subscriberClient = null,
  redisBus = null,
  runInTransaction,
  scoringStep = null,
  resolveJobMetadata = null,
  resolveCandidateMetadata = null,
  resolveResumeMetadata = null,
  jwtSecret = process.env.JWT_SECRET || "dev-secret",
  gatewaySecret = process.env.GATEWAY_INTERNAL_SECRET || "dev-gateway-secret",
  internalToken = process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
  outboxIntervalMs = 500,
} = {}) {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "application-service", request_id: req.requestId });
  });

  const applicationService = createApplicationService({
    ApplicationModel,
    OutboxEventModel,
    JobStatusMirrorModel,
    redisBus,
    runInTransaction,
    scoringStep,
    resolveJobMetadata,
    resolveCandidateMetadata,
    resolveResumeMetadata,
  });

  const outboxPublisher = createOutboxPublisher({
    OutboxEventModel,
    redisClient,
    redisBus,
    intervalMs: outboxIntervalMs,
  });

  const jobMirrorSync = createJobMirrorSync({
    JobStatusMirrorModel,
    subscriberClient,
  });

  // Mount internal worker endpoints before JWT extractor (authenticated via WORKER_INTERNAL_TOKEN)
  const internalRouter = createInternalRoutes(applicationService, internalToken);
  app.use("/api/internal", internalRouter);
  app.use("/internal", internalRouter);

  app.use(createAuthExtractor({ jwtSecret, gatewaySecret, redisBus }));
  app.use("/api/applications", createApplicationRoutes(applicationService));

  app.use(errorHandlerMiddleware);

  app.locals.outboxPublisher = outboxPublisher;
  app.locals.jobMirrorSync = jobMirrorSync;
  return app;
}
