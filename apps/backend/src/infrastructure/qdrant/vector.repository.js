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
  if (vector.length !== QDRANT_VECTOR_SIZE) {
    throw new Error(`Vector dimension must be ${QDRANT_VECTOR_SIZE}`);
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
  if (!qdrantId) {
    return;
  }

  const client = getQdrantClient();
  try {
    await client.delete(QDRANT_COLLECTIONS.JOBS, {
      wait: true,
      points: [qdrantId],
    });
  } catch (error) {
    if (!isNotFoundError(error)) {
      console.warn("[qdrant] deleteJobVector error, continuing", error?.message || error);
    }
  }
}

export async function deleteResumeVector(qdrantId) {
  if (!qdrantId) {
    return;
  }

  const client = getQdrantClient();
  try {
    await client.delete(QDRANT_COLLECTIONS.RESUMES, {
      wait: true,
      points: [qdrantId],
    });
  } catch (error) {
    if (!isNotFoundError(error)) {
      console.warn("[qdrant] deleteResumeVector error, continuing", error?.message || error);
    }
  }
}

async function getVectorPoint(collectionName, qdrantId, { withVector = true } = {}) {
  if (!qdrantId) {
    return null;
  }

  const client = getQdrantClient();
  try {
    const points = await client.retrieve(collectionName, {
      ids: [qdrantId],
      with_payload: true,
      with_vector: withVector,
    });

    return Array.isArray(points) && points.length > 0 ? points[0] : null;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function getJobVectorPoint(qdrantId, options = {}) {
  return getVectorPoint(QDRANT_COLLECTIONS.JOBS, qdrantId, options);
}

export async function getResumeVectorPoint(qdrantId, options = {}) {
  return getVectorPoint(QDRANT_COLLECTIONS.RESUMES, qdrantId, options);
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

