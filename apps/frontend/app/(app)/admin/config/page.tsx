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
  type ApiKeyProvider,
  type ApiKeyStatusResponse,
  type ApiKeysUpdateRequest,
  type FeatureConfig,
  type LanguageConfig,
  type LLMConfig,
  type PromptConfig,
  type PrivacyConfig,
} from '@/lib/api/config';
import { usePageHeader } from '@/lib/i18n/use-page-header';
import { useTranslations } from '@/lib/i18n/translations';

type Tab = 'llm' | 'prompts' | 'features' | 'apiKeys' | 'language' | 'privacy';

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
  const [apiKeyInputs, setApiKeyInputs] = useState<ApiKeysUpdateRequest>({});
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

  function askSave(operation: () => Promise<void>) {
    setConfirmSave(() => operation);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={header.title}
        subtitle={header.subtitle}
        action={<SystemHealthBadge />}
      />
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['llm', 'admin.tabs.llm'],
            ['prompts', 'admin.tabs.prompts'],
            ['features', 'admin.tabs.features'],
            ['apiKeys', 'admin.tabs.apiKeys'],
            ['language', 'admin.tabs.language'],
            ['privacy', 'admin.tabs.privacy'],
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
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
              onClick={() =>
                runSave(async () => {
                  const result = await testLlmConnection(llm);
                  setMessage(
                    result.healthy
                      ? t('admin.config.messages.connectionOk')
                      : result.error || t('admin.config.messages.connectionFailed')
                  );
                })
              }
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
            {['en', 'vi'].map((locale) => (
              <option key={locale} value={locale}>
                {t('admin.config.language.contentLocale', { locale: locale.toUpperCase() })}
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
        <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-white p-5">
          <select
            className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            value={prompts.default_prompt_id}
            onChange={(event) => setPrompts({ ...prompts, default_prompt_id: event.target.value })}
          >
            {prompts.prompt_options.map((prompt) => (
              <option key={prompt.id} value={prompt.id}>
                {prompt.label}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg bg-[var(--blue-700)] px-4 py-2 text-sm text-white"
            onClick={() =>
              askSave(async () => {
                setPrompts(await updatePromptConfig(prompts));
              })
            }
          >
            {t('common.save')}
          </button>
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
        onConfirm={() => (confirmSave ? runSave(confirmSave) : undefined)}
        onCancel={() => setConfirmSave(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmDanger)}
        title={confirmDanger?.title ?? t('admin.config.confirm.confirmAction')}
        description={confirmDanger?.description}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => (confirmDanger ? runDanger(confirmDanger.action) : undefined)}
        onCancel={() => setConfirmDanger(null)}
      />
    </div>
  );
}
