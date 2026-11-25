import express from "express";
import { ROLES } from "@cvm/shared";
import { requireAuth, requireRole } from "../middleware/auth-context.js";

export function createOpsAnalyticsRoutes({ configService, opsService, analyticsService }) {
  const router = express.Router();

  // TECH_STAFF Operations
  router.get("/health/cluster", requireAuth, requireRole(ROLES.TECH_STAFF), async (_req, res, next) => {
    try {
      res.json(await opsService.getClusterHealth());
    } catch (error) {
      next(error);
    }
  });

  router.get("/queues", requireAuth, requireRole(ROLES.TECH_STAFF), async (_req, res, next) => {
    try {
      res.json(await opsService.getQueuesSnapshot());
    } catch (error) {
      next(error);
    }
  });

  router.post("/queues/retry", requireAuth, requireRole(ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const result = await opsService.retryDlqMessages({
        dlqName: req.body?.dlq_name || req.body?.dlqName,
        count: req.body?.count,
        actor: req.auth,
        requestId: req.requestId || "",
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/vector/reindex", requireAuth, requireRole(ROLES.TECH_STAFF), async (req, res, next) => {
    try {
      const result = await opsService.reindexVectorCollection({
        target: req.body?.target || "resumes",
        batchSize: req.body?.batchSize || 100,
        actor: req.auth,
        requestId: req.requestId || "",
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/audit-logs", requireAuth, requireRole(ROLES.TECH_STAFF, ROLES.PLATFORM_OWNER), async (req, res, next) => {
    try {
      const logs = await configService.listAuditLogs({
        action: req.query?.action || null,
        limit: req.query?.limit,
      });
      res.json({ logs });
    } catch (error) {
      next(error);
    }
  });

  // PLATFORM_OWNER BI Analytics
  router.get(
    "/analytics/overview",
    requireAuth,
    requireRole(ROLES.PLATFORM_OWNER, ROLES.TECH_STAFF),
    async (req, res, next) => {
      try {
        res.json(
          await analyticsService.getOverview({
            range: req.query?.range || "30d",
            from: req.query?.from || null,
            to: req.query?.to || null,
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/analytics/funnel",
    requireAuth,
    requireRole(ROLES.PLATFORM_OWNER, ROLES.TECH_STAFF),
    async (req, res, next) => {
      try {
        res.json(await analyticsService.getFunnel({ range: req.query?.range || "30d" }));
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/analytics/export",
    requireAuth,
    requireRole(ROLES.PLATFORM_OWNER, ROLES.TECH_STAFF),
    async (req, res, next) => {
      try {
        const csv = await analyticsService.exportCsv({ range: req.query?.range || "30d" });
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="platform-analytics.csv"');
        res.send(csv);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
