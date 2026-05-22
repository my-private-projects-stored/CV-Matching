import { apiFetch, apiPatch, apiPost } from './client';
import { buildApiClientError } from './error';

async function assertOk(res: Response, fallbackMessagePrefix: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  throw buildApiClientError(res.status, body, fallbackMessagePrefix);
}

export type ApplicationStatus = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
export type ApplicationAiStatus = 'pending' | 'parsing' | 'scoring' | 'completed' | 'failed';

export interface RankedCandidateItem {
  application_id: string;
  status: ApplicationStatus;
  ai_status: ApplicationAiStatus;
  candidate: {
    id: string | null;
    full_name: string;
    email: string;
  };
  resume: {
    id: string | null;
    title: string | null;
    processing_status: 'pending' | 'processing' | 'ready' | 'failed';
  };
  scores: {
    semantic_score: number;
    keyword_score: number;
    hybrid_score: number;
  };
  explainability: {
    matched_keywords: string[];
    missing_keywords: string[];
  };
  updated_at: string;
  status_audit: {
    from_status: ApplicationStatus | null;
    to_status: ApplicationStatus;
    changed_at: string;
    changed_by: string;
  } | null;
}

export interface RankedApplicationsResponse {
  request_id: string;
  data: {
    job: {
      id: string;
      title: string;
      status: 'active' | 'closed';
    };
    candidates: RankedCandidateItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  };
}

export interface CandidateHistoryItem {
  application_id: string;
  candidate_id?: string | null;
  status: ApplicationStatus;
  ai_status: ApplicationAiStatus;
  job: {
    id: string | null;
    title: string;
    status: 'active' | 'closed';
    location: string | null;
    category: string | null;
  };
  resume: {
    id: string | null;
    title: string | null;
    processing_status: 'pending' | 'processing' | 'ready' | 'failed';
  };
  scores: {
    hybrid_score: number;
  };
  submitted_at: string;
  updated_at: string;
  status_audit: {
    from_status: ApplicationStatus | null;
    to_status: ApplicationStatus;
    changed_at: string;
    changed_by: string;
  } | null;
}

export interface CandidateHistoryResponse {
  request_id: string;
  data: {
    candidate_id: string;
    applications: CandidateHistoryItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  };
}

export interface ApplicationFeedbackResponse {
  request_id: string;
  data: {
    application_id: string;
    job_id: string | null;
    resume_id: string | null;
    scores: {
      semantic_score: number;
      keyword_score: number;
      hybrid_score: number;
    };
    explainability: {
      matched_keywords: string[];
      missing_keywords: string[];
    };
    recommendations: string[];
    status: ApplicationStatus;
    ai_status: ApplicationAiStatus;
  };
}

export interface ApplicationStatusHistoryResponse {
  request_id: string;
  data: {
    application_id: string;
    current_status: ApplicationStatus;
    history: Array<{
      from_status: ApplicationStatus | null;
      to_status: ApplicationStatus;
      changed_at: string;
      changed_by: string;
    }>;
  };
}

export interface ApplicationSummaryResponse {
  request_id: string;
  data: {
    job: {
      id: string;
      title: string;
    };
    total: number;
    by_status: Record<ApplicationStatus, number>;
    by_ai_status: Record<ApplicationAiStatus, number>;
  };
}

export interface RecentStatusChangesResponse {
  request_id: string;
  data: {
    job: {
      id: string;
      title: string;
    };
    changes: Array<{
      application_id: string;
      job: {
        id: string | null;
        title: string;
      };
      candidate: {
        id: string | null;
        full_name: string;
        email: string;
      };
      from_status: ApplicationStatus | null;
      to_status: ApplicationStatus;
      changed_at: string;
      changed_by: string;
      current_status: ApplicationStatus;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
    };
  };
}

export async function createApplication(payload: {
  job_id: string;
  resume_id: string;
}): Promise<{ request_id: string; data: { application_id: string } }> {
  const res = await apiPost('/applications', payload);
  await assertOk(res, 'Failed to create application');

  return res.json();
}

export async function fetchRankedApplications(params: {
  jobId: string;
  page?: number;
  limit?: number;
  status?: ApplicationStatus | '';
  changedBy?: string;
  changedAfter?: string;
  changedBefore?: string;
}): Promise<RankedApplicationsResponse> {
  const query = new URLSearchParams({ job_id: params.jobId });
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.changedBy && params.changedBy.trim()) {
    query.set('changed_by', params.changedBy.trim());
  }
  if (params.changedAfter) query.set('changed_after', params.changedAfter);
  if (params.changedBefore) query.set('changed_before', params.changedBefore);

  const res = await apiFetch(`/applications/ranked?${query.toString()}`);
  await assertOk(res, 'Failed to load ranked applications');

  return res.json();
}

