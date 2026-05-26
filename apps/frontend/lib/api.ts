import { apiFetch } from './api/client';
import type {
  AiDetails,
  AiScores,
  AiStatus,
  Application,
  ApplicationStatus,
  Resume,
  User,
} from '@/types';

export type ApiPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type ApiResult<T> = {
  data: T | null;
  error?: string;
  pagination?: ApiPagination;
  meta?: unknown;
};

type QueryParams = Record<string, string | number | boolean | undefined | null>;

type BackendScores = {
  semantic_score?: number;
  keyword_score?: number;
  hybrid_score?: number;
};

type BackendExplainability = {
  matched_keywords?: string[];
  missing_keywords?: string[];
};

type BackendHistoryApplication = {
  application_id?: string;
  status?: ApplicationStatus;
  ai_status?: AiStatus;
  job?: {
    id?: string | null;
    title?: string;
    status?: string;
    location?: string | null;
    category?: string | null;
  };
  resume?: {
    id?: string | null;
    title?: string | null;
    processing_status?: string;
  };
  scores?: Pick<BackendScores, 'hybrid_score'>;
  submitted_at?: string;
  updated_at?: string;
};

type BackendRankedApplication = {
  application_id?: string;
  status?: ApplicationStatus;
  ai_status?: AiStatus;
  candidate?: {
    id?: string | null;
    full_name?: string;
    email?: string;
  };
  resume?: {
    id?: string | null;
    title?: string | null;
    processing_status?: string;
  };
  scores?: BackendScores;
  explainability?: BackendExplainability;
  updated_at?: string;
};

type BackendFeedback = {
  application_id?: string;
  job_id?: string | null;
  resume_id?: string | null;
  scores?: BackendScores;
  explainability?: BackendExplainability;
  status?: ApplicationStatus;
  ai_status?: AiStatus;
};

function buildUrl(path: string, params?: QueryParams) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const search = new URLSearchParams();

  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `${normalizedPath}?${query}` : normalizedPath;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getMessage(payload: unknown, fallback: string) {
  const object = getObject(payload);
  const message = object.message ?? object.error ?? object.error_code;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

function getData(payload: unknown): unknown {
  const object = getObject(payload);
  return Object.prototype.hasOwnProperty.call(object, 'data') ? object.data : payload;
}

function getPagination(payload: unknown): ApiPagination | undefined {
  const object = getObject(payload);
  const dataObject = getObject(object.data);
  const raw = getObject(object.pagination ?? dataObject.pagination);
  if (!raw.total && !raw.totalPages && !raw.total_pages) {
    return undefined;
  }

  return {
    page: Number(raw.page ?? 1),
    limit: Number(raw.limit ?? 20),
    total: Number(raw.total ?? 0),
    totalPages: Number(raw.totalPages ?? raw.total_pages ?? 1),
  };
}

function getMeta(payload: unknown): unknown {
  const object = getObject(payload);
  return Object.prototype.hasOwnProperty.call(object, 'meta') ? object.meta : undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await apiFetch(path, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(init?.headers ?? {}),
      },
    });
    const payload = await parseJson(response);

    if (!response.ok) {
      return { data: null, error: getMessage(payload, 'Request failed') };
    }

    return {
      data: getData(payload) as T,
      pagination: getPagination(payload),
      meta: getMeta(payload),
    };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Request failed' };
  }
}

function normalizeScores(scores?: BackendScores): AiScores {
  return {
    semanticScore: Number(scores?.semantic_score ?? 0),
    keywordScore: Number(scores?.keyword_score ?? 0),
    hybridScore: Number(scores?.hybrid_score ?? 0),
  };
}

function normalizeDetails(explainability?: BackendExplainability): AiDetails {
  return {
    matchedKeywords: Array.isArray(explainability?.matched_keywords)
      ? explainability.matched_keywords
      : [],
    missingKeywords: Array.isArray(explainability?.missing_keywords)
      ? explainability.missing_keywords
      : [],
  };
}

