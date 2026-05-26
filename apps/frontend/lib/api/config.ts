import { apiFetch } from './client';
import { buildApiClientError } from './error';

async function assertOk(res: Response, fallbackMessagePrefix: string): Promise<void> {
  if (res.ok) return;
  const text = await res.text().catch(() => '');
  throw buildApiClientError(res.status, text, fallbackMessagePrefix);
}

// Supported LLM providers
export type LLMProvider = 'openai' | 'anthropic' | 'openrouter' | 'gemini' | 'deepseek' | 'ollama';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  api_key: string;
  api_base: string | null;
}

export interface LLMConfigUpdate {
  provider?: LLMProvider;
  model?: string;
  api_key?: string;
  api_base?: string | null;
}

export interface DatabaseStats {
  total_resumes: number;
  total_jobs: number;
  total_improvements: number;
  has_master_resume: boolean;
}

export interface SystemStatus {
  status: 'ready' | 'setup_required';
  llm_configured: boolean;
  llm_healthy: boolean;
  llm_provider?: string;
  llm_health_checked_at?: string | null;
  llm_health_stale?: boolean;
  privacy_mode?: PrivacyMode;
  has_master_resume: boolean;
  database_stats: DatabaseStats;
}

export type PrivacyMode = 'hybrid' | 'local_only' | 'cloud_only';

export interface PrivacyConfig {
  privacy_mode: PrivacyMode;
}

export interface PrivacyConfigUpdate {
  privacy_mode?: PrivacyMode;
}

export interface LLMHealthCheck {
  healthy: boolean;
  provider: string;
  model: string;
  error?: string;
  error_code?: string;
  response_model?: string;
  warning?: string;
  warning_code?: string;
  test_prompt?: string;
  model_output?: string;
  error_detail?: string;
}

// Fetch full LLM configuration
export async function fetchLlmConfig(): Promise<LLMConfig> {
  const res = await apiFetch('/config/llm-api-key', { credentials: 'include' });
  await assertOk(res, 'Failed to load LLM config');

  return res.json();
}

// Legacy function for backwards compatibility
export async function fetchLlmApiKey(): Promise<string> {
  const config = await fetchLlmConfig();
  return config.api_key ?? '';
}

// Update LLM configuration
export async function updateLlmConfig(config: LLMConfigUpdate): Promise<LLMConfig> {
  const res = await apiFetch('/config/llm-api-key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });

  await assertOk(res, 'Failed to update LLM config');

  return res.json();
}

// Legacy function for backwards compatibility
export async function updateLlmApiKey(value: string): Promise<string> {
  const config = await updateLlmConfig({ api_key: value });
  return config.api_key ?? '';
}

// Test LLM connection with optional config (for pre-save testing)
export async function testLlmConnection(config?: LLMConfigUpdate): Promise<LLMHealthCheck> {
  const options: RequestInit = {
    method: 'POST',
    credentials: 'include',
  };

  // If config provided, send it in the request body
  if (config) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(config);
  }

  const res = await apiFetch('/config/llm-test', options);

  await assertOk(res, 'Failed to test LLM connection');

  return res.json();
}

// Fetch system status
export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await apiFetch('/status', { credentials: 'include' });
  await assertOk(res, 'Failed to fetch system status');

  return res.json();
}

// Provider display names and default models
export const PROVIDER_INFO: Record<
  LLMProvider,
  { name: string; defaultModel: string; requiresKey: boolean }
> = {
  openai: { name: 'OpenAI', defaultModel: 'gpt-5-nano-2025-08-07', requiresKey: true },
  anthropic: { name: 'Anthropic', defaultModel: 'claude-haiku-4-5-20251001', requiresKey: true },
  openrouter: {
    name: 'OpenRouter',
    defaultModel: 'deepseek/deepseek-chat',
    requiresKey: true,
  },
  gemini: { name: 'Google Gemini', defaultModel: 'gemini-3-flash-preview', requiresKey: true },
  deepseek: { name: 'DeepSeek', defaultModel: 'deepseek-chat', requiresKey: true },
  ollama: { name: 'Ollama (Local)', defaultModel: 'gemma3:4b', requiresKey: false },
};

