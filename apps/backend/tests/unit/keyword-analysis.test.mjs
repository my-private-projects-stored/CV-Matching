import test from "node:test";
import assert from "node:assert/strict";

import {
  computeKeywordAnalysis,
  extractJobKeywords,
  extractResumeKeywords,
} from "../../src/services/keyword-analysis.service.js";

test("extractJobKeywords falls back to JD text when keywords are missing", () => {
  const keywords = extractJobKeywords({
    title: "Backend Engineer",
    requirements: "Node.js MongoDB Qdrant APIs",
    cleanText: "Backend services with Node.js and MongoDB",
  });

  assert.ok(keywords.includes("node.js"));
  assert.ok(keywords.includes("mongodb"));
  assert.ok(keywords.includes("qdrant"));
});

test("extractResumeKeywords includes additional.technicalSkills before raw text fallback", () => {
  const keywords = extractResumeKeywords({
    rawText: "Plain resume text",
    parsedData: {
      additional: {
        technicalSkills: ["Node.js", "Qdrant"],
      },
    },
  });

  assert.deepEqual(keywords, ["node.js", "qdrant"]);
});

test("computeKeywordAnalysis returns matched, missing, and normalized score", () => {
  const analysis = computeKeywordAnalysis(
    ["Node.js", "MongoDB", "Qdrant"],
    ["node.js", "qdrant"]
  );

  assert.deepEqual(analysis.matchedKeywords, ["node.js", "qdrant"]);
  assert.deepEqual(analysis.missingKeywords, ["mongodb"]);
  assert.equal(Math.round(analysis.keywordScore * 1000) / 1000, 0.667);
});

