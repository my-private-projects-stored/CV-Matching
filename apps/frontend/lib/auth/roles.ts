export type CanonicalRole = 'candidate' | 'recruiter' | 'tech_staff' | 'platform_owner';
export type UserRole = CanonicalRole | 'admin';

export function canonicalizeRole(role?: string | null): CanonicalRole | null {
  const normalized = String(role || '')
    .trim()
    .toLowerCase();
  if (normalized === 'admin' || normalized === 'tech_staff') return 'tech_staff';
  if (normalized === 'candidate') return 'candidate';
  if (normalized === 'recruiter') return 'recruiter';
  if (normalized === 'platform_owner') return 'platform_owner';
  return null;
}

export function isTechStaff(role?: string | null): boolean {
  return canonicalizeRole(role) === 'tech_staff';
}

export function isPlatformOwner(role?: string | null): boolean {
  return canonicalizeRole(role) === 'platform_owner';
}

export function defaultDashboardForRole(role?: string | null): string {
  const canonical = canonicalizeRole(role);
  if (canonical === 'recruiter') return '/recruiter/dashboard';
  if (canonical === 'tech_staff') return '/admin/health';
  if (canonical === 'platform_owner') return '/owner/dashboard';
  return '/candidate/dashboard';
}
