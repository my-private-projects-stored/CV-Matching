import crypto from "node:crypto";

export const RESUMES_COLLECTION = "resumes_vectors";

export function toQdrantPointId(id) {
  const hex = crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Qdrant vector store adapter for resumes_vectors.
 */
export function createResumeVectorStore(qdrantClient) {
  let collectionEnsured = false;

  async function ensureCollection(vectorSize = 384) {
    if (collectionEnsured || !qdrantClient) return;
    if (
      typeof qdrantClient.getCollections === "function" &&
      typeof qdrantClient.createCollection === "function"
    ) {
      const { collections = [] } = await qdrantClient.getCollections();
      const aliases =
        typeof qdrantClient.getAliases === "function"
          ? (await qdrantClient.getAliases().catch(() => ({ aliases: [] }))).aliases || []
          : [];
      const exists =
        collections.some((c) => c.name === RESUMES_COLLECTION) ||
        aliases.some((a) => a.alias_name === RESUMES_COLLECTION);
      if (!exists) {
        try {
          await qdrantClient.createCollection(RESUMES_COLLECTION, {
            vectors: { size: vectorSize, distance: "Cosine" },
          });
        } catch (err) {
          if (err?.status !== 409 && err?.status !== 400) throw err;
        }
      }
    }
    collectionEnsured = true;
  }

  async function upsertResumeVector({ resumeId, candidateId, isAnalyzed = true, vector }) {
    if (!qdrantClient) {
      throw new Error("Qdrant client is not configured");
    }
    await ensureCollection(Array.isArray(vector) && vector.length ? vector.length : 384);
    const pointId = toQdrantPointId(resumeId);
    await qdrantClient.upsert(RESUMES_COLLECTION, {
      wait: true,
      points: [
        {
          id: pointId,
          vector,
          payload: {
            mongoId: String(resumeId),
            candidateId: String(candidateId),
            isAnalyzed: Boolean(isAnalyzed),
          },
        },
      ],
    });
    return { pointId, collection: RESUMES_COLLECTION };
  }

  async function deleteResumeVector(resumeId) {
    if (!qdrantClient) return;
    const pointId = toQdrantPointId(resumeId);
    try {
      await qdrantClient.delete(RESUMES_COLLECTION, {
        wait: true,
        points: [pointId],
      });
    } catch (err) {
      if (err?.status !== 404) throw err;
    }
  }

  return {
    upsertResumeVector,
    deleteResumeVector,
  };
}
