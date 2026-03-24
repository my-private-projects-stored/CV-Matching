import Resume from "../models/Resume.js";
import Job from "../models/Job.js";
import { ensureQdrantId } from "../utils/qdrant-id.js";
import { createSimplePdf } from "../utils/simple-pdf.js";
import { generateEmbedding } from "./embedding.service.js";
import { deleteResumeVector, upsertResumeVector } from "./vector-index.service.js";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const DEFAULT_CANDIDATE_ID = "000000000000000000000001";
const ALLOWED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const JOB_KEYWORD_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "with",
  "you",
  "your",
  "will",
]);
const SUPPORTED_OUTPUT_LANGUAGES = new Set(["en", "vi"]);

function shouldRegenerateResumeEmbedding(payload = {}) {
  return ["rawText", "parsedData"].some((key) => key in payload);
}

function extractResumeEmbeddingText(resume) {
  if (resume.rawText && String(resume.rawText).trim()) {
    return String(resume.rawText);
  }

  return JSON.stringify(resume.parsedData || {});
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

function extractJobKeywords(content, limit = 10) {
  const words = String(content || "")
    .toLowerCase()
    .match(/[a-z0-9+#.]{3,}/g);

  if (!Array.isArray(words)) {
    return [];
  }

  const scores = new Map();
  for (const word of words) {
    if (JOB_KEYWORD_STOPWORDS.has(word)) continue;
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

function applyJobImprovements(basePreview, jobText) {
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
  const summaryAddon = shortKeywords
    ? `Targeted for this role with emphasis on ${shortKeywords}.`
    : "Tailored for this role with measurable and relevant impact.";

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

function buildImprovementSuggestions(keywords = []) {
  if (!keywords.length) {
    return [
      {
        suggestion: "Refine resume summary to better mirror the job description outcomes.",
        lineNumber: null,
      },
    ];
  }

  return keywords.slice(0, 5).map((keyword, index) => ({
    suggestion: `Highlight ${toDisplayKeyword(keyword)} in work experience bullets where relevant.`,
    lineNumber: index + 1,
  }));
}

async function getResumeAndJob(resumeId, jobId) {
  const [resume, job] = await Promise.all([getResumeByPublicId(resumeId), getJobByPublicId(jobId)]);
  return { resume, job };
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
    cover_letter: resume.coverLetter ?? null,
    outreach_message: resume.outreachMessage ?? null,
    parent_id: resume.parentResumeId ? String(resume.parentResumeId) : null,
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
    processing_status: deriveProcessingStatus(resume),
    created_at: toIsoDate(resume.createdAt),
    updated_at: toIsoDate(resume.updatedAt),
    title: resume.title ?? null,
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
    vector = await generateEmbedding(extractResumeEmbeddingText(saved));
  }

  if (Array.isArray(vector) && vector.length > 0) {
    await upsertResumeVector({
      qdrantId: saved.qdrantId,
      vector,
      payload: {
        mongoId: String(saved._id),
        candidateId: String(saved.candidateId),
        isAnalyzed: saved.isAnalyzed,
      },
    });

    saved.isAnalyzed = true;
    await saved.save();
  }

  return saved;
}

export async function createResumeFromUpload(file, candidateId = DEFAULT_CANDIDATE_ID) {
  if (!file) {
    const error = new Error("Missing uploaded file");
    error.statusCode = 400;
    throw error;
  }

  const mimeType = String(file.mimetype || "").toLowerCase();
  if (!ALLOWED_UPLOAD_TYPES.has(mimeType)) {
    const error = new Error(`Invalid file type: ${mimeType || "unknown"}`);
    error.statusCode = 400;
    throw error;
  }

  const size = Number(file.size || 0);
  if (size <= 0 || !file.buffer) {
    const error = new Error("Empty file");
    error.statusCode = 400;
    throw error;
  }

  if (size > MAX_UPLOAD_BYTES) {
    const error = new Error("File too large. Maximum size is 4MB");
    error.statusCode = 413;
    throw error;
  }

  const rawText = toUploadText(file.buffer);
  if (!rawText) {
    const error = new Error("Unable to extract textual content from file");
    error.statusCode = 422;
    throw error;
  }

  const hasMaster = await Resume.exists({ isMaster: true });
  const created = await createResume({
    candidateId,
    fileUrl: `upload://${Date.now()}-${file.originalname || "resume"}`,
    rawText,
    parsedData: null,
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

  created.processingStatus = created.isAnalyzed ? "ready" : "failed";
  await created.save();

  return {
    message:
      created.processingStatus === "ready"
        ? `File ${file.originalname || "resume"} uploaded successfully`
        : `File ${file.originalname || "resume"} uploaded but parsing failed`,
    resume_id: String(created._id),
    processing_status: deriveProcessingStatus(created),
    is_master: Boolean(created.isMaster),
  };
}

// Cap nhat CV va bo sung qdrantId neu du lieu cu chua co.
export async function updateResumeById(resumeId, payload) {
  const { embeddingVector, ...resumeData } = payload;
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  Object.assign(resume, resumeData);
  ensureQdrantId(resume);
  const saved = await resume.save();
  const mustRegenerate = shouldRegenerateResumeEmbedding(resumeData);

  let vector = embeddingVector;
  if ((!Array.isArray(vector) || vector.length === 0) && mustRegenerate) {
    vector = await generateEmbedding(extractResumeEmbeddingText(saved));
  }

  if (Array.isArray(vector) && vector.length > 0) {
    await upsertResumeVector({
      qdrantId: saved.qdrantId,
      vector,
      payload: {
        mongoId: String(saved._id),
        candidateId: String(saved.candidateId),
        isAnalyzed: saved.isAnalyzed,
      },
    });

    saved.isAnalyzed = true;
    await saved.save();
  }

  return saved;
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

export async function previewResumeImprovement(resumeId, jobId) {
  const { resume, job } = await getResumeAndJob(resumeId, jobId);
  if (!resume || !job) {
    return null;
  }

  const jobText = String(job.description || job.cleanText || job.requirements || "").trim();
  const originalPreview = toResumePreviewData(resume.parsedData);
  const { improved, keywords, addedSkills } = applyJobImprovements(originalPreview, jobText);
  const { diffSummary, detailedChanges } = buildDiffAndChanges(originalPreview, improved, addedSkills);
  const improvements = buildImprovementSuggestions(keywords);
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
  });
}

export async function confirmResumeImprovement({
  resumeId,
  jobId,
  improvedData,
  improvements,
}) {
  const { resume, job } = await getResumeAndJob(resumeId, jobId);
  if (!resume || !job) {
    return null;
  }

  const safePreview = toResumePreviewData(improvedData);
  const parentPreview = toResumePreviewData(resume.parsedData);
  const parentFilename = String(resume.filename || "resume").trim() || "resume";
  const jobText = String(job.description || job.cleanText || job.requirements || "").trim();
  const title = [safePreview.personalInfo?.title, job.title].filter(Boolean).join(" - ").slice(0, 120);
  const { diffSummary, detailedChanges } = buildDiffAndChanges(parentPreview, safePreview, []);

  const tailored = await Resume.create({
    candidateId: resume.candidateId || DEFAULT_CANDIDATE_ID,
    fileUrl: `tailored://${Date.now()}-${parentFilename}`,
    rawText: JSON.stringify(safePreview, null, 2),
    parsedData: safePreview,
    filename: `tailored_${parentFilename}`,
    title: title || `Tailored ${parentFilename}`,
    isMaster: false,
    parentResumeId: resume._id,
    processingStatus: "ready",
    jobDescription: jobText,
    jobId: String(job._id),
    isAnalyzed: false,
  });

  const requestId = makeRequestId();
  const normalizedImprovements = Array.isArray(improvements)
    ? improvements.map((item) => ({
        suggestion: String(item?.suggestion || "").trim() || "Refined resume content for target role.",
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
  });
}

export async function improveResume(resumeId, jobId) {
  const preview = await previewResumeImprovement(resumeId, jobId);
  if (!preview) {
    return null;
  }

  return confirmResumeImprovement({
    resumeId,
    jobId,
    improvedData: preview.data.resume_preview,
    improvements: preview.data.improvements,
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

export async function generateCoverLetterContent(resumeId, outputLanguage = "en") {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

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

  const content = [intro, contextLine, impact, closing].join("\n\n");
  resume.coverLetter = content;
  await resume.save();
  return content;
}

export async function generateOutreachContent(resumeId, outputLanguage = "en") {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

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

  const content = [line1, line2, line3, line4].join(" ");
  resume.outreachMessage = content;
  await resume.save();
  return content;
}

export async function generateResumePdf(resumeId) {
  const resume = await getResumeByPublicId(resumeId);
  if (!resume) return null;

  const lines = collectResumePdfLines(resume);
  const buffer = createSimplePdf(lines);
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
  await resume.deleteOne();
  return resume;
}
