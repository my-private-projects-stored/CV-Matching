import Resume from "../models/Resume.js";
import Job from "../models/Job.js";
import { ensureQdrantId } from "../utils/qdrant-id.js";
import { createSimplePdf } from "../utils/simple-pdf.js";
import { getPromptConfig, resolveLlmRuntimeConfig } from "./config.service.js";
import { detectLanguageOfResume } from "../utils/language-detector.js";
import { generateEmbedding } from "./embedding.service.js";
import { completeJson, completeText, getLlmFailureReason, logLlmFallback } from "./llm.service.js";
import { renderResumePdf } from "./pdf-renderer.service.js";
import { extractRawTextFromFile, parseStructuredDataFromText } from "./resume-parsing.service.js";
import { deleteResumeVector, upsertResumeVector, getResumeVectorPoint } from "./vector-index.service.js";
import { KEYWORD_STOPWORDS, tokenizeAllTokens, fetchIdfsForKeywords, computeKeywordAnalysis, normalizeKeyword } from "./keyword-analysis.service.js";
import { cosineSimilarity, extractPointVector } from "./semantic-search.service.js";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const DEFAULT_CANDIDATE_ID = "000000000000000000000001";
const ALLOWED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const AllowedUploadTypes = ALLOWED_UPLOAD_TYPES;
const JOB_KEYWORD_STOPWORDS = KEYWORD_STOPWORDS;

export const jdMatchDependencies = {
  getResumeVectorPoint,
  generateEmbedding,
  fetchIdfsForKeywords,
  computeKeywordAnalysis,
  cosineSimilarity,
  extractPointVector,
  tokenizeAllTokens,
};

const SUPPORTED_OUTPUT_LANGUAGES = new Set(["en", "vi", "auto"]);
const DEFAULT_BUILDER_FORMAT_SETTINGS = {
  pageSize: "A4",
  margins: { top: 16, right: 16, bottom: 16, left: 16 },
  fontSize: { base: 10, headerScale: 1.25, headerFont: "Instrument Serif", bodyFont: "DM Sans" },
  spacing: { section: 12, item: 8, lineHeight: 1.4 },
  compactMode: false,
};
const DEFAULT_SECTION_META = [
  { id: "personalInfo", key: "personalInfo", displayName: "Personal Info", sectionType: "personalInfo", isDefault: true, isVisible: true, order: 0 },
  { id: "summary", key: "summary", displayName: "Summary", sectionType: "summary", isDefault: true, isVisible: true, order: 1 },
  { id: "workExperience", key: "workExperience", displayName: "Experience", sectionType: "experience", isDefault: true, isVisible: true, order: 2 },
  { id: "education", key: "education", displayName: "Education", sectionType: "education", isDefault: true, isVisible: true, order: 3 },
  { id: "personalProjects", key: "personalProjects", displayName: "Projects", sectionType: "projects", isDefault: true, isVisible: true, order: 4 },
  { id: "additional", key: "additional", displayName: "Additional", sectionType: "additional", isDefault: true, isVisible: true, order: 5 },
];

function shouldRegenerateResumeEmbedding(payload = {}) {
  return ["rawText", "parsedData"].some((key) => key in payload);
}

function extractResumeEmbeddingText(resume) {
  if (resume.rawText && String(resume.rawText).trim()) {
    return String(resume.rawText);
  }

  return JSON.stringify(resume.parsedData || {});
}

async function markResumeVectorStale(resume, reason, error) {
  console.warn(`[resume-index] ${reason}`, error?.message || error);
  resume.isAnalyzed = false;
  await resume.save();
  await deleteResumeVector(resume.qdrantId);
}

function deriveProcessingStatus(resume) {
  if (resume.processingStatus) {
    return resume.processingStatus;
  }

  return resume.isAnalyzed ? "ready" : "pending";
}

