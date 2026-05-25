import type { Locale } from '@/i18n/config';

const ROUTE_TITLE_KEYS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /^\/candidate\/dashboard/, key: 'routes.dashboard' },
  { pattern: /^\/candidate\/applications\/[^/]+/, key: 'routes.applications' },
  { pattern: /^\/candidate\/applications/, key: 'routes.applications' },
  { pattern: /^\/candidate\/resumes\/[^/]+\/history/, key: 'routes.history' },
  { pattern: /^\/candidate\/resumes\/[^/]+\/cover-letter/, key: 'routes.coverLetter' },
  { pattern: /^\/candidate\/resumes\/[^/]+\/builder/, key: 'routes.builder' },
  { pattern: /^\/candidate\/resumes/, key: 'routes.resumes' },
  { pattern: /^\/candidate\/jobs/, key: 'routes.jobs' },
  { pattern: /^\/candidate\/recommendations/, key: 'routes.recommendations' },
  { pattern: /^\/candidate\/optimize/, key: 'routes.optimize' },
  { pattern: /^\/candidate\/notifications/, key: 'routes.notifications' },
  { pattern: /^\/candidate\/profile/, key: 'routes.profile' },
  { pattern: /^\/candidate\/settings/, key: 'routes.settings' },
  { pattern: /^\/recruiter\/dashboard/, key: 'routes.dashboard' },
  { pattern: /^\/recruiter\/jobs\/[^/]+\/candidates/, key: 'routes.candidates' },
  { pattern: /^\/recruiter\/jobs\/[^/]+\/find-candidates/, key: 'routes.candidates' },
  { pattern: /^\/recruiter\/jobs\/[^/]+\/interview/, key: 'routes.interview' },
  { pattern: /^\/recruiter\/jobs/, key: 'routes.jobs' },
  { pattern: /^\/recruiter\/candidates/, key: 'routes.candidates' },
  { pattern: /^\/recruiter\/notifications/, key: 'routes.notifications' },
  { pattern: /^\/recruiter\/company/, key: 'routes.company' },
  { pattern: /^\/recruiter\/settings/, key: 'routes.settings' },
  { pattern: /^\/admin\/config/, key: 'routes.config' },
  { pattern: /^\/admin\/vectors/, key: 'routes.vectors' },
  { pattern: /^\/admin\/users/, key: 'routes.users' },
  { pattern: /^\/login/, key: 'routes.login' },
  { pattern: /^\/register/, key: 'routes.register' },
];

export function routeTitleKey(pathname: string): string {
  for (const entry of ROUTE_TITLE_KEYS) {
    if (entry.pattern.test(pathname)) return entry.key;
  }
  const parts = pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] ?? 'workspace';
  return `routes.${last.replace(/-/g, '')}`;
}

export function normalizeStoredLocale(value: string | null | undefined, fallback: Locale): Locale {
  if (value === 'en' || value === 'vi') return value;
  return fallback;
}
