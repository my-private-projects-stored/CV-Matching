import { QdrantClient } from "@qdrant/js-client-rest";
import Redis from "ioredis";
import { createRedisBus } from "@cvm/shared";
import { createApp } from "./app.js";

const PORT = Number.parseInt(process.env.PORT || "5005", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";

const redisClient = new Redis(REDIS_URL);
const redisBus = createRedisBus(redisClient);
redisClient.on("error", (err) => {
  console.error("[recommendation-service] Redis error:", err.message);
});

const qdrantClient = new QdrantClient({ url: QDRANT_URL, checkCompatibility: false });

const app = createApp({
  qdrantClient,
  redisBus,
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[recommendation-service] Listening on port ${PORT}`);
});

function shutdown() {
  server.close(() => {
    redisClient.disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
