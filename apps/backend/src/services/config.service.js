import fs from "fs";
import Application from "../models/Application.js";
import Company from "../models/Company.js";
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
const LLM_HEALTH_STATUS_KEY = "llmHealthStatus";

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
  content_language: "auto",
  supported_languages: ["en", "vi", "auto"],
};

const DEFAULT_LLM_CONFIG = {
  provider: "openai",
  model: "gpt-5-nano-2025-08-07",
  api_key: "",
  api_base: null,
};

const DEFAULT_PROVIDER_MODELS = {
  openai: "gpt-5-nano-2025-08-07",
  anthropic: "claude-haiku-4-5-20251001",
  openrouter: "deepseek/deepseek-chat",
  gemini: "gemini-3-flash-preview",
  deepseek: "deepseek-chat",
  ollama: "gemma3:4b",
};

const PROVIDER_KEY_MAP = {
  openai: "openai",
  anthropic: "anthropic",
  openrouter: "openrouter",
  gemini: "google",
  deepseek: "deepseek",
  ollama: "ollama",
};

const PROVIDER_ENV_KEYS = {
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  google: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
  ollama: [],
};

const isRunningInDocker = fs.existsSync("/.dockerenv");

const DEFAULT_PROVIDER_API_BASE = {
  ollama: isRunningInDocker ? "http://host.docker.internal:11434/v1" : "http://127.0.0.1:11434/v1",
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
  truthfulness_rules: [
    "Do not add skills, tools, certifications, company names, product names, metrics, or timelines that are not present in the resume or user-provided answers.",
    "Do not upgrade seniority or responsibilities beyond the source material.",
    "Preserve candidate facts and use the requested output language.",
  ],
  templates: {
    tailor: {
      nudge:
        "You are a professional resume editor. Make targeted, minimal wording improvements to this resume to better match the job description. Do NOT add skills, tools, certifications, company names, metrics, or timelines that are not in the original resume.\n\nOutput language: {output_language}\nJob description:\n{job_description}\n\nResume JSON:\n{resume_json}\n\nReturn ONLY a JSON object with exactly two keys:\n- \"resume_preview\": the updated resume JSON (same schema as input)\n- \"improvements\": an array of strings describing each change made",
      keywords:
        "You are a professional resume editor. Improve this resume's keyword alignment with the job description by rephrasing or emphasizing existing content. Only include skills, tools, and experience that are already present in the resume. Do NOT fabricate or embellish.\n\nOutput language: {output_language}\nJob description:\n{job_description}\n\nResume JSON:\n{resume_json}\n\nReturn ONLY a JSON object with exactly two keys:\n- \"resume_preview\": the updated resume JSON (same schema as input)\n- \"improvements\": an array of strings describing each keyword-related change",
      full:
        "You are a professional resume writer. Rewrite and strengthen this resume to be highly relevant to the job description. Improve clarity, impact, and alignment. Preserve all factual information. Do NOT invent skills, certifications, companies, dates, or metrics.\n\nOutput language: {output_language}\nJob description:\n{job_description}\n\nResume JSON:\n{resume_json}\n\nReturn ONLY a JSON object with exactly two keys:\n- \"resume_preview\": the fully rewritten resume JSON (same schema as input)\n- \"improvements\": an array of strings summarizing significant improvements made",
    },
    cover_letter:
      "You are a professional cover letter writer. Write a concise, compelling cover letter tailored to the job description below. Use only information from the resume — do not invent experience, skills, or metrics.\n\nOutput language: {output_language}\n\nJob context:\n{job_description}\n\nResume JSON:\n{resume_json}\n\nReturn plain text only. No JSON. 3–4 paragraphs maximum.",
    outreach:
      "You are a professional recruiter assistant. Write a concise LinkedIn outreach or email message from the candidate to the hiring team for this role. Keep it under 150 words. Use only facts from the resume — do not invent accomplishments or skills.\n\nOutput language: {output_language}\n\nJob context:\n{job_description}\n\nResume JSON:\n{resume_json}\n\nReturn plain text only. No JSON.",
    interview:
      "You are an expert technical interviewer. Generate a comprehensive set of interview questions based on the candidate's resume and the job context below.\n\nOutput language: {output_language}\n\nJob context:\n{job_description}\n\nCandidate resume:\n{resume_json}\n\nReturn ONLY a valid JSON object. Do not include any text before or after the JSON.\n\nRequired JSON schema:\n{\n  \"question_groups\": [\n    {\n      \"group\": \"technical\",\n      \"label\": \"Technical & Domain Knowledge\",\n      \"description\": \"Questions assessing technical skills from the candidate's background\",\n      \"questions\": [\n        { \"id\": \"tech_1\", \"category\": \"technical\", \"question\": \"...\", \"focus_skill\": \"...\" }\n      ]\n    },\n    {\n      \"group\": \"behavioral\",\n      \"label\": \"Behavioral & Mindset\",\n      \"description\": \"Questions evaluating soft skills and problem-solving approach\",\n      \"questions\": [\n        { \"id\": \"beh_1\", \"category\": \"behavioral\", \"question\": \"...\" }\n      ]\n    }\n  ]\n}\n\nGenerate 3–6 groups total with 2–5 questions each. Questions must be specific to the resume content and job requirements. Do not invent skills or experience not present in the resume.",
    enrichment: {
      analyze:
        "You are a professional resume coach. Analyze this resume and identify gaps or areas where the candidate could add more detail to strengthen their profile.\n\nOutput language: {output_language}\n\nResume JSON:\n{resume_json}\n\nReturn ONLY a JSON object with these keys:\n- \"items_to_enrich\": array of {section, field, current_value, reason_to_enrich}\n- \"questions\": array of {id, question, section, field} — ask at most 6 questions total\n- \"analysis_summary\": string summarizing the main gaps",
      enhance:
        "You are a professional resume writer. Using the candidate's answers to your questions, add truthful, specific bullets or improve existing resume content. Only use information from the resume and answers — do not invent anything.\n\nOutput language: {output_language}\n\nOriginal resume JSON:\n{resume_json}\n\nCandidate answers:\n{answers_json}\n\nReturn ONLY a JSON object with key:\n- \"enhancements\": array of {\n    \"item_id\": string (e.g. \"exp_0\", parsed from candidate answers question_id),\n    \"item_type\": \"experience\" or \"project\",\n    \"title\": string,\n    \"original_description\": array of strings (original bullets),\n    \"enhanced_description\": array of strings (new improved bullets)\n  }",
      regenerate:
        "You are a professional resume writer. Rewrite the specified resume items according to the instruction. Use only existing factual content — do not add invented skills, metrics, or accomplishments.\n\nOutput language: {output_language}\n\nItems to rewrite:\n{items_json}\n\nInstruction: {instruction}\n\nReturn ONLY a JSON object with keys:\n- \"regenerated_items\": array of {id, original, regenerated}\n- \"errors\": array of {id, reason} for any items that could not be regenerated",
    },
  },
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

  if (!new Set(["en", "vi"]).has(uiLanguage)) {
    const err = new Error(`Unsupported ui_language: ${uiLanguage}`);
    err.statusCode = 400;
    throw err;
  }

  if (!new Set(["en", "vi", "auto"]).has(contentLanguage)) {
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

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function providerKeyFor(provider) {
  return PROVIDER_KEY_MAP[provider] || provider;
}

function defaultModelForProvider(provider) {
  return DEFAULT_PROVIDER_MODELS[provider] || DEFAULT_LLM_CONFIG.model;
}

function defaultApiBaseForProvider(provider) {
  return DEFAULT_PROVIDER_API_BASE[provider] || null;
}

function normalizeLlmProvider(value, fallback = DEFAULT_LLM_CONFIG.provider) {
  const provider = String(value || fallback || DEFAULT_LLM_CONFIG.provider).trim().toLowerCase();
  validateLlmProvider(provider);
  return provider;
}

function normalizeLlmModel(value, provider) {
  const model = String(value || "").trim();
  return model || defaultModelForProvider(provider);
}

function normalizeApiBase(value) {
  const apiBase = value ? String(value).trim() : "";
  return apiBase || null;
}

function isMaskedApiKey(value = "") {
  const normalized = String(value || "");
  return /\*{2,}/.test(normalized);
}

function resolveEnvApiKey(providerKey) {
  const envKeys = PROVIDER_ENV_KEYS[providerKey] || [];
  for (const key of [...envKeys, "LLM_API_KEY"]) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
}

function sanitizeLlmConfig(input = {}) {
  const provider = normalizeLlmProvider(input.provider, DEFAULT_LLM_CONFIG.provider);

  const model = normalizeLlmModel(input.model || DEFAULT_LLM_CONFIG.model, provider);
  const apiBase = normalizeApiBase(input.api_base);
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
    truthfulness_rules: Array.isArray(input.truthfulness_rules)
      ? input.truthfulness_rules
      : DEFAULT_PROMPT_CONFIG.truthfulness_rules,
    templates: {
      ...DEFAULT_PROMPT_CONFIG.templates,
      ...(input.templates && typeof input.templates === "object" ? input.templates : {}),
      tailor: {
        ...DEFAULT_PROMPT_CONFIG.templates.tailor,
        ...(input.templates?.tailor && typeof input.templates.tailor === "object"
          ? input.templates.tailor
          : {}),
      },
      enrichment: {
        ...DEFAULT_PROMPT_CONFIG.templates.enrichment,
        ...(input.templates?.enrichment && typeof input.templates.enrichment === "object"
          ? input.templates.enrichment
          : {}),
      },
    },
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
  const incoming = input || {};
  const provider = hasOwn(incoming, "provider")
    ? normalizeLlmProvider(incoming.provider, current.provider)
    : current.provider;
  const hasIncomingKey = hasOwn(incoming, "api_key");
  const incomingKey = typeof incoming.api_key === "string" ? incoming.api_key.trim() : undefined;

  const merged = {
    ...current,
    provider,
    model: hasOwn(incoming, "model")
      ? normalizeLlmModel(incoming.model, provider)
      : current.model || defaultModelForProvider(provider),
    api_base: hasOwn(incoming, "api_base")
      ? normalizeApiBase(incoming.api_base)
      : current.api_base,
    api_key: hasIncomingKey && !isMaskedApiKey(incomingKey)
      ? incomingKey
      : current.api_key,
  };

  if (!isProviderAllowedByPrivacy(merged.provider, privacyConfig.privacy_mode)) {
    const err = new Error(
      `Provider ${merged.provider} is not allowed in privacy_mode=${privacyConfig.privacy_mode}`
    );
    err.statusCode = 400;
    err.error_code = "provider_blocked_by_privacy_mode";
    throw err;
  }

  await upsertConfig(LLM_CONFIG_KEY, merged);
  return publicLlmConfig(merged);
}

export async function resolveLlmRuntimeConfig(input = {}) {
  const [currentRaw, apiKeysRaw, privacyConfig] = await Promise.all([
    readConfig(LLM_CONFIG_KEY, DEFAULT_LLM_CONFIG),
    readConfig(API_KEYS_CONFIG_KEY, DEFAULT_API_KEYS_CONFIG),
    getPrivacyConfig(),
  ]);

  const current = sanitizeLlmConfig(currentRaw);
  const provider = hasOwn(input, "provider")
    ? normalizeLlmProvider(input.provider, current.provider)
    : current.provider;
  const providerKey = providerKeyFor(provider);
  const apiKeys = sanitizeApiKeysConfig(apiKeysRaw);
  const model = hasOwn(input, "model")
    ? normalizeLlmModel(input.model, provider)
    : normalizeLlmModel(
        currentRaw.provider === provider ? currentRaw.model : defaultModelForProvider(provider),
        provider
      );
  const apiBase = hasOwn(input, "api_base")
    ? normalizeApiBase(input.api_base)
    : normalizeApiBase(currentRaw.api_base) || defaultApiBaseForProvider(provider);

  let apiKey = "";
  const inputApiKey = typeof input.api_key === "string" ? input.api_key.trim() : undefined;
  if (inputApiKey && !isMaskedApiKey(inputApiKey)) {
    apiKey = inputApiKey;
  } else if (currentRaw.api_key && !isMaskedApiKey(currentRaw.api_key)) {
    apiKey = String(currentRaw.api_key).trim();
  } else if (apiKeys[providerKey]) {
    apiKey = apiKeys[providerKey];
  } else {
    apiKey = resolveEnvApiKey(providerKey);
  }

  const privacyMode = privacyConfig.privacy_mode;
  if (!isProviderAllowedByPrivacy(provider, privacyMode)) {
    const err = new Error(
      `Provider ${provider} is not allowed in privacy_mode=${privacyMode}`
    );
    err.statusCode = 400;
    err.code = "provider_blocked_by_privacy_mode";
    err.error_code = "provider_blocked_by_privacy_mode";
    err.provider = provider;
    err.model = model;
    throw err;
  }

  if (!model) {
    const err = new Error("Model is required for selected provider");
    err.statusCode = 400;
    err.code = "model_required";
    err.error_code = "model_required";
    err.provider = provider;
    err.model = model;
    throw err;
  }

  const requiresApiKey = provider !== "ollama";
  return {
    provider,
    provider_key: providerKey,
    model,
    api_key: apiKey,
    api_base: apiBase,
    privacy_mode: privacyMode,
    requires_api_key: requiresApiKey,
    configured: !requiresApiKey || Boolean(apiKey),
  };
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
    Company.deleteMany({}),
    Job.deleteMany({}),
    Resume.deleteMany({}),
    SystemConfig.deleteMany({ key: { $in: [FEATURE_CONFIG_KEY, LANGUAGE_CONFIG_KEY, LLM_CONFIG_KEY, PROMPT_CONFIG_KEY, API_KEYS_CONFIG_KEY, COMPANY_PROFILE_CONFIG_KEY, PRIVACY_CONFIG_KEY] } }),
  ]);

  return {
    message: "Database reset completed",
  };
}

