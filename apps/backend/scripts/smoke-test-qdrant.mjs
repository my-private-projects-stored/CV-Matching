import "dotenv/config";

import { randomUUID } from "node:crypto";

import { ensureVectorCollections } from "../src/services/qdrant-collection.service.js";
import {
  deleteResumeVector,
  searchResumeVectorsByJobVector,
  upsertResumeVector,
} from "../src/services/vector-index.service.js";

function createRandomVector(size = Number(process.env.QDRANT_VECTOR_SIZE || 384)) {
  return Array.from({ length: size }, () => Math.random());
}

async function main() {
  await ensureVectorCollections();

  const qdrantId = randomUUID();
  const vector = createRandomVector();

  await upsertResumeVector({
    qdrantId,
    vector,
    payload: {
      source: "smoke-test",
      createdAt: new Date().toISOString(),
    },
  });

  const matches = await searchResumeVectorsByJobVector({
    vector,
    limit: 1,
    scoreThreshold: 0,
  });

  console.log("Smoke search results size:", matches.length);

  await deleteResumeVector(qdrantId);
  console.log("Smoke test completed successfully");
}

main().catch((error) => {
  console.error("Smoke test failed:", error.message);
  process.exitCode = 1;
});
