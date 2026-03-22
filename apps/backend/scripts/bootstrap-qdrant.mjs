import "dotenv/config";

import { ensureVectorCollections } from "../src/services/qdrant-collection.service.js";

async function main() {
  const result = await ensureVectorCollections();
  console.log("Qdrant bootstrap result:", result);
}

main().catch((error) => {
  console.error("Qdrant bootstrap failed:", error.message);
  process.exitCode = 1;
});