export async function testLlmConfig(input = {}) {
  let effective;
  try {
    effective = await resolveLlmRuntimeConfig(input);
  } catch (error) {
    return {
      healthy: false,
      provider: error.provider || input.provider || DEFAULT_LLM_CONFIG.provider,
      model: error.model || input.model || defaultModelForProvider(input.provider),
      error: error.message,
      error_code: error.error_code || error.code || "llm_config_invalid",
    };
  }

  if (effective.requires_api_key && !effective.api_key) {
    const result = {
      healthy: false,
      provider: effective.provider,
      model: effective.model,
      error: "API key is required for selected provider",
      error_code: "api_key_required",
    };
    await updateLlmHealthStatus(result);
    return result;
  }

  const { checkLlmHealth } = await import("./llm.service.js");
  const result = await checkLlmHealth(effective, { includeDetails: true, testPrompt: "Hi" });
  await updateLlmHealthStatus(result);
  return result;
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
  const [totalResumes, totalJobs, totalApplications, privacyConfig, llmRaw, apiKeysRaw, cachedHealth] = await Promise.all([
    Resume.countDocuments({}),
    Job.countDocuments({}),
    Application.countDocuments({}),
    getPrivacyConfig(),
    readConfig(LLM_CONFIG_KEY, DEFAULT_LLM_CONFIG),
    readConfig(API_KEYS_CONFIG_KEY, DEFAULT_API_KEYS_CONFIG),
    readConfig(LLM_HEALTH_STATUS_KEY, null),
  ]);

  const provider = normalizeLlmProvider(llmRaw.provider, DEFAULT_LLM_CONFIG.provider);
  const apiKeys = sanitizeApiKeysConfig(apiKeysRaw);
  const providerKey = providerKeyFor(provider);
  const llmConfigured =
    provider === "ollama" ||
    Boolean(llmRaw.api_key) ||
    Boolean(apiKeys[providerKey]) ||
    Boolean(resolveEnvApiKey(providerKey));

  const hasMasterResume = totalResumes > 0;

  // Use cached health if available, otherwise fallback to config-based guess
  const llmHealthy = cachedHealth?.healthy !== undefined ? Boolean(cachedHealth.healthy) : llmConfigured;
  const checkedAt = cachedHealth?.checked_at || null;
  const staleThresholdMs = 60 * 60 * 1000; // 1 hour
  const isStale = checkedAt ? Date.now() - new Date(checkedAt).getTime() > staleThresholdMs : true;

  return {
    status: "ready",
    llm_configured: llmConfigured,
    llm_healthy: llmHealthy,
    llm_provider: provider,
    privacy_mode: privacyConfig.privacy_mode,
    has_master_resume: hasMasterResume,
    llm_health_checked_at: checkedAt,
    llm_health_stale: isStale,
    database_stats: {
      total_resumes: totalResumes,
      total_jobs: totalJobs,
      total_improvements: totalApplications,
      has_master_resume: hasMasterResume,
    },
  };
}