function toIsoDate(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function toPlainObject(resume) {
  return typeof resume.toObject === "function" ? resume.toObject() : resume;
}

function isStructuredData(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  if (!isStructuredData(value) && !Array.isArray(value)) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function makeRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStringArray(values = []) {
  const seen = new Set();
  const normalized = [];

  for (const item of values) {
    const text = String(item || "").trim();
    if (!text) continue;

    const key = text.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(text);
  }

  return normalized;
}

function toResumePreviewData(parsedData) {
  const parsed = isStructuredData(parsedData) ? deepClone(parsedData) : {};
  const personalInfo = isStructuredData(parsed.personalInfo) ? parsed.personalInfo : {};
  const additional = isStructuredData(parsed.additional) ? parsed.additional : {};

  return {
    personalInfo: {
      name: String(personalInfo.name || "Candidate").trim() || "Candidate",
      title: String(personalInfo.title || "").trim(),
      email: String(personalInfo.email || "").trim(),
      phone: String(personalInfo.phone || "").trim(),
      location: String(personalInfo.location || "").trim(),
      website: String(personalInfo.website || "").trim(),
      linkedin: String(personalInfo.linkedin || "").trim(),
      github: String(personalInfo.github || "").trim(),
    },
    summary: String(parsed.summary || "").trim(),
    workExperience: Array.isArray(parsed.workExperience) ? parsed.workExperience : [],
    education: Array.isArray(parsed.education) ? parsed.education : [],
    personalProjects: Array.isArray(parsed.personalProjects) ? parsed.personalProjects : [],
    additional: {
      technicalSkills: Array.isArray(additional.technicalSkills) ? additional.technicalSkills : [],
      languages: Array.isArray(additional.languages) ? additional.languages : [],
      certificationsTraining: Array.isArray(additional.certificationsTraining)
        ? additional.certificationsTraining
        : [],
      awards: Array.isArray(additional.awards) ? additional.awards : [],
    },
  };
}

export function normalizeBuilderData(input = {}, parsedData = {}) {
  const data = isStructuredData(input) ? input : {};
  const template = ["classic-single", "modern-single", "classic-two-column", "modern-two-column"].includes(data.template)
    ? data.template
    : "classic-single";
  const sections = isStructuredData(data.sections) ? data.sections : toResumePreviewData(parsedData);
  const sectionMeta = normalizeSectionMeta(data.sectionMeta, sections);

  return {
    sections,
    sectionMeta,
    template,
    formatSettings: {
      ...DEFAULT_BUILDER_FORMAT_SETTINGS,
      ...(isStructuredData(data.formatSettings) ? data.formatSettings : {}),
    },
    customSections: isStructuredData(data.customSections) ? data.customSections : {},
  };
}

function normalizeSectionMeta(input, sections = {}) {
  const provided = Array.isArray(input) ? input : [];
  const byId = new Map();

  for (const meta of provided) {
    if (!isStructuredData(meta)) continue;
    const id = String(meta.id || meta.key || "").trim();
    if (!id) continue;
    byId.set(id, {
      id,
      key: String(meta.key || id).trim() || id,
      displayName: String(meta.displayName || meta.name || id).trim() || id,
      sectionType: String(meta.sectionType || meta.type || id).trim() || id,
      isDefault: meta.isDefault !== false,
      isVisible: meta.isVisible !== false,
      order: Number.isFinite(Number(meta.order)) ? Number(meta.order) : byId.size,
    });
  }

  for (const defaultMeta of DEFAULT_SECTION_META) {
    if (!byId.has(defaultMeta.id) && Object.prototype.hasOwnProperty.call(sections, defaultMeta.key)) {
      byId.set(defaultMeta.id, { ...defaultMeta });
    }
  }

  for (const key of Object.keys(sections || {})) {
    if (!byId.has(key)) {
      byId.set(key, {
        id: key,
        key,
        displayName: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
        sectionType: "custom",
        isDefault: false,
        isVisible: true,
        order: byId.size,
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.order - b.order).map((meta, index) => ({ ...meta, order: index }));
}

function syncParsedDataFromBuilder(parsedData, builderData) {
  const sections = isStructuredData(builderData?.sections) ? builderData.sections : {};
  return {
    ...(isStructuredData(parsedData) ? parsedData : {}),
    ...sections,
  };
}

function extractJobKeywords(content, limit = 10) {
  const words = tokenizeAllTokens(content);
  const scores = new Map();
  for (const word of words) {
    scores.set(word, (scores.get(word) || 0) + 1);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function toDisplayKeyword(keyword) {
  const normalized = String(keyword || "").trim();
  if (!normalized) return "";

  if (/[+#.]/.test(normalized)) {
    return normalized.toUpperCase();
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getTailorCopy(language) {
  const normalized = resolveOutputLanguage(language);

  if (normalized === "vi") {
    return {
      summaryWithKeywords: (keywords) => `Tap trung vao vai tro nay, nhan manh ${keywords}.`,
      summaryNoKeywords: "Dieu chinh tom tat de phu hop vai tro va tac dong ro rang hon.",
      suggestionForKeyword: (keyword) =>
        `Nhan manh ${keyword} trong cac bullet kinh nghiem phu hop.`,
      defaultSuggestion: "Lam ro tom tat de phu hop mo ta cong viec va ket qua mong doi.",
    };
  }

  return {
    summaryWithKeywords: (keywords) => `Targeted for this role with emphasis on ${keywords}.`,
    summaryNoKeywords: "Tailored for this role with measurable and relevant impact.",
    suggestionForKeyword: (keyword) =>
      `Highlight ${keyword} in work experience bullets where relevant.`,
    defaultSuggestion: "Refine resume summary to better mirror the job description outcomes.",
  };
}

function applyJobImprovements(basePreview, jobText, outputLanguage) {
  const preview = deepClone(basePreview);
  const keywords = extractJobKeywords(jobText);

  const additional = isStructuredData(preview.additional) ? preview.additional : {};
  const currentSkills = Array.isArray(additional.technicalSkills) ? additional.technicalSkills : [];
  const suggestedSkills = keywords.slice(0, 6).map(toDisplayKeyword).filter(Boolean);
  const mergedSkills = normalizeStringArray([...currentSkills, ...suggestedSkills]);

  preview.additional = {
    ...additional,
    technicalSkills: mergedSkills,
    languages: Array.isArray(additional.languages) ? additional.languages : [],
    certificationsTraining: Array.isArray(additional.certificationsTraining)
      ? additional.certificationsTraining
      : [],
    awards: Array.isArray(additional.awards) ? additional.awards : [],
  };

  const existingSummary = String(preview.summary || "").trim();
  const shortKeywords = suggestedSkills.slice(0, 3).join(", ");
  
  let resolvedLang = outputLanguage;
  if (resolvedLang === "auto") {
    resolvedLang = detectLanguageOfResume(preview);
  }
  const copy = getTailorCopy(resolvedLang);
  const summaryAddon = shortKeywords
    ? copy.summaryWithKeywords(shortKeywords)
    : copy.summaryNoKeywords;

  preview.summary = existingSummary ? `${existingSummary} ${summaryAddon}` : summaryAddon;

  return {
    improved: preview,
    keywords,
    addedSkills: suggestedSkills.filter((skill) => !currentSkills.includes(skill)),
  };
}

function buildDiffAndChanges(originalPreview, improvedPreview, addedSkills = []) {
  const originalSummary = String(originalPreview.summary || "").trim();
  const improvedSummary = String(improvedPreview.summary || "").trim();
  const detailedChanges = [];

  if (originalSummary !== improvedSummary) {
    detailedChanges.push({
      field_path: "summary",
      field_type: "summary",
      change_type: "modified",
      original_value: originalSummary,
      new_value: improvedSummary,
      confidence: "high",
    });
  }

  for (const skill of addedSkills) {
    detailedChanges.push({
      field_path: "additional.technicalSkills",
      field_type: "skill",
      change_type: "added",
      original_value: null,
      new_value: skill,
      confidence: "medium",
    });
  }

  return {
    diffSummary: {
      total_changes: detailedChanges.length,
      skills_added: addedSkills.length,
      skills_removed: 0,
      descriptions_modified: originalSummary !== improvedSummary ? 1 : 0,
      certifications_added: 0,
      high_risk_changes: 0,
    },
    detailedChanges,
  };
}

function buildImprovementSuggestions(keywords = [], outputLanguage) {
  const copy = getTailorCopy(outputLanguage);

  if (!keywords.length) {
    return [
      {
        suggestion: copy.defaultSuggestion,
        lineNumber: null,
      },
    ];
  }

  return keywords.slice(0, 5).map((keyword, index) => ({
    suggestion: copy.suggestionForKeyword(toDisplayKeyword(keyword)),
    lineNumber: index + 1,
  }));
}

function renderTemplate(template = "", values = {}) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) =>
    values[key] === undefined || values[key] === null ? "" : String(values[key])
  );
}

function outputLanguageName(language) {
  return language === "vi" ? "Vietnamese" : "English";
}

async function getResumeAndJob(resumeId, jobId) {
  const [resume, job] = await Promise.all([getResumeByPublicId(resumeId), getJobByPublicId(jobId)]);
  return { resume, job };
}

function buildJobContext(job) {
  return [job?.title, job?.description, job?.requirements, job?.benefits, job?.cleanText]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function technicalSkillsOf(preview = {}) {
  return Array.isArray(preview.additional?.technicalSkills)
    ? preview.additional.technicalSkills.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function findAddedSkills(originalPreview, improvedPreview) {
  const original = new Set(technicalSkillsOf(originalPreview).map((item) => item.toLowerCase()));
  return technicalSkillsOf(improvedPreview).filter((skill) => !original.has(skill.toLowerCase()));
}

function normalizeLlmImprovements(value, outputLanguage) {
  const copy = getTailorCopy(outputLanguage);
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item, index) => {
      if (typeof item === "string") {
        return { suggestion: item.trim(), lineNumber: index + 1 };
      }
      return {
        suggestion: String(item?.suggestion || item?.text || "").trim(),
        lineNumber: item?.lineNumber ?? item?.line_number ?? null,
      };
    })
    .filter((item) => item.suggestion)
    .slice(0, 8)
    .concat(items.length ? [] : [{ suggestion: copy.defaultSuggestion, lineNumber: null }]);
}

function normalizeTailorJsonResult(result, originalPreview, outputLanguage) {
  const container = isStructuredData(result) ? result : {};
  const rawPreview =
    container.resume_preview ||
    container.resumePreview ||
    container.resume ||
    container.improved_resume ||
    container.data ||
    container;

  const merged = isStructuredData(rawPreview)
    ? {
        ...originalPreview,
        ...rawPreview,
        personalInfo: originalPreview.personalInfo,
      }
    : originalPreview;

  let resolvedLang = outputLanguage;
  if (resolvedLang === "auto") {
    resolvedLang = detectLanguageOfResume(originalPreview);
  }

  return {
    improved: toResumePreviewData(merged),
    improvements: normalizeLlmImprovements(container.improvements || container.suggestions, resolvedLang),
  };
}

async function buildTailorWithLlm({ originalPreview, jobText, outputLanguage }) {
  const [runtimeConfig, promptConfig] = await Promise.all([
    resolveLlmRuntimeConfig(),
    getPromptConfig(),
  ]);
  const promptId = promptConfig.default_prompt_id || "keywords";
  const template =
    promptConfig.templates?.tailor?.[promptId] ||
    promptConfig.templates?.tailor?.keywords;
    
  let resolvedLang = outputLanguage;
  if (resolvedLang === "auto") {
    resolvedLang = detectLanguageOfResume(originalPreview);
  }

  const prompt = renderTemplate(template, {
    output_language: outputLanguageName(resolvedLang),
    job_description: jobText,
    resume_json: JSON.stringify(originalPreview, null, 2),
  });

  const result = await completeJson({
    feature: "resume_tailor",
    prompt,
    systemPrompt:
      "You are an expert resume editor. Preserve facts. Return JSON only.",
    maxTokens: 8192,
    retries: 1,
    config: runtimeConfig,
  });

  return {
    ...normalizeTailorJsonResult(result.data, originalPreview, outputLanguage),
    llmMetadata: result.metadata,
    runtimeConfig,
  };
}

function buildImproveResponse({
  requestId,
  resumeId,
  jobId,
  resumePreview,
  improvements,
  jobDescription,
  keywords,
  diffSummary,
  detailedChanges,
  generationMode = "template_fallback",
  llmMetadata = null,
}) {
  return {
    request_id: requestId,
    data: {
      request_id: requestId,
      resume_id: resumeId,
      job_id: jobId,
      resume_preview: resumePreview,
      improvements,
      job_description: jobDescription,
      job_keywords: keywords.join(", "),
      diff_summary: diffSummary,
      detailed_changes: detailedChanges,
      generation_mode: generationMode,
      llm_metadata: llmMetadata,
    },
  };
}

export function toResumeFetchData(resumeDoc) {
  const resume = toPlainObject(resumeDoc);
  const content = String(resume.rawText || "");
  const parsedData = isStructuredData(resume.parsedData) ? resume.parsedData : null;

  return {
    resume_id: String(resume._id),
    candidate_id: resume.candidateId ? String(resume.candidateId) : null,
    raw_resume: {
      id: null,
      content,
      content_type: "md",
      created_at: toIsoDate(resume.createdAt),
      processing_status: deriveProcessingStatus(resume),
    },
    processed_resume: parsedData,
    builder_data: normalizeBuilderData(resume.builderData, parsedData || {}),
    cover_letter: resume.coverLetter ?? null,
    outreach_message: resume.outreachMessage ?? null,
    parent_id: resume.parentResumeId ? String(resume.parentResumeId) : null,
    restored_from_version_id: resume.restoredFromVersionId ? String(resume.restoredFromVersionId) : null,
    restored_at: resume.restoredAt ? toIsoDate(resume.restoredAt) : null,
    title: resume.title ?? null,
  };
}

export function toResumeSummary(resumeDoc) {
  const resume = toPlainObject(resumeDoc);

  return {
    resume_id: String(resume._id),
    candidate_id: resume.candidateId ? String(resume.candidateId) : null,
    filename: resume.filename ?? null,
    is_master: Boolean(resume.isMaster),
    parent_id: resume.parentResumeId ? String(resume.parentResumeId) : null,
    restored_from_version_id: resume.restoredFromVersionId ? String(resume.restoredFromVersionId) : null,
    restored_at: resume.restoredAt ? toIsoDate(resume.restoredAt) : null,
    processing_status: deriveProcessingStatus(resume),
    created_at: toIsoDate(resume.createdAt),
    updated_at: toIsoDate(resume.updatedAt),
    title: resume.title ?? null,
    template: resume.builderData?.template || "classic-single",
  };
}

function inferTitleFromFilename(filename) {
  if (!filename) return null;
  const sanitized = String(filename).trim();
  if (!sanitized) return null;
  return sanitized.replace(/\.[^./\\]+$/, "").trim() || sanitized;
}

function toUploadText(buffer) {
  if (!buffer || !buffer.length) {
    return "";
  }

  return String(buffer.toString("utf8")).trim();
}

// Tao CV moi va gan qdrantId de mapping sang Qdrant.
export async function createResume(payload) {
  const { embeddingVector, ...resumeData } = payload;
  const resume = new Resume(resumeData);
  ensureQdrantId(resume);
  const saved = await resume.save();
  let vector = embeddingVector;

  if (!Array.isArray(vector) || vector.length === 0) {
    try {
      vector = await generateEmbedding(extractResumeEmbeddingText(saved));
    } catch (error) {
      vector = null;
      await markResumeVectorStale(
        saved,
        "embedding generation failed on create, resume marked stale",
        error
      );
    }
  }

  if (Array.isArray(vector) && vector.length > 0) {
    try {
      await upsertResumeVector({
        qdrantId: saved.qdrantId,
        vector,
        payload: {
          mongoId: String(saved._id),
          candidateId: String(saved.candidateId),
          isAnalyzed: true,
        },
      });

      saved.isAnalyzed = true;
      await saved.save();
    } catch (error) {
      await markResumeVectorStale(
        saved,
        "vector upsert failed on create, resume marked stale",
        error
      );
    }
  }

  return saved;
}

export async function createResumeFromUpload(file, candidateId = DEFAULT_CANDIDATE_ID) {
  if (!file) {
    const error = new Error("Missing uploaded file");
    error.statusCode = 400;
    error.error_code = "missing_uploaded_file";
    throw error;
  }

  const mimeType = String(file.mimetype || "").toLowerCase();
  if (!ALLOWED_UPLOAD_TYPES.has(mimeType)) {
    const error = new Error(`Invalid file type: ${mimeType || "unknown"}`);
    error.statusCode = 400;
    error.error_code = "invalid_upload_file_type";
    throw error;
  }

  const size = Number(file.size || 0);
  if (size <= 0 || !file.buffer) {
    const error = new Error("Empty file");
    error.statusCode = 400;
    error.error_code = "empty_uploaded_file";
    throw error;
  }

  if (size > MAX_UPLOAD_BYTES) {
    const error = new Error("File too large. Maximum size is 4MB");
    error.statusCode = 413;
    error.error_code = "uploaded_file_too_large";
    throw error;
  }

  // Step 1: Extract raw text (fast — calls parsing service for text extraction only)
  let rawText = "";
  try {
    rawText = await extractRawTextFromFile(file);
  } catch (_error) {
    // Fallback: try to read buffer as plain text (e.g. .txt files)
    rawText = toUploadText(file.buffer);
  }

  rawText = String(rawText || "").trim();
  if (!rawText) {
    // Final fallback: try reading buffer directly
    rawText = toUploadText(file.buffer).trim();
  }

  if (!rawText) {
    const error = new Error("Unable to extract textual content from file");
    error.statusCode = 422;
    error.error_code = "unable_to_extract_textual_content";
    throw error;
  }

  // Step 2: Save the resume immediately with raw text, processingStatus='processing'
  // We don't wait for LLM parsing — that happens in the background.
  const hasMaster = await Resume.exists({ isMaster: true });
  const created = await createResume({
    candidateId,
    fileUrl: `upload://${Date.now()}-${file.originalname || "resume"}`,
    rawText,
    parsedData: null,
    builderData: normalizeBuilderData({}, {}),
    filename: file.originalname || null,
    sourceFile: {
      filename: file.originalname || null,
      mimeType: mimeType || "application/octet-stream",
      size,
      data: file.buffer,
    },
    title: inferTitleFromFilename(file.originalname),
    isMaster: !hasMaster,
    processingStatus: "processing",
  });

  const resumeId = String(created._id);

  // Step 3: Run LLM structured-data parsing in the background (don't await)
  // This updates parsedData, builderData, embedding, and processingStatus asynchronously.
  setImmediate(async () => {
    try {
      const parsedData = await parseStructuredDataFromText(rawText);
      if (isStructuredData(parsedData)) {
        await updateResumeById(resumeId, {
          parsedData,
          builderData: normalizeBuilderData({}, parsedData),
          processingStatus: "ready",
        });
      } else {
        // LLM failed but we still have raw text — mark as ready with empty parsed data
        const resume = await Resume.findById(resumeId);
        if (resume) {
          resume.processingStatus = "ready";
          await resume.save();
        }
      }
    } catch (bgError) {
      console.error("[upload] Background LLM parsing failed for resume", resumeId, bgError?.message);
      try {
        const resume = await Resume.findById(resumeId);
        if (resume) {
          resume.processingStatus = "failed";
          await resume.save();
        }
      } catch (_saveError) {
        // ignore
      }
    }
  });

  return {
    message: `File ${file.originalname || "resume"} uploaded successfully`,
    resume_id: resumeId,
    processing_status: "processing",
    is_master: Boolean(created.isMaster),
  };
}

// Cap nhat CV va bo sung qdrantId neu du lieu cu chua co.
export async function updateResumeById(resumeId, payload) {
  const { embeddingVector, ...resumeData } = payload;
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  if ("builderData" in resumeData) {
    resumeData.builderData = normalizeBuilderData(resumeData.builderData, resumeData.parsedData || resume.parsedData);
    resumeData.parsedData = syncParsedDataFromBuilder(resumeData.parsedData || resume.parsedData, resumeData.builderData);
  }

  const mustRegenerate = shouldRegenerateResumeEmbedding(resumeData);
  if (mustRegenerate) {
    resumeData.isAnalyzed = false;
  }

  Object.assign(resume, resumeData);
  ensureQdrantId(resume);
  const saved = await resume.save();

  let vector = embeddingVector;
  if (mustRegenerate) {
    await deleteResumeVector(saved.qdrantId);
  }

  if ((!Array.isArray(vector) || vector.length === 0) && mustRegenerate) {
    try {
      vector = await generateEmbedding(extractResumeEmbeddingText(saved));
    } catch (error) {
      vector = null;
      await markResumeVectorStale(
        saved,
        "embedding generation failed on update, stale vector removed",
        error
      );
    }
  }

  if (Array.isArray(vector) && vector.length > 0) {
    try {
      await upsertResumeVector({
        qdrantId: saved.qdrantId,
        vector,
        payload: {
          mongoId: String(saved._id),
          candidateId: String(saved.candidateId),
          isAnalyzed: true,
        },
      });

      saved.isAnalyzed = true;
      await saved.save();
    } catch (error) {
      await markResumeVectorStale(
        saved,
        "vector upsert failed on update, stale vector removed",
        error
      );
    }
  }

  return saved;
}

export async function reorderResumeSections(resumeId, sectionIds = []) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  const builderData = normalizeBuilderData(resume.builderData, resume.parsedData);
  const requested = Array.isArray(sectionIds) ? sectionIds.map((id) => String(id || "").trim()).filter(Boolean) : [];
  const orderMap = new Map(requested.map((id, index) => [id, index]));
  const fallbackStart = requested.length;
  builderData.sectionMeta = builderData.sectionMeta
    .map((meta, index) => ({
      ...meta,
      order: orderMap.has(meta.id) ? orderMap.get(meta.id) : fallbackStart + index,
    }))
    .sort((a, b) => a.order - b.order)
    .map((meta, index) => ({ ...meta, order: index }));

  resume.builderData = builderData;
  resume.parsedData = syncParsedDataFromBuilder(resume.parsedData, builderData);
  await resume.save();
  return resume;
}

export async function updateResumeSection(resumeId, sectionId, updates = {}) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  const id = String(sectionId || "").trim();
  if (!id) {
    const error = new Error("sectionId is required");
    error.statusCode = 400;
    error.error_code = "missing_section_id";
    throw error;
  }

  const builderData = normalizeBuilderData(resume.builderData, resume.parsedData);
  const sectionKey = String(updates.key || id).trim() || id;
  if ("content" in updates) {
    builderData.sections[sectionKey] = updates.content;
  }

  builderData.sectionMeta = normalizeSectionMeta(builderData.sectionMeta, builderData.sections).map((meta) => {
    if (meta.id !== id && meta.key !== id) return meta;
    return {
      ...meta,
      displayName: "displayName" in updates ? String(updates.displayName || meta.displayName).trim() || meta.displayName : meta.displayName,
      isVisible: "isVisible" in updates ? Boolean(updates.isVisible) : meta.isVisible,
      sectionType: "sectionType" in updates ? String(updates.sectionType || meta.sectionType).trim() || meta.sectionType : meta.sectionType,
    };
  });

  resume.builderData = normalizeBuilderData(builderData, resume.parsedData);
  resume.parsedData = syncParsedDataFromBuilder(resume.parsedData, resume.builderData);
  await resume.save();
  return resume;
}

export async function addResumeSection(resumeId, payload = {}) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  const builderData = normalizeBuilderData(resume.builderData, resume.parsedData);
  const rawId = String(payload.id || payload.key || payload.displayName || `custom_${Date.now()}`).trim();
  const id = rawId.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || `custom_${Date.now()}`;
  if (Object.prototype.hasOwnProperty.call(builderData.sections, id)) {
    const error = new Error("Section already exists");
    error.statusCode = 409;
    error.error_code = "section_already_exists";
    throw error;
  }

  builderData.sections[id] = "content" in payload ? payload.content : "";
  builderData.customSections[id] = builderData.sections[id];
  builderData.sectionMeta = normalizeSectionMeta(
    [
      ...builderData.sectionMeta,
      {
        id,
        key: id,
        displayName: String(payload.displayName || payload.name || id).trim() || id,
        sectionType: String(payload.sectionType || "custom").trim() || "custom",
        isDefault: false,
        isVisible: payload.isVisible !== false,
        order: builderData.sectionMeta.length,
      },
    ],
    builderData.sections
  );

  resume.builderData = normalizeBuilderData(builderData, resume.parsedData);
  resume.parsedData = syncParsedDataFromBuilder(resume.parsedData, resume.builderData);
  await resume.save();
  return resume;
}

export async function deleteResumeSection(resumeId, sectionId) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  const id = String(sectionId || "").trim();
  const builderData = normalizeBuilderData(resume.builderData, resume.parsedData);
  const meta = builderData.sectionMeta.find((item) => item.id === id || item.key === id);
  if (meta?.isDefault) {
    const error = new Error("Default sections cannot be deleted");
    error.statusCode = 400;
    error.error_code = "default_section_not_deletable";
    throw error;
  }

  delete builderData.sections[id];
  delete builderData.customSections[id];
  builderData.sectionMeta = builderData.sectionMeta
    .filter((item) => item.id !== id && item.key !== id)
    .map((item, index) => ({ ...item, order: index }));

  resume.builderData = normalizeBuilderData(builderData, resume.parsedData);
  resume.parsedData = syncParsedDataFromBuilder(resume.parsedData, resume.builderData);
  await resume.save();
  return resume;
}

export async function getResumeByPublicId(resumeId) {
  if (!resumeId || typeof resumeId !== "string") return null;
  if (!/^[a-fA-F0-9]{24}$/.test(resumeId)) return null;

  return Resume.findById(resumeId);
}

export async function getJobByPublicId(jobId) {
  if (!jobId || typeof jobId !== "string") return null;
  if (!/^[a-fA-F0-9]{24}$/.test(jobId)) return null;

  return Job.findById(jobId);
}

export async function listResumeSummaries(includeMaster = false, candidateId) {
  const filter = includeMaster ? {} : { isMaster: { $ne: true } };
  if (candidateId) {
    filter.candidateId = candidateId;
  }
  const resumes = await Resume.find(filter).sort({ updatedAt: -1 });
  return resumes.map(toResumeSummary);
}

export async function getResumeVersionHistory(resumeId) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  const candidateId = String(resume.candidateId || '').trim();
  const query = candidateId ? { candidateId } : { _id: resume._id };
  const versions = await Resume.find(query).sort({ createdAt: 1, updatedAt: 1 });

  return {
    resume_id: String(resume._id),
    candidate_id: candidateId || null,
    root_resume_id: versions.length ? String(versions[0]._id) : String(resume._id),
    current_resume_id: String(resume._id),
    versions: versions.map(toResumeSummary),
  };
}

export async function getMasterResume(candidateId = DEFAULT_CANDIDATE_ID) {
  if (!candidateId) return null;

  return Resume.findOne({ candidateId, isMaster: true }).sort({ updatedAt: -1 });
}

export async function setResumeAsMaster(resumeId) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  await Resume.updateMany(
    {
      candidateId: resume.candidateId,
      _id: { $ne: resume._id },
    },
    {
      $set: { isMaster: false },
    }
  );

  if (!resume.isMaster) {
    resume.isMaster = true;
    await resume.save();
  }

  return resume;
}

export async function restoreFromVersion(resumeId, versionId) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  const version = await getResumeByPublicId(versionId);
  if (!version) return null;

  // Verify both resumes belong to same candidate
  if (String(resume.candidateId) !== String(version.candidateId)) {
    return null;
  }

  const snapshotData = {
    candidateId: resume.candidateId,
    fileUrl: resume.fileUrl,
    rawText: resume.rawText,
    qdrantId: resume.qdrantId,
    parsedData: deepClone(resume.parsedData),
    builderData: deepClone(resume.builderData),
    processingStatus: resume.processingStatus,
    filename: resume.filename,
    sourceFile: deepClone(resume.sourceFile),
    isMaster: false,
    parentResumeId: resume.parentResumeId || null,
    title: resume.title || null,
    coverLetter: resume.coverLetter ?? null,
    outreachMessage: resume.outreachMessage ?? null,
    jobDescription: resume.jobDescription ?? null,
    jobId: resume.jobId ?? null,
    isAnalyzed: resume.isAnalyzed,
  };

  await Resume.create(snapshotData);

  // Copy content fields from version to current resume
  resume.title = version.title || resume.title;
  resume.rawText = version.rawText || resume.rawText;
  resume.parsedData = deepClone(version.parsedData) || resume.parsedData;
  resume.builderData = normalizeBuilderData(version.builderData, resume.parsedData);

  // Optionally preserve job context if version had it
  if (version.jobDescription) {
    resume.jobDescription = version.jobDescription;
  }
  if (version.jobId) {
    resume.jobId = version.jobId;
  }

  resume.restoredFromVersionId = version._id;
  resume.restoredAt = new Date();

  await resume.save();
  return resume;
}

