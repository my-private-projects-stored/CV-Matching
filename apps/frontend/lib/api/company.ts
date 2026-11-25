import { apiFetch, apiPatch, apiPut } from './client';
import { buildApiClientError } from './error';

async function assertOk(res: Response, fallbackMessagePrefix: string): Promise<void> {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  throw buildApiClientError(res.status, body, fallbackMessagePrefix);
}

export interface CompanyProfile {
  id?: string;
  recruiterId?: string;
  name?: string;
  companyName?: string;
  taxCode?: string;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  verificationNote?: string;
  industry?: string;
  website?: string;
  description?: string;
  overview?: string;
  companySize?: string;
  address?: string;
  brandPrimaryColor?: string;
  brandLogoUrl?: string;
}

function normalizeCompany(raw: Record<string, unknown>): CompanyProfile {
  return {
    id: raw._id ? String(raw._id) : raw.id ? String(raw.id) : undefined,
    recruiterId: raw.recruiter_id
      ? String(raw.recruiter_id)
      : raw.ownerId
        ? String(raw.ownerId)
        : undefined,
    name: String(raw.name ?? raw.company_name ?? ''),
    companyName: String(raw.company_name ?? raw.name ?? ''),
    taxCode: raw.taxCode ? String(raw.taxCode) : '',
    verificationStatus:
      (raw.verificationStatus as CompanyProfile['verificationStatus']) ?? 'unverified',
    verificationNote: raw.verificationNote ? String(raw.verificationNote) : '',
    industry: String(raw.industry ?? ''),
    website: String(raw.website ?? ''),
    description: String(raw.description ?? raw.overview ?? ''),
    overview: String(raw.overview ?? raw.description ?? ''),
    companySize: String(raw.company_size ?? raw.companySize ?? raw.size ?? ''),
    address: String(raw.address ?? raw.location ?? ''),
    brandPrimaryColor: String(raw.brand_primary_color ?? raw.brandPrimaryColor ?? '#1D4ED8'),
    brandLogoUrl: String(raw.brand_logo_url ?? raw.brandLogoUrl ?? ''),
  };
}

function toPayload(profile: CompanyProfile): Record<string, unknown> {
  return {
    name: profile.name ?? profile.companyName,
    taxCode: profile.taxCode,
    industry: profile.industry,
    website: profile.website,
    description: profile.description ?? profile.overview,
    company_size: profile.companySize,
    size: profile.companySize,
    address: profile.address,
    location: profile.address,
    brand_primary_color: profile.brandPrimaryColor,
    brand_logo_url: profile.brandLogoUrl,
  };
}

export async function fetchMyCompany(): Promise<CompanyProfile> {
  const res = await apiFetch('/company/me');
  await assertOk(res, 'Failed to load company profile');
  const body = (await res.json()) as {
    data?: Record<string, unknown>;
    company?: Record<string, unknown>;
  };
  return normalizeCompany(body.data ?? body.company ?? {});
}

export async function updateMyCompany(profile: CompanyProfile): Promise<CompanyProfile> {
  const res = await apiPut('/company/me', toPayload(profile));
  await assertOk(res, 'Failed to update company profile');
  const body = (await res.json()) as {
    data?: Record<string, unknown>;
    company?: Record<string, unknown>;
  };
  return normalizeCompany(body.data ?? body.company ?? {});
}

export async function fetchCompanyById(companyId: string): Promise<CompanyProfile> {
  const res = await apiFetch(`/company/${encodeURIComponent(companyId)}`);
  await assertOk(res, 'Failed to load company');
  const body = (await res.json()) as {
    data?: Record<string, unknown>;
    company?: Record<string, unknown>;
  };
  return normalizeCompany(body.data ?? body.company ?? {});
}

export async function fetchCompanies(verificationStatus?: string): Promise<CompanyProfile[]> {
  const suffix = verificationStatus
    ? `?verificationStatus=${encodeURIComponent(verificationStatus)}`
    : '';
  const res = await apiFetch(`/company${suffix}`);
  await assertOk(res, 'Failed to load companies');
  const body = (await res.json()) as {
    companies?: Record<string, unknown>[];
    data?: Record<string, unknown>[];
  };
  return (body.companies ?? body.data ?? []).map(normalizeCompany);
}

export async function verifyCompany(
  companyId: string,
  status: 'verified' | 'rejected',
  note?: string
): Promise<CompanyProfile> {
  const res = await apiPatch(`/company/${encodeURIComponent(companyId)}/verify`, { status, note });
  await assertOk(res, 'Failed to verify company');
  const body = (await res.json()) as {
    company?: Record<string, unknown>;
    data?: Record<string, unknown>;
  };
  return normalizeCompany(body.company ?? body.data ?? {});
}