export async function assertAiGenerationAllowed(feature = "ai_generation") {
  const [llmRaw, privacyConfig] = await Promise.all([
    readConfig(LLM_CONFIG_KEY, DEFAULT_LLM_CONFIG),
    getPrivacyConfig(),
  ]);

  const provider = String(llmRaw.provider || DEFAULT_LLM_CONFIG.provider).trim().toLowerCase();
  const privacyMode = privacyConfig.privacy_mode;

  if (!isProviderAllowedByPrivacy(provider, privacyMode)) {
    const err = new Error(
      `AI generation for ${feature} is blocked by privacy_mode=${privacyMode}. Current provider=${provider}.`
    );
    err.statusCode = 400;
    err.code = "provider_blocked_by_privacy_mode";
    throw err;
  }

  return {
    provider,
    privacy_mode: privacyMode,
  };
}

/**
 * Cache the latest LLM health check result in SystemConfig.
 */
async function updateLlmHealthStatus(healthResult) {
  try {
    await upsertConfig(LLM_HEALTH_STATUS_KEY, {
      provider: healthResult.provider || null,
      model: healthResult.model || null,
      healthy: Boolean(healthResult.healthy),
      checked_at: new Date().toISOString(),
      error_code: healthResult.error_code || null,
      response_model: healthResult.response_model || null,
    });
  } catch {
    // Non-fatal: if we can't cache, just continue
  }
}

/**
 * Query LLM generation events for admin observability.
 */
export async function getLlmEvents(filters = {}) {
  const AiGenerationEvent = (await import("../models/AiGenerationEvent.js")).default;
  const query = {};
  if (filters.feature) query.feature = filters.feature;
  if (filters.generation_mode) query.generation_mode = filters.generation_mode;
  const limit = Math.min(Number(filters.limit) || 50, 200);
  const events = await AiGenerationEvent.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return events;
}