export async function retryResumeProcessing(resumeId) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  resume.processingStatus = "processing";
  await resume.save();

  try {
    await updateResumeById(String(resume._id), {
      rawText: resume.rawText,
      parsedData: resume.parsedData,
    });

    resume.processingStatus = "ready";
    await resume.save();

    return {
      message: "Resume processing succeeded on retry",
      resume_id: String(resume._id),
      processing_status: "ready",
      is_master: Boolean(resume.isMaster),
    };
  } catch (_error) {
    resume.processingStatus = "failed";
    await resume.save();

    return {
      message: "Retry processing failed",
      resume_id: String(resume._id),
      processing_status: "failed",
      is_master: Boolean(resume.isMaster),
    };
  }
}

export async function updateResumeFields(resumeId, fields = {}) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  Object.assign(resume, fields);
  await resume.save();
  return resume;
}

export async function previewResumeImprovement(resumeId, jobId, outputLanguage = "en") {
  const { resume, job } = await getResumeAndJob(resumeId, jobId);
  if (!resume || !job) {
    return null;
  }

  const jobText = buildJobContext(job);
  const originalPreview = toResumePreviewData(resume.parsedData);
  const keywords = extractJobKeywords(jobText);
  let generationMode = "template_fallback";
  let llmMetadata = null;
  let improved = null;
  let improvements = null;

  try {
    const llmResult = await buildTailorWithLlm({ originalPreview, jobText, outputLanguage });
    improved = llmResult.improved;
    improvements = llmResult.improvements;
    generationMode = "llm";
    llmMetadata = llmResult.llmMetadata;
  } catch (error) {
    let fallbackConfig = null;
    try {
      fallbackConfig = await resolveLlmRuntimeConfig();
    } catch {
      fallbackConfig = null;
    }
    logLlmFallback({
      feature: "resume_tailor",
      error,
      config: fallbackConfig,
      reason: getLlmFailureReason(error),
    });
    const fallback = applyJobImprovements(originalPreview, jobText, outputLanguage);
    improved = fallback.improved;
  }

  const addedSkills = findAddedSkills(originalPreview, improved);
  const { diffSummary, detailedChanges } = buildDiffAndChanges(originalPreview, improved, addedSkills);
  if (!improvements) {
    improvements = buildImprovementSuggestions(keywords, outputLanguage);
  }
  const requestId = makeRequestId();

  return buildImproveResponse({
    requestId,
    resumeId: null,
    jobId: String(job._id),
    resumePreview: improved,
    improvements,
    jobDescription: jobText,
    keywords,
    diffSummary,
    detailedChanges,
    generationMode,
    llmMetadata,
  });
}

