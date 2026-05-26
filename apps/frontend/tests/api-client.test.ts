import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Resume } from '@/types';

const fetchMock = vi.fn();

describe('api client', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds bearer token from stored auth session', async () => {
    window.localStorage.setItem(
      'cvm_auth_session_v1',
      JSON.stringify({ accessToken: 'token-123' })
    );
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const { apiFetch } = await import('@/lib/api/client');
    await apiFetch('/resumes/list');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Headers).get('Authorization')).toBe('Bearer token-123');
  });

  it('normalizes resume list payloads with builder data', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              resume_id: 'resume-1',
              candidate_id: 'candidate-1',
              is_master: true,
              is_analyzed: true,
              processing_status: 'ready',
              processed_resume: { summary: 'Hello' },
              builder_data: {
                template: 'modern-two-column',
                sections: { summary: 'Hello' },
              },
              created_at: '2026-05-01T00:00:00.000Z',
              updated_at: '2026-05-02T00:00:00.000Z',
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
        { status: 200 }
      )
    );

    const { getList } = await import('@/lib/api');
    const result = await getList<Resume>('resumes');

    expect(result.error).toBeUndefined();
    expect(result.data?.[0]._id).toBe('resume-1');
    expect(result.data?.[0].builderData?.template).toBe('modern-two-column');
    expect(result.pagination?.total).toBe(1);
  });

  it('maps company profile calls to recruiter-owned company endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ data: { company_name: 'Acme', overview: 'Hiring platform' } }),
        {
          status: 200,
        }
      )
    );

    const { getPath } = await import('@/lib/api');
    const result = await getPath<{ name: string; description: string }>('companies/me');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/company/me');
    expect(result.data?.name).toBe('Acme');
    expect(result.data?.description).toBe('Hiring platform');
  });

  it('preserves recommendation data and meta from top-level backend response', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          request_id: 'req_1',
          data: [
            {
              job_id: 'job-1',
              title: 'Backend Engineer',
              category: 'IT',
              location: 'Remote',
              experience_level: 'Senior',
              status: 'active',
              description_preview: 'Build APIs',
              scores: {
                semantic_score: 0.9,
                keyword_score: 0.7,
                hybrid_score: 0.83,
              },
              matched_keywords: ['node.js'],
              application_deadline: null,
              created_at: null,
            },
          ],
          meta: { resume_id: 'resume-1', total: 1, semantic_weight: 0.65 },
        }),
        { status: 200 }
      )
    );

    const { getJobRecommendations } = await import('@/lib/api');
    const result = await getJobRecommendations('resume-1');

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0].job_id).toBe('job-1');
    expect(result.meta.total).toBe(1);
    expect(result.meta.semantic_weight).toBe(0.65);
  });

  it('fetches LLM events from the backend configuration endpoint', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              _id: 'event-1',
              feature: 'tailor',
              generation_mode: 'llm',
              provider: 'openai',
              model: 'gpt-4o',
              reason: null,
              request_id: 'req_1',
              createdAt: '2026-05-26T00:00:00.000Z',
            },
          ],
          count: 1,
        }),
        { status: 200 }
      )
    );

    const { fetchLlmEvents } = await import('@/lib/api/config');
    const result = await fetchLlmEvents({ limit: 10, feature: 'tailor' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/config/llm-events?feature=tailor&limit=10');
    expect(result.data).toHaveLength(1);
    expect(result.data[0]._id).toBe('event-1');
    expect(result.count).toBe(1);
  });
});

