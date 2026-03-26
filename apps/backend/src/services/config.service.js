import Application from "../models/Application.js";
import Job from "../models/Job.js";
import Resume from "../models/Resume.js";
import SystemConfig from "../models/SystemConfig.js";

const FEATURE_CONFIG_KEY = "featureConfig";
const LANGUAGE_CONFIG_KEY = "languageConfig";
const LLM_CONFIG_KEY = "llmConfig";
const PROMPT_CONFIG_KEY = "promptConfig";
const API_KEYS_CONFIG_KEY = "apiKeysConfig";
const COMPANY_PROFILE_CONFIG_KEY = "companyProfileConfig";
const PRIVACY_CONFIG_KEY = "privacyConfig";

const SUPPORTED_API_KEY_PROVIDERS = ["openai", "anthropic", "google", "openrouter", "deepseek"];

const SUPPORTED_LLM_PROVIDERS = new Set([
  "openai",
  "anthropic",
  "openrouter",
  "gemini",
  "deepseek",
  "ollama",
]);

const DEFAULT_FEATURE_CONFIG = {
  enable_cover_letter: false,
  enable_outreach_message: false,
};

const DEFAULT_LANGUAGE_CONFIG = {
  ui_language: "en",
  content_language: "en",
  supported_languages: ["en", "vi"],
};

const DEFAULT_LLM_CONFIG = {
  provider: "openai",
  model: "gpt-5-nano-2025-08-07",
  api_key: "",
  api_base: null,
};

const DEFAULT_PROMPT_CONFIG = {
  default_prompt_id: "keywords",
  prompt_options: [
    {
      id: "nudge",
      label: "Nudge",
      description: "Small wording adjustments preserving original structure.",
    },
    {
      id: "keywords",
      label: "Keywords",
      description: "Optimize keyword coverage for ATS and recruiter scanning.",
    },
    {
      id: "full",
      label: "Full rewrite",
      description: "Comprehensive rewrite with stronger impact and alignment.",
    },
  ],
};

const DEFAULT_API_KEYS_CONFIG = {
  openai: "",
  anthropic: "",
  google: "",
  openrouter: "",
  deepseek: "",
};

const DEFAULT_COMPANY_PROFILE_CONFIG = {
  company_name: "",
  overview: "",
  industry: "",
  company_size: "",
  address: "",
  website: "",
  brand_primary_color: "#1D4ED8",
  brand_logo_url: "",
};

const DEFAULT_PRIVACY_CONFIG = {
  privacy_mode: "hybrid",
};

const SUPPORTED_PRIVACY_MODES = new Set(["hybrid", "local_only", "cloud_only"]);

const SUPPORTED_LANGUAGES = new Set(DEFAULT_LANGUAGE_CONFIG.supported_languages);