export async function confirmResumeImprovement({
  resumeId,
  jobId,
  improvedData,
  improvements,
  outputLanguage = "en",
  generationMode = "template_fallback",
  llmMetadata = null,
}) {
  const { resume, job } = await getResumeAndJob(resumeId, jobId);
  if (!resume || !job) {
    return null;
  }

  const safePreview = toResumePreviewData(improvedData);
  const parentPreview = toResumePreviewData(resume.parsedData);
  const parentFilename = String(resume.filename || "resume").trim() || "resume";
  const jobText = buildJobContext(job);
  const title = [safePreview.personalInfo?.title, job.title].filter(Boolean).join(" - ").slice(0, 120);
  const { diffSummary, detailedChanges } = buildDiffAndChanges(parentPreview, safePreview, []);

  const tailored = await createResume({
    candidateId: resume.candidateId || DEFAULT_CANDIDATE_ID,
    fileUrl: `tailored://${Date.now()}-${parentFilename}`,
    rawText: JSON.stringify(safePreview, null, 2),
    parsedData: safePreview,
    builderData: normalizeBuilderData({ sections: safePreview }, safePreview),
    filename: `tailored_${parentFilename}`,
    title: title || `Tailored ${parentFilename}`,
    isMaster: false,
    parentResumeId: resume._id,
    processingStatus: "ready",
    jobDescription: jobText,
    jobId: String(job._id),
  });

  const requestId = makeRequestId();
  const copy = getTailorCopy(outputLanguage);
  const normalizedImprovements = Array.isArray(improvements)
    ? improvements.map((item) => ({
        suggestion: String(item?.suggestion || "").trim() || copy.defaultSuggestion,
        lineNumber: item?.lineNumber ?? null,
      }))
    : [];

  return buildImproveResponse({
    requestId,
    resumeId: String(tailored._id),
    jobId: String(job._id),
    resumePreview: safePreview,
    improvements: normalizedImprovements,
    jobDescription: jobText,
    keywords: extractJobKeywords(jobText),
    diffSummary,
    detailedChanges,
    generationMode,
    llmMetadata,
  });
}

