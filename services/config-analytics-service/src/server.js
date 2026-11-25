import crypto from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import Redis from "ioredis";
import mongoose from "mongoose";
import { SERVICE_DATABASES, buildServiceMongoUri, createRedisBus } from "@cvm/shared";
import { createApp } from "./app.js";
import { createMongoAnalyticsProvider } from "./services/analytics.service.js";

const PORT = Number.parseInt(process.env.PORT || "5008", 10);
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://admin:admin123@localhost:27017/?authSource=admin&replicaSet=rs0";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || "http://worker-embedding-sbert:8010";
const DB_NAME = process.env.SERVICE_DB_NAME || SERVICE_DATABASES.config;

function toQdrantPointId(id) {
  const hex = crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function start() {
  const serviceMongoUri = buildServiceMongoUri(MONGO_URI, DB_NAME);
  await mongoose.connect(serviceMongoUri);

  const redisClient = new Redis(REDIS_URL);
  const redisBus = createRedisBus(redisClient);
  redisClient.on("error", (err) => {
    console.error("[config-analytics-service] Redis error:", err.message);
  });

  const qdrantClient = new QdrantClient({ url: QDRANT_URL, checkCompatibility: false });
  const embeddingClient = {
    async embedText(text) {
      const resp = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: String(text || "") }),
      });
      if (!resp.ok) throw new Error(`Embedding failed (${resp.status})`);
      const data = await resp.json();
      return data.vector;
    },
  };

  const recordLoader = async (target, offset, limit) => {
    const dbName = target === "resumes" ? SERVICE_DATABASES.resume : SERVICE_DATABASES.job;
    const collName = target === "resumes" ? "resumes" : "jobs";
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    const docs = await db
      .collection(collName)
      .find({}, { readPreference: "secondaryPreferred" })
      .skip(offset)
      .limit(limit)
      .toArray();
    return docs.map((d) => ({
      id: String(d._id),
      pointId: toQdrantPointId(d._id),
      text: d.rawText || [d.title, d.description, ...(d.skills || [])].filter(Boolean).join("\n"),
      payload:
        target === "resumes"
          ? { mongoId: String(d._id), candidateId: String(d.candidateId || ""), isAnalyzed: Boolean(d.isAnalyzed) }
          : { mongoId: String(d._id), category: String(d.category || "general"), status: String(d.status || "active") },
    }));
  };

  const app = createApp({
    redisClient,
    redisBus,
    qdrantClient,
    embeddingClient,
    recordLoader,
    mongoPing: async () => mongoose.connection.db.admin().ping(),
    analyticsProvider: createMongoAnalyticsProvider(mongoose.connection),
    listLlmEvents: async ({ feature = null, generation_mode = null, limit = 50 } = {}) => {
      const db = mongoose.connection.useDb(SERVICE_DATABASES.enrichment, { useCache: true });
      const filter = {};
      if (feature) filter.feature = feature;
      if (generation_mode) filter.generation_mode = generation_mode;
      const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
      return db.collection("ai_generation_events").find(filter).sort({ createdAt: -1 }).limit(safeLimit).toArray();
    },
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[config-analytics-service] Listening on port ${PORT} (DB: ${DB_NAME})`);
  });

  function shutdown() {
    server.close(async () => {
      redisClient.disconnect();
      await mongoose.disconnect();
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("[config-analytics-service] Failed to start:", err);
  process.exit(1);
});