export async function fetchCandidateApplicationHistory(params: {
  candidateId: string;
  page?: number;
  limit?: number;
  status?: ApplicationStatus | '';
}): Promise<CandidateHistoryResponse> {
  const query = new URLSearchParams({ candidate_id: params.candidateId });
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);

  const res = await apiFetch(`/applications/history?${query.toString()}`);
  await assertOk(res, 'Failed to load application history');

  return res.json();
}

export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
  changedBy?: string
): Promise<{ request_id: string; data: { status: ApplicationStatus } }> {
  const payload: { status: ApplicationStatus; changed_by?: string } = { status };
  if (changedBy && changedBy.trim()) {
    payload.changed_by = changedBy.trim();
  }

  const res = await apiPatch(`/applications/${encodeURIComponent(applicationId)}/status`, payload);
  await assertOk(res, 'Failed to update application status');

  return res.json();
}

export async function bulkUpdateApplicationStatus(payload: {
  applicationIds: string[];
  status: ApplicationStatus;
  changedBy?: string;
}): Promise<{
  request_id: string;
  data: {
    requested_count: number;
    matched_count: number;
    updated_count: number;
    unchanged_count: number;
    updated_ids: string[];
    status: ApplicationStatus;
  };
}> {
  const res = await apiPatch('/applications/status/bulk', {
    application_ids: payload.applicationIds,
    status: payload.status,
    changed_by: payload.changedBy?.trim() || undefined,
  });

  await assertOk(res, 'Failed to bulk update application status');

  return res.json();
}

export async function fetchApplicationFeedback(
  applicationId: string
): Promise<ApplicationFeedbackResponse> {
  const res = await apiFetch(`/applications/${encodeURIComponent(applicationId)}/feedback`);
  await assertOk(res, 'Failed to load application feedback');

  return res.json();
}

export async function fetchApplicationStatusSummary(
  jobId: string
): Promise<ApplicationSummaryResponse> {
  const query = new URLSearchParams({ job_id: jobId.trim() });
  const res = await apiFetch(`/applications/summary?${query.toString()}`);
  await assertOk(res, 'Failed to load application summary');

  return res.json();
}

export async function fetchRecentStatusChanges(params: {
  jobId: string;
  page?: number;
  limit?: number;
  status?: ApplicationStatus | '';
  changedBy?: string;
  changedAfter?: string;
  changedBefore?: string;
}): Promise<RecentStatusChangesResponse> {
  const query = new URLSearchParams({ job_id: params.jobId });
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.changedBy && params.changedBy.trim()) {
    query.set('changed_by', params.changedBy.trim());
  }
  if (params.changedAfter && params.changedAfter.trim()) {
    query.set('changed_after', params.changedAfter.trim());
  }
  if (params.changedBefore && params.changedBefore.trim()) {
    query.set('changed_before', params.changedBefore.trim());
  }

  const res = await apiFetch(`/applications/status-changes?${query.toString()}`);
  await assertOk(res, 'Failed to load recent status changes');

  return res.json();
}

export async function exportRecentStatusChangesCsv(params: {
  jobId: string;
  status?: ApplicationStatus | '';
  changedBy?: string;
  changedAfter?: string;
  changedBefore?: string;
}): Promise<Blob> {
  const query = new URLSearchParams({ job_id: params.jobId });
  if (params.status) query.set('status', params.status);
  if (params.changedBy && params.changedBy.trim()) {
    query.set('changed_by', params.changedBy.trim());
  }
  if (params.changedAfter && params.changedAfter.trim()) {
    query.set('changed_after', params.changedAfter.trim());
  }
  if (params.changedBefore && params.changedBefore.trim()) {
    query.set('changed_before', params.changedBefore.trim());
  }

  const res = await apiFetch(`/applications/status-changes/export?${query.toString()}`);
  await assertOk(res, 'Failed to export recent status changes CSV');

  return res.blob();
}

export async function fetchApplicationStatusHistory(
  applicationId: string
): Promise<ApplicationStatusHistoryResponse> {
  const res = await apiFetch(`/applications/${encodeURIComponent(applicationId)}/status-history`);
  await assertOk(res, 'Failed to load application status history');

  return res.json();
}
