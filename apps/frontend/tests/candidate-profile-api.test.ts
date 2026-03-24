import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(),
  apiPut: vi.fn(),
}));

import { fetchMyCandidateProfile, updateMyCandidateProfile } from '@/lib/api/candidate-profile';
import { apiFetch, apiPut } from '@/lib/api/client';

const mockedApiFetch = vi.mocked(apiFetch);
const mockedApiPut = vi.mocked(apiPut);

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('candidate profile API client', () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
    mockedApiPut.mockReset();
  });

  it('fetchMyCandidateProfile returns profile payload', async () => {
    mockedApiFetch.mockResolvedValueOnce(
      jsonResponse({
        data: {
          user_id: 'u-1',
          email: 'candidate@example.com',
          full_name: 'Candidate',
          role: 'candidate',
          profile: {
            headline: 'Frontend Engineer',
            summary: 'Built production resume systems',
            phone: '',
            location: '',
            website: '',
            portfolio_links: [],
            skills: ['React', 'TypeScript'],
            experience: [],
            education: [],
            portfolio: [],
          },
          updated_at: '2026-03-23T00:00:00.000Z',
        },
      })
    );

    const result = await fetchMyCandidateProfile();

    expect(result.data.user_id).toBe('u-1');
    expect(result.data.profile.skills).toEqual(['React', 'TypeScript']);
    expect(mockedApiFetch).toHaveBeenCalledWith('/candidate-profile/me');
  });

  it('updateMyCandidateProfile sends payload and returns updated profile', async () => {
    mockedApiPut.mockResolvedValueOnce(
      jsonResponse({
        data: {
          user_id: 'u-1',
          email: 'candidate@example.com',
          full_name: 'Candidate',
          role: 'candidate',
          profile: {
            headline: 'Senior Frontend Engineer',
            summary: 'Improved ATS score by 25%',
            phone: '',
            location: '',
            website: '',
            portfolio_links: [],
            skills: ['React'],
            experience: [],
            education: [],
            portfolio: [],
          },
          updated_at: '2026-03-23T01:00:00.000Z',
        },
      })
    );

    const payload = {
      headline: 'Senior Frontend Engineer',
      skills: ['React'],
    };

    const result = await updateMyCandidateProfile(payload);

    expect(result.data.profile.headline).toBe('Senior Frontend Engineer');
    expect(mockedApiPut).toHaveBeenCalledWith('/candidate-profile/me', payload);
  });
});
