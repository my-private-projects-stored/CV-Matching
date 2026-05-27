import fs from "fs";
import AiGenerationEvent from "../models/AiGenerationEvent.js";

const OPENAI_COMPATIBLE_PROVIDERS = new Set(["openai", "openrouter", "deepseek", "ollama"]);

const isRunningInDocker = fs.existsSync("/.dockerenv");

const DEFAULT_BASE_URLS = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com/v1",
  ollama: isRunningInDocker ? "http://host.docker.internal:11434/v1" : "http://127.0.0.1:11434/v1",
  anthropic: "https://api.anthropic.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
};

const LLM_REQUEST_TIMEOUT_MS = Number(process.env.LLM_REQUEST_TIMEOUT_MS || 60_000);
const LLM_JSON_TIMEOUT_MS = Number(process.env.LLM_JSON_TIMEOUT_MS || 180_000);
const MAX_JSON_EXTRACTION_RECURSION = 10;
const MAX_JSON_CONTENT_SIZE = 1024 * 1024;

export class LlmServiceError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "LlmServiceError";
    this.code = code;
    this.error_code = code;
    Object.assign(this, details);
  }
}

function normalizeProvider(value) {
  return String(value || "openai").trim().toLowerCase();
}

function trimTrailingSlash(value = "") {
  return String(value || "").trim().replace(/\/+$/, "");
}

function getConfig(input = {}) {
  const config = input.configOverride || input.config || input;
  const provider = normalizeProvider(config.provider);
  const model = String(config.model || "").trim();

  if (!model) {
    throw new LlmServiceError("Model is required for LLM request", "model_required", {
      provider,
      model,
    });
  }

  if (provider !== "ollama" && !String(config.api_key || "").trim()) {
    throw new LlmServiceError("API key is required for selected provider", "api_key_required", {
      provider,
      model,
    });
  }

  return {
    ...config,
    provider,
    model,
    api_key: String(config.api_key || "").trim(),
    api_base: config.api_base ? String(config.api_base).trim() : null,
  };
}

function openAiCompatibleUrl(config) {
  let base = trimTrailingSlash(config.api_base || DEFAULT_BASE_URLS[config.provider]);
  if (base.endsWith("/chat/completions")) {
    return base;
  }

  if (config.provider === "ollama" && !base.endsWith("/v1")) {
    base = `${base}/v1`;
  }

  return `${base}/chat/completions`;
}

function anthropicUrl(config) {
  const base = trimTrailingSlash(config.api_base || DEFAULT_BASE_URLS.anthropic);
  return base.endsWith("/messages") ? base : `${base}/messages`;
}

function geminiUrl(config) {
  const base = trimTrailingSlash(config.api_base || DEFAULT_BASE_URLS.gemini);
  if (base.includes(":generateContent")) {
    return base;
  }

  const separator = base.includes("?") ? "&" : "?";
  return `${base}/models/${encodeURIComponent(config.model)}:generateContent${separator}key=${encodeURIComponent(config.api_key)}`;
}

function toAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : LLM_REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function classifyHttpStatus(status) {
  if (status === 401 || status === 403) return "auth_error";
  if (status === 400 || status === 404) return "bad_request";
  if (status === 408) return "timeout";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "provider_error";
  return "provider_error";
}

function isRetryableError(error) {
  return ["timeout", "rate_limit", "provider_error"].includes(error?.code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, { headers, body, timeoutMs, provider, model }) {
  const { signal, clear } = toAbortSignal(timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new LlmServiceError(
        `LLM provider returned HTTP ${response.status}`,
        classifyHttpStatus(response.status),
        {
          status: response.status,
          provider,
          model,
          response_text: text.slice(0, 500),
        }
      );
    }

    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new LlmServiceError("LLM request timed out", "timeout", { provider, model });
    }
    if (error instanceof LlmServiceError) {
      throw error;
    }
    throw new LlmServiceError(error.message || "LLM request failed", "provider_error", {
      provider,
      model,
    });
  } finally {
    clear();
  }
}

function extractOpenAiText(payload) {
  return String(payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.text || "").trim();
}

function extractAnthropicText(payload) {
  const parts = Array.isArray(payload?.content) ? payload.content : [];
  return parts
    .map((part) => String(part?.text || ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => String(part?.text || ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeUsage(usage = {}) {
  return {
    prompt_tokens: usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount ?? null,
    completion_tokens: usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount ?? null,
  };
}

function openAiCompatibleBody({ config, messages, maxTokens, temperature }) {
  const body = {
    model: config.model,
    messages,
    max_tokens: maxTokens,
    stream: false,
  };

  if (!/gpt-5/i.test(config.model) && Number.isFinite(Number(temperature))) {
    body.temperature = Number(temperature);
  }

  return body;
}

function anthropicBody({ config, messages, maxTokens, temperature, systemPrompt }) {
  const body = {
    model: config.model,
    max_tokens: maxTokens,
    messages: messages.filter((message) => message.role !== "system"),
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  if (Number.isFinite(Number(temperature))) {
    body.temperature = Number(temperature);
  }

  return body;
}

function geminiBody({ messages, systemPrompt, maxTokens, temperature }) {
  const userText = messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n\n");

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: userText }],
      },
    ],
    generationConfig: {
      maxOutputTokens: maxTokens,
    },
  };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  if (Number.isFinite(Number(temperature))) {
    body.generationConfig.temperature = Number(temperature);
  }

  return body;
}