// Feature configuration types
export interface FeatureConfig {
  enable_cover_letter: boolean;
  enable_outreach_message: boolean;
}

export interface FeatureConfigUpdate {
  enable_cover_letter?: boolean;
  enable_outreach_message?: boolean;
}

export interface CompanyProfileConfig {
  company_name: string;
  overview: string;
  industry: string;
  company_size: string;
  address: string;
  website: string;
  brand_primary_color: string;
  brand_logo_url: string;
}

export type CompanyProfileConfigUpdate = Partial<CompanyProfileConfig>;

// Fetch feature configuration
export async function fetchFeatureConfig(): Promise<FeatureConfig> {
  const res = await apiFetch('/config/features', { credentials: 'include' });
  await assertOk(res, 'Failed to load feature config');

  return res.json();
}

// Update feature configuration
export async function updateFeatureConfig(config: FeatureConfigUpdate): Promise<FeatureConfig> {
  const res = await apiFetch('/config/features', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });

  await assertOk(res, 'Failed to update feature config');

  return res.json();
}

export async function fetchPrivacyConfig(): Promise<PrivacyConfig> {
  const res = await apiFetch('/config/privacy', { credentials: 'include' });
  await assertOk(res, 'Failed to load privacy config');

  return res.json();
}

export async function updatePrivacyConfig(config: PrivacyConfigUpdate): Promise<PrivacyConfig> {
  const res = await apiFetch('/config/privacy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });

  await assertOk(res, 'Failed to update privacy config');

  return res.json();
}

export async function fetchCompanyProfileConfig(): Promise<CompanyProfileConfig> {
  const res = await apiFetch('/config/company-profile', { credentials: 'include' });
  await assertOk(res, 'Failed to load company profile config');

  return res.json();
}

export async function updateCompanyProfileConfig(
  config: CompanyProfileConfigUpdate
): Promise<CompanyProfileConfig> {
  const res = await apiFetch('/config/company-profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(config),
  });

  await assertOk(res, 'Failed to update company profile');

  return res.json();
}

// Language configuration types
export type SupportedLanguage = 'en' | 'vi' | 'auto';

export interface LanguageConfig {
  ui_language: SupportedLanguage;
  content_language: SupportedLanguage;
  supported_languages: SupportedLanguage[];
}

export interface LanguageConfigUpdate {
  ui_language?: SupportedLanguage;
  content_language?: SupportedLanguage;
}

// Fetch language configuration
export async function fetchLanguageConfig(): Promise<LanguageConfig> {
  const res = await apiFetch('/config/language', { credentials: 'include' });
  await assertOk(res, 'Failed to load language config');

  return res.json();
}

// Update language configuration
export async function updateLanguageConfig(update: LanguageConfigUpdate): Promise<LanguageConfig> {
  const res = await apiFetch('/config/language', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(update),
  });

  await assertOk(res, 'Failed to update language config');

  return res.json();
}

export interface PromptOption {
  id: string;
  label: string;
  description: string;
}

export interface PromptTemplates {
  tailor?: {
    nudge?: string;
    keywords?: string;
    full?: string;
  };
  cover_letter?: string;
  outreach?: string;
  interview?: string;
  enrichment?: {
    analyze?: string;
    enhance?: string;
    regenerate?: string;
  };
}

export interface PromptConfig {
  default_prompt_id: string;
  prompt_options: PromptOption[];
  truthfulness_rules?: string[];
  templates?: PromptTemplates;
}

export interface PromptConfigUpdate {
  default_prompt_id?: string;
  truthfulness_rules?: string[];
  templates?: PromptTemplates;
}

