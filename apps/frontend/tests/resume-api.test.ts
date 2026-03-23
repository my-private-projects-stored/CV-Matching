import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  API_BASE: '/api',
  apiFetch: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

import {
  deleteResume,
  downloadOriginalResumeFile,
  fetchMasterResume,
  fetchJobDescription,
  fetchResume,
  getOriginalResumeDownloadUrl,
  getResumePdfUrl,
  improveResume,
  setResumeAsMaster,
  uploadJobDescriptions,
} from '@/lib/api/resume';
import { apiDelete, apiFetch, apiPost } from '@/lib/api/client';

const mockedApiFetch = vi.mocked(apiFetch);
const mockedApiPost = vi.mocked(apiPost);
const mockedApiDelete = vi.mocked(apiDelete);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('resume API client', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiPost.mockReset();
    mockedApiDelete.mockReset();
  });

  it('uploadJobDescriptions posts payload and returns first job id', async () => {
    mockedApiPost.mockResolvedValueOnce(jsonResponse({ job_id: ['job-1', 'job-2'] }));

    const result = await uploadJobDescriptions(['jd A', 'jd B'], 'resume-1');

    expect(result).toBe('job-1');
    expect(mockedApiPost).toHaveBeenCalledWith('/jobs/upload', {
      job_descriptions: ['jd A', 'jd B'],
      resume_id: 'resume-1',
    });
  });

  it('improveResume throws with backend status and body when request fails', async () => {
    mockedApiPost.mockResolvedValueOnce(new Response('bad request', { status: 400 }));

    await expect(improveResume('resume-1', 'job-1')).rejects.toThrow(
      'Improve failed with status 400: bad request'
    );
  });

  it('fetchResume calls encoded endpoint and returns data payload', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        request_id: 'req-1',
        data: {
          resume_id: 'resume-1',
          candidate_id: 'candidate-1',
          raw_resume: {
            id: 1,
            content: 'content',
            content_type: 'text/plain',
            created_at: '2026-03-22T00:00:00Z',
            processing_status: 'ready',
          },
          processed_resume: null,
        },
      })
    );

    const result = await fetchResume('resume 1');

    expect(result.resume_id).toBe('resume-1');
    expect(mockedApiFetch).toHaveBeenCalledWith('/resumes?resume_id=resume%201');
  });

  it('deleteResume throws detailed error when delete fails', async () => {
    mockedApiDelete.mockResolvedValueOnce(new Response('forbidden', { status: 403 }));

    await expect(deleteResume('resume-1')).rejects.toThrow(
      'Failed to delete resume (status 403): forbidden'
    );
  });

  it('fetchJobDescription returns parsed payload', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({ job_id: 'job-1', content: 'Senior engineer role' })
    );

    const result = await fetchJobDescription('resume-1');

    expect(result).toEqual({ job_id: 'job-1', content: 'Senior engineer role' });
    expect(mockedApiFetch).toHaveBeenCalledWith('/resumes/resume-1/job-description');
  });

  it('getResumePdfUrl builds default and custom query parameters', () => {
    const defaultUrl = getResumePdfUrl('resume-1');
    expect(defaultUrl).toContain('/api/resumes/resume-1/pdf?');
    expect(defaultUrl).toContain('template=swiss-single');
    expect(defaultUrl).toContain('pageSize=A4');

    const customUrl = getResumePdfUrl(
      'resume-1',
      {
        template: 'swiss-single',
        pageSize: 'LETTER',
        margins: { top: 10, bottom: 11, left: 12, right: 13 },
        spacing: { section: 4, item: 3, lineHeight: 2 },
        fontSize: {
          base: 4,
          headerScale: 2,
          headerFont: 'serif',
          bodyFont: 'sans-serif',
        },
        compactMode: true,
        showContactIcons: false,
        accentColor: 'blue',
      },
      'vi'
    );

    expect(customUrl).toContain('pageSize=LETTER');
    expect(customUrl).toContain('fontSize=4');
    expect(customUrl).toContain('compactMode=true');
    expect(customUrl).toContain('lang=vi');
  });

  it('builds and downloads original resume file endpoint', async () => {
    const url = getOriginalResumeDownloadUrl('resume-1');
    expect(url).toBe('/api/resumes/resume-1/download');

    mockedApiFetch.mockResolvedValueOnce(
      new Response(new Blob(['raw file'], { type: 'text/plain' }), { status: 200 })
    );

    const blob = await downloadOriginalResumeFile('resume-1');
    expect(blob.size).toBeGreaterThan(0);
    expect(mockedApiFetch).toHaveBeenCalledWith('/api/resumes/resume-1/download');
  });

  it('fetchMasterResume calls master endpoint and returns summary', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        request_id: 'req-master-1',
        data: {
          resume_id: 'resume-master-1',
          candidate_id: 'candidate-1',
          filename: 'master.pdf',
          is_master: true,
          parent_id: null,
          processing_status: 'ready',
          created_at: '2026-03-22T00:00:00Z',
          updated_at: '2026-03-22T00:00:00Z',
          title: 'Master Resume',
        },
      })
    );

    const result = await fetchMasterResume('candidate-1');

    expect(result.resume_id).toBe('resume-master-1');
    expect(mockedApiFetch).toHaveBeenCalledWith('/resumes/master?candidate_id=candidate-1');
  });

  it('setResumeAsMaster posts endpoint and returns updated summary', async () => {
    mockedApiPost.mockResolvedValueOnce(
      jsonResponse({
        request_id: 'req-master-2',
        data: {
          resume_id: 'resume-2',
          candidate_id: 'candidate-1',
          filename: 'resume.pdf',
          is_master: true,
          parent_id: null,
          processing_status: 'ready',
          created_at: '2026-03-22T00:00:00Z',
          updated_at: '2026-03-22T00:00:00Z',
          title: 'Resume 2',
        },
      })
    );

    const result = await setResumeAsMaster('resume-2');

    expect(result.is_master).toBe(true);
    expect(mockedApiPost).toHaveBeenCalledWith('/resumes/resume-2/set-as-master', {});
  });
});