function normalizeHistoryApplication(item: BackendHistoryApplication): Application {
  return {
    _id: String(item.application_id ?? ''),
    jobId: String(item.job?.id ?? item.job?.title ?? ''),
    resumeId: String(item.resume?.id ?? ''),
    status: item.status ?? 'new',
    aiStatus: item.ai_status ?? 'pending',
    aiScores: normalizeScores({ hybrid_score: item.scores?.hybrid_score }),
    aiDetails: normalizeDetails(),
    statusHistory: [],
    createdAt: String(item.submitted_at ?? ''),
    updatedAt: String(item.updated_at ?? item.submitted_at ?? ''),
  };
}

function normalizeRankedApplication(item: BackendRankedApplication): Application {
  return {
    _id: String(item.application_id ?? ''),
    jobId: String(item.candidate?.full_name ?? item.candidate?.email ?? ''),
    resumeId: String(item.resume?.id ?? ''),
    status: item.status ?? 'new',
    aiStatus: item.ai_status ?? 'pending',
    aiScores: normalizeScores(item.scores),
    aiDetails: normalizeDetails(item.explainability),
    statusHistory: [],
    createdAt: String(item.updated_at ?? ''),
    updatedAt: String(item.updated_at ?? ''),
  };
}

function normalizeFeedback(item: BackendFeedback): Application {
  return {
    _id: String(item.application_id ?? ''),
    jobId: String(item.job_id ?? ''),
    resumeId: String(item.resume_id ?? ''),
    status: item.status ?? 'new',
    aiStatus: item.ai_status ?? 'pending',
    aiScores: normalizeScores(item.scores),
    aiDetails: normalizeDetails(item.explainability),
    statusHistory: [],
    createdAt: '',
    updatedAt: '',
  };
}

function normalizeResume(item: unknown): Resume {
  const object = getObject(item);
  return {
    _id: String(object.id ?? object._id ?? object.resume_id ?? ''),
    candidateId: String(object.candidateId ?? object.candidate_id ?? ''),
    fileUrl: String(object.fileUrl ?? object.file_url ?? ''),
    title: typeof object.title === 'string' ? object.title : undefined,
    isMaster: Boolean(object.isMaster ?? object.is_master),
    isAnalyzed: Boolean(object.isAnalyzed ?? object.is_analyzed),
    processingStatus: String(object.processingStatus ?? object.processing_status ?? 'pending'),
    parsedData: getObject(object.parsedData ?? object.parsed_data ?? object.processed_resume),
    builderData: getObject(object.builderData ?? object.builder_data) as Resume['builderData'],
    coverLetter: typeof object.coverLetter === 'string' ? object.coverLetter : undefined,
    outreachMessage:
      typeof object.outreachMessage === 'string' ? object.outreachMessage : undefined,
    createdAt: String(object.createdAt ?? object.created_at ?? ''),
    updatedAt: String(object.updatedAt ?? object.updated_at ?? ''),
  };
}

function normalizeUser(item: unknown): User {
  const object = getObject(item);
  return {
    _id: String(object.id ?? object._id ?? ''),
    email: String(object.email ?? ''),
    fullName: String(object.fullName ?? object.full_name ?? ''),
    role: object.role === 'recruiter' || object.role === 'admin' ? object.role : 'candidate',
    avatar: typeof object.avatar === 'string' ? object.avatar : undefined,
    disabled: Boolean(object.disabled),
    candidateProfile: getObject(object.candidateProfile ?? object.candidate_profile),
  };
}

function normalizeCompanyProfile(item: unknown) {
  const object = getObject(item);
  return {
    id: 'me',
    name: String(object.company_name ?? object.name ?? ''),
    industry: String(object.industry ?? ''),
    website: String(object.website ?? ''),
    description: String(object.overview ?? object.description ?? ''),
  };
}

function toCompanyProfilePayload(item: unknown) {
  const object = getObject(item);
  return {
    company_name: String(object.name ?? object.company_name ?? ''),
    industry: String(object.industry ?? ''),
    website: String(object.website ?? ''),
    overview: String(object.description ?? object.overview ?? ''),
  };
}

