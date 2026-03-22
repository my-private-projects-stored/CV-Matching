import { ensureVectorCollections } from "../infrastructure/qdrant/vector.repository.js";

// Bootstrap collection state cho Qdrant khi app startup.
export async function bootstrapQdrant() {
  return ensureVectorCollections();
}
