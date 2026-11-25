import Redis from "ioredis";
import { createRedisBus } from "@cvm/shared";
import { createApp } from "./app.js";

const PORT = Number.parseInt(process.env.PORT || "3001", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const redisClient = new Redis(REDIS_URL);
const subscriberClient = new Redis(REDIS_URL);
const redisBus = createRedisBus(redisClient);

redisClient.on("error", (err) => {
  console.error("[api-gateway] Redis client error:", err.message);
});
subscriberClient.on("error", (err) => {
  console.error("[api-gateway] Redis subscriber error:", err.message);
});

const app = createApp({
  redisClient,
  subscriberClient,
  redisBus,
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[api-gateway] Listening on port ${PORT}`);
});

function shutdown() {
  server.close(() => {
    redisClient.disconnect();
    subscriberClient.disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