export async function improveResume(resumeId, jobId, outputLanguage = "en") {
  const preview = await previewResumeImprovement(resumeId, jobId, outputLanguage);
  if (!preview) {
    return null;
  }

  return confirmResumeImprovement({
    resumeId,
    jobId,
    improvedData: preview.data.resume_preview,
    improvements: preview.data.improvements,
    outputLanguage,
    generationMode: preview.data.generation_mode,
    llmMetadata: preview.data.llm_metadata,
  });
}

function normalizeSentence(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.endsWith(".") ? text : `${text}.`;
}

function resolveOutputLanguage(language) {
  const normalized = String(language || "").trim().toLowerCase();
  if (SUPPORTED_OUTPUT_LANGUAGES.has(normalized)) {
    return normalized;
  }

  return "en";
}

function tokenizeForMatch(value = "") {
  return tokenizeAllTokens(value);
}

function buildHighlights(text, matchedKeywords = [], missingKeywords = []) {
  const matched = new Set(matchedKeywords.map((item) => String(item).toLowerCase()));
  const missing = new Set(missingKeywords.map((item) => String(item).toLowerCase()));
  const source = String(text || "");
  const segments = [];
  const pattern = /[a-zA-Z0-9+#.]{3,}/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(source))) {
    if (match.index > cursor) {
      segments.push({ text: source.slice(cursor, match.index), type: "plain" });
    }
    const token = match[0];
    const normalized = token.toLowerCase();
    const type = matched.has(normalized) ? "matched" : missing.has(normalized) ? "missing" : "plain";
    segments.push({ text: token, type });
    cursor = match.index + token.length;
  }

  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), type: "plain" });
  }

  return segments;
}