function normalizeListData<T>(resource: string, payload: unknown): T[] {
  const data = getData(payload);
  const dataObject = getObject(data);

  if (resource === 'applications') {
    const applications = Array.isArray(dataObject.applications) ? dataObject.applications : [];
    return applications.map((item) =>
      normalizeHistoryApplication(item as BackendHistoryApplication)
    ) as T[];
  }

  if (resource === 'ranked-applications') {
    const candidates = Array.isArray(dataObject.candidates) ? dataObject.candidates : [];
    return candidates.map((item) =>
      normalizeRankedApplication(item as BackendRankedApplication)
    ) as T[];
  }

  const list = Array.isArray(data) ? data : [];
  if (resource === 'resumes') {
    return list.map(normalizeResume) as T[];
  }

  if (resource === 'users') {
    return list.map(normalizeUser) as T[];
  }

  return list as T[];
}

function mapListPath(resource: string, params?: QueryParams) {
  if (resource === 'applications') {
    return buildUrl('/applications/history', params);
  }

  if (resource === 'resumes') {
    return buildUrl('/resumes/list', { include_master: true, ...params });
  }

  if (resource === 'systemconfigs') {
    return buildUrl('/config/features', params);
  }

  return buildUrl(`/${resource}`, params);
}

function mapPath(path: string, params?: QueryParams) {
  const normalized = path.replace(/^\/+/, '');

  if (normalized === 'users/me') {
    return buildUrl('/auth/me', params);
  }

  if (normalized === 'companies/me') {
    return buildUrl('/company/me', params);
  }

  const jobApplicationsMatch = normalized.match(/^jobs\/([^/]+)\/applications$/);
  if (jobApplicationsMatch) {
    return buildUrl('/applications/ranked', {
      ...params,
      job_id: jobApplicationsMatch[1],
    });
  }

  return buildUrl(`/${normalized}`, params);
}

export async function getList<T>(resource: string, params?: QueryParams): Promise<ApiResult<T[]>> {
  const path = mapListPath(resource, params);
  const result = await request<unknown>(path);
  if (result.error) {
    return { data: null, error: result.error };
  }

  if (resource === 'systemconfigs') {
    return {
      data: [{ key: 'featureConfig', value: result.data }] as T[],
      pagination: result.pagination,
    };
  }

  return {
    data: normalizeListData<T>(resource, result.data),
    pagination: result.pagination,
  };
}

export async function getOne<T>(resource: string, id: string): Promise<ApiResult<T>> {
  if (resource === 'resumes') {
    const result = await request<unknown>(buildUrl('/resumes', { resume_id: id }));
    return result.error || !result.data
      ? { data: null, error: result.error }
      : { data: normalizeResume(result.data) as T, pagination: result.pagination };
  }

  if (resource === 'applications') {
    const result = await request<unknown>(buildUrl(`/applications/${id}/feedback`));
    return result.error || !result.data
      ? { data: null, error: result.error }
      : {
          data: normalizeFeedback(result.data as BackendFeedback) as T,
          pagination: result.pagination,
        };
  }

  return request<T>(buildUrl(`/${resource}/${id}`));
}

export async function getPath<T>(path: string, params?: QueryParams): Promise<ApiResult<T>> {
  const normalized = path.replace(/^\/+/, '');
  const result = await request<unknown>(mapPath(path, params));

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  if (normalized === 'users/me') {
    const object = getObject(result.data);
    return { data: normalizeUser(object.user ?? result.data) as T, pagination: result.pagination };
  }

  if (normalized === 'companies/me') {
    return { data: normalizeCompanyProfile(result.data) as T, pagination: result.pagination };
  }

  if (normalized.endsWith('/feedback')) {
    return {
      data: {
        application: normalizeFeedback(result.data as BackendFeedback),
        aiScores: normalizeScores((result.data as BackendFeedback).scores),
        aiDetails: normalizeDetails((result.data as BackendFeedback).explainability),
        aiStatus: (result.data as BackendFeedback).ai_status ?? 'pending',
      } as T,
      pagination: result.pagination,
    };
  }

  if (/^jobs\/[^/]+\/applications$/.test(normalized)) {
    return {
      data: normalizeListData<Application>('ranked-applications', result.data) as T,
      pagination: result.pagination,
    };
  }

  return { data: result.data as T, pagination: result.pagination };
}

