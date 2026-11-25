import { PUBSUB_CHANNELS, createHttpError } from "@cvm/shared";

export const CONFIG_DEFAULTS = Object.freeze({
  featureConfig: {
    enable_cover_letter: true,
    enable_outreach_message: true,
  },
  languageConfig: {
    ui_language: "en",
    content_language: "auto",
    supported_languages: ["en", "vi", "auto"],
  },
  llmConfig: {
    provider: process.env.LLM_PROVIDER || "ollama",
    model: process.env.OLLAMA_MODEL || "gemma3:4b",
    api_key: "",
    api_base: process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434",
  },
  promptConfig: {
    default_prompt_id: "keywords",
    prompt_options: [
      { id: "nudge", label: "Light Nudge", description: "Minor wording polish while keeping original structure." },
      { id: "keywords", label: "ATS Keywords", description: "Align technical keywords and skills with target JD." },
      { id: "full", label: "Full Tailor", description: "Comprehensive bullet alignment for maximum match." },
    ],
    truthfulness_rules: ["Never fabricate experience, degrees, or skills absent from the original CV."],
    templates: {},
  },
  apiKeysConfig: {
    openai: "",
    anthropic: "",
    google: "",
    openrouter: "",
    deepseek: "",
  },
  companyProfileConfig: {
    company_name: "",
    overview: "",
    industry: "",
    company_size: "",
    address: "",
    website: "",
    brand_primary_color: "#1D4ED8",
    brand_logo_url: "",
  },
  privacyConfig: {
    privacy_mode: "hybrid",
  },
  llmHealthStatus: {
    status: "unknown",
    checked_at: null,
  },
  scoringWeights: {
    semanticWeight: 0.65,
    keywordWeight: 0.35,
  },
  maintenanceMode: {
    global: false,
    modules: {
      auth: false,
      resumes: false,
      jobs: false,
      applications: false,
      recommendations: false,
      enrichment: false,
      notifications: false,
    },
  },
});

export function validateScoringWeights(input = {}) {
  const semanticWeight = Number(input.semanticWeight ?? input.semantic_weight);
  const keywordWeight =
    input.keywordWeight !== undefined || input.keyword_weight !== undefined
      ? Number(input.keywordWeight ?? input.keyword_weight)
      : Number((1 - semanticWeight).toFixed(4));

  if (
    !Number.isFinite(semanticWeight) ||
    !Number.isFinite(keywordWeight) ||
    semanticWeight < 0 ||
    semanticWeight > 1 ||
    keywordWeight < 0 ||
    keywordWeight > 1 ||
    Math.abs(semanticWeight + keywordWeight - 1.0) > 1e-6
  ) {
    throw createHttpError(
      400,
      "scoringWeights must satisfy semanticWeight + keywordWeight === 1.0 within [0, 1]",
      "invalid_scoring_weights"
    );
  }

  return {
    semanticWeight: Number(semanticWeight.toFixed(4)),
    keywordWeight: Number(keywordWeight.toFixed(4)),
  };
}

/**
 * Dynamic SystemConfig service with audit logging and instant CONFIG_UPDATED Pub/Sub hot-reload.
 */
export function createConfigService({
  SystemConfigModel,
  AuditLogModel,
  redisBus = null,
} = {}) {
  async function getConfig(key) {
    const defaults = CONFIG_DEFAULTS[key] || {};
    const doc = await SystemConfigModel.findOne({ key });
    return {
      ...defaults,
      ...(doc?.value || {}),
    };
  }

  async function getAllConfigs() {
    const keys = Object.keys(CONFIG_DEFAULTS);
    const entries = await Promise.all(keys.map(async (k) => [k, await getConfig(k)]));
    return Object.fromEntries(entries);
  }

  async function updateConfig({ key, value, actor, reason = "", requestId = "" }) {
    let normalizedValue = value;
    if (key === "scoringWeights") {
      normalizedValue = validateScoringWeights(value);
    } else if (key === "languageConfig") {
      const ui = String(value?.ui_language || "en");
      if (ui !== "en" && ui !== "vi") {
        throw createHttpError(400, `Unsupported ui_language: ${ui}`, "invalid_language_config");
      }
      normalizedValue = { ...CONFIG_DEFAULTS.languageConfig, ...value };
    } else if (key === "privacyConfig") {
      const mode = String(value?.privacy_mode || "hybrid");
      if (!["hybrid", "local_only", "cloud_only"].includes(mode)) {
        throw createHttpError(400, `Unsupported privacy_mode: ${mode}`, "invalid_privacy_config");
      }
      normalizedValue = { privacy_mode: mode };
    }

    const before = await getConfig(key);
    await SystemConfigModel.findOneAndUpdate(
      { key },
      { $set: { value: normalizedValue } },
      { upsert: true, new: true }
    );

    const auditLog = await AuditLogModel.create({
      actorId: String(actor?.id || "system"),
      actorRole: String(actor?.role || "tech_staff"),
      action: "UPDATE_CONFIG",
      targetKey: key,
      before,
      after: normalizedValue,
      reason: String(reason || "").trim(),
      requestId: String(requestId || ""),
    });

    if (redisBus && typeof redisBus.publishEvent === "function") {
      await redisBus.publishEvent(PUBSUB_CHANNELS.CONFIG_UPDATED, {
        key,
        value: normalizedValue,
        [key]: normalizedValue,
        updated_by: String(actor?.id || "system"),
      });
    }

    return { key, value: normalizedValue, auditLog };
  }

  async function listAuditLogs({ action = null, limit = 50 } = {}) {
    const filter = {};
    if (action) filter.action = String(action);
    const safeLimit = Math.min(200, Math.max(1, Number.parseInt(String(limit), 10) || 50));
    return AuditLogModel.find(filter, null, { sort: { createdAt: -1 }, limit: safeLimit });
  }

  return {
    getConfig,
    getAllConfigs,
    updateConfig,
    listAuditLogs,
  };
}
