import {
  getQdrantClient,
  QDRANT_COLLECTIONS,
  QDRANT_DISTANCE,
  QDRANT_VECTOR_SIZE,
} from "./client.js";

function isNotFoundError(error) {
  return error?.status === 404 || error?.statusCode === 404;
}

function assertVector(vector) {
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Vector is required and must be a non-empty array");
  }
}

export async function ensureCollectionExists(collectionName) {
  const client = getQdrantClient();

  try {
    await client.getCollection(collectionName);
    return { created: false, collectionName };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    await client.createCollection(collectionName, {
      vectors: {
        size: QDRANT_VECTOR_SIZE,
        distance: QDRANT_DISTANCE,
      },
    });

    return { created: true, collectionName };
  }
}

export async function ensureVectorCollections() {
  const results = await Promise.all([
    ensureCollectionExists(QDRANT_COLLECTIONS.JOBS),
    ensureCollectionExists(QDRANT_COLLECTIONS.RESUMES),
  ]);

  return {
    jobs: results[0],
    resumes: results[1],
  };
}

export async function upsertJobVector({ qdrantId, vector, payload = {} }) {
  assertVector(vector);

  const client = getQdrantClient();
  await client.upsert(QDRANT_COLLECTIONS.JOBS, {
    wait: true,
    points: [
      {
        id: qdrantId,
        vector,
        payload,
      },
    ],
  });
}

export async function upsertResumeVector({ qdrantId, vector, payload = {} }) {
  assertVector(vector);

  const client = getQdrantClient();
  await client.upsert(QDRANT_COLLECTIONS.RESUMES, {
    wait: true,
    points: [
      {
        id: qdrantId,
        vector,
        payload,
      },
    ],
  });
}

export async function deleteJobVector(qdrantId) {
  const client = getQdrantClient();
  await client.delete(QDRANT_COLLECTIONS.JOBS, {
    wait: true,
    points: [qdrantId],
  });
}

export async function deleteResumeVector(qdrantId) {
  const client = getQdrantClient();
  await client.delete(QDRANT_COLLECTIONS.RESUMES, {
    wait: true,
    points: [qdrantId],
  });
}

export async function searchResumeVectorsByJobVector({ vector, limit = 10, scoreThreshold = 0 }) {
  assertVector(vector);

  const client = getQdrantClient();
  return client.search(QDRANT_COLLECTIONS.RESUMES, {
    vector,
    limit,
    score_threshold: scoreThreshold,
    with_payload: true,
  });
}

export async function searchJobVectorsByResumeVector({ vector, limit = 10, scoreThreshold = 0 }) {
  assertVector(vector);

  const client = getQdrantClient();
  return client.search(QDRANT_COLLECTIONS.JOBS, {
    vector,
    limit,
    score_threshold: scoreThreshold,
    with_payload: true,
  });
}
