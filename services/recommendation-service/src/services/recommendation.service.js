import crypto from "node:crypto";
import { REDIS_KEYS, createHttpError } from "@cvm/shared";

function toQdrantPointId(id) {
  const hex = crypto.createHash("sha256").update(String(id)).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function withTimeout(promise, timeoutMs, label = "Operation") {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    if (typeof timer.unref === "function") timer.unref();
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

function tokenize(textOrArray) {
  const raw = Array.isArray(textOrArray) ? textOrArray.join(" ") : String(textOrArray || "");
  return Array.from(
    new Set(
      raw
        .toLowerCase()
        .split(/[^a-z0-9.+#-]+/i)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2)
    )
  );
}

export function computeKeywordOverlapScore(sourceTokensInput, targetTokensInput) {
  const targetTokens = tokenize(targetTokensInput);
  if (targetTokens.length === 0) {
    return { keywordScore: 0, matchedKeywords: [], missingKeywords: [] };
  }

  const sourceSet = new Set(tokenize(sourceTokensInput));
  const matchedKeywords = [];
  const missingKeywords = [];

  for (const token of targetTokens) {
    if (sourceSet.has(token)) matchedKeywords.push(token);
    else missingKeywords.push(token);
  }

  const keywordScore = Number((matchedKeywords.length / targetTokens.length).toFixed(4));
  return {
    keywordScore,
    matchedKeywords: matchedKeywords.slice(0, 20),
    missingKeywords: missingKeywords.slice(0, 20),
  };
}

function buildSearchCacheKey(params) {
  const hash = crypto.createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0, 24);
  return REDIS_KEYS.jobsCache(hash);
}

/**
 * Recommendation & Semantic Search service with Redis Cache-Aside (300s),
 * Qdrant HNSW matching (Cosine >= 0.60, Hybrid 0.65/0.35), and 1.5s keyword fallback.
 */
export function createRecommendationService({
  qdrantClient = null,
  redisBus = null,
  jobCatalogClient,
  resumeCatalogClient,
  qdrantTimeoutMs = 1500,
  defaultScoreThreshold = 0.6,
  defaultSemanticWeight = 0.65,
} = {}) {
  async function searchQdrantPoints(collectionName, { vector, limit, score_threshold, filter, with_payload = true }) {
    if (!qdrantClient) {
      throw new Error("Qdrant client is not configured");
    }
    if (typeof qdrantClient.search === "function") {
      return qdrantClient.search(collectionName, {
        vector,
        limit,
        score_threshold,
        filter,
        with_payload,
      });
    }
    if (typeof qdrantClient.query === "function") {
      const result = await qdrantClient.query(collectionName, {
        query: vector,
        limit,
        score_threshold,
        filter,
        with_payload,
      });
      return Array.isArray(result) ? result : result?.points || [];
    }
    throw new Error("Qdrant client does not support search or query");
  }

  async function retrievePointVector(collectionName, id) {
    if (!qdrantClient) {
      throw new Error("Qdrant client is not configured");
    }
    const pointId = toQdrantPointId(id);
    const points = await withTimeout(
      qdrantClient.retrieve(collectionName, { ids: [pointId], with_vector: true }),
      qdrantTimeoutMs,
      `Qdrant retrieve(${collectionName})`
    );
    const vector = points?.[0]?.vector;
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error(`Vector not found in ${collectionName} for ${id}`);
    }
    return vector;
  }

  async function searchJobs({
    query = "",
    category = "",
    location = "",
    skills = [],
    page = 1,
    limit = 20,
  } = {}) {
    const startedAt = Date.now();
    const normalized = {
      query: String(query || "").trim().toLowerCase(),
      category: String(category || "").trim().toLowerCase(),
      location: String(location || "").trim().toLowerCase(),
      skills: Array.isArray(skills) ? skills.map((s) => String(s).trim().toLowerCase()).sort() : [],
      page: Math.max(1, Number.parseInt(String(page), 10) || 1),
      limit: Math.min(100, Math.max(1, Number.parseInt(String(limit), 10) || 20)),
    };

    const cacheKey = buildSearchCacheKey(normalized);
    if (redisBus && typeof redisBus.cacheGetJson === "function") {
      const cached = await redisBus.cacheGetJson(cacheKey);
      if (cached) {
        return {
          ...cached,
          cache_hit: true,
          latency_ms: Date.now() - startedAt,
        };
      }
    }

    const catalogResult = await jobCatalogClient.listActiveJobs(normalized);
    const responsePayload = {
      jobs: catalogResult?.jobs || [],
      pagination: catalogResult?.pagination || {
        page: normalized.page,
        limit: normalized.limit,
        total: (catalogResult?.jobs || []).length,
      },
    };

    if (redisBus && typeof redisBus.cacheSetJson === "function") {
      await redisBus.cacheSetJson(cacheKey, responsePayload, 300);
    }

    return {
      ...responsePayload,
      cache_hit: false,
      latency_ms: Date.now() - startedAt,
    };
  }

  async function recommendJobsForResume({
    resumeId,
    limit = 10,
    scoreThreshold = defaultScoreThreshold,
    semanticWeight = defaultSemanticWeight,
  } = {}) {
    if (!resumeId) {
      throw createHttpError(400, "resume_id is required", "missing_resume_id");
    }

    const resume = await resumeCatalogClient.getResumeById(resumeId);
    if (!resume) {
      throw createHttpError(404, "Resume not found", "resume_not_found");
    }

    const safeLimit = Math.min(50, Math.max(1, Number.parseInt(String(limit), 10) || 10));
    const safeThreshold = Number.isFinite(Number(scoreThreshold)) ? Number(scoreThreshold) : defaultScoreThreshold;
    const safeWeight = Number.isFinite(Number(semanticWeight)) ? Number(semanticWeight) : defaultSemanticWeight;
    const resumeText = [resume.rawText || "", ...(resume.parsedData?.skills || [])].join(" ");

    try {
      const resumeVector = await retrievePointVector("resumes_vectors", resumeId);
      const hits = await withTimeout(
        searchQdrantPoints("jobs_vectors", {
          vector: resumeVector,
          limit: safeLimit,
          score_threshold: safeThreshold,
          filter: {
            must: [{ key: "status", match: { any: ["active", "open"] } }],
          },
          with_payload: true,
        }),
        qdrantTimeoutMs,
        "Qdrant search(jobs_vectors)"
      );

      const recommendations = [];
      for (const hit of hits || []) {
        const jobId = String(hit?.payload?.mongoId || "");
        if (!jobId) continue;
        const job = await jobCatalogClient.getJobById(jobId);
        if (!job) continue;

        const semanticScore = Number(hit.score || 0);
        const jobText = [job.title, job.category, ...(job.skills || []), job.description, job.requirements].join(" ");
        const kw = computeKeywordOverlapScore(resumeText, jobText);
        const hybridScore = Number((safeWeight * semanticScore + (1 - safeWeight) * kw.keywordScore).toFixed(4));

        recommendations.push({
          job_id: jobId,
          title: job.title,
          company_name: job.companyName || "",
          category: job.category || "general",
          location: job.location || "",
          semantic_score: semanticScore,
          keyword_score: kw.keywordScore,
          hybrid_score: hybridScore,
          matched_keywords: kw.matchedKeywords,
          missing_keywords: kw.missingKeywords,
        });
      }

      recommendations.sort((a, b) => b.hybrid_score - a.hybrid_score);
      const dataItems = recommendations.map((rec) => ({
        ...rec,
        scores: {
          semantic_score: rec.semantic_score,
          keyword_score: rec.keyword_score,
          hybrid_score: rec.hybrid_score,
        },
        explainability: {
          matched_keywords: rec.matched_keywords,
          missing_keywords: rec.missing_keywords,
        },
      }));
      return {
        recommendations,
        data: dataItems,
        meta: {
          resume_id: String(resumeId),
          total: dataItems.length,
          semantic_weight: safeWeight,
        },
        fallback_mode: null,
        source: "qdrant_hnsw",
        threshold: safeThreshold,
      };
    } catch (err) {
      const active = await jobCatalogClient.listActiveJobs({ limit: 100 });
      const jobs = active?.jobs || [];
      const fallback = jobs
        .map((job) => {
          const jobText = [job.title, job.category, ...(job.skills || []), job.description, job.requirements].join(" ");
          const kw = computeKeywordOverlapScore(resumeText, jobText);
          return {
            job_id: String(job._id),
            title: job.title,
            company_name: job.companyName || "",
            category: job.category || "general",
            location: job.location || "",
            semantic_score: 0,
            keyword_score: kw.keywordScore,
            hybrid_score: kw.keywordScore,
            matched_keywords: kw.matchedKeywords,
            missing_keywords: kw.missingKeywords,
          };
        })
        .sort((a, b) => b.keyword_score - a.keyword_score)
        .slice(0, safeLimit);

      const dataItems = fallback.map((rec) => ({
        ...rec,
        scores: {
          semantic_score: rec.semantic_score,
          keyword_score: rec.keyword_score,
          hybrid_score: rec.hybrid_score,
        },
        explainability: {
          matched_keywords: rec.matched_keywords,
          missing_keywords: rec.missing_keywords,
        },
      }));

      return {
        recommendations: fallback,
        data: dataItems,
        meta: {
          resume_id: String(resumeId),
          total: dataItems.length,
          semantic_weight: safeWeight,
        },
        fallback_mode: "keyword",
        source: "keyword_fallback",
        degraded_reason: err?.message || "qdrant_unavailable",
      };
    }
  }

  async function recommendResumesForJob({
    jobId,
    limit = 10,
    scoreThreshold = defaultScoreThreshold,
    semanticWeight = defaultSemanticWeight,
  } = {}) {
    if (!jobId) {
      throw createHttpError(400, "job_id is required", "missing_job_id");
    }

    const job = await jobCatalogClient.getJobById(jobId);
    if (!job) {
      throw createHttpError(404, "Job not found", "job_not_found");
    }

    const safeLimit = Math.min(50, Math.max(1, Number.parseInt(String(limit), 10) || 10));
    const safeThreshold = Number.isFinite(Number(scoreThreshold)) ? Number(scoreThreshold) : defaultScoreThreshold;
    const safeWeight = Number.isFinite(Number(semanticWeight)) ? Number(semanticWeight) : defaultSemanticWeight;
    const jobText = [job.title, job.category, ...(job.skills || []), job.description, job.requirements].join(" ");

    try {
      const jobVector = await retrievePointVector("jobs_vectors", jobId);
      const hits = await withTimeout(
        searchQdrantPoints("resumes_vectors", {
          vector: jobVector,
          limit: safeLimit,
          score_threshold: safeThreshold,
          filter: {
            must: [{ key: "isAnalyzed", match: { value: true } }],
          },
          with_payload: true,
        }),
        qdrantTimeoutMs,
        "Qdrant search(resumes_vectors)"
      );

      const recommendations = [];
      for (const hit of hits || []) {
        const resumeId = String(hit?.payload?.mongoId || "");
        if (!resumeId) continue;
        const resume = await resumeCatalogClient.getResumeById(resumeId);
        if (!resume) continue;

        const semanticScore = Number(hit.score || 0);
        const resumeText = [resume.rawText || "", ...(resume.parsedData?.skills || [])].join(" ");
        const kw = computeKeywordOverlapScore(resumeText, jobText);
        const hybridScore = Number((safeWeight * semanticScore + (1 - safeWeight) * kw.keywordScore).toFixed(4));

        const topSkills =
          Array.isArray(resume.parsedData?.skills) && resume.parsedData.skills.length
            ? resume.parsedData.skills.slice(0, 8)
            : Array.isArray(resume.builderData?.sections?.additional?.technicalSkills) &&
                resume.builderData.sections.additional.technicalSkills.length
              ? resume.builderData.sections.additional.technicalSkills.slice(0, 8)
              : kw.matchedKeywords.slice(0, 5);

        recommendations.push({
          resume_id: resumeId,
          candidate_id: String(resume.candidateId),
          candidate_name:
            resume.parsedData?.personalInfo?.name ||
            resume.builderData?.sections?.personalInfo?.name ||
            `Candidate ${String(resume.candidateId || "").slice(-6)}`,
          candidate_email:
            resume.parsedData?.personalInfo?.email ||
            resume.builderData?.sections?.personalInfo?.email ||
            null,
          resume_title: resume.title || resume.fileName || "Resume",
          current_role:
            resume.parsedData?.personalInfo?.title ||
            resume.builderData?.sections?.personalInfo?.title ||
            null,
          is_master: Boolean(resume.isMaster),
          processing_status:
            resume.processingStatus === "completed" ? "ready" : resume.processingStatus || "ready",
          top_skills: topSkills,
          title: resume.title || "",
          semantic_score: semanticScore,
          keyword_score: kw.keywordScore,
          hybrid_score: hybridScore,
          matched_keywords: kw.matchedKeywords,
          missing_keywords: kw.missingKeywords,
        });
      }

      recommendations.sort((a, b) => b.hybrid_score - a.hybrid_score);
      const dataItems = recommendations.map((rec) => ({
        ...rec,
        scores: {
          semantic_score: rec.semantic_score,
          keyword_score: rec.keyword_score,
          hybrid_score: rec.hybrid_score,
        },
        explainability: {
          matched_keywords: rec.matched_keywords,
          missing_keywords: rec.missing_keywords,
        },
      }));
      return {
        recommendations,
        data: dataItems,
        meta: {
          job_id: String(jobId),
          total: dataItems.length,
          semantic_weight: safeWeight,
        },
        fallback_mode: null,
        source: "qdrant_hnsw",
        threshold: safeThreshold,
      };
    } catch (err) {
      const candidates = await resumeCatalogClient.listCandidateResumes({ limit: 100 });
      const fallback = (candidates || [])
        .map((resume) => {
          const resumeText = [resume.rawText || "", ...(resume.parsedData?.skills || [])].join(" ");
          const kw = computeKeywordOverlapScore(resumeText, jobText);
          const topSkills =
            Array.isArray(resume.parsedData?.skills) && resume.parsedData.skills.length
              ? resume.parsedData.skills.slice(0, 8)
              : Array.isArray(resume.builderData?.sections?.additional?.technicalSkills) &&
                  resume.builderData.sections.additional.technicalSkills.length
                ? resume.builderData.sections.additional.technicalSkills.slice(0, 8)
                : kw.matchedKeywords.slice(0, 5);
          return {
            resume_id: String(resume._id),
            candidate_id: String(resume.candidateId),
            candidate_name:
              resume.parsedData?.personalInfo?.name ||
              resume.builderData?.sections?.personalInfo?.name ||
              `Candidate ${String(resume.candidateId || "").slice(-6)}`,
            candidate_email:
              resume.parsedData?.personalInfo?.email ||
              resume.builderData?.sections?.personalInfo?.email ||
              null,
            resume_title: resume.title || resume.fileName || "Resume",
            current_role:
              resume.parsedData?.personalInfo?.title ||
              resume.builderData?.sections?.personalInfo?.title ||
              null,
            is_master: Boolean(resume.isMaster),
            processing_status:
              resume.processingStatus === "completed" ? "ready" : resume.processingStatus || "ready",
            top_skills: topSkills,
            title: resume.title || "",
            semantic_score: 0,
            keyword_score: kw.keywordScore,
            hybrid_score: kw.keywordScore,
            matched_keywords: kw.matchedKeywords,
            missing_keywords: kw.missingKeywords,
          };
        })
        .sort((a, b) => b.keyword_score - a.keyword_score)
        .slice(0, safeLimit);

      const dataItems = fallback.map((rec) => ({
        ...rec,
        scores: {
          semantic_score: rec.semantic_score,
          keyword_score: rec.keyword_score,
          hybrid_score: rec.hybrid_score,
        },
        explainability: {
          matched_keywords: rec.matched_keywords,
          missing_keywords: rec.missing_keywords,
        },
      }));

      return {
        recommendations: fallback,
        data: dataItems,
        meta: {
          job_id: String(jobId),
          total: dataItems.length,
          semantic_weight: safeWeight,
        },
        fallback_mode: "keyword",
        source: "keyword_fallback",
        degraded_reason: err?.message || "qdrant_unavailable",
      };
    }
  }

  async function indexJobVector({ jobId, vector = [], payload = {} }) {
    if (!qdrantClient || !Array.isArray(vector) || vector.length === 0) {
      throw createHttpError(400, "Valid vector is required", "invalid_vector_payload");
    }
    const pointId = toQdrantPointId(jobId);
    await qdrantClient.upsert("jobs_vectors", {
      wait: true,
      points: [{ id: pointId, vector, payload: { mongoId: String(jobId), ...payload } }],
    });
    return { message: "Job vector indexed", qdrantId: pointId };
  }

  async function indexResumeVector({ resumeId, vector = [], payload = {} }) {
    if (!qdrantClient || !Array.isArray(vector) || vector.length === 0) {
      throw createHttpError(400, "Valid vector is required", "invalid_vector_payload");
    }
    const pointId = toQdrantPointId(resumeId);
    await qdrantClient.upsert("resumes_vectors", {
      wait: true,
      points: [{ id: pointId, vector, payload: { mongoId: String(resumeId), ...payload } }],
    });
    return { message: "Resume vector indexed", qdrantId: pointId };
  }

  async function searchResumesByVector({ vector = [], limit = 10, scoreThreshold = defaultScoreThreshold }) {
    if (!qdrantClient || !Array.isArray(vector) || vector.length === 0) return [];
    const hits = await withTimeout(
      searchQdrantPoints("resumes_vectors", { vector, limit: Number(limit) || 10, score_threshold: Number(scoreThreshold) || 0, with_payload: true }),
      qdrantTimeoutMs,
      "Qdrant search(resumes_vectors)"
    );
    return (hits || []).map((h) => ({ id: String(h.id), score: Number(h.score || 0), payload: h.payload || {} }));
  }

  async function searchJobsByVector({ vector = [], limit = 10, scoreThreshold = defaultScoreThreshold }) {
    if (!qdrantClient || !Array.isArray(vector) || vector.length === 0) return [];
    const hits = await withTimeout(
      searchQdrantPoints("jobs_vectors", { vector, limit: Number(limit) || 10, score_threshold: Number(scoreThreshold) || 0, with_payload: true }),
      qdrantTimeoutMs,
      "Qdrant search(jobs_vectors)"
    );
    return (hits || []).map((h) => ({ id: String(h.id), score: Number(h.score || 0), payload: h.payload || {} }));
  }

  async function scorePair({ jobId, resumeId }) {
    const [job, resume] = await Promise.all([
      jobCatalogClient.getJobById(jobId),
      resumeCatalogClient.getResumeById(resumeId),
    ]);
    if (!job || !resume) {
      throw createHttpError(404, "Job or Resume not found", "resource_not_found");
    }
    const jobText = [job.title, job.category, ...(job.skills || []), job.description, job.requirements].join(" ");
    const resumeText = [resume.rawText || "", ...(resume.parsedData?.skills || [])].join(" ");
    const kw = computeKeywordOverlapScore(resumeText, jobText);
    let semanticScore = kw.keywordScore;
    try {
      const [rVec, jVec] = await Promise.all([
        retrievePointVector("resumes_vectors", resumeId),
        retrievePointVector("jobs_vectors", jobId),
      ]);
      let dot = 0;
      let na = 0;
      let nb = 0;
      for (let i = 0; i < rVec.length && i < jVec.length; i += 1) {
        dot += rVec[i] * jVec[i];
        na += rVec[i] * rVec[i];
        nb += jVec[i] * jVec[i];
      }
      if (na > 0 && nb > 0) {
        semanticScore = Number(Math.max(0, Math.min(1, dot / (Math.sqrt(na) * Math.sqrt(nb)))).toFixed(4));
      }
    } catch {
      // Fallback to keyword score when vectors unavailable
    }
    const hybridScore = Number((defaultSemanticWeight * semanticScore + (1 - defaultSemanticWeight) * kw.keywordScore).toFixed(4));
    return {
      semantic_score: semanticScore,
      keyword_score: kw.keywordScore,
      hybrid_score: hybridScore,
      matched_keywords: kw.matchedKeywords,
      missing_keywords: kw.missingKeywords,
      data: {
        semantic_score: semanticScore,
        keyword_score: kw.keywordScore,
        hybrid_score: hybridScore,
        matched_keywords: kw.matchedKeywords,
        missing_keywords: kw.missingKeywords,
      },
    };
  }

  return {
    searchJobs,
    recommendJobsForResume,
    recommendResumesForJob,
    indexJobVector,
    indexResumeVector,
    searchResumesByVector,
    searchJobsByVector,
    scorePair,
  };
}
