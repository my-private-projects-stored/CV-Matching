import { QdrantClient } from "@qdrant/js-client-rest";

const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
const qdrantApiKey = process.env.QDRANT_API_KEY || undefined;

export const QDRANT_COLLECTIONS = {
  JOBS: process.env.QDRANT_JOBS_COLLECTION || "jobs_vectors",
  RESUMES: process.env.QDRANT_RESUMES_COLLECTION || "resumes_vectors",
};

export const QDRANT_VECTOR_SIZE = Number(process.env.QDRANT_VECTOR_SIZE || 384);
export const QDRANT_DISTANCE = process.env.QDRANT_DISTANCE || "Cosine";

let qdrantClientInstance;

export function getQdrantClient() {
  if (!qdrantClientInstance) {
    qdrantClientInstance = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
    });
  }

  return qdrantClientInstance;
}
