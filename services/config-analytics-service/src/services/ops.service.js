import { createHttpError } from "@cvm/shared";

const DEFAULT_CLUSTER_TARGETS = Object.freeze({
  services: [
    { name: "auth-service", url: process.env.AUTH_SERVICE_URL || "http://auth-service:5001/api/health" },
    { name: "resume-service", url: process.env.RESUME_SERVICE_URL || "http://resume-service:5002/api/health" },
    { name: "job-service", url: process.env.JOB_SERVICE_URL || "http://job-service:5003/api/health" },
    { name: "application-service", url: process.env.APPLICATION_SERVICE_URL || "http://application-service:5004/api/health" },
    { name: "recommendation-service", url: process.env.RECOMMENDATION_SERVICE_URL || "http://recommendation-service:5005/api/health" },
    { name: "ai-enrichment-service", url: process.env.AI_ENRICHMENT_SERVICE_URL || "http://ai-enrichment-service:5006/api/health" },
    { name: "notification-service", url: process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:5007/api/health" },
    { name: "config-analytics-service", url: "self" },
  ],
  workers: [
    { name: "worker-parsing", url: process.env.PARSING_SERVICE_URL ? `${process.env.PARSING_SERVICE_URL}/health` : "http://worker-parsing:8020/health" },
    { name: "worker-embedding-sbert", url: process.env.EMBEDDING_SERVICE_URL ? `${process.env.EMBEDDING_SERVICE_URL}/health` : "http://worker-embedding-sbert:8010/health" },
    { name: "worker-scoring", url: process.env.SCORING_METRICS_URL || "http://worker-scoring:9101/health" },
    { name: "worker-notification", url: process.env.NOTIFICATION_METRICS_URL || "http://worker-notification:9102/health" },
  ],
  datastores: [
    { name: "mongo", url: "mongo-ping" },
    { name: "redis", url: "redis-ping" },
    { name: "qdrant", url: process.env.QDRANT_URL ? `${process.env.QDRANT_URL}/readyz` : "http://qdrant:6333/readyz" },
    { name: "minio", url: process.env.MINIO_HEALTH_URL || "http://minio:9000/minio/health/live" },
  ],
});

const DLQ_TO_MAIN_MAP = Object.freeze({
  application_scoring_queue_dlq: "application_scoring_queue",
  notification_queue_dlq: "notification_queue",
});

async function defaultProbe(target, timeoutMs, deps) {
  const startedAt = Date.now();
  if (target.url === "self") {
    return { name: target.name, status: "up", latency_ms: 0 };
  }
  if (target.url === "redis-ping") {
    if (!deps.redisClient?.ping) return { name: target.name, status: "down", latency_ms: 0, error: "not_configured" };
    await deps.redisClient.ping();
    return { name: target.name, status: "up", latency_ms: Date.now() - startedAt };
  }
  if (target.url === "mongo-ping") {
    if (!deps.mongoPing) return { name: target.name, status: "down", latency_ms: 0, error: "not_configured" };
    await deps.mongoPing();
    return { name: target.name, status: "up", latency_ms: Date.now() - startedAt };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer.unref === "function") timer.unref();
  try {
    const resp = await fetch(target.url, { signal: controller.signal });
    return {
      name: target.name,
      status: resp.ok ? "up" : "down",
      http_status: resp.status,
      latency_ms: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      name: target.name,
      status: "down",
      latency_ms: Date.now() - startedAt,
      error: String(err?.message || "unreachable"),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Technical operations service for TECH_STAFF: cluster health probe, Redis queue/DLQ retry,
 * and zero-downtime Qdrant Collection Alias Swap re-indexing.
 */
export function createOpsService({
  AuditLogModel,
  redisClient = null,
  qdrantClient = null,
  embeddingClient = null,
  recordLoader = null,
  mongoPing = null,
  clusterTargets = DEFAULT_CLUSTER_TARGETS,
  probeFn = null,
  probeTimeoutMs = 2000,
} = {}) {
  async function getClusterHealth() {
    const startedAt = Date.now();
    const runProbe = probeFn
      ? (target) => probeFn(target, probeTimeoutMs)
      : (target) => defaultProbe(target, probeTimeoutMs, { redisClient, mongoPing });

    const [services, workers, datastores] = await Promise.all([
      Promise.all((clusterTargets.services || []).map(runProbe)),
      Promise.all((clusterTargets.workers || []).map(runProbe)),
      Promise.all((clusterTargets.datastores || []).map(runProbe)),
    ]);

    const allUp = [...services, ...workers, ...datastores].every((item) => item.status === "up");
    return {
      status: allUp ? "healthy" : "degraded",
      checked_at: new Date().toISOString(),
      total_latency_ms: Date.now() - startedAt,
      services,
      workers,
      datastores,
    };
  }

  async function getQueuesSnapshot() {
    if (!redisClient) {
      throw createHttpError(503, "Redis client is not configured", "redis_unavailable");
    }

    const queueNames = [
      "application_scoring_queue",
      "application_scoring_queue_processing",
      "application_scoring_queue_dlq",
      "notification_queue",
      "notification_queue_processing",
      "notification_queue_dlq",
      "resume_processing_retry_queue",
    ];

    const lengths = await Promise.all(queueNames.map((q) => redisClient.llen(q)));
    const depths = Object.fromEntries(queueNames.map((q, i) => [q, Number(lengths[i] || 0)]));

    const [scoringDlqItems, notificationDlqItems] = await Promise.all([
      redisClient.lrange("application_scoring_queue_dlq", 0, 49),
      redisClient.lrange("notification_queue_dlq", 0, 49),
    ]);

    return {
      depths,
      dlqs: {
        application_scoring_queue_dlq: (scoringDlqItems || []).map((raw) => {
          try {
            return JSON.parse(raw);
          } catch {
            return { raw };
          }
        }),
        notification_queue_dlq: (notificationDlqItems || []).map((raw) => {
          try {
            return JSON.parse(raw);
          } catch {
            return { raw };
          }
        }),
      },
    };
  }

  async function retryDlqMessages({ dlqName, count = 10, actor, requestId = "" }) {
    const targetQueue = DLQ_TO_MAIN_MAP[String(dlqName || "").trim()];
    if (!targetQueue) {
      throw createHttpError(400, `Unsupported DLQ name '${dlqName}'`, "invalid_dlq_name");
    }
    if (!redisClient) {
      throw createHttpError(503, "Redis client is not configured", "redis_unavailable");
    }

    const maxCount = Math.min(200, Math.max(1, Number.parseInt(String(count), 10) || 10));
    let retriedCount = 0;

    for (let i = 0; i < maxCount; i += 1) {
      const raw = await redisClient.rpop(dlqName);
      if (!raw) break;

      let nextStr = raw;
      try {
        const parsed = JSON.parse(raw);
        parsed.retry_count = 0;
        delete parsed.dead_lettered_at;
        parsed.retried_at = new Date().toISOString();
        parsed.retried_by = String(actor?.id || "tech_staff");
        nextStr = JSON.stringify(parsed);
      } catch {
        // Requeue raw string if unparseable
      }

      await redisClient.lpush(targetQueue, nextStr);
      retriedCount += 1;
    }

    const auditLog = await AuditLogModel.create({
      actorId: String(actor?.id || "tech_staff"),
      actorRole: String(actor?.role || "tech_staff"),
      action: "RETRY_DLQ",
      targetKey: dlqName,
      before: { dlqName },
      after: { targetQueue, retriedCount },
      reason: `Retried ${retriedCount} DLQ messages`,
      requestId: String(requestId || ""),
    });

    return { dlqName, targetQueue, retriedCount, auditLog };
  }

  async function reindexVectorCollection({
    target = "resumes",
    batchSize = 100,
    actor,
    requestId = "",
  } = {}) {
    const normalizedTarget = String(target || "resumes").trim().toLowerCase();
    if (normalizedTarget !== "resumes" && normalizedTarget !== "jobs") {
      throw createHttpError(400, "target must be 'resumes' or 'jobs'", "invalid_reindex_target");
    }
    if (!qdrantClient || !embeddingClient || !recordLoader) {
      throw createHttpError(503, "Vector reindex dependencies are not configured", "reindex_unavailable");
    }

    const aliasName = normalizedTarget === "resumes" ? "resumes_vectors" : "jobs_vectors";
    const newCollection = `${aliasName}_v${Date.now()}`;
    const safeBatchSize = Math.min(100, Math.max(1, Number.parseInt(String(batchSize), 10) || 100));

    await qdrantClient.createCollection(newCollection, {
      vectors: { size: 384, distance: "Cosine" },
    });

    let offset = 0;
    let reindexedCount = 0;
    let batches = 0;

    while (true) {
      const records = await recordLoader(normalizedTarget, offset, safeBatchSize);
      if (!Array.isArray(records) || records.length === 0) {
        break;
      }

      const points = [];
      for (const rec of records) {
        const vector = await embeddingClient.embedText(rec.text || "");
        points.push({
          id: rec.pointId || String(rec.id),
          vector,
          payload: rec.payload || { mongoId: String(rec.id) },
        });
      }

      if (points.length > 0) {
        await qdrantClient.upsert(newCollection, { wait: true, points });
        reindexedCount += points.length;
      }

      batches += 1;
      offset += records.length;
      if (records.length < safeBatchSize) break;
    }

    const swapStart = performance.now();
    if (typeof qdrantClient.getCollections === "function") {
      const { collections = [] } = await qdrantClient.getCollections();
      const aliases =
        typeof qdrantClient.getAliases === "function"
          ? (await qdrantClient.getAliases().catch(() => ({ aliases: [] }))).aliases || []
          : [];
      const hasRealCollection = collections.some((c) => c.name === aliasName);
      const hasExistingAlias =
        typeof qdrantClient.getAliases === "function"
          ? aliases.some((a) => a.alias_name === aliasName)
          : true;
      if (hasRealCollection && typeof qdrantClient.deleteCollection === "function") {
        await qdrantClient.deleteCollection(aliasName);
      }
      const actions = [];
      if (hasExistingAlias) {
        actions.push({ delete_alias: { alias_name: aliasName } });
      }
      actions.push({ create_alias: { collection_name: newCollection, alias_name: aliasName } });
      await qdrantClient.updateCollectionAliases({ actions });
    } else {
      await qdrantClient.updateCollectionAliases({
        actions: [
          { delete_alias: { alias_name: aliasName } },
          { create_alias: { collection_name: newCollection, alias_name: aliasName } },
        ],
      });
    }
    const aliasSwapMs = Number((performance.now() - swapStart).toFixed(2));

    const auditLog = await AuditLogModel.create({
      actorId: String(actor?.id || "tech_staff"),
      actorRole: String(actor?.role || "tech_staff"),
      action: "REINDEX_VECTORS",
      targetKey: aliasName,
      before: { alias: aliasName },
      after: { newCollection, reindexedCount, batches, alias_swap_ms: aliasSwapMs },
      reason: `Atomic collection alias swap to ${newCollection}`,
      requestId: String(requestId || ""),
    });

    return {
      alias: aliasName,
      newCollection,
      reindexedCount,
      batches,
      alias_swap_ms: aliasSwapMs,
      auditLog,
    };
  }

  return {
    getClusterHealth,
    getQueuesSnapshot,
    retryDlqMessages,
    reindexVectorCollection,
  };
}
