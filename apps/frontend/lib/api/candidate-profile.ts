import { apiFetch, apiPut } from './client';
import { buildApiClientError } from './error';

export interface CandidateProfileExperience {
  title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  summary: string;
}

export interface CandidateProfileEducation {
  school: string;
  degree: string;
  field: string;
  start_date: string;
  end_date: string;
  summary: string;
}

export interface CandidatePortfolioItem {
  name: string;
  url: string;
  description: string;
}

export interface CandidateProfilePayload {
  headline: string;
  summary: string;
  phone: string;
  location: string;
  website: string;
  portfolio_links: string[];
  skills: string[];
  experience: CandidateProfileExperience[];
  education: CandidateProfileEducation[];
  portfolio: CandidatePortfolioItem[];
}

export interface CandidateProfileResponse {
  data: {
    user_id: string;
    email: string;
    full_name: string;
    role: 'candidate' | 'recruiter' | 'admin';
    profile: CandidateProfilePayload;
    updated_at: string;
  };
}

async function assertOk(res: Response, fallbackMessagePrefix: string): Promise<void> {
  if (res.ok) return;
  const text = await res.text().catch(() => '');
  throw buildApiClientError(res.status, text, fallbackMessagePrefix);
}

export async function fetchMyCandidateProfile(): Promise<CandidateProfileResponse> {
  const res = await apiFetch('/candidate-profile/me');
  await assertOk(res, 'Fetch candidate profile failed');
  return (await res.json()) as CandidateProfileResponse;
}

export async function updateMyCandidateProfile(
  payload: Partial<CandidateProfilePayload>
): Promise<CandidateProfileResponse> {
  const res = await apiPut('/candidate-profile/me', payload);
  await assertOk(res, 'Update candidate profile failed');
  return (await res.json()) as CandidateProfileResponse;
}
