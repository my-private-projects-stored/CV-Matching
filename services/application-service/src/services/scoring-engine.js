export const HYBRID_SEMANTIC_WEIGHT = 0.65;
export const HYBRID_KEYWORD_WEIGHT = 0.35;

export function boundScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

export function computeHybridScore({
  semanticScore,
  keywordScore,
  semanticWeight = HYBRID_SEMANTIC_WEIGHT,
}) {
  const safeWeight = boundScore(semanticWeight);
  const boundedSemantic = boundScore(semanticScore);
  const boundedKeyword = boundScore(keywordScore);
  const hybrid = safeWeight * boundedSemantic + (1 - safeWeight) * boundedKeyword;

  return {
    semanticScore: Number(boundedSemantic.toFixed(6)),
    keywordScore: Number(boundedKeyword.toFixed(6)),
    hybridScore: Number(boundScore(hybrid).toFixed(6)),
  };
}

function tokenizeKeywords(text) {
  return Array.from(
    new Set(
      String(text || "")
        .toLowerCase()
        .split(/[^a-z0-9.+#-]+/i)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
    )
  );
}

export function analyzeKeywords(jobText = "", resumeText = "") {
  const jobTokens = tokenizeKeywords(jobText);
  if (jobTokens.length === 0) {
    return { keywordScore: 0, matchedKeywords: [], missingKeywords: [] };
  }

  const resumeSet = new Set(tokenizeKeywords(resumeText));
  const matchedKeywords = [];
  const missingKeywords = [];

  for (const kw of jobTokens) {
    if (resumeSet.has(kw)) matchedKeywords.push(kw);
    else missingKeywords.push(kw);
  }

  const keywordScore = matchedKeywords.length / jobTokens.length;
  return {
    keywordScore: Number(boundScore(keywordScore).toFixed(6)),
    matchedKeywords: matchedKeywords.slice(0, 30),
    missingKeywords: missingKeywords.slice(0, 30),
  };
}
