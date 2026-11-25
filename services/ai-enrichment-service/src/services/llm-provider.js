import { SERVICE_DATABASES } from "@cvm/shared";

function parseJsonSafe(rawText = "") {
  const cleaned = String(rawText || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

/**
 * Dynamic LLM provider reading runtime config from cvm_config.system_configs
 * with env fallback for local Ollama and Google Gemini API.
 */
export function createDynamicLlmProvider({
  mongooseConnection,
  env = process.env,
  fetchImpl = fetch,
} = {}) {
  let lastMeta = {
    provider: String(env.LLM_PROVIDER || "ollama").trim().toLowerCase(),
    model: String(env.OLLAMA_MODEL || "gemma3:4b").trim(),
  };

  async function resolveRuntimeConfig() {
    let llmDoc = null;
    let keysDoc = null;
    try {
      if (mongooseConnection?.useDb) {
        const configDb = mongooseConnection.useDb(SERVICE_DATABASES.config, { useCache: true });
        const [llmRow, keysRow] = await Promise.all([
          configDb.collection("system_configs").findOne({ key: "llmConfig" }),
          configDb.collection("system_configs").findOne({ key: "apiKeysConfig" }),
        ]);
        llmDoc = llmRow?.value || null;
        keysDoc = keysRow?.value || null;
      }
    } catch {
      // Fall back to env when config DB is unreachable
    }

    const provider = String(llmDoc?.provider || env.LLM_PROVIDER || "ollama")
      .trim()
      .toLowerCase();

    if (provider === "ollama") {
      const model = String(llmDoc?.model || env.OLLAMA_MODEL || "gemma3:4b").trim();
      const baseUrl = String(
        llmDoc?.api_base || env.OLLAMA_BASE_URL || "http://host.docker.internal:11434"
      )
        .trim()
        .replace(/\/+$/, "");
      lastMeta = { provider, model };
      return { provider, model, baseUrl, apiKey: "" };
    }

    if (provider === "gemini") {
      const model = String(llmDoc?.model || env.GEMINI_MODEL || "gemini-2.5-flash").trim();
      const apiKey = String(llmDoc?.api_key || keysDoc?.google || env.GEMINI_API_KEY || "").trim();
      lastMeta = { provider, model };
      return { provider, model, baseUrl: "", apiKey };
    }

    lastMeta = { provider, model: String(llmDoc?.model || "").trim() };
    return { provider, model: lastMeta.model, baseUrl: "", apiKey: "" };
  }

  async function callModel({ prompt, expectJson = true }) {
    const cfg = await resolveRuntimeConfig();

    if (cfg.provider === "ollama") {
      const resp = await fetchImpl(`${cfg.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model: cfg.model,
          prompt,
          stream: false,
          ...(expectJson ? { format: "json" } : {}),
        }),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => resp.statusText);
        throw new Error(`Ollama ${resp.status}: ${errText.slice(0, 200)}`);
      }
      const data = await resp.json();
      return String(data?.response || "");
    }

    if (cfg.provider === "gemini") {
      if (!cfg.apiKey) {
        throw new Error("GEMINI_API_KEY is not configured");
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        cfg.model
      )}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
      const resp = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          ...(expectJson ? { generationConfig: { responseMimeType: "application/json" } } : {}),
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.json().catch(() => null);
        const msg = errBody?.error?.message || resp.statusText || "request failed";
        throw new Error(`Gemini API ${resp.status}: ${String(msg).slice(0, 220)}`);
      }
      const data = await resp.json();
      return (data?.candidates?.[0]?.content?.parts || []).map((p) => p?.text || "").join("");
    }

    throw new Error(`Unsupported LLM provider: ${cfg.provider}`);
  }

  return {
    get providerName() {
      return lastMeta.provider;
    },
    get modelName() {
      return lastMeta.model;
    },
    async generateInterviewQuestions({
      targetAudience = "recruiter",
      jobTitle = "Software Engineer",
      skills = [],
      missingKeywords = [],
      language = "vi",
    } = {}) {
      const langLabel = language === "vi" ? "Vietnamese" : "English";
      const prompt = [
        `Generate exactly 3 concise ${langLabel} interview questions for audience "${targetAudience}" targeting role "${jobTitle}".`,
        `Skills: ${Array.isArray(skills) ? skills.join(", ") : ""}`,
        `Missing keywords: ${Array.isArray(missingKeywords) ? missingKeywords.join(", ") : ""}`,
        `Return strict JSON only: {"questions":[{"category":"technical|gap_verification|behavioral","question":"...","expectedSignal":"...","sampleAnswer":"...","difficulty":"easy|medium|hard"}]}`,
      ].join("\n");

      const raw = await callModel({ prompt, expectJson: true });
      const parsed = parseJsonSafe(raw);
      const questions = Array.isArray(parsed) ? parsed : parsed?.questions;
      if (!Array.isArray(questions) || questions.length === 0 || !questions[0]?.question) {
        throw new Error("Invalid interview questions JSON from LLM");
      }
      return questions.slice(0, 5).map((q) => ({
        category: String(q.category || "technical"),
        question: String(q.question),
        expectedSignal: String(q.expectedSignal || ""),
        sampleAnswer: String(q.sampleAnswer || ""),
        difficulty: String(q.difficulty || "medium"),
      }));
    },

    async optimizeCv({ resumeText = "", jobDescription = "", missingKeywords = [] } = {}) {
      const prompt = [
        "Analyze the resume against the job description and missing keywords.",
        `Resume excerpt: ${String(resumeText || "").slice(0, 1200)}`,
        `Job description excerpt: ${String(jobDescription || "").slice(0, 1200)}`,
        `Missing keywords: ${Array.isArray(missingKeywords) ? missingKeywords.join(", ") : ""}`,
        `Return strict JSON only: {"summary":"...","missing_keywords":["..."],"bullet_suggestions":["..."]}`,
      ].join("\n");

      const raw = await callModel({ prompt, expectJson: true });
      const parsed = parseJsonSafe(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.summary) {
        throw new Error("Invalid CV optimization JSON from LLM");
      }
      return {
        summary: String(parsed.summary),
        missing_keywords: Array.isArray(parsed.missing_keywords)
          ? parsed.missing_keywords.map(String)
          : [],
        bullet_suggestions: Array.isArray(parsed.bullet_suggestions)
          ? parsed.bullet_suggestions.map(String)
          : [],
      };
    },

    async generateCoverLetter({
      candidateName = "Candidate",
      jobTitle = "Target Position",
      companyName = "the company",
      skills = [],
      resumeText = "",
      jobDescription = "",
    } = {}) {
      const prompt = [
        `Write a concise professional cover letter for ${candidateName} applying to ${jobTitle} at ${companyName}.`,
        `Key skills: ${Array.isArray(skills) ? skills.join(", ") : ""}`,
        `Resume excerpt: ${String(resumeText || "").slice(0, 800)}`,
        `JD excerpt: ${String(jobDescription || "").slice(0, 800)}`,
        `Return strict JSON only: {"subject":"...","content":"..."}`,
      ].join("\n");

      const raw = await callModel({ prompt, expectJson: true });
      const parsed = parseJsonSafe(raw);
      if (!parsed?.content) {
        throw new Error("Invalid cover letter JSON from LLM");
      }
      return {
        subject: String(parsed.subject || `Application for ${jobTitle} - ${candidateName}`),
        content: String(parsed.content),
      };
    },

    async generateOutreach({
      candidateName = "there",
      jobTitle = "Engineering Role",
      companyName = "our team",
    } = {}) {
      const prompt = [
        `Write a concise recruiter outreach message to ${candidateName} for ${jobTitle} at ${companyName}.`,
        `Return strict JSON only: {"subject":"...","message":"..."}`,
      ].join("\n");

      const raw = await callModel({ prompt, expectJson: true });
      const parsed = parseJsonSafe(raw);
      if (!parsed?.message) {
        throw new Error("Invalid outreach JSON from LLM");
      }
      return {
        subject: String(parsed.subject || `Opportunity: ${jobTitle}`),
        message: String(parsed.message),
      };
    },
  };
}