async function requestCompletion({ config, messages, systemPrompt, maxTokens, temperature, timeoutMs }) {
  if (OPENAI_COMPATIBLE_PROVIDERS.has(config.provider)) {
    const headers = { "Content-Type": "application/json" };
    if (config.api_key) {
      headers.Authorization = `Bearer ${config.api_key}`;
    }

    if (config.provider === "openrouter") {
      headers["HTTP-Referer"] = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
      headers["X-Title"] = "CV Matching";
    }

    const payload = await fetchJson(openAiCompatibleUrl(config), {
      headers,
      body: openAiCompatibleBody({ config, messages, maxTokens, temperature }),
      timeoutMs,
      provider: config.provider,
      model: config.model,
    });

    const usage = normalizeUsage(payload?.usage);
    return {
      content: extractOpenAiText(payload),
      metadata: {
        provider: config.provider,
        model: config.model,
        response_model: payload?.model || config.model,
        ...usage,
      },
    };
  }

  if (config.provider === "anthropic") {
    const payload = await fetchJson(anthropicUrl(config), {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.api_key,
        "anthropic-version": "2023-06-01",
      },
      body: anthropicBody({ config, messages, maxTokens, temperature, systemPrompt }),
      timeoutMs,
      provider: config.provider,
      model: config.model,
    });

    const usage = normalizeUsage(payload?.usage);
    return {
      content: extractAnthropicText(payload),
      metadata: {
        provider: config.provider,
        model: config.model,
        response_model: payload?.model || config.model,
        ...usage,
      },
    };
  }

  if (config.provider === "gemini") {
    const payload = await fetchJson(geminiUrl(config), {
      headers: { "Content-Type": "application/json" },
      body: geminiBody({ messages, systemPrompt, maxTokens, temperature }),
      timeoutMs,
      provider: config.provider,
      model: config.model,
    });

    const usage = normalizeUsage(payload?.usageMetadata);
    return {
      content: extractGeminiText(payload),
      metadata: {
        provider: config.provider,
        model: config.model,
        response_model: config.model,
        ...usage,
      },
    };
  }

  throw new LlmServiceError(`Unsupported provider: ${config.provider}`, "unsupported_provider", {
    provider: config.provider,
    model: config.model,
  });
}

async function requestCompletionWithRetry(options) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await requestCompletion(options);
    } catch (error) {
      lastError = error;
      if (attempt === 1 || !isRetryableError(error)) {
        throw error;
      }
      await sleep(500 * (attempt + 1));
    }
  }

  throw lastError;
}

function buildMessages(prompt, systemPrompt, provider) {
  const messages = [];
  if (provider === "ollama") {
    const combined = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    messages.push({ role: "user", content: combined });
  } else {
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });
  }
  return messages;
}

export async function completeText({
  feature = "llm_completion",
  prompt,
  systemPrompt = "",
  maxTokens = 4096,
  temperature = 0.3,
  config,
  configOverride,
  timeoutMs = LLM_REQUEST_TIMEOUT_MS,
} = {}) {
  const resolvedConfig = getConfig(configOverride || config);
  const contentPrompt = String(prompt || "").trim();
  if (!contentPrompt) {
    throw new LlmServiceError("Prompt is required for LLM request", "prompt_required", {
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      feature,
    });
  }

  const result = await requestCompletionWithRetry({
    config: resolvedConfig,
    messages: buildMessages(contentPrompt, systemPrompt, resolvedConfig.provider),
    systemPrompt,
    maxTokens,
    temperature,
    timeoutMs,
  });

  if (!result.content) {
    throw new LlmServiceError("Empty response from LLM", "empty_content", {
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      feature,
    });
  }

  console.info("llm_generation_success", {
    feature,
    provider: result.metadata.provider,
    model: result.metadata.model,
    response_model: result.metadata.response_model,
    prompt_tokens: result.metadata.prompt_tokens,
    completion_tokens: result.metadata.completion_tokens,
  });
  console.info("LLM Raw Response Content:", JSON.stringify(result.content));

  // Persist success event asynchronously (non-blocking)
  AiGenerationEvent.create({
    feature,
    generation_mode: "llm",
    provider: result.metadata.provider,
    model: result.metadata.model,
    reason: null,
  }).catch(() => {}); // ignore persistence errors

  return result;
}