// Fetch prompt configuration
export async function fetchPromptConfig(): Promise<PromptConfig> {
  const res = await apiFetch('/config/prompts', { credentials: 'include' });
  await assertOk(res, 'Failed to load prompt config');

  return res.json();
}

// Update prompt configuration
export async function updatePromptConfig(update: PromptConfigUpdate): Promise<PromptConfig> {
  const res = await apiFetch('/config/prompts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(update),
  });

  await assertOk(res, 'Failed to update prompt config');

  return res.json();
}

// API Key Management types
export type ApiKeyProvider = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'deepseek';

export interface ApiKeyProviderStatus {
  provider: ApiKeyProvider;
  configured: boolean;
  masked_key: string | null;
}

export interface ApiKeyStatusResponse {
  providers: ApiKeyProviderStatus[];
}

export interface ApiKeysUpdateRequest {
  openai?: string;
  anthropic?: string;
  google?: string;
  openrouter?: string;
  deepseek?: string;
}

export interface ApiKeysUpdateResponse {
  message: string;
  updated_providers: string[];
}

// Provider display names for API keys
export const API_KEY_PROVIDER_INFO: Record<ApiKeyProvider, { name: string; description: string }> =
  {
    openai: { name: 'OpenAI', description: 'GPT-4, GPT-4o, etc.' },
    anthropic: { name: 'Anthropic', description: 'Claude 3.5, Claude 4, etc.' },
    google: { name: 'Google', description: 'Gemini 1.5, Gemini 2, etc.' },
    openrouter: { name: 'OpenRouter', description: 'Access multiple providers' },
    deepseek: { name: 'DeepSeek', description: 'DeepSeek chat models' },
  };

// Fetch API key status for all providers
export async function fetchApiKeyStatus(): Promise<ApiKeyStatusResponse> {
  const res = await apiFetch('/config/api-keys', { credentials: 'include' });
  await assertOk(res, 'Failed to load API key status');

  return res.json();
}

// Update API keys for one or more providers
export async function updateApiKeys(keys: ApiKeysUpdateRequest): Promise<ApiKeysUpdateResponse> {
  const res = await apiFetch('/config/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(keys),
  });

  await assertOk(res, 'Failed to update API keys');

  return res.json();
}

// Delete API key for a specific provider
export async function deleteApiKey(provider: ApiKeyProvider): Promise<void> {
  const res = await apiFetch(`/config/api-keys/${provider}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  await assertOk(res, 'Failed to delete API key');

  // 204 No Content is expected here.
  if (res.status === 204) {
    return;
  }
}

// Clear all API keys
export async function clearAllApiKeys(): Promise<void> {
  const res = await apiFetch('/config/api-keys?confirm=CLEAR_ALL_KEYS', {
    method: 'DELETE',
    credentials: 'include',
  });

  await assertOk(res, 'Failed to clear API keys');
}

// Reset database
export async function resetDatabase(): Promise<void> {
  const res = await apiFetch('/config/reset', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: 'RESET_ALL_DATA' }),
  });

  await assertOk(res, 'Failed to reset database');
}

export interface LlmEvent {
  _id: string;
  feature: string;
  generation_mode: 'llm' | 'template_fallback';
  provider: string | null;
  model: string | null;
  reason: string | null;
  request_id: string | null;
  createdAt: string;
}

export interface LlmEventsResponse {
  data: LlmEvent[];
  count: number;
}

// Fetch LLM logs / events
export async function fetchLlmEvents(params?: {
  feature?: string;
  generation_mode?: string;
  limit?: number;
}): Promise<LlmEventsResponse> {
  const query = new URLSearchParams();
  if (params?.feature) query.set('feature', params.feature);
  if (params?.generation_mode) query.set('generation_mode', params.generation_mode);
  if (params?.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/config/llm-events${suffix}`, { credentials: 'include' });
  await assertOk(res, 'Failed to fetch LLM logs');
  return res.json();
}
