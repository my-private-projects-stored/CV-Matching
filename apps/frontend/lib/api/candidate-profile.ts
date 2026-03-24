import { apiFetch, apiPut } from './client';

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

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  let detail = '';
  try {
    const payload = (await res.json()) as { message?: string; detail?: string };
    detail = payload?.message || payload?.detail || '';
  } catch {
    // Ignore parse failures and use fallback message.
  }

  return detail || fallback;
}

export async function fetchMyCandidateProfile(): Promise<CandidateProfileResponse> {
  const res = await apiFetch('/candidate-profile/me');
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Fetch candidate profile failed (status ${res.status})`));
  }
  return (await res.json()) as CandidateProfileResponse;
}

export async function updateMyCandidateProfile(
  payload: Partial<CandidateProfilePayload>
): Promise<CandidateProfileResponse> {
  const res = await apiPut('/candidate-profile/me', payload);
  if (!res.ok) {
    throw new Error(await readErrorMessage(res, `Update candidate profile failed (status ${res.status})`));
  }
  return (await res.json()) as CandidateProfileResponse;
}