export function extractJsonFromText(content, depth = 0) {
  if (depth > MAX_JSON_EXTRACTION_RECURSION) {
    throw new LlmServiceError("JSON extraction exceeded recursion limit", "invalid_json");
  }

  const original = String(content || "");
  if (original.length > MAX_JSON_CONTENT_SIZE) {
    throw new LlmServiceError("JSON response is too large", "invalid_json");
  }

  let text = original.trim();
  if (!text) {
    throw new LlmServiceError("Empty JSON response", "invalid_json");
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    text = fenced[1].trim();
  }

  if (text.startsWith("{")) {
    let braceDepth = 0;
    let inString = false;
    let escaped = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (char === "{") braceDepth += 1;
      if (char === "}") {
        braceDepth -= 1;
        if (braceDepth === 0) {
          return text.slice(0, index + 1);
        }
      }
    }
  }

  const start = text.indexOf("{");
  if (start > 0) {
    return extractJsonFromText(text.slice(start), depth + 1);
  }

  throw new LlmServiceError(`No JSON object found in response: ${original.slice(0, 160)}`, "invalid_json");
}

function parseJsonContent(content) {
  const jsonText = extractJsonFromText(content);
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new LlmServiceError(error.message || "Failed to parse JSON response", "invalid_json");
  }
}

export async function completeJson({
  feature = "llm_json_completion",
  prompt,
  systemPrompt = "",
  maxTokens = 4096,
  retries = 1,
  config,
  configOverride,
} = {}) {
  const jsonSystemPrompt = `${systemPrompt || ""}\n\nYou must respond with valid JSON only. No markdown, no explanations.`.trim();
  let currentPrompt = String(prompt || "");
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await completeText({
        feature,
        prompt: currentPrompt,
        systemPrompt: jsonSystemPrompt,
        maxTokens,
        temperature: attempt === 0 ? 0.1 : 0.3,
        config,
        configOverride,
        timeoutMs: LLM_JSON_TIMEOUT_MS,
      });

      return {
        data: parseJsonContent(result.content),
        metadata: result.metadata,
      };
    } catch (error) {
      lastError = error;
      if (error?.code !== "invalid_json" || attempt >= retries) {
        throw error;
      }
      currentPrompt = `${prompt}\n\nIMPORTANT: Return ONLY a complete valid JSON object. Start with { and end with }.`;
    }
  }

  throw lastError;
}

export async function checkLlmHealth(config, { includeDetails = false, testPrompt = "Hi" } = {}) {
  let resolvedConfig;
  try {
    resolvedConfig = getConfig(config);
  } catch (error) {
    return {
      healthy: false,
      provider: error.provider || config?.provider || "openai",
      model: error.model || config?.model || "",
      error: error.message,
      error_code: error.code || "llm_config_invalid",
    };
  }

  try {
    const result = await completeText({
      feature: "llm_health_check",
      prompt: testPrompt,
      maxTokens: 16,
      temperature: 0,
      config: resolvedConfig,
      timeoutMs: Math.min(LLM_REQUEST_TIMEOUT_MS, 30_000),
    });

    const response = {
      healthy: true,
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      response_model: result.metadata.response_model,
    };

    if (includeDetails) {
      response.test_prompt = testPrompt;
      response.model_output = result.content;
    }

    return response;
  } catch (error) {
    const response = {
      healthy: false,
      provider: resolvedConfig.provider,
      model: resolvedConfig.model,
      error: "LLM health check failed",
      error_code: error.code || "health_check_failed",
    };

    if (includeDetails) {
      response.test_prompt = testPrompt;
      response.model_output = null;
      response.error_detail = error.message;
    }

    return response;
  }
}

export function getLlmFailureReason(error) {
  const code = error?.code || error?.error_code;
  if (code === "api_key_required") return "no_api_key";
  if (code === "timeout") return "timeout";
  if (code === "rate_limit") return "rate_limit";
  if (code === "invalid_json") return "invalid_json";
  if (code === "provider_blocked_by_privacy_mode") return "privacy_blocked";
  return "provider_error";
}

/**
 * Log a fallback event and persist it to the AiGenerationEvent collection.
 * @param {object} opts
 * @param {string} opts.feature
 * @param {Error}  opts.error
 * @param {object} opts.config
 * @param {string} [opts.reason]
 * @param {string} [opts.requestId]
 */
export function logLlmFallback({ feature, error, config, reason, requestId }) {
  const resolvedReason = reason || getLlmFailureReason(error);
  console.warn("llm_generation_fallback", {
    feature,
    provider: config?.provider || error?.provider || null,
    model: config?.model || error?.model || null,
    reason: resolvedReason,
    request_id: requestId || null,
  });

  // Persist fallback event asynchronously (non-blocking)
  AiGenerationEvent.create({
    feature,
    generation_mode: "template_fallback",
    provider: config?.provider || error?.provider || null,
    model: config?.model || error?.model || null,
    reason: resolvedReason,
    request_id: requestId || null,
  }).catch(() => {}); // ignore persistence errors
}
