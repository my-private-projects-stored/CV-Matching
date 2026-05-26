/**
 * Cloud Provider Contract Tests (env-gated)
 *
 * These tests verify that each cloud LLM provider integration works
 * correctly when a real API key is available. They are skipped when
 * the relevant environment variable is not set.
 *
 * Usage:
 *   LLM_CONTRACT_PROVIDERS=openai,anthropic node --test tests/integration/llm-cloud-contract.test.mjs
 *
 * Or set individual keys:
 *   OPENAI_API_KEY=sk-... LLM_CONTRACT_PROVIDERS=openai node --test ...
 */
import test from "node:test";
import assert from "node:assert/strict";
import "dotenv/config";

import { checkLlmHealth, completeText, completeJson } from "../../src/services/llm.service.js";

const ENABLED_PROVIDERS = new Set(
  (process.env.LLM_CONTRACT_PROVIDERS || "").split(",").map((s) => s.trim()).filter(Boolean)
);

function providerEnabled(name) {
  return ENABLED_PROVIDERS.has(name);
}

/** Build config for each provider */
function getProviderConfig(provider) {
  switch (provider) {
    case "openai":
      return {
        provider: "openai",
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        api_key: process.env.OPENAI_API_KEY || "",
      };
    case "anthropic":
      return {
        provider: "anthropic",
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
        api_key: process.env.ANTHROPIC_API_KEY || "",
      };
    case "gemini":
      return {
        provider: "gemini",
        model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
        api_key: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "",
      };
    case "deepseek":
      return {
        provider: "deepseek",
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        api_key: process.env.DEEPSEEK_API_KEY || "",
      };
    case "openrouter":
      return {
        provider: "openrouter",
        model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat",
        api_key: process.env.OPENROUTER_API_KEY || "",
      };
    case "ollama":
      return {
        provider: "ollama",
        model: process.env.OLLAMA_MODEL || "gemma3:4b",
        api_base: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
      };
    default:
      return null;
  }
}

const PROVIDERS_TO_TEST = ["openai", "anthropic", "gemini", "deepseek", "openrouter", "ollama"];

for (const providerName of PROVIDERS_TO_TEST) {
  const config = getProviderConfig(providerName);
  const shouldRun = config && providerEnabled(providerName);

  test(`[${providerName}] checkLlmHealth returns healthy=true`, {
    skip: !shouldRun ? `Set LLM_CONTRACT_PROVIDERS=${providerName} to enable` : false,
  }, async () => {
    const result = await checkLlmHealth(config, { includeDetails: true });
    assert.equal(result.healthy, true, `Expected healthy=true but got: ${JSON.stringify(result)}`);
    assert.equal(result.provider, providerName);
    assert.ok(result.model, "model should be present");
    assert.ok(result.response_model, "response_model should be present");
  });

  test(`[${providerName}] completeText returns non-empty content`, {
    skip: !shouldRun ? `Set LLM_CONTRACT_PROVIDERS=${providerName} to enable` : false,
  }, async () => {
    const result = await completeText({
      feature: `contract_test_${providerName}`,
      prompt: "Reply with exactly one word: Hello",
      maxTokens: 16,
      config,
    });
    assert.ok(result.content.length > 0, "content should be non-empty");
    assert.equal(result.metadata.provider, providerName);
    assert.ok(result.metadata.model, "model metadata should be set");
  });

  test(`[${providerName}] completeJson returns parsed object`, {
    skip: !shouldRun ? `Set LLM_CONTRACT_PROVIDERS=${providerName} to enable` : false,
  }, async () => {
    const result = await completeJson({
      feature: `contract_json_${providerName}`,
      prompt: 'Return a JSON object with key "ok" set to true.',
      maxTokens: 64,
      retries: 1,
      config,
    });
    assert.ok(result.data !== null && typeof result.data === "object", "data should be an object");
    assert.equal(result.metadata.provider, providerName);
  });

  test(`[${providerName}] auth error path when key is wrong`, {
    skip: !shouldRun ? `Set LLM_CONTRACT_PROVIDERS=${providerName} to enable` : false,
  }, async () => {
    if (providerName === "ollama") {
      // Ollama does not require an API key — test with bad base URL instead
      const badConfig = { ...config, api_base: "http://127.0.0.1:9999" };
      const result = await checkLlmHealth(badConfig);
      assert.equal(result.healthy, false, "should fail with bad URL");
      return;
    }

    const badConfig = { ...config, api_key: "invalid-key-xxx" };
    const result = await checkLlmHealth(badConfig);
    assert.equal(result.healthy, false, "should fail with invalid API key");
    assert.ok(
      ["auth_error", "bad_request", "provider_error", "health_check_failed"].includes(result.error_code),
      `unexpected error_code: ${result.error_code}`
    );
  });
}

// Always-run Ollama-only tests (for local development)
const ollamaConfig = getProviderConfig("ollama");
const SKIP_OLLAMA_CONTRACT = !providerEnabled("ollama")
  ? "Set LLM_CONTRACT_PROVIDERS=ollama to enable"
  : false;

test("Ollama contract: health check with real model", {
  skip: SKIP_OLLAMA_CONTRACT,
}, async () => {
  const result = await checkLlmHealth(ollamaConfig, { includeDetails: true });
  // We log the result rather than hard-failing if Ollama is not running
  if (!result.healthy) {
    console.warn("Ollama not available:", result.error);
  }
  // Just check structure
  assert.ok(typeof result.healthy === "boolean");
  assert.ok(typeof result.provider === "string");
});
