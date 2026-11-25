import Redis from "ioredis";
import mongoose from "mongoose";
import { SERVICE_DATABASES, buildServiceMongoUri, createRedisBus } from "@cvm/shared";
import { createApp } from "./app.js";

const PORT = Number.parseInt(process.env.PORT || "5001", 10);
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://admin:admin123@localhost:27017/?authSource=admin&replicaSet=rs0";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const DB_NAME = process.env.SERVICE_DB_NAME || SERVICE_DATABASES.auth;

async function start() {
  const serviceMongoUri = buildServiceMongoUri(MONGO_URI, DB_NAME);
  await mongoose.connect(serviceMongoUri);

  const redisClient = new Redis(REDIS_URL);
  const redisBus = createRedisBus(redisClient);
  redisClient.on("error", (err) => {
    console.error("[auth-service] Redis error:", err.message);
  });

  const app = createApp({ redisClient, redisBus });
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[auth-service] Listening on port ${PORT} (DB: ${DB_NAME})`);
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
  console.error("[auth-service] Failed to start:", err);
  process.exit(1);
});
