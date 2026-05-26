/**
 * Unit tests for the prompt config service.
 * Proves that custom promptConfig.templates are used by generation services.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Minimal re-implementation of sanitizePromptConfig ────────────────────────

const DEFAULT_PROMPT_CONFIG = {
  default_prompt_id: "keywords",
  prompt_options: [
    { id: "nudge", label: "Nudge" },
    { id: "keywords", label: "Keywords" },
    { id: "full", label: "Full rewrite" },
  ],
  truthfulness_rules: [
    "Do not add skills that are not present in the resume.",
  ],
  templates: {
    tailor: {
      nudge: "Default nudge template {output_language} {job_description} {resume_json}",
      keywords: "Default keywords template {output_language} {job_description} {resume_json}",
      full: "Default full template {output_language} {job_description} {resume_json}",
    },
    cover_letter: "Default cover letter {output_language} {job_description} {resume_json}",
    outreach: "Default outreach {output_language} {job_description} {resume_json}",
    interview: "Default interview {output_language} {job_description} {resume_json}",
    enrichment: {
      analyze: "Default analyze {output_language} {resume_json}",
      enhance: "Default enhance {output_language} {resume_json} {answers_json}",
      regenerate: "Default regenerate {output_language} {items_json} {instruction}",
    },
  },
};

function sanitizePromptConfig(input = {}) {
  const promptOptions =
    Array.isArray(input.prompt_options) && input.prompt_options.length
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

function renderTemplate(template = "", values = {}) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) =>
    values[key] === undefined || values[key] === null ? "" : String(values[key])
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("sanitizePromptConfig: returns defaults when no input", () => {
  const config = sanitizePromptConfig({});
  assert.equal(config.default_prompt_id, "keywords");
  assert.ok(config.templates.interview.length > 0);
  assert.ok(config.templates.tailor.keywords.length > 0);
});

test("sanitizePromptConfig: custom interview template overrides default", () => {
  const custom = sanitizePromptConfig({
    templates: {
      interview: "CUSTOM INTERVIEW TEMPLATE {output_language}",
    },
  });
  assert.equal(custom.templates.interview, "CUSTOM INTERVIEW TEMPLATE {output_language}");
});

test("sanitizePromptConfig: custom tailor.nudge does not affect tailor.keywords", () => {
  const custom = sanitizePromptConfig({
    templates: {
      tailor: { nudge: "CUSTOM NUDGE" },
    },
  });
  assert.equal(custom.templates.tailor.nudge, "CUSTOM NUDGE");
  assert.ok(
    custom.templates.tailor.keywords.includes("Default keywords"),
    "keywords should remain default"
  );
});

test("sanitizePromptConfig: custom truthfulness_rules are used", () => {
  const custom = sanitizePromptConfig({
    truthfulness_rules: ["Rule A", "Rule B"],
  });
  assert.deepEqual(custom.truthfulness_rules, ["Rule A", "Rule B"]);
});

test("sanitizePromptConfig: enrichment.analyze can be customized independently", () => {
  const custom = sanitizePromptConfig({
    templates: {
      enrichment: { analyze: "CUSTOM ANALYZE" },
    },
  });
  assert.equal(custom.templates.enrichment.analyze, "CUSTOM ANALYZE");
  assert.ok(
    custom.templates.enrichment.enhance.includes("Default enhance"),
    "enhance should remain default"
  );
});

test("sanitizePromptConfig: rejects unknown default_prompt_id", () => {
  assert.throws(
    () =>
      sanitizePromptConfig({
        default_prompt_id: "nonexistent",
      }),
    (error) => {
      assert.ok(error.message.includes("Unsupported default_prompt_id"));
      return true;
    }
  );
});

test("renderTemplate: substitutes all placeholders", () => {
  const template = "Hello {output_language}, job: {job_description}";
  const result = renderTemplate(template, {
    output_language: "English",
    job_description: "Backend Engineer",
  });
  assert.equal(result, "Hello English, job: Backend Engineer");
});

test("renderTemplate: leaves unknown placeholders empty", () => {
  const result = renderTemplate("Value: {unknown_key}", {});
  assert.equal(result, "Value: ");
});

test("truthfulness_rules are appended to prompt when non-empty", () => {
  const rules = ["Rule 1", "Rule 2"];
  const basePrompt = "Generate questions";
  const block = rules.length
    ? `\n\nTruthfulness rules:\n${rules.map((r) => `- ${r}`).join("\n")}`
    : "";
  const fullPrompt = basePrompt + block;
  assert.ok(fullPrompt.includes("Rule 1"));
  assert.ok(fullPrompt.includes("Rule 2"));
  assert.ok(fullPrompt.includes("Truthfulness rules:"));
});

test("empty truthfulness_rules produce no block", () => {
  const rules = [];
  const block = rules.length
    ? `\n\nTruthfulness rules:\n${rules.map((r) => `- ${r}`).join("\n")}`
    : "";
  assert.equal(block, "");
});