export async function postOne<T, B>(resource: string, body: B): Promise<ApiResult<T>> {
  return request<T>(buildUrl(`/${resource}`), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function putOne<T, B>(resource: string, id: string, body: B): Promise<ApiResult<T>> {
  if (resource === 'companies') {
    return request<T>('/company/me', {
      method: 'PUT',
      body: JSON.stringify(toCompanyProfilePayload(body)),
    });
  }

  if (resource === 'candidate-profile') {
    return request<T>('/candidate-profile/me', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  if (resource === 'users') {
    return request<T>(buildUrl(`/users/${id}/status`), {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  const method = resource === 'jobs' || resource === 'resumes' ? 'PATCH' : 'PUT';
  return request<T>(buildUrl(`/${resource}/${id}`), {
    method,
    body: JSON.stringify(body),
  });
}

// ── Recommendations ──────────────────────────────────────────────────────────

export type JobRecommendation = {
  job_id: string;
  title: string;
  category: string;
  location: string;
  experience_level: string;
  status: string;
  description_preview: string;
  scores: { semantic_score: number; keyword_score: number; hybrid_score: number };
  matched_keywords: string[];
  application_deadline: string | null;
  created_at: string | null;
};

export type ResumeRecommendation = {
  resume_id: string;
  candidate_id: string | null;
  candidate_name: string | null;
  candidate_email: string | null;
  resume_title: string | null;
  is_master: boolean;
  processing_status: string;
  current_role: string | null;
  top_skills: string[];
  scores: { semantic_score: number; keyword_score: number; hybrid_score: number };
  matched_keywords: string[];
  created_at: string | null;
  updated_at: string | null;
};

export type RecommendationMeta = {
  resume_id?: string;
  job_id?: string;
  job_title?: string;
  total: number;
  semantic_weight: number;
};

export async function getJobRecommendations(
  resumeId: string,
  params?: { limit?: number; score_threshold?: number; semantic_weight?: number }
): Promise<{ data: JobRecommendation[]; meta: RecommendationMeta } | { error: string }> {
  const result = await request<unknown>(
    buildUrl('/recommendations/jobs', { resume_id: resumeId, ...params })
  );
  if (result.error) return { error: result.error };
  return {
    data: Array.isArray(result.data) ? (result.data as JobRecommendation[]) : [],
    meta: (result.meta as RecommendationMeta) ?? { total: 0, semantic_weight: 0.65 },
  };
}

export async function getResumeRecommendations(
  jobId: string,
  params?: { limit?: number; score_threshold?: number; semantic_weight?: number }
): Promise<{ data: ResumeRecommendation[]; meta: RecommendationMeta } | { error: string }> {
  const result = await request<unknown>(
    buildUrl('/recommendations/resumes', { job_id: jobId, ...params })
  );
  if (result.error) return { error: result.error };
  return {
    data: Array.isArray(result.data) ? (result.data as ResumeRecommendation[]) : [],
    meta: (result.meta as RecommendationMeta) ?? { total: 0, semantic_weight: 0.65 },
  };
}

// ── Interview Questions ───────────────────────────────────────────────────────

export type InterviewQuestion = {
  id: string;
  category: string;
  question: string;
  focus_skill?: string | null;
  context?: Record<string, string>;
};

export type QuestionGroup = {
  group: string;
  label: string;
  description: string;
  questions: InterviewQuestion[];
};

export type InterviewQuestionsResult = {
  resume_id: string;
  job_id: string | null;
  job_title: string | null;
  candidate_name: string;
  candidate_title: string;
  language: string;
  generated_at: string;
  question_groups: QuestionGroup[];
  total_questions: number;
  generation_mode?: 'llm' | 'template_fallback';
  llm_metadata?: {
    provider?: string;
    model?: string;
    response_model?: string;
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
  } | null;
};

export async function generateInterviewQuestions(
  resumeId: string,
  jobId?: string,
  language: 'en' | 'vi' = 'en'
): Promise<{ data: InterviewQuestionsResult } | { error: string }> {
  const result = await request<unknown>('/interviews/questions', {
    method: 'POST',
    body: JSON.stringify({ resume_id: resumeId, job_id: jobId ?? null, language }),
  });
  if (result.error) return { error: result.error };
  const payload = getObject(result.data);
  return { data: payload as unknown as InterviewQuestionsResult };
}

// Re-export named API clients from submodules (see lib/api/index.ts)
export * from './api/index';
