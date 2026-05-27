'use client';

import { useEffect, useState } from 'react';
import { PageHeader, ConfirmDialog, ErrorBanner, SkeletonRow } from '@/components/ui';
import { SystemHealthBadge } from '@/components/admin/SystemHealthBadge';
import {
  clearAllApiKeys,
  deleteApiKey,
  fetchApiKeyStatus,
  fetchFeatureConfig,
  fetchLanguageConfig,
  fetchLlmConfig,
  fetchPromptConfig,
  fetchPrivacyConfig,
  resetDatabase,
  testLlmConnection,
  updateApiKeys,
  updateFeatureConfig,
  updateLanguageConfig,
  updateLlmConfig,
  updatePromptConfig,
  updatePrivacyConfig,
  fetchLlmEvents,
  type ApiKeyProvider,
  type ApiKeyStatusResponse,
  type ApiKeysUpdateRequest,
  type FeatureConfig,
  type LanguageConfig,
  type LLMConfig,
  type PromptConfig,
  type PrivacyConfig,
  type LlmEvent,
} from '@/lib/api/config';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

type Tab = 'llm' | 'prompts' | 'features' | 'apiKeys' | 'language' | 'privacy' | 'llmEvents';

export default function AdminConfigPage() {
  const header = usePageHeader('adminConfig');
  const { t } = useTranslations();
  const [tab, setTab] = useState<Tab>('llm');
  const [llm, setLlm] = useState<LLMConfig | null>(null);
  const [features, setFeatures] = useState<FeatureConfig | null>(null);
  const [language, setLanguage] = useState<LanguageConfig | null>(null);
  const [prompts, setPrompts] = useState<PromptConfig | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyConfig | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatusResponse | null>(null);
  const [truthfulnessRulesInput, setTruthfulnessRulesInput] = useState<string>('');
  const [apiKeyInputs, setApiKeyInputs] = useState<ApiKeysUpdateRequest>({});
  const [llmEvents, setLlmEvents] = useState<LlmEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventFeature, setEventFeature] = useState('');
  const [eventMode, setEventMode] = useState('');
  const [eventLimit, setEventLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState<(() => Promise<void>) | null>(null);
  const [confirmDanger, setConfirmDanger] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchLlmConfig(),
      fetchFeatureConfig(),
      fetchLanguageConfig(),
      fetchPromptConfig(),
      fetchPrivacyConfig(),
      fetchApiKeyStatus(),
    ])
      .then(
        ([llmConfig, featureConfig, languageConfig, promptConfig, privacyConfig, apiKeyStatus]) => {
          if (!active) return;
          setLlm(llmConfig);
          setFeatures(featureConfig);
          setLanguage(languageConfig);
          setPrompts(promptConfig);
          setTruthfulnessRulesInput(promptConfig.truthfulness_rules?.join('\n') || '');
          setPrivacy(privacyConfig);
          setApiKeyStatus(apiKeyStatus);
          setError(null);
        }
      )
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : t('errors.loadConfig'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function loadLlmEvents() {
    setEventsLoading(true);
    fetchLlmEvents({
      feature: eventFeature.trim() || undefined,
      generation_mode: eventMode || undefined,
      limit: eventLimit,
    })
      .then((res) => {
        setLlmEvents(res.data || []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('errors.loadLlmEvents'));
      })
      .finally(() => {
        setEventsLoading(false);
      });
  }

  useEffect(() => {
    if (tab !== 'llmEvents') return;
    void loadLlmEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function runSave(operation: () => Promise<void>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await operation();
      setMessage(t('admin.config.messages.configSaved'));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('errors.saveConfig'));
    } finally {
      setSaving(false);
      setConfirmSave(null);
    }
  }

  async function runDanger(operation: () => Promise<void>) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await operation();
      setMessage(t('admin.config.messages.actionCompleted'));
      const refreshed = await fetchApiKeyStatus();
      setApiKeyStatus(refreshed);
      setApiKeyInputs({});
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('errors.adminActionFailed'));
    } finally {
      setSaving(false);
      setConfirmDanger(null);
    }
  }

  async function refreshApiKeyStatus() {
    const refreshed = await fetchApiKeyStatus();
    setApiKeyStatus(refreshed);
  }

  async function runConnectionTest() {
    if (!llm) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await testLlmConnection(llm);
      if (result.healthy) {
        setMessage(t('admin.config.messages.connectionOk'));
      } else {
        setError(result.error || t('admin.config.messages.connectionFailed'));
      }
    } catch (testError) {
      setError(
        testError instanceof Error ? testError.message : t('admin.config.messages.connectionFailed')
      );
    } finally {
      setSaving(false);
    }
  }

  function askSave(operation: () => Promise<void>) {
    setConfirmSave(() => operation);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={header.title} subtitle={header.subtitle} action={<SystemHealthBadge />} />
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['llm', 'admin.tabs.llm'],
            ['prompts', 'admin.tabs.prompts'],
            ['features', 'admin.tabs.features'],
            ['apiKeys', 'admin.tabs.apiKeys'],
            ['language', 'admin.tabs.language'],
            ['privacy', 'admin.tabs.privacy'],
            ['llmEvents', 'admin.tabs.llmEvents'],
          ] as const
        ).map(([id, labelKey]) => (
          <button
            key={id}
            className={`rounded-lg border border-[var(--border)] px-3 py-2 text-xs ${tab === id ? 'bg-[var(--blue-50)] text-[var(--blue-700)]' : ''}`}
            onClick={() => setTab(id as Tab)}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
      {loading ? <SkeletonRow /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {message ? (
        <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-[var(--success)]">
          {message}
        </p>
      ) : null}

      {!loading && llm && tab === 'llm' ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <select
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            value={llm.provider}
            onChange={(event) =>
              setLlm({ ...llm, provider: event.target.value as LLMConfig['provider'] })
            }
          >
            {(['ollama', 'openai', 'anthropic', 'gemini', 'openrouter', 'deepseek'] as const).map(
              (provider) => (
                <option key={provider} value={provider}>
                  {t(`admin.config.llmProviders.${provider}`)}
                </option>
              )
            )}
          </select>
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('admin.config.model')}
            value={llm.model}
            onChange={(event) => setLlm({ ...llm, model: event.target.value })}
          />
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('admin.config.baseUrl')}
            value={llm.api_base ?? ''}
            onChange={(event) => setLlm({ ...llm, api_base: event.target.value || null })}
          />
          <input
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            placeholder={t('admin.config.apiKey')}
            value={llm.api_key ?? ''}
            onChange={(event) => setLlm({ ...llm, api_key: event.target.value })}
          />
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-60"
              disabled={saving}
              onClick={runConnectionTest}
            >
              {t('admin.config.testConnection')}
            </button>
            <button
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
              disabled={saving}
              onClick={() =>
                askSave(async () => {
                  setLlm(await updateLlmConfig(llm));
                })
              }
            >
              {t('common.save')}
            </button>
          </div>
        </section>
      ) : null}

      {!loading && features && tab === 'features' ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          {(
            [
              ['enable_cover_letter', 'admin.config.features.coverLetter'],
              ['enable_outreach_message', 'admin.config.features.outreachMessage'],
            ] as const
          ).map(([key, labelKey]) => (
            <label key={key} className="flex items-center justify-between text-sm">
              {t(labelKey)}
              <input
                type="checkbox"
                checked={Boolean(features[key as keyof FeatureConfig])}
                onChange={(event) => setFeatures({ ...features, [key]: event.target.checked })}
              />
            </label>
          ))}
          <button
            className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white"
            onClick={() =>
              askSave(async () => {
                setFeatures(await updateFeatureConfig(features));
              })
            }
          >
            {t('common.save')}
          </button>
        </section>
      ) : null}

      {!loading && language && tab === 'language' ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <select
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            value={language.ui_language}
            onChange={(event) =>
              setLanguage({
                ...language,
                ui_language: event.target.value as LanguageConfig['ui_language'],
              })
            }
          >
            {['en', 'vi'].map((locale) => (
              <option key={locale} value={locale}>
                {t('admin.config.language.uiLocale', { locale: locale.toUpperCase() })}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            value={language.content_language}
            onChange={(event) =>
              setLanguage({
                ...language,
                content_language: event.target.value as LanguageConfig['content_language'],
              })
            }
          >
            {['en', 'vi', 'auto'].map((locale) => (
              <option key={locale} value={locale}>
                {locale === 'auto'
                  ? t('admin.config.language.autoDetect')
                  : t('admin.config.language.contentLocale', { locale: locale.toUpperCase() })}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white"
            onClick={() =>
              askSave(async () => {
                setLanguage(await updateLanguageConfig(language));
              })
            }
          >
            {t('common.save')}
          </button>
        </section>
      ) : null}

      {!loading && prompts && tab === 'prompts' ? (
        <section className="space-y-6 rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
              {t('admin.config.prompts.defaultTailorStyle')}
            </label>
            <select
              className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              value={prompts.default_prompt_id}
              onChange={(event) =>
                setPrompts({ ...prompts, default_prompt_id: event.target.value })
              }
            >
              {prompts.prompt_options.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
              {t('admin.config.prompts.truthfulnessRules')}
            </label>
            <p className="text-xs text-[var(--text-2)]">
              {t('admin.config.prompts.truthfulnessHelp')}
            </p>
            <textarea
              className="w-full min-h-28 rounded-lg border border-[var(--border)] p-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)] leading-6 font-mono"
              value={truthfulnessRulesInput}
              onChange={(event) => setTruthfulnessRulesInput(event.target.value)}
              placeholder={t('admin.config.prompts.truthfulnessPlaceholder')}
            />
          </div>

          <hr className="border-[var(--border)]" />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-1)]">
              {t('admin.config.prompts.templates')}
            </h3>
            <p className="text-xs text-[var(--text-2)]">
              {t('admin.config.prompts.templatesHelp')}
            </p>

            <div className="space-y-3">
              {/* Accordion for Tailor Resume Templates */}
              <details
                className="group border border-[var(--border)] rounded-xl bg-white overflow-hidden"
                open
              >
                <summary className="flex items-center justify-between p-4 text-sm font-semibold cursor-pointer hover:bg-gray-50 list-none">
                  <span>{t('admin.config.prompts.tailor')}</span>
                  <span className="text-xs text-[var(--text-3)] group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="p-4 border-t border-[var(--border)] bg-gray-50/30 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">
                      {t('admin.config.prompts.tailorNudge')}
                    </label>
                    <textarea
                      className="w-full min-h-24 rounded-lg border border-[var(--border)] bg-white p-3 text-sm font-mono leading-6 focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)]"
                      value={prompts.templates?.tailor?.nudge ?? ''}
                      onChange={(e) =>
                        setPrompts({
                          ...prompts,
                          templates: {
                            ...prompts.templates,
                            tailor: {
                              ...prompts.templates?.tailor,
                              nudge: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">
                      {t('admin.config.prompts.tailorKeywords')}
                    </label>
                    <textarea
                      className="w-full min-h-24 rounded-lg border border-[var(--border)] bg-white p-3 text-sm font-mono leading-6 focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)]"
                      value={prompts.templates?.tailor?.keywords ?? ''}
                      onChange={(e) =>
                        setPrompts({
                          ...prompts,
                          templates: {
                            ...prompts.templates,
                            tailor: {
                              ...prompts.templates?.tailor,
                              keywords: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">
                      {t('admin.config.prompts.tailorFull')}
                    </label>
                    <textarea
                      className="w-full min-h-24 rounded-lg border border-[var(--border)] bg-white p-3 text-sm font-mono leading-6 focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)]"
                      value={prompts.templates?.tailor?.full ?? ''}
                      onChange={(e) =>
                        setPrompts({
                          ...prompts,
                          templates: {
                            ...prompts.templates,
                            tailor: {
                              ...prompts.templates?.tailor,
                              full: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </details>

              {/* Accordion for Cover Letter & Outreach Templates */}
              <details className="group border border-[var(--border)] rounded-xl bg-white overflow-hidden">
                <summary className="flex items-center justify-between p-4 text-sm font-semibold cursor-pointer hover:bg-gray-50 list-none">
                  <span>{t('admin.config.prompts.coverOutreach')}</span>
                  <span className="text-xs text-[var(--text-3)] group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="p-4 border-t border-[var(--border)] bg-gray-50/30 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">
                      {t('admin.config.prompts.coverLetter')}
                    </label>
                    <textarea
                      className="w-full min-h-24 rounded-lg border border-[var(--border)] bg-white p-3 text-sm font-mono leading-6 focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)]"
                      value={prompts.templates?.cover_letter ?? ''}
                      onChange={(e) =>
                        setPrompts({
                          ...prompts,
                          templates: {
                            ...prompts.templates,
                            cover_letter: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">
                      {t('admin.config.prompts.outreach')}
                    </label>
                    <textarea
                      className="w-full min-h-24 rounded-lg border border-[var(--border)] bg-white p-3 text-sm font-mono leading-6 focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)]"
                      value={prompts.templates?.outreach ?? ''}
                      onChange={(e) =>
                        setPrompts({
                          ...prompts,
                          templates: {
                            ...prompts.templates,
                            outreach: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </details>

              {/* Accordion for Interview questions Template */}
              <details className="group border border-[var(--border)] rounded-xl bg-white overflow-hidden">
                <summary className="flex items-center justify-between p-4 text-sm font-semibold cursor-pointer hover:bg-gray-50 list-none">
                  <span>{t('admin.config.prompts.interview')}</span>
                  <span className="text-xs text-[var(--text-3)] group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="p-4 border-t border-[var(--border)] bg-gray-50/30 space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-2)]">
                    {t('admin.config.prompts.interviewDirectives')}
                  </label>
                  <textarea
                    className="w-full min-h-36 rounded-lg border border-[var(--border)] bg-white p-3 text-sm font-mono leading-6 focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)]"
                    value={prompts.templates?.interview ?? ''}
                    onChange={(e) =>
                      setPrompts({
                        ...prompts,
                        templates: {
                          ...prompts.templates,
                          interview: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </details>

              {/* Accordion for CV Enrichment Templates */}
              <details className="group border border-[var(--border)] rounded-xl bg-white overflow-hidden">
                <summary className="flex items-center justify-between p-4 text-sm font-semibold cursor-pointer hover:bg-gray-50 list-none">
                  <span>{t('admin.config.prompts.enrichment')}</span>
                  <span className="text-xs text-[var(--text-3)] group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <div className="p-4 border-t border-[var(--border)] bg-gray-50/30 space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">
                      {t('admin.config.prompts.enrichmentAnalyze')}
                    </label>
                    <textarea
                      className="w-full min-h-24 rounded-lg border border-[var(--border)] bg-white p-3 text-sm font-mono leading-6 focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)]"
                      value={prompts.templates?.enrichment?.analyze ?? ''}
                      onChange={(e) =>
                        setPrompts({
                          ...prompts,
                          templates: {
                            ...prompts.templates,
                            enrichment: {
                              ...prompts.templates?.enrichment,
                              analyze: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">
                      {t('admin.config.prompts.enrichmentEnhance')}
                    </label>
                    <textarea
                      className="w-full min-h-24 rounded-lg border border-[var(--border)] bg-white p-3 text-sm font-mono leading-6 focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)]"
                      value={prompts.templates?.enrichment?.enhance ?? ''}
                      onChange={(e) =>
                        setPrompts({
                          ...prompts,
                          templates: {
                            ...prompts.templates,
                            enrichment: {
                              ...prompts.templates?.enrichment,
                              enhance: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[var(--text-2)]">
                      {t('admin.config.prompts.enrichmentRegenerate')}
                    </label>
                    <textarea
                      className="w-full min-h-24 rounded-lg border border-[var(--border)] bg-white p-3 text-sm font-mono leading-6 focus:outline-none focus:ring-1 focus:ring-[var(--blue-700)]"
                      value={prompts.templates?.enrichment?.regenerate ?? ''}
                      onChange={(e) =>
                        setPrompts({
                          ...prompts,
                          templates: {
                            ...prompts.templates,
                            enrichment: {
                              ...prompts.templates?.enrichment,
                              regenerate: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60 font-semibold"
              disabled={saving}
              onClick={() =>
                askSave(async () => {
                  const rulesArray = truthfulnessRulesInput
                    .split('\n')
                    .map((r) => r.trim())
                    .filter(Boolean);
                  const updated = await updatePromptConfig({
                    ...prompts,
                    truthfulness_rules: rulesArray,
                  });
                  setPrompts(updated);
                  setTruthfulnessRulesInput(updated.truthfulness_rules?.join('\n') || '');
                })
              }
            >
              {saving ? t('forms.saving') : t('common.save')}
            </button>
          </div>
        </section>
      ) : null}

      {!loading && apiKeyStatus && tab === 'apiKeys' ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          {(['openai', 'anthropic', 'google', 'openrouter', 'deepseek'] as ApiKeyProvider[]).map(
            (provider) => {
              const status = apiKeyStatus.providers.find((item) => item.provider === provider);
              const providerName = t(`admin.apiKeyProviders.${provider}.name`);
              return (
                <div key={provider} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{providerName}</p>
                      <p className="text-xs text-[var(--text-3)]">
                        {t(`admin.apiKeyProviders.${provider}.description`)}
                      </p>
                      {status?.configured ? (
                        <p className="mt-1 text-xs text-[var(--text-2)]">
                          {t('admin.config.apiKeys.configured', { key: status.masked_key ?? '' })}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-[var(--text-3)]">
                          {t('admin.config.apiKeys.notConfigured')}
                        </p>
                      )}
                    </div>
                    {status?.configured ? (
                      <button
                        className="text-xs font-semibold text-[var(--danger)] disabled:opacity-60"
                        disabled={saving}
                        onClick={() =>
                          setConfirmDanger({
                            title: t('admin.config.apiKeys.deleteTitle', {
                              provider: providerName,
                            }),
                            description: t('admin.config.apiKeys.deleteDescription'),
                            action: async () => {
                              await deleteApiKey(provider);
                              await refreshApiKeyStatus();
                            },
                          })
                        }
                        type="button"
                      >
                        {t('common.delete')}
                      </button>
                    ) : null}
                  </div>
                  <input
                    className="mt-3 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                    placeholder={t('admin.config.apiKeys.newKey', {
                      provider: providerName,
                    })}
                    type="password"
                    value={apiKeyInputs[provider] ?? ''}
                    onChange={(event) =>
                      setApiKeyInputs((current) => ({ ...current, [provider]: event.target.value }))
                    }
                  />
                </div>
              );
            }
          )}
          <button
            className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white disabled:opacity-60"
            disabled={saving || Object.values(apiKeyInputs).every((value) => !value?.trim())}
            onClick={() =>
              askSave(async () => {
                const payload = Object.fromEntries(
                  Object.entries(apiKeyInputs).filter(([, value]) => value?.trim())
                ) as ApiKeysUpdateRequest;
                await updateApiKeys(payload);
                await refreshApiKeyStatus();
                setApiKeyInputs({});
                setMessage(t('admin.config.messages.apiKeysUpdated'));
              })
            }
            type="button"
          >
            {t('admin.config.apiKeys.save')}
          </button>
        </section>
      ) : null}

      {!loading && privacy && tab === 'privacy' ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <select
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            value={privacy.privacy_mode}
            onChange={(event) =>
              setPrivacy({ privacy_mode: event.target.value as PrivacyConfig['privacy_mode'] })
            }
          >
            <option value="hybrid">{t('admin.config.privacy.hybrid')}</option>
            <option value="local_only">{t('admin.config.privacy.localOnly')}</option>
            <option value="cloud_only">{t('admin.config.privacy.cloudOnly')}</option>
          </select>
          <button
            className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white"
            onClick={() =>
              askSave(async () => {
                setPrivacy(await updatePrivacyConfig(privacy));
              })
            }
          >
            {t('common.save')}
          </button>
        </section>
      ) : null}

      {!loading && tab === 'llmEvents' ? (
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{t('admin.config.llmEvents.title')}</h2>
            <button
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-1 disabled:opacity-60"
              disabled={eventsLoading}
              onClick={() => void loadLlmEvents()}
              type="button"
            >
              <svg
                className={`h-3 w-3 ${eventsLoading ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              {t('admin.config.llmEvents.refresh')}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px_120px]">
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              placeholder={t('admin.config.llmEvents.filters.feature')}
              value={eventFeature}
              onChange={(event) => setEventFeature(event.target.value)}
            />
            <select
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              value={eventMode}
              onChange={(event) => setEventMode(event.target.value)}
            >
              <option value="">{t('admin.config.llmEvents.filters.allModes')}</option>
              <option value="llm">{t('admin.config.llmEvents.modes.llm')}</option>
              <option value="template_fallback">
                {t('admin.config.llmEvents.modes.fallback')}
              </option>
            </select>
            <input
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              type="number"
              min={1}
              max={200}
              value={eventLimit}
              aria-label={t('admin.config.llmEvents.filters.limit')}
              onChange={(event) => setEventLimit(Number(event.target.value) || 50)}
            />
          </div>

          {eventsLoading && llmEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-3)]">
              {t('admin.config.llmEvents.loading')}
            </div>
          ) : llmEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-3)]">
              {t('admin.config.llmEvents.empty')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                    <th className="pb-3 pr-4">{t('admin.config.llmEvents.columns.timestamp')}</th>
                    <th className="pb-3 px-4">{t('admin.config.llmEvents.columns.feature')}</th>
                    <th className="pb-3 px-4">{t('admin.config.llmEvents.columns.mode')}</th>
                    <th className="pb-3 px-4">
                      {t('admin.config.llmEvents.columns.providerModel')}
                    </th>
                    <th className="pb-3 px-4">
                      {t('admin.config.llmEvents.columns.statusReason')}
                    </th>
                    <th className="pb-3 pl-4">{t('admin.config.llmEvents.columns.requestId')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {llmEvents.map((event) => {
                    const isLlm = event.generation_mode === 'llm';
                    const dateStr = new Date(event.createdAt).toLocaleString();
                    return (
                      <tr key={event._id} className="hover:bg-gray-50/50">
                        <td className="py-3.5 pr-4 text-xs font-mono text-[var(--text-2)] whitespace-nowrap">
                          {dateStr}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-[var(--text-1)]">
                          {event.feature}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isLlm
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            {isLlm
                              ? t('admin.config.llmEvents.modes.llm')
                              : t('admin.config.llmEvents.modes.fallback')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          {event.provider ? (
                            <div className="font-medium text-[var(--text-1)]">
                              {event.provider}
                              {event.model && (
                                <span className="text-[var(--text-3)] font-normal font-mono ml-1">
                                  ({event.model})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[var(--text-3)]">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          {isLlm ? (
                            <span className="text-green-600 font-semibold">
                              {t('admin.config.llmEvents.status.success')}
                            </span>
                          ) : (
                            <span
                              className="text-amber-600 font-medium whitespace-nowrap"
                              title={event.reason || ''}
                            >
                              {t('admin.config.llmEvents.status.failed', {
                                reason: event.reason || t('admin.config.llmEvents.status.unknown'),
                              })}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 pl-4 text-xs font-mono text-[var(--text-3)] whitespace-nowrap">
                          {event.request_id || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {!loading ? (
        <section className="space-y-3 rounded-2xl border border-red-200 bg-red-50/40 p-5">
          <h2 className="text-sm font-semibold text-[var(--danger)]">
            {t('admin.config.dangerZone.title')}
          </h2>
          <p className="text-xs text-[var(--text-2)]">{t('admin.config.dangerZone.description')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--danger)] disabled:opacity-60"
              disabled={saving}
              onClick={() =>
                setConfirmDanger({
                  title: t('admin.config.dangerZone.clearAllKeysTitle'),
                  description: t('admin.config.dangerZone.clearAllKeysDescription'),
                  action: clearAllApiKeys,
                })
              }
              type="button"
            >
              {t('admin.config.dangerZone.clearAllKeys')}
            </button>
            <button
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--danger)] disabled:opacity-60"
              disabled={saving}
              onClick={() =>
                setConfirmDanger({
                  title: t('admin.config.dangerZone.resetDatabaseTitle'),
                  description: t('admin.config.dangerZone.resetDatabaseDescription'),
                  action: resetDatabase,
                })
              }
              type="button"
            >
              {t('admin.config.dangerZone.resetDatabase')}
            </button>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmSave)}
        title={t('admin.config.confirm.saveTitle')}
        description={t('admin.config.confirm.saveDescription')}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        disabled={saving}
        onConfirm={() => (confirmSave ? runSave(confirmSave) : undefined)}
        onCancel={() => setConfirmSave(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmDanger)}
        title={confirmDanger?.title ?? t('admin.config.confirm.confirmAction')}
        description={confirmDanger?.description}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        confirmVariant="danger"
        disabled={saving}
        onConfirm={() => (confirmDanger ? runDanger(confirmDanger.action) : undefined)}
        onCancel={() => setConfirmDanger(null)}
      />
    </div>
  );
}
