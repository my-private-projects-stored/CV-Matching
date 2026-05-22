import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

import {
  bulkUpdateApplicationStatus,
  createApplication,
  exportRecentStatusChangesCsv,
  fetchApplicationFeedback,
  fetchCandidateApplicationHistory,
  fetchRecentStatusChanges,
  fetchApplicationStatusHistory,
  fetchApplicationStatusSummary,
  fetchRankedApplications,
  updateApplicationStatus,
} from '@/lib/api/applications';
import { apiFetch, apiPatch, apiPost } from '@/lib/api/client';

const mockedApiFetch = vi.mocked(apiFetch);
const mockedApiPatch = vi.mocked(apiPatch);
const mockedApiPost = vi.mocked(apiPost);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('applications API client', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiPatch.mockReset();
    mockedApiPost.mockReset();
  });

  it('creates application with expected payload', async () => {
    mockedApiPost.mockResolvedValueOnce(
      jsonResponse({ request_id: 'req-1', data: { application_id: 'a-1' } }, 201)
    );

    const result = await createApplication({ job_id: 'job-1', resume_id: 'resume-1' });

    expect(result.data.application_id).toBe('a-1');
    expect(mockedApiPost).toHaveBeenCalledWith('/applications', {
      job_id: 'job-1',
      resume_id: 'resume-1',
    });
  });

  it('createApplication preserves backend error_code on failure', async () => {
    mockedApiPost.mockResolvedValueOnce(
      jsonResponse(
        { message: 'Duplicate application', error_code: 'application_already_exists' },
        409
      )
    );

    await expect(
      createApplication({ job_id: 'job-1', resume_id: 'resume-1' })
    ).rejects.toMatchObject({
      errorCode: 'application_already_exists',
      statusCode: 409,
    });
  });

  it('fetches ranked applications with query string', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        request_id: 'req-1',
        data: {
          job: { id: 'j', title: 'x', status: 'active' },
          candidates: [
            {
              application_id: 'a-1',
              status: 'screening',
              ai_status: 'completed',
              candidate: { id: 'c-1', full_name: 'Candidate', email: 'candidate@example.com' },
              resume: { id: 'r-1', title: 'Resume', processing_status: 'ready' },
              scores: { semantic_score: 0.8, keyword_score: 0.7, hybrid_score: 0.76 },
              explainability: { matched_keywords: ['node'], missing_keywords: ['redis'] },
              updated_at: '2026-03-23T00:00:00.000Z',
              status_audit: {
                from_status: 'new',
                to_status: 'screening',
                changed_at: '2026-03-23T00:00:00.000Z',
                changed_by: 'recruiter-ui',
              },
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, total_pages: 1 },
        },
      })
    );

    const result = await fetchRankedApplications({
      jobId: 'job-1',
      page: 2,
      limit: 10,
      status: 'screening',
      changedBy: 'recruiter-ui',
      changedAfter: '2026-03-10',
      changedBefore: '2026-03-20',
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/applications/ranked?job_id=job-1&page=2&limit=10&status=screening&changed_by=recruiter-ui&changed_after=2026-03-10&changed_before=2026-03-20'
    );
    expect(result.data.candidates[0].status_audit?.changed_by).toBe('recruiter-ui');
  });

  it('fetches candidate history with query string', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        request_id: 'req-1',
        data: {
          candidate_id: 'c-1',
          applications: [],
          pagination: { page: 1, limit: 20, total: 0, total_pages: 1 },
        },
      })
    );

    await fetchCandidateApplicationHistory({ candidateId: 'candidate-1', page: 1, limit: 5 });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/applications/history?candidate_id=candidate-1&page=1&limit=5'
    );
  });

  it('updates application status', async () => {
    mockedApiPatch.mockResolvedValueOnce(
      jsonResponse({ request_id: 'req-1', data: { status: 'interview' } })
    );

    const result = await updateApplicationStatus('app-1', 'interview', 'recruiter-ui');

    expect(result.data.status).toBe('interview');
    expect(mockedApiPatch).toHaveBeenCalledWith('/applications/app-1/status', {
      status: 'interview',
      changed_by: 'recruiter-ui',
    });
  });

  it('bulk updates application statuses', async () => {
    mockedApiPatch.mockResolvedValueOnce(
      jsonResponse({
        request_id: 'req-1',
        data: {
          requested_count: 2,
          matched_count: 2,
          updated_count: 2,
          unchanged_count: 0,
          updated_ids: ['app-1', 'app-2'],
          status: 'offer',
        },
      })
    );

    const result = await bulkUpdateApplicationStatus({
      applicationIds: ['app-1', 'app-2'],
      status: 'offer',
      changedBy: 'recruiter-ui',
    });

    expect(result.data.updated_count).toBe(2);
    expect(mockedApiPatch).toHaveBeenCalledWith('/applications/status/bulk', {
      application_ids: ['app-1', 'app-2'],
      status: 'offer',
      changed_by: 'recruiter-ui',
    });
  });

  it('loads application feedback', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        request_id: 'req-1',
        data: {
          application_id: 'a-1',
          job_id: 'j-1',
          resume_id: 'r-1',
          scores: { semantic_score: 0.7, keyword_score: 0.6, hybrid_score: 0.66 },
          explainability: { matched_keywords: ['node.js'], missing_keywords: ['redis'] },
          recommendations: ['Add redis project bullet'],
          status: 'screening',
          ai_status: 'completed',
        },
      })
    );

    const result = await fetchApplicationFeedback('app-1');

    expect(result.data.application_id).toBe('a-1');
    expect(mockedApiFetch).toHaveBeenCalledWith('/applications/app-1/feedback');
  });

  it('loads application summary by job id', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        request_id: 'req-1',
        data: {
          job: { id: 'job-1', title: 'Backend Engineer' },
          total: 3,
          by_status: {
            new: 1,
            screening: 1,
            interview: 1,
            hired: 0,
            rejected: 0,
          },
          by_ai_status: {
            pending: 0,
            parsing: 0,
            scoring: 0,
            completed: 3,
            failed: 0,
          },
        },
      })
    );

    const result = await fetchApplicationStatusSummary('job-1');

    expect(result.data.total).toBe(3);
    expect(mockedApiFetch).toHaveBeenCalledWith('/applications/summary?job_id=job-1');
  });

  it('loads application status history', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        request_id: 'req-1',
        data: {
          application_id: 'app-1',
          current_status: 'interview',
          history: [
            {
              from_status: 'screening',
              to_status: 'interview',
              changed_at: '2026-03-23T00:00:00.000Z',
              changed_by: 'recruiter-ui',
            },
          ],
        },
      })
    );

    const result = await fetchApplicationStatusHistory('app-1');

    expect(result.data.current_status).toBe('interview');
    expect(result.data.history.length).toBe(1);
    expect(mockedApiFetch).toHaveBeenCalledWith('/applications/app-1/status-history');
  });

  it('loads recent status changes with filters', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        request_id: 'req-1',
        data: {
          job: { id: 'job-1', title: 'Backend Engineer' },
          changes: [
            {
              application_id: 'app-1',
              job: { id: 'job-1', title: 'Backend Engineer' },
              candidate: {
                id: 'candidate-1',
                full_name: 'Candidate 1',
                email: 'candidate-1@example.com',
              },
              from_status: 'new',
              to_status: 'screening',
              changed_at: '2026-03-23T00:00:00.000Z',
              changed_by: 'recruiter-ui',
              current_status: 'screening',
            },
          ],
          pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
        },
      })
    );

    const result = await fetchRecentStatusChanges({
      jobId: 'job-1',
      page: 1,
      limit: 10,
      status: 'screening',
      changedBy: 'recruiter',
      changedAfter: '2026-03-20',
      changedBefore: '2026-03-23',
    });

    expect(result.data.changes.length).toBe(1);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/applications/status-changes?job_id=job-1&page=1&limit=10&status=screening&changed_by=recruiter&changed_after=2026-03-20&changed_before=2026-03-23'
    );
  });

  it('exports recent status changes CSV with filters', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      new Response('application_id,changed_by\napp-1,recruiter-ui\n', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    );

    const blob = await exportRecentStatusChangesCsv({
      jobId: 'job-1',
      status: 'screening',
      changedBy: 'recruiter-ui',
      changedAfter: '2026-03-01',
      changedBefore: '2026-03-31',
    });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/applications/status-changes/export?job_id=job-1&status=screening&changed_by=recruiter-ui&changed_after=2026-03-01&changed_before=2026-03-31'
    );
    await expect(blob.text()).resolves.toContain('application_id,changed_by');
  });
});
