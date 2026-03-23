import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
  apiPost: vi.fn(),
}));

import {
  analyzeResume,
  applyEnhancements,
  applyRegeneratedItems,
  generateEnhancements,
  regenerateItems,
} from '@/lib/api/enrichment';
import { apiFetch, apiPost } from '@/lib/api/client';

const mockedApiFetch = vi.mocked(apiFetch);
const mockedApiPost = vi.mocked(apiPost);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('enrichment API client', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiPost.mockReset();
  });

  it('analyzeResume uses POST endpoint and include credentials', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({ items_to_enrich: [], questions: [], analysis_summary: 'ok' })
    );

    const result = await analyzeResume('resume-1');

    expect(result.analysis_summary).toBe('ok');
    expect(mockedApiFetch).toHaveBeenCalledWith('/enrichment/analyze/resume-1', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('analyzeResume surfaces backend detail on error', async () => {
    mockedApiFetch.mockResolvedValueOnce(jsonResponse({ detail: 'Resume not found' }, 404));

    await expect(analyzeResume('missing-id')).rejects.toThrow('Resume not found');
  });

  it('generateEnhancements posts answers and returns preview', async () => {
    mockedApiPost.mockResolvedValueOnce(
      jsonResponse({
        enhancements: [
          {
            item_id: 'exp-1',
            item_type: 'experience',
            title: 'Engineer',
            original_description: ['old'],
            enhanced_description: ['new'],
          },
        ],
      })
    );

    const result = await generateEnhancements('resume-1', [
      { question_id: 'q-1', answer: 'Built measurable impact.' },
    ]);

    expect(result.enhancements).toHaveLength(1);
    expect(mockedApiPost).toHaveBeenCalledWith('/enrichment/enhance', {
      resume_id: 'resume-1',
      answers: [{ question_id: 'q-1', answer: 'Built measurable impact.' }],
    });
  });

  it('applyEnhancements posts enhancement payload', async () => {
    mockedApiPost.mockResolvedValueOnce(jsonResponse({ message: 'Applied', updated_items: 2 }));

    const result = await applyEnhancements('resume-1', [
      {
        item_id: 'exp-1',
        item_type: 'experience',
        title: 'Engineer',
        original_description: ['old'],
        enhanced_description: ['new'],
      },
    ]);

    expect(result).toEqual({ message: 'Applied', updated_items: 2 });
    expect(mockedApiPost).toHaveBeenCalledWith('/enrichment/apply/resume-1', {
      enhancements: [
        {
          item_id: 'exp-1',
          item_type: 'experience',
          title: 'Engineer',
          original_description: ['old'],
          enhanced_description: ['new'],
        },
      ],
    });
  });

  it('regenerateItems throws generic message when backend detail missing', async () => {
    mockedApiPost.mockResolvedValueOnce(new Response('server down', { status: 503 }));

    await expect(
      regenerateItems({
        resume_id: 'resume-1',
        instruction: 'Make it concise',
        items: [
          {
            item_id: 'exp-1',
            item_type: 'experience',
            title: 'Engineer',
            current_content: ['line 1'],
          },
        ],
      })
    ).rejects.toThrow('Failed to regenerate content (status 503).');
  });

  it('applyRegeneratedItems posts array payload and returns result', async () => {
    mockedApiPost.mockResolvedValueOnce(
      jsonResponse({ message: 'Applied regenerated', updated_items: 1 })
    );

    const result = await applyRegeneratedItems('resume-1', [
      {
        item_id: 'exp-1',
        item_type: 'experience',
        title: 'Engineer',
        original_content: ['old'],
        new_content: ['new'],
        diff_summary: 'Improved clarity',
      },
    ]);

    expect(result.updated_items).toBe(1);
    expect(mockedApiPost).toHaveBeenCalledWith('/enrichment/apply-regenerated/resume-1', [
      {
        item_id: 'exp-1',
        item_type: 'experience',
        title: 'Engineer',
        original_content: ['old'],
        new_content: ['new'],
        diff_summary: 'Improved clarity',
      },
    ]);
  });
});
