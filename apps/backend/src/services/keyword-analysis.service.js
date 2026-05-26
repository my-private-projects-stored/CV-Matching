const KEYWORD_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "for",
  "from",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "this",
  "to",
  "we",
  "with",
  "you",
  "your",
  "will",
]);

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeKeyword(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}+#.]+|[^\p{L}\p{N}+#.]+$/gu, "");
}

export function tokenizeKeywords(value = "", limit = 80) {
  const text = String(value || "").toLowerCase();
  const tokens = text.match(/[\p{L}\p{N}][\p{L}\p{N}+#.]{1,}/gu) || [];
  const keywords = [];
  const seen = new Set();

  for (const token of tokens) {
    const normalized = normalizeKeyword(token);
    if (!normalized || KEYWORD_STOPWORDS.has(normalized) || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    keywords.push(normalized);
    if (keywords.length >= limit) {
      break;
    }
  }

  return keywords;
}

export function extractJobKeywords(jobDoc = {}, { limit = 80 } = {}) {
  const explicit = toArray(jobDoc?.keywords).map(normalizeKeyword).filter(Boolean);
  if (explicit.length > 0) {
    return [...new Set(explicit)].slice(0, limit);
  }

  return tokenizeKeywords(
    [
      jobDoc?.title,
      jobDoc?.description,
      jobDoc?.requirements,
      jobDoc?.benefits,
      jobDoc?.cleanText,
    ]
      .filter(Boolean)
      .join("\n"),
    limit
  );
}

export function extractResumeKeywords(resumeDoc = {}, { limit = 80 } = {}) {
  const parsedData = resumeDoc?.parsedData || {};
  const additional = parsedData.additional || {};
  const builderAdditional = resumeDoc?.builderData?.sections?.additional || {};

  const structured = [
    ...toArray(parsedData.skills),
    ...toArray(additional.technicalSkills),
    ...toArray(additional.skills),
    ...toArray(builderAdditional.technicalSkills),
    ...toArray(builderAdditional.skills),
  ]
    .map(normalizeKeyword)
    .filter(Boolean);

  if (structured.length > 0) {
    return [...new Set(structured)].slice(0, limit);
  }

  return tokenizeKeywords(
    [
      resumeDoc?.rawText,
      parsedData.summary,
      JSON.stringify(parsedData || {}),
    ]
      .filter(Boolean)
      .join("\n"),
    limit
  );
}

export function computeKeywordAnalysis(jobKeywords = [], resumeKeywords = []) {
  const jobSet = new Set(jobKeywords.map(normalizeKeyword).filter(Boolean));
  const resumeSet = new Set(resumeKeywords.map(normalizeKeyword).filter(Boolean));

  const matchedKeywords = [...jobSet].filter((keyword) => resumeSet.has(keyword));
  const missingKeywords = [...jobSet].filter((keyword) => !resumeSet.has(keyword));
  const keywordScore = jobSet.size === 0 ? 0 : matchedKeywords.length / jobSet.size;

  return {
    matchedKeywords,
    missingKeywords,
    keywordScore,
  };
}

