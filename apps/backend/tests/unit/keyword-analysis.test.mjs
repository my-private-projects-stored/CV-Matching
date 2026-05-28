import test from "node:test";
import assert from "node:assert/strict";

import {
  computeKeywordAnalysis,
  extractJobKeywords,
  extractResumeKeywords,
  tokenizeAllTokens,
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

test("tokenizeAllTokens extracts tokens including duplicates and ignores stopwords", () => {
  const tokens = tokenizeAllTokens("Node.js and MongoDB. Node.js is python!");
  assert.deepEqual(tokens, ["node.js", "mongodb", "node.js", "python"]);
});

test("tokenizeAllTokens normalizes trailing dots and filters expanded stopwords", () => {
  // "USERS." -> "users" (should be filtered since "users" is a stopword)
  // "TEAMS." -> "teams" (should be filtered since "teams" is a stopword)
  // "databases" -> "databases" (should be filtered)
  // "requirements" -> "requirements" (should be filtered)
  // "Restful" -> "restful" (not a stopword, should be kept)
  // "Devops" -> "devops" (not a stopword, should be kept)
  const tokens = tokenizeAllTokens("We need TEAMS. and USERS. for managing databases and requirements. Plus Restful Devops software.");
  assert.ok(!tokens.includes("users"));
  assert.ok(!tokens.includes("teams"));
  assert.ok(!tokens.includes("databases"));
  assert.ok(!tokens.includes("requirements"));
  assert.ok(!tokens.includes("software"));
  assert.ok(tokens.includes("restful"));
  assert.ok(tokens.includes("devops"));
});

test("computeKeywordAnalysis calculates correct BM25 score with custom idfMap and docTokens", () => {
  const jobKeywords = ["Node.js", "MongoDB"];
  const resumeKeywords = ["node.js"];

  const options = {
    docTokens: ["node.js", "node.js", "mongodb"],
    avgdl: 3,
    idfMap: { "node.js": 1.5, "mongodb": 0.8 },
    k1: 1.2,
    b: 0.75
  };

  const analysis = computeKeywordAnalysis(jobKeywords, resumeKeywords, options);
  assert.equal(analysis.keywordScore, 1.0);

  const optionsMissing = {
    docTokens: ["node.js", "node.js"],
    avgdl: 3,
    idfMap: { "node.js": 1.5, "mongodb": 0.8 },
    k1: 1.2,
    b: 0.75
  };

  const analysisMissing = computeKeywordAnalysis(jobKeywords, resumeKeywords, optionsMissing);
  assert.equal(Math.round(analysisMissing.keywordScore * 1000) / 1000, 0.99);
});

