import Resume from "../models/Resume.js";
import Job from "../models/Job.js";

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

export function tokenizeAllTokens(value = "") {
  const text = String(value || "").toLowerCase();
  const tokens = text.match(/[\p{L}\p{N}][\p{L}\p{N}+#.]{1,}/gu) || [];
  const result = [];
  for (const token of tokens) {
    const normalized = normalizeKeyword(token);
    if (normalized && !KEYWORD_STOPWORDS.has(normalized)) {
      result.push(normalized);
    }
  }
  return result;
}

export async function fetchIdfsForKeywords(keywords = [], corpusType = "resume") {
  const Model = corpusType === "job" ? Job : Resume;
  const uniqueKws = [...new Set(keywords.map(normalizeKeyword).filter(Boolean))];

  if (uniqueKws.length === 0) return { idfMap: {}, totalDocs: 0 };

  try {
    const totalDocs = await Model.countDocuments();
    if (totalDocs === 0) return { idfMap: {}, totalDocs: 0 };

    const idfMap = {};
    const counts = await Promise.all(
      uniqueKws.map(async (kw) => {
        let query;
        if (corpusType === "job") {
          query = {
            $or: [
              { keywords: kw },
              { title: { $regex: new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i") } }
            ]
          };
        } else {
          query = {
            $or: [
              { "parsedData.skills": kw },
              { "parsedData.additional.technicalSkills": kw },
              { "builderData.sections.additional.technicalSkills": kw }
            ]
          };
        }
        const n = await Model.countDocuments(query);
        // BM25 IDF formula
        const idf = Math.max(0.0001, Math.log(1 + (totalDocs - n + 0.5) / (n + 0.5)));
        return { kw, idf };
      })
    );

    for (const { kw, idf } of counts) {
      idfMap[kw] = idf;
    }

    return { idfMap, totalDocs };
  } catch (error) {
    console.error("Failed to fetch IDFs:", error);
    return { idfMap: {}, totalDocs: 0 };
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function computeKeywordAnalysis(
  jobKeywords = [],
  resumeKeywords = [],
  options = {}
) {
  const jobSet = new Set(jobKeywords.map(normalizeKeyword).filter(Boolean));
  const resumeSet = new Set(resumeKeywords.map(normalizeKeyword).filter(Boolean));

  const matchedKeywords = [...jobSet].filter((keyword) => resumeSet.has(keyword));
  const missingKeywords = [...jobSet].filter((keyword) => !resumeSet.has(keyword));

  let keywordScore = 0;
  if (jobSet.size > 0) {
    const docTokens = options.docTokens || [...resumeSet];
    const docLen = docTokens.length;
    const avgdl = options.avgdl || docLen || 1;
    const k1 = options.k1 ?? 1.2;
    const b = options.b ?? 0.75;
    const idfMap = options.idfMap || {};

    // Count term frequencies
    const tfMap = {};
    for (const token of docTokens) {
      const normToken = normalizeKeyword(token);
      if (normToken) {
        tfMap[normToken] = (tfMap[normToken] || 0) + 1;
      }
    }

    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const q of jobSet) {
      const idf = idfMap[q] ?? 1.0; // Default to 1.0 if not provided
      const tf = tfMap[q] ?? 0;
      
      const termScore = idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgdl)));
      totalScore += termScore;
      
      const maxTermScore = idf * (1 * (k1 + 1)) / (1 + k1);
      maxPossibleScore += maxTermScore;
    }

    keywordScore = maxPossibleScore === 0 ? 0 : Math.min(1.0, totalScore / maxPossibleScore);
  }

  return {
    matchedKeywords,
    missingKeywords,
    keywordScore,
  };
}