export async function extractKeywordsWithLlm(jobText) {
  try {
    const config = await resolveLlmRuntimeConfig();
    const systemPrompt = `You are an expert technical recruiter. Analyze the job description and extract up to 80 core technical skills, hard skills, programming languages, databases, cloud providers, concepts, tools, or methodologies. Do NOT extract generic adjectives or common action verbs (like "experienced", "skilled", "utilize", "contribute", "ideal", "requires", "team", "motivated", "successful", "reliable", "jd", "making"). Return ONLY a JSON object with a single key "keywords" containing an array of strings. Example format: { "keywords": ["React", "TypeScript", "Docker", "AWS", "CI/CD"] }`;
    const prompt = `Job Description:\n\n${jobText}`;

    const response = await completeJson({
      feature: "jd_keyword_extraction",
      prompt,
      systemPrompt,
      config,
    });

    if (response?.data?.keywords && Array.isArray(response.data.keywords)) {
      return response.data.keywords
        .map(normalizeKeyword)
        .filter((kw) => kw && !KEYWORD_STOPWORDS.has(kw));
    }
  } catch (error) {
    console.warn("Failed to extract keywords with LLM, falling back to regex tokenization:", error?.message || error);
  }
  return null;
}

export async function buildResumeJdMatch(resumeId, input = {}) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  let jobText = String(input.job_description || "").trim();
  if (!jobText && input.job_id) {
    const job = await getJobByPublicId(String(input.job_id));
    if (!job) return null;
    jobText = [job.title, job.description, job.requirements, job.benefits].filter(Boolean).join("\n");
  }

  if (!jobText) {
    const error = new Error("job_id or job_description is required");
    error.statusCode = 400;
    throw error;
  }

  const resumeText = String(resume.rawText || JSON.stringify(resume.parsedData || {}));

  // Try LLM keyword extraction first, with fallback to Regex tokenization
  let jdKeywords;
  const llmKeywords = await extractKeywordsWithLlm(jobText);
  if (llmKeywords && llmKeywords.length > 0) {
    jdKeywords = [...new Set(llmKeywords)].slice(0, 80);
  } else {
    jdKeywords = [...new Set(tokenizeForMatch(jobText))].slice(0, 80);
  }

  const resumeTokens = new Set(tokenizeForMatch(resumeText));
  const matchedKeywords = jdKeywords.filter((keyword) => resumeTokens.has(keyword)).map(toDisplayKeyword);
  const missingKeywords = jdKeywords.filter((keyword) => !resumeTokens.has(keyword)).map(toDisplayKeyword);

  let matchPercentage = jdKeywords.length
    ? Math.round((matchedKeywords.length / jdKeywords.length) * 100)
    : 0;
  let keywordScore = jdKeywords.length ? matchedKeywords.length / jdKeywords.length : 0;
  let semanticScore = null;
  let hybridScore = null;

  if (resume.qdrantId) {
    try {
      const [resumePoint, jobVector, { idfMap }] = await Promise.all([
        jdMatchDependencies.getResumeVectorPoint(resume.qdrantId, { withVector: true }),
        jdMatchDependencies.generateEmbedding(jobText),
        jdMatchDependencies.fetchIdfsForKeywords(jdKeywords, "resume"),
      ]);

      const resumeVector = resumePoint ? jdMatchDependencies.extractPointVector(resumePoint) : null;
      if (resumeVector && jobVector) {
        const rawSemantic = jdMatchDependencies.cosineSimilarity(jobVector, resumeVector);
        semanticScore = Math.max(0, Math.min(1, rawSemantic));

        const docTokens = jdMatchDependencies.tokenizeAllTokens(resumeText);
        const keywordAnalysis = jdMatchDependencies.computeKeywordAnalysis(jdKeywords, [...resumeTokens], {
          docTokens,
          idfMap,
        });
        keywordScore = Math.max(0, Math.min(1, keywordAnalysis.keywordScore));

        // Hybrid weight matches recruiter config (0.65 semantic, 0.35 keyword)
        hybridScore = 0.65 * semanticScore + 0.35 * keywordScore;
        matchPercentage = Math.round(hybridScore * 100);
      }
    } catch (error) {
      console.warn("Failed to compute hybrid score for JD match, falling back to keyword ratio:", error?.message || error);
    }
  }

  const includeHighlights = input.include_highlights !== false;
  const recommendations = missingKeywords.slice(0, 8).map(
    (keyword) => `Add evidence for ${keyword} where it is truthful and relevant.`
  );

  return {
    resume_id: String(resume._id),
    job_id: input.job_id || null,
    match_percentage: matchPercentage,
    keyword_score: Math.round(keywordScore * 100),
    semantic_score: semanticScore !== null ? Math.round(semanticScore * 100) : null,
    hybrid_score: hybridScore !== null ? Math.round(hybridScore * 100) : null,
    score_method: hybridScore !== null ? "hybrid" : "keyword_only",
    score_weights: hybridScore !== null ? { semantic: 0.65, keyword: 0.35 } : null,
    matched_keywords: matchedKeywords,
    missing_keywords: missingKeywords,
    jd_highlights: includeHighlights ? buildHighlights(jobText, matchedKeywords, missingKeywords) : [],
    resume_highlights: includeHighlights ? buildHighlights(resumeText, matchedKeywords, []) : [],
    recommendations,
  };
}

