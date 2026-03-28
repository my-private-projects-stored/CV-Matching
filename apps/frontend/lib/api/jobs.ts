import { apiDelete, apiFetch, apiPatch } from './client';
import { buildApiClientError } from './error';

async function assertOk(res: Response, fallbackMessagePrefix: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  throw buildApiClientError(res.status, body, fallbackMessagePrefix);
}

export type JobStatus = 'active' | 'closed';
export type JobCategory = 'IT' | 'Accounting' | 'Marketing';

export interface ImportantJobChange {
  changedAt: string;
  changedFields: string[];
  changes?: Array<{
    field: string;
    before: string | null;
    after: string | null;
  }>;
  summary: string;
}

export interface JobItem {
  _id: string;
  recruiterId: string;
  title: string;
  description: string;
  requirements: string;
  benefits?: string;
  applicationDeadline?: string | null;
  cleanText: string;
  qdrantId: string | null;
  isAnalyzed: boolean;
  keywords: string[];
  category: JobCategory;
  location: string;
  experienceLevel: string;
  status: JobStatus;
  importantChangeHistory?: ImportantJobChange[];
  applications_count?: number;
  createdAt: string;
  updatedAt: string;
}

export interface JobListQuery {
  search?: string;
  category?: JobCategory | '';
  location?: string;
  status?: JobStatus | '';
  page?: number;
  limit?: number;
}

export interface JobListResponse {
  data: JobItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UpdateJobPayload {
  title?: string;
  description?: string;
  requirements?: string;
  benefits?: string;
  applicationDeadline?: string | null;
  category?: JobCategory;
  location?: string;
  experienceLevel?: string;
  status?: JobStatus;
}

function toSearchParams(query: JobListQuery): string {
  const params = new URLSearchParams();

  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.category) params.set('category', query.category);
  if (query.location?.trim()) params.set('location', query.location.trim());
  if (query.status) params.set('status', query.status);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));

  return params.toString();
}

export async function fetchJobs(query: JobListQuery = {}): Promise<JobListResponse> {
  const qs = toSearchParams(query);
  const endpoint = qs ? `/jobs?${qs}` : '/jobs';

  const res = await apiFetch(endpoint);
  await assertOk(res, 'Failed to load jobs');

  return res.json();
}

export async function fetchJobById(jobId: string): Promise<JobItem> {
  const res = await apiFetch(`/jobs/${encodeURIComponent(jobId)}`);
  await assertOk(res, 'Failed to load job detail');

  return res.json();
}

export async function updateJob(jobId: string, payload: UpdateJobPayload): Promise<JobItem> {
  const res = await apiPatch(`/jobs/${encodeURIComponent(jobId)}`, payload);
  await assertOk(res, 'Failed to update job');

  return res.json();
}

export async function closeJob(jobId: string): Promise<JobItem> {
  return updateJob(jobId, { status: 'closed' });
}

export async function reopenJob(jobId: string): Promise<JobItem> {
  return updateJob(jobId, { status: 'active' });
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await apiDelete(`/jobs/${encodeURIComponent(jobId)}`);
  await assertOk(res, 'Failed to delete job');
}
