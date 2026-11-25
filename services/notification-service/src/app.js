import express from "express";
import { correlationMiddleware, errorHandlerMiddleware } from "@cvm/shared";
import { createAuthExtractor } from "./middleware/auth-context.js";
import Notification from "./models/Notification.js";
import { createInternalRoutes } from "./routes/internal.routes.js";
import { createNotificationRoutes } from "./routes/notification.routes.js";
import { createNotificationEventConsumer } from "./services/event-consumer.js";
import { createNotificationService } from "./services/notification.service.js";
import { createSseHub } from "./services/sse-hub.js";

export function createApp({
  NotificationModel = Notification,
  redisClient = null,
  subscriberClient = null,
  redisBus = null,
  heartbeatMs = 25000,
  jwtSecret = process.env.JWT_SECRET || "dev-secret",
  gatewaySecret = process.env.GATEWAY_INTERNAL_SECRET || "dev-gateway-secret",
  internalToken = process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token",
} = {}) {
  const app = express();
  app.use(correlationMiddleware);
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "notification-service", request_id: req.requestId });
  });

  app.use(createAuthExtractor({ jwtSecret, gatewaySecret, redisBus }));

  const sseHub = createSseHub({ heartbeatMs });
  const notificationService = createNotificationService({
    NotificationModel,
    sseHub,
    redisClient,
  });

  const eventConsumer = createNotificationEventConsumer({
    notificationService,
    subscriberClient,
  });

  app.use("/api/notifications", createNotificationRoutes(notificationService, sseHub));
  app.use("/internal", createInternalRoutes(notificationService, internalToken));

  app.use(errorHandlerMiddleware);

  app.locals.sseHub = sseHub;
  app.locals.eventConsumer = eventConsumer;
  return app;
}
