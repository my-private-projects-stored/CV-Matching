import { apiPost } from './client';
import { buildApiClientError } from './error';

async function assertOk(res: Response, fallbackMessagePrefix: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  throw buildApiClientError(res.status, body, fallbackMessagePrefix);
}

export async function indexJobVector(
  jobId: string,
  payload: { vector: number[]; payload?: Record<string, unknown> }
): Promise<{ message: string; qdrantId: string }> {
  const res = await apiPost(`/vectors/jobs/${encodeURIComponent(jobId)}/index`, payload);
  await assertOk(res, 'Failed to index job vector');
  return res.json();
}

export async function indexResumeVector(
  resumeId: string,
  payload: { vector: number[]; payload?: Record<string, unknown> }
): Promise<{ message: string; qdrantId: string }> {
  const res = await apiPost(`/vectors/resumes/${encodeURIComponent(resumeId)}/index`, payload);
  await assertOk(res, 'Failed to index resume vector');
  return res.json();
}

export interface VectorSearchMatch {
  id: string;
  score: number;
  payload?: Record<string, unknown>;
}

export async function searchResumesByJobVector(payload: {
  vector: number[];
  limit?: number;
  scoreThreshold?: number;
}): Promise<VectorSearchMatch[]> {
  const res = await apiPost('/vectors/search/resumes', payload);
  await assertOk(res, 'Failed to search resumes');
  const body = (await res.json()) as { matches?: VectorSearchMatch[]; data?: VectorSearchMatch[] };
  return body.matches ?? body.data ?? [];
}

export async function searchJobsByResumeVector(payload: {
  vector: number[];
  limit?: number;
  scoreThreshold?: number;
}): Promise<VectorSearchMatch[]> {
  const res = await apiPost('/vectors/search/jobs', payload);
  await assertOk(res, 'Failed to search jobs');
  const body = (await res.json()) as { matches?: VectorSearchMatch[]; data?: VectorSearchMatch[] };
  return body.matches ?? body.data ?? [];
}

export interface HybridScorePairResult {
  semantic_score: number;
  keyword_score: number;
  hybrid_score: number;
  matched_keywords?: string[];
  missing_keywords?: string[];
}

export async function scorePair(payload: {
  job_id: string;
  resume_id: string;
}): Promise<HybridScorePairResult> {
  const res = await apiPost('/vectors/score/pair', payload);
  await assertOk(res, 'Failed to compute hybrid score');
  const body = (await res.json()) as {
    data?: HybridScorePairResult;
    semanticScore?: number;
    keywordScore?: number;
    hybridScore?: number;
    matchedKeywords?: string[];
    missingKeywords?: string[];
  } & Partial<HybridScorePairResult>;
  if (body.data) {
    return body.data;
  }
  return {
    semantic_score: Number(body.semantic_score ?? body.semanticScore ?? 0),
    keyword_score: Number(body.keyword_score ?? body.keywordScore ?? 0),
    hybrid_score: Number(body.hybrid_score ?? body.hybridScore ?? 0),
    matched_keywords: body.matched_keywords ?? body.matchedKeywords,
    missing_keywords: body.missing_keywords ?? body.missingKeywords,
  };
}
