import { apiFetch, apiPatch, apiPost } from './client';

export type ApplicationStatus = 'new' | 'screening' | 'interview' | 'hired' | 'rejected';
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
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to create application (status ${res.status}): ${body}`);
  }

  return res.json();
}

export async function fetchRankedApplications(params: {
  jobId: string;
  page?: number;
  limit?: number;
  status?: ApplicationStatus | '';
}): Promise<RankedApplicationsResponse> {
  const query = new URLSearchParams({ job_id: params.jobId });
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);

  const res = await apiFetch(`/applications/ranked?${query.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to load ranked applications (status ${res.status}): ${body}`);
  }

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
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to load application history (status ${res.status}): ${body}`);
  }

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
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to update application status (status ${res.status}): ${body}`);
  }

  return res.json();
}

export async function fetchApplicationFeedback(
  applicationId: string
): Promise<ApplicationFeedbackResponse> {
  const res = await apiFetch(`/applications/${encodeURIComponent(applicationId)}/feedback`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to load application feedback (status ${res.status}): ${body}`);
  }

  return res.json();
}

export async function fetchApplicationStatusSummary(jobId: string): Promise<ApplicationSummaryResponse> {
  const query = new URLSearchParams({ job_id: jobId.trim() });
  const res = await apiFetch(`/applications/summary?${query.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to load application summary (status ${res.status}): ${body}`);
  }

  return res.json();
}

export async function fetchRecentStatusChanges(params: {
  jobId: string;
  page?: number;
  limit?: number;
  status?: ApplicationStatus | '';
  changedBy?: string;
}): Promise<RecentStatusChangesResponse> {
  const query = new URLSearchParams({ job_id: params.jobId });
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.changedBy && params.changedBy.trim()) {
    query.set('changed_by', params.changedBy.trim());
  }

  const res = await apiFetch(`/applications/status-changes?${query.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to load recent status changes (status ${res.status}): ${body}`);
  }

  return res.json();
}

export async function fetchApplicationStatusHistory(
  applicationId: string
): Promise<ApplicationStatusHistoryResponse> {
  const res = await apiFetch(`/applications/${encodeURIComponent(applicationId)}/status-history`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to load application status history (status ${res.status}): ${body}`);
  }

  return res.json();
}