async function upsertConfig(key, value) {
  await SystemConfig.findOneAndUpdate(
    { key },
    { $set: { value } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return value;
}

async function readConfig(key, defaults) {
  const doc = await SystemConfig.findOne({ key }).lean();
  return {
    ...defaults,
    ...(doc?.value || {}),
  };
}

function validateLanguageConfig(input = {}) {
  const uiLanguage = input.ui_language || DEFAULT_LANGUAGE_CONFIG.ui_language;
  const contentLanguage = input.content_language || DEFAULT_LANGUAGE_CONFIG.content_language;

  if (!SUPPORTED_LANGUAGES.has(uiLanguage)) {
    const err = new Error(`Unsupported ui_language: ${uiLanguage}`);
    err.statusCode = 400;
    throw err;
  }

  if (!SUPPORTED_LANGUAGES.has(contentLanguage)) {
    const err = new Error(`Unsupported content_language: ${contentLanguage}`);
    err.statusCode = 400;
    throw err;
  }

  return {
    ui_language: uiLanguage,
    content_language: contentLanguage,
    supported_languages: DEFAULT_LANGUAGE_CONFIG.supported_languages,
  };
}

function normalizeFeatureConfig(input = {}) {
  return {
    enable_cover_letter: Boolean(input.enable_cover_letter),
    enable_outreach_message: Boolean(input.enable_outreach_message),
  };
}

function maskApiKey(value = "") {
  const normalized = String(value || "");
  if (!normalized) {
    return "";
  }

  if (normalized.length <= 6) {
    return `${normalized.slice(0, 1)}***${normalized.slice(-1)}`;
  }

  return `${normalized.slice(0, 4)}****${normalized.slice(-2)}`;
}

function validateLlmProvider(provider) {
  if (!SUPPORTED_LLM_PROVIDERS.has(provider)) {
    const err = new Error(`Unsupported provider: ${provider}`);
    err.statusCode = 400;
    throw err;
  }
}

function sanitizeLlmConfig(input = {}) {
  const provider = input.provider || DEFAULT_LLM_CONFIG.provider;
  validateLlmProvider(provider);

  const model = String(input.model || DEFAULT_LLM_CONFIG.model).trim();
  const apiBase = input.api_base ? String(input.api_base).trim() : null;
  const apiKey = typeof input.api_key === "string" ? input.api_key.trim() : undefined;

  return {
    provider,
    model: model || DEFAULT_LLM_CONFIG.model,
    api_base: apiBase || null,
    api_key: apiKey,
  };
}

function publicLlmConfig(config) {
  return {
    provider: config.provider,
    model: config.model,
    api_base: config.api_base,
    api_key: config.api_key ? maskApiKey(config.api_key) : "",
  };
}

function sanitizePromptConfig(input = {}) {
  const promptOptions = Array.isArray(input.prompt_options) && input.prompt_options.length
    ? input.prompt_options
    : DEFAULT_PROMPT_CONFIG.prompt_options;

  const promptOptionIds = new Set(promptOptions.map((item) => item.id));
  const defaultPromptId = input.default_prompt_id || DEFAULT_PROMPT_CONFIG.default_prompt_id;

  if (!promptOptionIds.has(defaultPromptId)) {
    const err = new Error(`Unsupported default_prompt_id: ${defaultPromptId}`);
    err.statusCode = 400;
    throw err;
  }

  return {
    default_prompt_id: defaultPromptId,
    prompt_options: promptOptions,
  };
}

function sanitizeApiKeysConfig(input = {}) {
  const merged = {
    ...DEFAULT_API_KEYS_CONFIG,
    ...input,
  };

  const normalized = {};
  for (const provider of SUPPORTED_API_KEY_PROVIDERS) {
    const value = merged[provider];
    normalized[provider] = typeof value === "string" ? value.trim() : "";
  }

  return normalized;
}

function assertSupportedApiKeyProvider(provider) {
  if (!SUPPORTED_API_KEY_PROVIDERS.includes(provider)) {
    const err = new Error(`Unsupported API key provider: ${provider}`);
    err.statusCode = 400;
    throw err;
  }
}

function normalizeCompanyText(value = "") {
  return String(value || "").trim();
}

function normalizeWebsite(value = "") {
  const website = normalizeCompanyText(value);
  if (!website) return "";

  if (/^https?:\/\//i.test(website)) {
    return website;
  }

  return `https://${website}`;
}

function normalizeBrandColor(value = "") {
  const color = normalizeCompanyText(value).toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(color)) {
    return color;
  }
  return DEFAULT_COMPANY_PROFILE_CONFIG.brand_primary_color;
}

function sanitizeCompanyProfileConfig(input = {}) {
  return {
    company_name: normalizeCompanyText(input.company_name),
    overview: normalizeCompanyText(input.overview),
    industry: normalizeCompanyText(input.industry),
    company_size: normalizeCompanyText(input.company_size),
    address: normalizeCompanyText(input.address),
    website: normalizeWebsite(input.website),
    brand_primary_color: normalizeBrandColor(input.brand_primary_color),
    brand_logo_url: normalizeCompanyText(input.brand_logo_url),
  };
}

function sanitizePrivacyConfig(input = {}) {
  const privacyMode = String(input.privacy_mode || DEFAULT_PRIVACY_CONFIG.privacy_mode)
    .trim()
    .toLowerCase();

  if (!SUPPORTED_PRIVACY_MODES.has(privacyMode)) {
    const err = new Error(`Unsupported privacy_mode: ${privacyMode}`);
    err.statusCode = 400;
    throw err;
  }

  return {
    privacy_mode: privacyMode,
  };
}

function isProviderAllowedByPrivacy(provider, privacyMode) {
  if (privacyMode === "local_only") {
    return provider === "ollama";
  }

  if (privacyMode === "cloud_only") {
    return provider !== "ollama";
  }

  return true;
}

export async function getFeatureConfig() {
  return readConfig(FEATURE_CONFIG_KEY, DEFAULT_FEATURE_CONFIG);
}

export async function getLlmConfig() {
  const raw = await readConfig(LLM_CONFIG_KEY, DEFAULT_LLM_CONFIG);
  const normalized = sanitizeLlmConfig(raw);
  const withResolvedKey = {
    ...normalized,
    api_key: raw.api_key || "",
  };

  return publicLlmConfig(withResolvedKey);
}

export async function updateLlmConfig(input) {
  const currentRaw = await readConfig(LLM_CONFIG_KEY, DEFAULT_LLM_CONFIG);
  const privacyConfig = await getPrivacyConfig();
  const current = {
    ...sanitizeLlmConfig(currentRaw),
    api_key: currentRaw.api_key || "",
  };
  const incoming = sanitizeLlmConfig(input || {});

  const merged = {
    ...current,
    provider: incoming.provider,
    model: incoming.model,
    api_base: incoming.api_base,
    api_key: incoming.api_key === undefined ? current.api_key : incoming.api_key,
  };

  if (!isProviderAllowedByPrivacy(merged.provider, privacyConfig.privacy_mode)) {
    const err = new Error(
      `Provider ${merged.provider} is not allowed in privacy_mode=${privacyConfig.privacy_mode}`
    );
    err.statusCode = 400;
    throw err;
  }

  await upsertConfig(LLM_CONFIG_KEY, merged);
  return publicLlmConfig(merged);
}

export async function getPromptConfig() {
  const raw = await readConfig(PROMPT_CONFIG_KEY, DEFAULT_PROMPT_CONFIG);
  return sanitizePromptConfig(raw);
}

export async function updatePromptConfig(input) {
  const current = await getPromptConfig();
  const merged = sanitizePromptConfig({
    ...current,
    ...input,
  });

  await upsertConfig(PROMPT_CONFIG_KEY, merged);
  return merged;
}

export async function getApiKeyStatus() {
  const raw = await readConfig(API_KEYS_CONFIG_KEY, DEFAULT_API_KEYS_CONFIG);
  const normalized = sanitizeApiKeysConfig(raw);

  return {
    providers: SUPPORTED_API_KEY_PROVIDERS.map((provider) => {
      const value = normalized[provider];
      return {
        provider,
        configured: Boolean(value),
        masked_key: value ? maskApiKey(value) : null,
      };
    }),
  };
}

export async function getCompanyProfileConfig() {
  const raw = await readConfig(COMPANY_PROFILE_CONFIG_KEY, DEFAULT_COMPANY_PROFILE_CONFIG);
  return sanitizeCompanyProfileConfig(raw);
}

export async function getPrivacyConfig() {
  const raw = await readConfig(PRIVACY_CONFIG_KEY, DEFAULT_PRIVACY_CONFIG);
  return sanitizePrivacyConfig(raw);
}

export async function updatePrivacyConfig(input = {}) {
  const current = await getPrivacyConfig();
  const merged = sanitizePrivacyConfig({
    ...current,
    ...input,
  });

  await upsertConfig(PRIVACY_CONFIG_KEY, merged);
  return merged;
}

export async function updateCompanyProfileConfig(input = {}) {
  const current = await getCompanyProfileConfig();
  const merged = sanitizeCompanyProfileConfig({
    ...current,
    ...input,
  });

  await upsertConfig(COMPANY_PROFILE_CONFIG_KEY, merged);
  return merged;
}

export async function updateApiKeys(input = {}) {
  const current = sanitizeApiKeysConfig(
    await readConfig(API_KEYS_CONFIG_KEY, DEFAULT_API_KEYS_CONFIG)
  );

  const updates = {};
  for (const [provider, value] of Object.entries(input)) {
    assertSupportedApiKeyProvider(provider);
    updates[provider] = typeof value === "string" ? value.trim() : "";
  }

  const merged = {
    ...current,
    ...updates,
  };

  await upsertConfig(API_KEYS_CONFIG_KEY, merged);

  return {
    message: "API keys updated successfully",
    updated_providers: Object.keys(updates),
  };
}

export async function deleteApiKey(provider) {
  assertSupportedApiKeyProvider(provider);

  const current = sanitizeApiKeysConfig(
    await readConfig(API_KEYS_CONFIG_KEY, DEFAULT_API_KEYS_CONFIG)
  );
  current[provider] = "";
  await upsertConfig(API_KEYS_CONFIG_KEY, current);
}

export async function clearAllApiKeys(confirm) {
  if (confirm !== "CLEAR_ALL_KEYS") {
    const err = new Error("Missing or invalid confirm token for clearing API keys");
    err.statusCode = 400;
    throw err;
  }

  await upsertConfig(API_KEYS_CONFIG_KEY, DEFAULT_API_KEYS_CONFIG);
}

export async function resetDatabase(confirm) {
  if (confirm !== "RESET_ALL_DATA") {
    const err = new Error("Missing or invalid confirm token for database reset");
    err.statusCode = 400;
    throw err;
  }

  await Promise.all([
    Application.deleteMany({}),
    Job.deleteMany({}),
    Resume.deleteMany({}),
    SystemConfig.deleteMany({ key: { $in: [FEATURE_CONFIG_KEY, LANGUAGE_CONFIG_KEY, LLM_CONFIG_KEY, PROMPT_CONFIG_KEY, API_KEYS_CONFIG_KEY, COMPANY_PROFILE_CONFIG_KEY, PRIVACY_CONFIG_KEY] } }),
  ]);

  return {
    message: "Database reset completed",
  };
}

export async function testLlmConfig(input = {}) {
  const currentRaw = await readConfig(LLM_CONFIG_KEY, DEFAULT_LLM_CONFIG);
  const privacyConfig = await getPrivacyConfig();
  const current = {
    ...sanitizeLlmConfig(currentRaw),
    api_key: currentRaw.api_key || "",
  };
  const incoming = sanitizeLlmConfig(input);

  const effective = {
    provider: incoming.provider || current.provider,
    model: incoming.model || current.model,
    api_base: incoming.api_base ?? current.api_base,
    api_key: incoming.api_key === undefined ? current.api_key : incoming.api_key,
  };

  if (!isProviderAllowedByPrivacy(effective.provider, privacyConfig.privacy_mode)) {
    return {
      healthy: false,
      provider: effective.provider,
      model: effective.model,
      error: `Provider ${effective.provider} is not allowed in current privacy mode`,
      error_code: "provider_blocked_by_privacy_mode",
    };
  }

  const requiresKey = effective.provider !== "ollama";

  if (requiresKey && !effective.api_key) {
    return {
      healthy: false,
      provider: effective.provider,
      model: effective.model,
      error: "API key is required for selected provider",
      error_code: "api_key_required",
    };
  }

  return {
    healthy: true,
    provider: effective.provider,
    model: effective.model,
    response_model: effective.model,
    warning: "LLM endpoint validation is currently config-level only.",
    warning_code: "config_validation_only",
  };
}

export async function updateFeatureConfig(input) {
  const current = await getFeatureConfig();
  const merged = normalizeFeatureConfig({
    ...current,
    ...input,
  });

  return upsertConfig(FEATURE_CONFIG_KEY, merged);
}

export async function getLanguageConfig() {
  const raw = await readConfig(LANGUAGE_CONFIG_KEY, DEFAULT_LANGUAGE_CONFIG);
  return validateLanguageConfig(raw);
}

export async function updateLanguageConfig(input) {
  const current = await getLanguageConfig();
  const merged = validateLanguageConfig({
    ...current,
    ...input,
  });

  return upsertConfig(LANGUAGE_CONFIG_KEY, merged);
}

export async function getSystemStatus() {
  const [totalResumes, totalJobs, totalApplications, privacyConfig] = await Promise.all([
    Resume.countDocuments({}),
    Job.countDocuments({}),
    Application.countDocuments({}),
    getPrivacyConfig(),
  ]);

  const llmRaw = await readConfig(LLM_CONFIG_KEY, DEFAULT_LLM_CONFIG);
  const llmConfigured = Boolean(llmRaw.api_key) || llmRaw.provider === "ollama";

  const hasMasterResume = totalResumes > 0;

  return {
    status: "ready",
    llm_configured: llmConfigured,
    llm_healthy: llmConfigured,
    llm_provider: llmRaw.provider || DEFAULT_LLM_CONFIG.provider,
    privacy_mode: privacyConfig.privacy_mode,
    has_master_resume: hasMasterResume,
    database_stats: {
      total_resumes: totalResumes,
      total_jobs: totalJobs,
      total_improvements: totalApplications,
      has_master_resume: hasMasterResume,
    },
  };
}
