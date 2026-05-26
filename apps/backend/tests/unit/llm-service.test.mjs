import test from "node:test";
import assert from "node:assert/strict";

import {
  completeJson,
  completeText,
  extractJsonFromText,
  getLlmFailureReason,
  LlmServiceError,
} from "../../src/services/llm.service.js";

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("extractJsonFromText handles plain, fenced, and prefixed JSON", () => {
  assert.equal(extractJsonFromText('{"ok":true}'), '{"ok":true}');
  assert.equal(extractJsonFromText('```json\n{"ok":true}\n```'), '{"ok":true}');
  assert.equal(extractJsonFromText('Result:\n{"ok":true}\nDone'), '{"ok":true}');
});

test("completeText supports Ollama without API key through OpenAI-compatible endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  let authHeader = null;

  globalThis.fetch = async (url, options = {}) => {
    calledUrl = String(url);
    authHeader = options.headers?.Authorization || null;
    return jsonResponse({
      model: "gemma3:4b",
      choices: [{ message: { content: "OK" } }],
      usage: { prompt_tokens: 3, completion_tokens: 1 },
    });
  };

  try {
    const result = await completeText({
      feature: "unit",
      prompt: "Reply OK",
      config: {
        provider: "ollama",
        model: "gemma3:4b",
        api_base: "http://127.0.0.1:11434",
      },
    });

    assert.equal(calledUrl, "http://127.0.0.1:11434/v1/chat/completions");
    assert.equal(authHeader, null);
    assert.equal(result.content, "OK");
    assert.equal(result.metadata.provider, "ollama");
    assert.equal(result.metadata.prompt_tokens, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("completeJson retries malformed JSON and returns parsed object", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return jsonResponse({
        model: "gemma3:4b",
        choices: [{ message: { content: "not json" } }],
      });
    }

    return jsonResponse({
      model: "gemma3:4b",
      choices: [{ message: { content: "```json\n{\"ok\":true}\n```" } }],
    });
  };

  try {
    const result = await completeJson({
      feature: "unit_json",
      prompt: "Return JSON",
      retries: 1,
      config: {
        provider: "ollama",
        model: "gemma3:4b",
        api_base: "http://127.0.0.1:11434/v1",
      },
    });

    assert.equal(calls, 2);
    assert.deepEqual(result.data, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("cloud providers require API key and map fallback reason", async () => {
  await assert.rejects(
    () =>
      completeText({
        prompt: "Hi",
        config: {
          provider: "openai",
          model: "gpt-test",
        },
      }),
    (error) => {
      assert.equal(error instanceof LlmServiceError, true);
      assert.equal(error.code, "api_key_required");
      assert.equal(getLlmFailureReason(error), "no_api_key");
      return true;
    }
  );
});
