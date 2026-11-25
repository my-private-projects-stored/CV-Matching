import crypto from "node:crypto";

export const JOBS_COLLECTION = "jobs_vectors";

export function toQdrantPointId(id) {
  const hex = crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Qdrant vector store adapter for jobs_vectors.
 */
export function createJobVectorStore(qdrantClient) {
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
        collections.some((c) => c.name === JOBS_COLLECTION) ||
        aliases.some((a) => a.alias_name === JOBS_COLLECTION);
      if (!exists) {
        try {
          await qdrantClient.createCollection(JOBS_COLLECTION, {
            vectors: { size: vectorSize, distance: "Cosine" },
          });
        } catch (err) {
          if (err?.status !== 409 && err?.status !== 400) throw err;
        }
      }
    }
    collectionEnsured = true;
  }

  async function upsertJobVector({ jobId, category = "general", status = "active", vector }) {
    if (!qdrantClient) {
      throw new Error("Qdrant client is not configured");
    }
    await ensureCollection(Array.isArray(vector) && vector.length ? vector.length : 384);
    const pointId = toQdrantPointId(jobId);
    await qdrantClient.upsert(JOBS_COLLECTION, {
      wait: true,
      points: [
        {
          id: pointId,
          vector,
          payload: {
            mongoId: String(jobId),
            category: String(category || "general"),
            status: String(status),
          },
        },
      ],
    });
    return { pointId, collection: JOBS_COLLECTION };
  }

  async function deleteJobVector(jobId) {
    if (!qdrantClient) return;
    const pointId = toQdrantPointId(jobId);
    try {
      await qdrantClient.delete(JOBS_COLLECTION, {
        wait: true,
        points: [pointId],
      });
    } catch (err) {
      if (err?.status !== 404) throw err;
    }
  }

  return {
    upsertJobVector,
    deleteJobVector,
  };
}
