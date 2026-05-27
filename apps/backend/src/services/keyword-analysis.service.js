export const KEYWORD_STOPWORDS = new Set([
  // Basic English Stopwords
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "for", "from", "have", "in", "is", "it", "of", "on", "or", "our", "that", "the", "this", "to", "we", "with", "you", "your", "will", "about", "above", "after", "again", "against", "all", "am", "any", "because", "been", "before", "being", "below", "between", "both", "but", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "further", "had", "has", "having", "he", "her", "here", "hers", "herself", "him", "himself", "his", "how", "if", "into", "its", "itself", "me", "more", "most", "my", "myself", "no", "nor", "not", "once", "only", "other", "ought", "ours", "ourselves", "out", "over", "own", "same", "she", "should", "so", "some", "such", "than", "their", "theirs", "them", "themselves", "then", "there", "these", "they", "this", "those", "through", "too", "under", "until", "up", "very", "was", "were", "what", "when", "where", "which", "who", "whom", "why", "would", "null", "undefined",

  // Generic Job Description Noise Words (excluding domain terms like backend, database, api, devops)
  "job", "overview", "looking", "high", "serving", "millions", "users", "work", "working", "real", "time", "while", "closely", "using", "similar", "layers", "times", "internal", "end", "deliver", "delivering", "teams", "mentor", "mentoring", "junior", "senior", "design", "designing", "build", "building", "scalable", "performance", "systems", "distributed", "architectures", "data", "pipelines", "native", "infrastructure", "collaborating", "product", "engineering", "responsibilities", "develop", "developing", "services", "maintain", "maintaining", "event", "driven", "throughput", "processing", "technologies", "optimize", "optimizing", "response", "platform", "integrations", "implement", "implementing", "automation", "monitor", "monitoring", "system", "reliability", "production", "collaborate", "features", "participate", "participating", "reviews", "discussions", "experience", "years", "strong", "proficiency", "understanding", "solid", "familiarity", "tools", "knowledge", "communication", "skills", "handling", "volumes", "collaboration", "contributions", "personal", "projects", "fast-paced", "environments", "competitive", "salary", "bonus", "flexible", "opportunities", "culture", "focused", "test", "testing", "clean", "none", "year", "month", "day", "week", "hour", "part", "role", "position", "company", "client", "team", "member", "partner", "business", "project", "product", "customer", "user", "requirement", "responsibility", "benefit", "opportunity", "growth", "career", "insurance", "holiday", "vacation", "remote", "hybrid", "office", "location", "candidate", "applicant", "resume", "cv", "portfolio", "interview", "hire", "recruiter", "manager", "lead", "director", "head", "officer", "staff", "employee", "contractor", "intern", "student", "graduate", "university", "college", "school", "degree", "diploma", "certificate", "course", "training", "education", "ability", "expert", "specialist", "professional", "engineer", "developer", "programmer", "analyst", "designer", "consultant", "administrator", "support", "operations", "management", "administration", "leadership", "guidance", "etc", "e.g", "i.e", "new", "old", "good", "great", "best", "fast", "slow", "large", "small", "many", "few", "various", "multiple", "different", "several", "each", "every", "other", "another", "such", "own", "self"
]);

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeKeyword(value) {
  let normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}+#.]+|[^\p{L}\p{N}+#.]+$/gu, "");
  if (normalized.endsWith(".")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
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