function collectResumePdfLines(resume) {
  const preview = toResumePreviewData(resume.parsedData);
  const lines = [];
  const name = String(preview.personalInfo?.name || resume.title || "Candidate").trim();
  const role = String(preview.personalInfo?.title || "").trim();

  lines.push(name || "Candidate Resume");
  if (role) {
    lines.push(role);
  }

  if (preview.summary) {
    lines.push("Summary");
    lines.push(preview.summary);
  }

  const skills = Array.isArray(preview.additional?.technicalSkills)
    ? preview.additional.technicalSkills.slice(0, 18)
    : [];
  if (skills.length) {
    lines.push("Skills");
    lines.push(skills.join(", "));
  }

  const experiences = Array.isArray(preview.workExperience) ? preview.workExperience.slice(0, 6) : [];
  if (experiences.length) {
    lines.push("Experience Highlights");
    for (const exp of experiences) {
      const title = String(exp?.title || "").trim();
      const company = String(exp?.company || "").trim();
      if (title || company) {
        lines.push([title, company].filter(Boolean).join(" - "));
      }

      const bullets = Array.isArray(exp?.description) ? exp.description.slice(0, 2) : [];
      for (const bullet of bullets) {
        lines.push(`- ${String(bullet || "").trim()}`);
      }
    }
  }

  return lines;
}

function buildRoleLine(resume) {
  const data = isStructuredData(resume.parsedData) ? resume.parsedData : {};
  const personal = isStructuredData(data.personalInfo) ? data.personalInfo : {};
  const name = String(personal.name || resume.title || "Candidate").trim() || "Candidate";
  const role = String(personal.title || "professional").trim() || "professional";
  return { name, role };
}

function buildContextLine(resume, outputLanguage = "en") {
  const language = resolveOutputLanguage(outputLanguage);
  const source = String(resume.jobDescription || resume.rawText || "").trim();
  if (!source) {
    return language === "vi"
      ? "Toi hao hung dong gop kinh nghiem cua minh cho doi ngu va tao ra tac dong co the do luong duoc."
      : "I am excited to contribute my experience to your team and deliver measurable impact.";
  }

  const clipped = source.replace(/\s+/g, " ").slice(0, 220).trim();
  if (!clipped) {
    return language === "vi"
      ? "Toi hao hung dong gop kinh nghiem cua minh cho doi ngu va tao ra tac dong co the do luong duoc."
      : "I am excited to contribute my experience to your team and deliver measurable impact.";
  }

  if (language === "vi") {
    return `Yeu cau cua vi tri nay phu hop voi nen tang cua toi, dac biet o cac noi dung ${clipped.toLowerCase()}.`;
  }

  return `Your role expectations align with my background, especially around ${clipped.toLowerCase()}.`;
}

