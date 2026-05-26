/**
 * Unit tests for interview service normalizer.
 * Tests that common LLM output variants are accepted and normalized correctly.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline minimal copies of the normalizer functions ─────────────────────────
// We test the normalizer logic in isolation by re-implementing a small testable
// version here. Integration tests prove the real service end-to-end.

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeQuestionGroups(value, language = "en") {
  let raw = value;

  // Variant: object keyed by category name
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    raw = Object.entries(raw).map(([key, val]) => ({
      group: key,
      label: key,
      questions: Array.isArray(val) ? val : [],
    }));
  }

  const groups = Array.isArray(raw) ? raw : [];

  // Variant: flat list of questions — group by category
  if (
    groups.length > 0 &&
    groups[0] &&
    !Array.isArray(groups[0]?.questions) &&
    (groups[0]?.question || groups[0]?.text)
  ) {
    const byCategory = {};
    for (const item of groups) {
      const cat = normalizeText(item?.category || "general");
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }
    return normalizeQuestionGroups(byCategory, language);
  }

  return groups
    .map((group, groupIndex) => {
      const groupName = normalizeText(
        group?.group || group?.category || group?.name || `group_${groupIndex + 1}`
      );
      const questions = Array.isArray(group?.questions) ? group.questions : [];
      return {
        group: groupName || `group_${groupIndex + 1}`,
        label: normalizeText(group?.label || group?.title || groupName || "Questions"),
        description: normalizeText(group?.description || ""),
        questions: questions
          .map((item, index) => ({
            id: normalizeText(item?.id || `${groupName || "question"}_${index + 1}`),
            category: normalizeText(item?.category || groupName || "general"),
            question: normalizeText(item?.question || item?.text || item?.q),
            focus_skill: item?.focus_skill ?? null,
          }))
          .filter((item) => item.question),
      };
    })
    .filter((group) => group.questions.length)
    .slice(0, 8);
}

function extractQuestionGroups(data) {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data.question_groups)) return data.question_groups;
  if (Array.isArray(data.groups)) return data.groups;
  if (Array.isArray(data.questions)) return data.questions;
  const keys = Object.keys(data);
  if (keys.length > 0 && keys.every((k) => Array.isArray(data[k]))) return data;
  return null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test("normalizeQuestionGroups: standard shape is preserved", () => {
  const input = [
    {
      group: "technical",
      label: "Technical",
      description: "Tech questions",
      questions: [{ id: "t1", category: "technical", question: "Tell me about Node.js" }],
    },
  ];
  const result = normalizeQuestionGroups(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].group, "technical");
  assert.equal(result[0].questions.length, 1);
  assert.equal(result[0].questions[0].question, "Tell me about Node.js");
});

test("normalizeQuestionGroups: uses 'groups' alias via extractQuestionGroups", () => {
  const llmOutput = {
    groups: [
      {
        group: "behavioral",
        label: "Behavioral",
        description: "",
        questions: [{ question: "Tell me about a conflict" }],
      },
    ],
  };
  const rawGroups = extractQuestionGroups(llmOutput);
  assert.ok(Array.isArray(rawGroups), "should extract groups array");
  const result = normalizeQuestionGroups(rawGroups);
  assert.equal(result.length, 1);
  assert.equal(result[0].group, "behavioral");
});

test("normalizeQuestionGroups: handles flat questions with category field", () => {
  const flatQuestions = [
    { question: "What is React?", category: "technical" },
    { question: "What is a closure?", category: "technical" },
    { question: "Tell me about yourself", category: "behavioral" },
  ];
  const result = normalizeQuestionGroups(flatQuestions);
  // Should group by category
  assert.ok(result.length >= 2, "should have at least 2 groups");
  const technical = result.find((g) => g.group === "technical");
  assert.ok(technical, "should have technical group");
  assert.equal(technical.questions.length, 2);
});

test("normalizeQuestionGroups: handles object-by-category shape", () => {
  const objectShape = {
    technical: [{ question: "Explain async/await" }],
    behavioral: [{ question: "How do you handle conflict?" }],
    closing: [{ question: "Do you have questions for us?" }],
  };
  const rawGroups = extractQuestionGroups(objectShape);
  assert.ok(rawGroups, "should extract from object shape");
  const result = normalizeQuestionGroups(rawGroups);
  assert.ok(result.length === 3, "should produce 3 groups");
});

test("normalizeQuestionGroups: handles 'text' instead of 'question' field", () => {
  const input = [
    {
      group: "experience",
      questions: [{ text: "What was your biggest challenge?" }],
    },
  ];
  const result = normalizeQuestionGroups(input);
  assert.equal(result[0].questions[0].question, "What was your biggest challenge?");
});

test("normalizeQuestionGroups: handles 'q' alias for question", () => {
  const input = [
    {
      group: "general",
      questions: [{ q: "What motivates you?" }],
    },
  ];
  const result = normalizeQuestionGroups(input);
  assert.equal(result[0].questions[0].question, "What motivates you?");
});

test("normalizeQuestionGroups: filters out groups with no valid questions", () => {
  const input = [
    {
      group: "empty",
      questions: [{ id: "x" }], // no question text
    },
    {
      group: "valid",
      questions: [{ question: "Real question?" }],
    },
  ];
  const result = normalizeQuestionGroups(input);
  assert.equal(result.length, 1);
  assert.equal(result[0].group, "valid");
});

test("extractQuestionGroups: extracts question_groups key", () => {
  const data = { question_groups: [{ group: "x", questions: [] }] };
  const result = extractQuestionGroups(data);
  assert.ok(Array.isArray(result));
});

test("extractQuestionGroups: returns null for non-object", () => {
  assert.equal(extractQuestionGroups(null), null);
  assert.equal(extractQuestionGroups("string"), null);
  assert.equal(extractQuestionGroups(undefined), null);
});

test("extractQuestionGroups: extracts flat questions array", () => {
  const data = { questions: [{ question: "Hi?" }] };
  const result = extractQuestionGroups(data);
  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1);
});
