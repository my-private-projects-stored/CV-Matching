'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchLlmApiKey, updateLlmApiKey } from '@/lib/api/config';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { logError } from '@/lib/utils/logger';

type Status = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

const MASK_THRESHOLD = 6;

export default function ApiKeyMenu(): React.ReactElement {
  const { t } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [apiKey, setApiKey] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const value = await fetchLlmApiKey();
        if (cancelled) return;
        setApiKey(value);
        setDraft(value);
        setStatus('idle');
      } catch (err) {
        logError('api-key-menu', 'Failed to load LLM API key', err);
        if (!cancelled) {
          setError(t('settings.apiKeyMenu.loadError'));
          setStatus('error');
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const maskedKey = useMemo(() => {
    if (!apiKey) return t('settings.statusValues.notSet');
    if (apiKey.length <= MASK_THRESHOLD) return apiKey;
    return `${apiKey.slice(0, MASK_THRESHOLD)}••••`;
  }, [apiKey, t]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (!prev) {
        setDraft(apiKey);
        setError(null);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setStatus('saving');
    setError(null);
    try {
      const trimmed = draft.trim();
      const saved = await updateLlmApiKey(trimmed);
      setApiKey(saved);
      setDraft(saved);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1800);
    } catch (err) {
      logError('api-key-menu', 'Failed to update LLM API key', err);
      setError((err as Error).message || t('settings.apiKeyMenu.updateError'));
      setStatus('error');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setDraft(apiKey);
    setError(null);
  };

  return (
    <div className="relative text-sm">
      <button
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-[var(--foreground)] shadow-[0_10px_20px_rgba(15,27,45,0.12)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(15,27,45,0.18)]"
      >
        <span className="font-semibold">{t('settings.apiKeyMenu.buttonLabel')}</span>
        <span className="text-xs text-[color:var(--text-subtle)]">{maskedKey}</span>
        <ChevronDown className="h-4 w-4" />
      </button>
      {isOpen ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={handleClose}
            aria-hidden="true"
          />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-[color:var(--border)] bg-white p-4 shadow-[0_18px_32px_rgba(15,27,45,0.2)]">
            <h3 className="font-serif text-base font-semibold text-black mb-2">
              {t('settings.apiKeyMenu.title')}
            </h3>
            <p className="text-xs text-[color:var(--text-subtle)] mb-3">
              {t('settings.apiKeyMenu.description')}
            </p>
            <label
              htmlFor="llmKey"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-subtle)]"
            >
              {t('settings.apiKey')}
            </label>
            <input
              id="llmKey"
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('settings.llmConfiguration.apiKeyPlaceholder')}
              className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
            {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={status === 'saving'}
                className={`rounded-lg border border-[color:var(--border)] px-4 py-2 text-xs font-semibold transition-all ${
                  status === 'saving'
                    ? 'bg-[var(--surface-muted)] text-[color:var(--text-subtle)] cursor-wait'
                    : 'bg-[var(--primary)] text-white shadow-[0_10px_20px_rgba(15,27,45,0.18)] hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(15,27,45,0.22)]'
                }`}
              >
                {status === 'saving' ? t('common.saving') : t('common.save')}
              </button>
            </div>
            {status === 'saved' ? (
              <p className="mt-2 text-xs text-green-700 font-medium">
                {t('settings.apiKeyMenu.savedMessage')}
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