function buildTemplateCoverLetter(resume, outputLanguage = "en") {
  const language = resolveOutputLanguage(outputLanguage);
  const { name, role } = buildRoleLine(resume);
  const contextLine = normalizeSentence(buildContextLine(resume, language));

  const intro =
    language === "vi"
      ? normalizeSentence(`Kinh gui Quy cong ty,\n\nToi ten la ${name} va hien la ${role}`)
      : normalizeSentence(`Dear Hiring Team,\n\nMy name is ${name} and I am a ${role}`);

  const impact =
    language === "vi"
      ? "Toi tap trung tao ket qua ro rang, phoi hop hieu qua lien phong ban va lien tuc cai tien chat luong cong viec."
      : "I focus on delivering clear outcomes, collaborating effectively across teams, and continuously improving quality and efficiency.";

  const closing =
    language === "vi"
      ?
          "Cam on Quy cong ty da danh thoi gian xem xet ho so cua toi. Toi rat mong co co hoi trao doi them ve cach toi co the dong gop cho to chuc.\n\nTran trong,\n" +
          name
      :
          "Thank you for considering my application. I would welcome the opportunity to discuss how I can contribute to your organization.\n\nSincerely,\n" +
          name;

  return [intro, contextLine, impact, closing].join("\n\n");
}

function buildTemplateOutreach(resume, outputLanguage = "en") {
  const language = resolveOutputLanguage(outputLanguage);
  const { name, role } = buildRoleLine(resume);
  const line1 =
    language === "vi" ? `Chao anh/chi, toi la ${name}, hien la ${role}.` : `Hi, I am ${name}, a ${role}.`;
  const line2 = normalizeSentence(buildContextLine(resume, language));
  const line3 =
    language === "vi"
      ? "Neu phu hop, toi san long chia se cach kinh nghiem cua minh co the ho tro muc tieu cua doi ngu cua anh/chi."
      : "If useful, I would be glad to share how my background can support your team goals.";
  const line4 = language === "vi" ? "Cam on anh/chi da danh thoi gian." : "Thank you for your time.";

  return [line1, line2, line3, line4].join(" ");
}

async function generateTextWithLlm({ feature, resume, outputLanguage, templateKey, maxTokens }) {
  const [runtimeConfig, promptConfig] = await Promise.all([
    resolveLlmRuntimeConfig(),
    getPromptConfig(),
  ]);
  const template = promptConfig.templates?.[templateKey];

  let resolvedLang = outputLanguage;
  if (resolvedLang === "auto") {
    resolvedLang = detectLanguageOfResume(resume.parsedData);
  }

  const prompt = renderTemplate(template, {
    output_language: outputLanguageName(resolvedLang),
    job_description: String(resume.jobDescription || "").trim(),
    resume_json: JSON.stringify(toResumePreviewData(resume.parsedData), null, 2),
  });
  return completeText({
    feature,
    prompt,
    systemPrompt:
      "You are a professional career writing assistant. Preserve facts and output only the requested text.",
    maxTokens,
    temperature: 0.4,
    config: runtimeConfig,
  });
}

export async function generateCoverLetterContent(resumeId, outputLanguage = "en") {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  let content = "";
  let generationMode = "template_fallback";
  let llmMetadata = null;

  try {
    const result = await generateTextWithLlm({
      feature: "cover_letter_generation",
      resume,
      outputLanguage,
      templateKey: "cover_letter",
      maxTokens: 2048,
    });
    content = result.content.trim();
    generationMode = "llm";
    llmMetadata = result.metadata;
  } catch (error) {
    let fallbackConfig = null;
    try {
      fallbackConfig = await resolveLlmRuntimeConfig();
    } catch {
      fallbackConfig = null;
    }
    logLlmFallback({
      feature: "cover_letter_generation",
      error,
      config: fallbackConfig,
      reason: getLlmFailureReason(error),
    });
    content = buildTemplateCoverLetter(resume, outputLanguage);
  }

  resume.coverLetter = content;
  await resume.save();
  return {
    content,
    generation_mode: generationMode,
    llm_metadata: llmMetadata,
  };
}

export async function setResumeJobContext(resumeId, jobId) {
  const resume = await getResumeByPublicId(resumeId);
  const job = await getJobByPublicId(jobId);
  if (!resume || !job) return null;

  resume.jobId = String(job._id);
  resume.jobDescription = [job.title, job.description, job.requirements, job.benefits].filter(Boolean).join("\n");
  await resume.save();
  return resume;
}

export async function generateOutreachContent(resumeId, outputLanguage = "en") {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  let content = "";
  let generationMode = "template_fallback";
  let llmMetadata = null;

  try {
    const result = await generateTextWithLlm({
      feature: "outreach_generation",
      resume,
      outputLanguage,
      templateKey: "outreach",
      maxTokens: 1024,
    });
    content = result.content.trim();
    generationMode = "llm";
    llmMetadata = result.metadata;
  } catch (error) {
    let fallbackConfig = null;
    try {
      fallbackConfig = await resolveLlmRuntimeConfig();
    } catch {
      fallbackConfig = null;
    }
    logLlmFallback({
      feature: "outreach_generation",
      error,
      config: fallbackConfig,
      reason: getLlmFailureReason(error),
    });
    content = buildTemplateOutreach(resume, outputLanguage);
  }

  resume.outreachMessage = content;
  await resume.save();
  return {
    content,
    generation_mode: generationMode,
    llm_metadata: llmMetadata,
  };
}

export async function generateResumePdf(resumeId) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  const builderData = normalizeBuilderData(resume.builderData, resume.parsedData);
  const buffer = await renderResumePdf({
    title: resume.title || resume.filename || `resume_${String(resume._id)}`,
    parsedData: resume.parsedData,
    builderData,
  });
  return {
    buffer,
    filename: `resume_${String(resume._id)}.pdf`,
  };
}

export async function generateCoverLetterPdf(resumeId) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  const content = String(resume.coverLetter || "").trim();
  if (!content) {
    return {
      buffer: null,
      filename: `cover_letter_${String(resume._id)}.pdf`,
    };
  }

  const lines = ["Cover Letter", ...content.split(/\r?\n/).map((line) => line.trim())];
  const buffer = createSimplePdf(lines);
  return {
    buffer,
    filename: `cover_letter_${String(resume._id)}.pdf`,
  };
}

export async function downloadOriginalResumeFile(resumeId) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  const source = isStructuredData(resume.sourceFile) ? resume.sourceFile : {};
  const buffer = Buffer.isBuffer(source.data) ? source.data : null;

  if (!buffer || buffer.length === 0) {
    return {
      buffer: null,
      filename: source.filename || resume.filename || `resume_${String(resume._id)}.txt`,
      mimeType: source.mimeType || "application/octet-stream",
    };
  }

  return {
    buffer,
    filename: source.filename || resume.filename || `resume_${String(resume._id)}`,
    mimeType: source.mimeType || "application/octet-stream",
  };
}

export async function deleteResumeById(resumeId) {
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  await deleteResumeVector(resume.qdrantId);
  
  // Clean up associated applications to avoid dangling references/orphans
  try {
    const ApplicationModel = resume.constructor.db.model("Application");
    await ApplicationModel.deleteMany({ resumeId: resume._id });
  } catch (err) {
    console.error("Failed to clean up applications for deleted resume:", err);
  }

  await resume.deleteOne();
  return resume;
}
