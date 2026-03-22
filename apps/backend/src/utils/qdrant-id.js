import { randomUUID } from "node:crypto";

// Sinh UUID chuẩn cho point_id của Qdrant.
export function createQdrantId() {
  return randomUUID();
}

// Dam bao document luon co qdrantId truoc khi luu.
export function ensureQdrantId(doc) {
  if (!doc.qdrantId) {
    doc.qdrantId = createQdrantId();
  }

  return doc;
}
