import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

import { closeJob, deleteJob, fetchJobs, reopenJob, updateJob } from '@/lib/api/jobs';
import { apiDelete, apiFetch, apiPatch } from '@/lib/api/client';

const mockedApiFetch = vi.mocked(apiFetch);
const mockedApiPatch = vi.mocked(apiPatch);
const mockedApiDelete = vi.mocked(apiDelete);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('jobs API client', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiPatch.mockReset();
    mockedApiDelete.mockReset();
  });

  it('fetchJobs builds query string from filters', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        data: [],
        pagination: { page: 1, limit: 12, total: 0, totalPages: 1 },
      })
    );

    await fetchJobs({ search: 'backend', status: 'active', page: 1, limit: 12 });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/jobs?search=backend&status=active&page=1&limit=12'
    );
  });

  it('updateJob patches encoded endpoint and returns payload', async () => {
    mockedApiPatch.mockResolvedValueOnce(
      jsonResponse({
        _id: 'job-1',
        title: 'Senior Backend Engineer',
        description: 'desc',
        requirements: 'req',
        benefits: 'Remote, bonus',
        applicationDeadline: '2026-12-31T00:00:00.000Z',
        recruiterId: 'rec-1',
        cleanText: 'clean',
        qdrantId: null,
        isAnalyzed: false,
        keywords: [],
        category: 'IT',
        location: 'Hanoi',
        experienceLevel: 'Senior',
        status: 'active',
        createdAt: '2026-03-22T00:00:00Z',
        updatedAt: '2026-03-22T00:00:00Z',
      })
    );

    const result = await updateJob('job 1', {
      status: 'closed',
      benefits: 'Remote, bonus',
      applicationDeadline: '2026-12-31T00:00:00.000Z',
    });

    expect(result._id).toBe('job-1');
    expect(mockedApiPatch).toHaveBeenCalledWith('/jobs/job%201', {
      status: 'closed',
      benefits: 'Remote, bonus',
      applicationDeadline: '2026-12-31T00:00:00.000Z',
    });
  });

  it('closeJob and reopenJob map to status transitions', async () => {
    mockedApiPatch
      .mockResolvedValueOnce(jsonResponse({ _id: 'job-1', status: 'closed' }))
      .mockResolvedValueOnce(jsonResponse({ _id: 'job-1', status: 'active' }));

    await closeJob('job-1');
    await reopenJob('job-1');

    expect(mockedApiPatch).toHaveBeenNthCalledWith(1, '/jobs/job-1', { status: 'closed' });
    expect(mockedApiPatch).toHaveBeenNthCalledWith(2, '/jobs/job-1', { status: 'active' });
  });

  it('deleteJob throws backend status details on failure', async () => {
    mockedApiDelete.mockResolvedValueOnce(new Response('cannot delete', { status: 409 }));

    await expect(deleteJob('job-1')).rejects.toThrow('Failed to delete job (status 409).');
  });

  it('deleteJob preserves backend error_code for downstream handling', async () => {
    mockedApiDelete.mockResolvedValueOnce(
      jsonResponse(
        { message: 'Job has active applications', error_code: 'job_has_active_applications' },
        409
      )
    );

    await expect(deleteJob('job-1')).rejects.toMatchObject({
      errorCode: 'job_has_active_applications',
      statusCode: 409,
    });
  });
});
