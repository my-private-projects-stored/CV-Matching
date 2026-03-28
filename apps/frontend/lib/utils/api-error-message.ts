import type { ApiClientError } from '@/lib/api/error';

export type Translator = (key: string, params?: Record<string, string | number>) => string;

export function mapApiErrorToMessage(error: unknown, t: Translator, fallback: string): string {
  const apiError = error as ApiClientError;
  const errorCode = String(apiError?.errorCode || '').toLowerCase();

  if (errorCode === 'provider_blocked_by_privacy_mode') {
    return t('tailor.errors.privacyModeBlocked');
  }

  return error instanceof Error ? error.message : fallback;
}
