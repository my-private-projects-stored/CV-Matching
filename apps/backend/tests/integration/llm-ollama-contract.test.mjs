import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import {
  checkLlmHealth,
  completeJson,
  completeText,
} from "../../src/services/llm.service.js";

const RUN_CONTRACT =
  process.env.RUN_INTEGRATION_TESTS === "1" &&
  String(process.env.LLM_CONTRACT_PROVIDER || "").toLowerCase() === "ollama";

const OLLAMA_CONFIG = {
  provider: "ollama",
  model: process.env.LLM_CONTRACT_MODEL || "gemma3:4b",
  api_base: process.env.LLM_CONTRACT_API_BASE || "http://127.0.0.1:11434/v1",
};

test("Ollama contract: health, text completion, and JSON completion", { skip: !RUN_CONTRACT }, async () => {
  const health = await checkLlmHealth(OLLAMA_CONFIG, {
    includeDetails: true,
    testPrompt: "Reply with exactly OK.",
  });
  assert.equal(health.healthy, true);
  assert.equal(health.provider, "ollama");
  assert.ok(String(health.model_output || "").trim());

  const text = await completeText({
    feature: "ollama_contract_text",
    prompt: "Reply with exactly OK.",
    maxTokens: 16,
    temperature: 0,
    config: OLLAMA_CONFIG,
  });
  assert.match(text.content, /ok/i);

  const json = await completeJson({
    feature: "ollama_contract_json",
    prompt: 'Return exactly this JSON object: {"ok": true}',
    maxTokens: 64,
    retries: 1,
    config: OLLAMA_CONFIG,
  });
  assert.equal(json.data.ok, true);
});
