import Job from "../models/Job.js";
import Resume from "../models/Resume.js";
import { getPromptConfig, resolveLlmRuntimeConfig } from "./config.service.js";
import { detectLanguageOfResume } from "../utils/language-detector.js";
import { completeJson, getLlmFailureReason, logLlmFallback } from "./llm.service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeLines(value) {
  if (Array.isArray(value)) {
    return value.map((l) => normalizeText(l)).filter(Boolean);
  }
  const text = normalizeText(value);
  return text ? [text] : [];
}

function resolveLanguage(value) {
  const supported = new Set(["en", "vi", "auto"]);
  const normalized = normalizeText(value).toLowerCase();
  return supported.has(normalized) ? normalized : "en";
}

function safeSlice(arr, n) {
  return Array.isArray(arr) ? arr.slice(0, n) : [];
}

function renderTemplate(template = "", values = {}) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) =>
    values[key] === undefined || values[key] === null ? "" : String(values[key])
  );
}

function outputLanguageName(language) {
  return language === "vi" ? "Vietnamese" : "English";
}

function buildJobContext(job) {
  if (!job) return "";
  return [job.title, job.description, job.requirements, job.benefits, job.cleanText]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function countQuestions(questionGroups = []) {
  return questionGroups.reduce((sum, group) => {
    const questions = Array.isArray(group?.questions) ? group.questions : [];
    return sum + questions.length;
  }, 0);
}

/**
 * Normalize LLM question_groups output into the canonical shape.
 * Handles several common LLM output variants:
 *   1. Standard: [{group, label, description, questions:[{question,...}]}]
 *   2. Alias "groups" instead of "question_groups"
 *   3. Flat questions array with a "category" field: [{question, category}]
 *   4. Object-by-category: {technical:[...], behavioral:[...]}
 *   5. Each item may use "text" instead of "question"
 */
function normalizeQuestionGroups(value, language) {
  let raw = value;

  // Variant: object keyed by category name (e.g. {technical:[...], behavioral:[...]})
  if (raw && !Array.isArray(raw) && typeof raw === "object") {
    raw = Object.entries(raw).map(([key, val]) => ({
      group: key,
      label: key,
      questions: Array.isArray(val) ? val : [],
    }));
  }

  const groups = Array.isArray(raw) ? raw : [];

  // Variant: flat list of questions (no group nesting) — group by category
  if (groups.length > 0 && groups[0] && !Array.isArray(groups[0]?.questions) && (groups[0]?.question || groups[0]?.text)) {
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
      const groupName = normalizeText(group?.group || group?.category || group?.name || `group_${groupIndex + 1}`);
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
            context: item?.context || undefined,
          }))
          .filter((item) => item.question),
      };
    })
    .filter((group) => group.questions.length)
    .slice(0, 8)
    .map((group) => ({
      ...group,
      label: group.label || (language === "vi" ? "Câu hỏi" : "Questions"),
    }));
}

/**
 * Extract question_groups from various LLM response shapes.
 * Tries "question_groups", "groups", then the root object itself.
 */
function extractQuestionGroups(data) {
  if (!data || typeof data !== "object") return null;
  if (Array.isArray(data.question_groups)) return data.question_groups;
  if (Array.isArray(data.groups)) return data.groups;
  if (Array.isArray(data.questions)) return data.questions; // flat
  // Object-by-category: {technical: [...], behavioral: [...]}
  const keys = Object.keys(data);
  if (keys.length > 0 && keys.every((k) => Array.isArray(data[k]))) return data;
  return null;
}

async function buildInterviewWithLlm({ resume, job, language, candidateName, candidateTitle }) {
  const [runtimeConfig, promptConfig] = await Promise.all([
    resolveLlmRuntimeConfig(),
    getPromptConfig(),
  ]);
  const truthfulnessBlock = Array.isArray(promptConfig.truthfulness_rules) && promptConfig.truthfulness_rules.length
    ? `\n\nTruthfulness rules:\n${promptConfig.truthfulness_rules.map((r) => `- ${r}`).join("\n")}`
    : "";
    
  let resolvedLang = language;
  if (resolvedLang === "auto") {
    resolvedLang = detectLanguageOfResume(resume.parsedData);
  }

  let prompt = renderTemplate(promptConfig.templates?.interview, {
    output_language: outputLanguageName(resolvedLang),
    job_description: buildJobContext(job),
    resume_json: JSON.stringify(resume.parsedData || {}, null, 2),
  }) + truthfulnessBlock;

  // Add explicit language enforcement directive for LLM stability (especially local models)
  if (resolvedLang === "vi") {
    prompt += "\n\nCRITICAL: All text content in the JSON output, including all \"label\", \"description\", and \"question\" fields, MUST be written in Vietnamese. Do NOT use English.";
  } else if (resolvedLang === "en") {
    prompt += "\n\nCRITICAL: All text content in the JSON output, including all \"label\", \"description\", and \"question\" fields, MUST be written in English. Do NOT use Vietnamese.";
  }

  const result = await completeJson({
    feature: "interview_questions",
    prompt,
    systemPrompt:
      "You are a structured interview designer. Generate specific, job-relevant questions. " +
      "Return ONLY a JSON object with the key \"question_groups\". " +
      "Each group must have: group (string), label (string), description (string), questions (array). " +
      "Each question must have: id (string), category (string), question (string). " +
      "Do not add any text outside the JSON object.",
    maxTokens: 4096,
    retries: 1,
    config: runtimeConfig,
  });

  // Try to extract question_groups from various shapes the LLM might return
  const rawGroups = extractQuestionGroups(result.data);
  const questionGroups = normalizeQuestionGroups(rawGroups, language);

  if (!questionGroups.length) {
    const error = new Error("LLM returned no usable interview questions after normalization");
    error.code = "invalid_json";
    throw error;
  }

  return {
    data: {
      resume_id: String(resume._id),
      job_id: job ? String(job._id) : null,
      job_title: job ? normalizeText(job.title) : null,
      candidate_name: candidateName,
      candidate_title: candidateTitle,
      language,
      generated_at: new Date().toISOString(),
      question_groups: questionGroups,
      total_questions: countQuestions(questionGroups),
      generation_mode: "llm",
      llm_metadata: result.metadata,
    },
  };
}

// ---------------------------------------------------------------------------
// Question templates — bilingual (English + Vietnamese)
// ---------------------------------------------------------------------------

const TEMPLATES = {
  en: {
    technical: {
      skill: (skill) => `Can you walk me through a project where you applied ${skill}?`,
      depth: (skill) => `What are the most common challenges you have encountered when working with ${skill}, and how did you resolve them?`,
      comparison: (s1, s2) => `How would you compare ${s1} and ${s2}? When would you choose one over the other?`,
      generic: "Describe a complex technical problem you solved recently. What was your approach?",
    },
    experience: {
      impact: (title, company) =>
        `At ${company}, as a ${title}, what was the most impactful project you delivered and how did you measure success?`,
      challenge: (title) =>
        `What was the biggest challenge you faced as a ${title} and how did you overcome it?`,
      growth: (title) =>
        `How did your responsibilities evolve during your time as a ${title}?`,
    },
    behavioral: {
      conflict: "Tell me about a time you had a disagreement with a teammate. How did you handle it?",
      deadline: "Describe a situation where you had to deliver under a very tight deadline. What did you do?",
      initiative:
        "Give me an example of when you took initiative on a project that wasn't explicitly asked of you.",
      feedback:
        "How do you respond when you receive critical feedback about your work?",
      leadership:
        "Tell me about a time you led a team or mentored a junior colleague.",
    },
    project: {
      overview: (name) =>
        `Can you give a high-level overview of the ${name} project and your specific contribution?`,
      technical: (name) =>
        `What technical decisions did you make during ${name}, and would you change any of them in hindsight?`,
      impact: (name) =>
        `What measurable outcomes came from the ${name} project?`,
    },
    closing: {
      motivation:
        "What attracted you to this role, and how does it align with your career goals?",
      strength: "What do you consider your greatest professional strength relevant to this position?",
      question: "Do you have any questions for us about the role or the team?",
    },
  },

  vi: {
    technical: {
      skill: (skill) =>
        `Bạn có thể mô tả một dự án cụ thể mà bạn đã sử dụng ${skill} không?`,
      depth: (skill) =>
        `Những thách thức phổ biến nhất khi làm việc với ${skill} là gì, và bạn đã giải quyết như thế nào?`,
      comparison: (s1, s2) =>
        `Bạn so sánh ${s1} và ${s2} như thế nào? Khi nào bạn chọn cái này thay vì cái kia?`,
      generic:
        "Hãy mô tả một vấn đề kỹ thuật phức tạp bạn đã giải quyết gần đây và cách bạn xử lý nó.",
    },
    experience: {
      impact: (title, company) =>
        `Tại ${company}, với vai trò ${title}, dự án có tác động lớn nhất của bạn là gì và bạn đo lường thành công như thế nào?`,
      challenge: (title) =>
        `Thách thức lớn nhất khi làm việc ở vị trí ${title} là gì và bạn vượt qua nó như thế nào?`,
      growth: (title) =>
        `Trách nhiệm của bạn thay đổi như thế nào trong quá trình làm ${title}?`,
    },
    behavioral: {
      conflict:
        "Hãy kể về một lần bạn có bất đồng với đồng nghiệp. Bạn xử lý tình huống đó như thế nào?",
      deadline:
        "Mô tả một tình huống bạn phải hoàn thành công việc trong thời hạn rất gấp. Bạn đã làm gì?",
      initiative:
        "Cho tôi một ví dụ khi bạn chủ động thực hiện một việc gì đó mà không ai yêu cầu.",
      feedback:
        "Bạn phản ứng như thế nào khi nhận được phản hồi tiêu cực về công việc của mình?",
      leadership:
        "Hãy kể về lần bạn dẫn dắt nhóm hoặc hướng dẫn một đồng nghiệp trẻ.",
    },
    project: {
      overview: (name) =>
        `Bạn có thể tóm tắt tổng quan về dự án ${name} và đóng góp cụ thể của bạn không?`,
      technical: (name) =>
        `Những quyết định kỹ thuật nào bạn đã đưa ra trong dự án ${name}, và bạn có thay đổi gì nếu làm lại không?`,
      impact: (name) =>
        `Những kết quả đo lường được nào từ dự án ${name}?`,
    },
    closing: {
      motivation:
        "Điều gì thu hút bạn đến với vị trí này, và nó phù hợp với mục tiêu nghề nghiệp của bạn như thế nào?",
      strength:
        "Bạn coi điểm mạnh nghề nghiệp lớn nhất của bạn liên quan đến vị trí này là gì?",
      question:
        "Bạn có câu hỏi nào về vị trí hoặc nhóm làm việc không?",
    },
  },
};

function getTemplate(language) {
  return TEMPLATES[language] || TEMPLATES.en;
}

// ---------------------------------------------------------------------------
// Question builders
// ---------------------------------------------------------------------------

function buildTechnicalQuestions(skills = [], language) {
  const t = getTemplate(language).technical;
  const questions = [];

  const topSkills = safeSlice(skills, 6);
  for (let i = 0; i < topSkills.length; i++) {
    const skill = normalizeText(topSkills[i]);
    if (!skill) continue;
    if (i === 0) {
      questions.push({
        id: `tech_depth_${i}`,
        category: "technical",
        question: t.depth(skill),
        focus_skill: skill,
      });
    } else {
      questions.push({
        id: `tech_skill_${i}`,
        category: "technical",
        question: t.skill(skill),
        focus_skill: skill,
      });
    }
  }

  // Add a comparison question if we have 2+ skills
  if (topSkills.length >= 2) {
    questions.push({
      id: "tech_comparison",
      category: "technical",
      question: t.comparison(normalizeText(topSkills[0]), normalizeText(topSkills[1])),
      focus_skill: null,
    });
  }

  if (questions.length === 0) {
    questions.push({
      id: "tech_generic",
      category: "technical",
      question: t.generic,
      focus_skill: null,
    });
  }

  return questions;
}

function buildExperienceQuestions(workExperience = [], language) {
  const t = getTemplate(language).experience;
  const questions = [];

  const topExp = safeSlice(workExperience, 2);
  for (let i = 0; i < topExp.length; i++) {
    const exp = topExp[i];
    const title = normalizeText(exp?.title || "this role");
    const company = normalizeText(exp?.company || "your previous company");

    if (i === 0) {
      questions.push({
        id: `exp_impact_${i}`,
        category: "experience",
        question: t.impact(title, company),
        context: { title, company },
      });
    }
    questions.push({
      id: `exp_challenge_${i}`,
      category: "experience",
      question: t.challenge(title),
      context: { title, company },
    });
  }

  return questions;
}

function buildProjectQuestions(projects = [], language) {
  const t = getTemplate(language).project;
  const questions = [];

  const topProjects = safeSlice(projects, 2);
  for (let i = 0; i < topProjects.length; i++) {
    const proj = topProjects[i];
    const name = normalizeText(proj?.name || `project ${i + 1}`);
    questions.push({
      id: `proj_overview_${i}`,
      category: "project",
      question: t.overview(name),
      context: { project_name: name },
    });
    questions.push({
      id: `proj_impact_${i}`,
      category: "project",
      question: t.impact(name),
      context: { project_name: name },
    });
  }

  return questions;
}

function buildBehavioralQuestions(language) {
  const t = getTemplate(language).behavioral;
  return [
    { id: "beh_conflict", category: "behavioral", question: t.conflict },
    { id: "beh_deadline", category: "behavioral", question: t.deadline },
    { id: "beh_initiative", category: "behavioral", question: t.initiative },
    { id: "beh_feedback", category: "behavioral", question: t.feedback },
    { id: "beh_leadership", category: "behavioral", question: t.leadership },
  ];
}

function buildClosingQuestions(language) {
  const t = getTemplate(language).closing;
  return [
    { id: "close_motivation", category: "closing", question: t.motivation },
    { id: "close_strength", category: "closing", question: t.strength },
    { id: "close_question", category: "closing", question: t.question },
  ];
}

// ---------------------------------------------------------------------------
// Main export: generateInterviewQuestions
// ---------------------------------------------------------------------------

/**
 * Generate a structured set of interview questions based on a candidate's
 * resume and a job description.
 *
 * @param {string} resumeId - MongoDB ID of the resume
 * @param {string} jobId    - MongoDB ID of the job (optional)
 * @param {object} options  - { language }
 */
export async function generateInterviewQuestions(resumeId, jobId, options = {}) {
  const resume = await Resume.findById(resumeId).lean();
  if (!resume) {
    return { error: "Resume not found", code: 404 };
  }

  let job = null;
  if (jobId) {
    job = await Job.findById(jobId).lean();
    // Job not found is non-fatal — we generate generic questions from CV only
  }

  const language = resolveLanguage(options.language || "en");
  const parsedData = resume.parsedData || {};

  // Extract data from CV
  const skills = Array.isArray(parsedData.skills) ? parsedData.skills : [];
  const workExperience = Array.isArray(parsedData.workExperience)
    ? parsedData.workExperience
    : [];
  const projects = Array.isArray(parsedData.personalProjects)
    ? parsedData.personalProjects
    : [];

  // If job is provided, merge job's required skills into focus list
  let focusSkills = [...skills];
  if (job) {
    const jobText = [job.description, job.requirements].filter(Boolean).join(" ");
    const jobTokens = jobText.toLowerCase().match(/[a-z0-9+#.]{3,}/g) || [];
    const stopwords = new Set(["and", "the", "for", "are", "with", "you", "will", "this", "that", "have"]);
    const jobKeywords = [...new Set(jobTokens.filter((t) => !stopwords.has(t)))].slice(0, 20);
    // Prioritize skills that appear in JD
    const resumeSkillSet = new Set(skills.map((s) => s.toLowerCase()));
    const jdMatchedSkills = jobKeywords.filter((k) => resumeSkillSet.has(k));
    focusSkills = [
      ...jdMatchedSkills,
      ...skills.filter((s) => !jdMatchedSkills.includes(s.toLowerCase())),
    ];
  }

  const candidateName =
    normalizeText(parsedData.personalInfo?.fullName) ||
    normalizeText(parsedData.personalInfo?.name) ||
    "the candidate";
  const candidateTitle =
    normalizeText(parsedData.personalInfo?.title) ||
    normalizeText(workExperience[0]?.title) ||
    "";

  try {
    return await buildInterviewWithLlm({
      resume,
      job,
      language,
      candidateName,
      candidateTitle,
    });
  } catch (error) {
    let fallbackConfig = null;
    try {
      fallbackConfig = await resolveLlmRuntimeConfig();
    } catch {
      fallbackConfig = null;
    }
    logLlmFallback({
      feature: "interview_questions",
      error,
      config: fallbackConfig,
      reason: getLlmFailureReason(error),
    });
  }

  // Build question groups
  const technicalQuestions = buildTechnicalQuestions(focusSkills, language);
  const experienceQuestions = buildExperienceQuestions(workExperience, language);
  const projectQuestions = buildProjectQuestions(projects, language);
  // Select 3 behavioral questions randomly (deterministic shuffle by skill count)
  const allBehavioral = buildBehavioralQuestions(language);
  const behavioralQuestions = allBehavioral.slice(0, 3);
  const closingQuestions = buildClosingQuestions(language);

  return {
    data: {
      resume_id: String(resume._id),
      job_id: job ? String(job._id) : null,
      job_title: job ? normalizeText(job.title) : null,
      candidate_name: candidateName,
      candidate_title: candidateTitle,
      language,
      generated_at: new Date().toISOString(),
      question_groups: [
        {
          group: "technical",
          label: language === "vi" ? "Kỹ thuật & chuyên môn" : "Technical & Domain Knowledge",
          description:
            language === "vi"
              ? "Câu hỏi đánh giá kỹ năng kỹ thuật và độ sâu chuyên môn từ CV ứng viên"
              : "Questions assessing technical skills and domain depth from the candidate's CV",
          questions: technicalQuestions,
        },
        {
          group: "experience",
          label: language === "vi" ? "Kinh nghiệm làm việc" : "Work Experience",
          description:
            language === "vi"
              ? "Câu hỏi khai thác các vai trò và thành tích cụ thể"
              : "Questions exploring specific roles, responsibilities and achievements",
          questions: experienceQuestions,
        },
        {
          group: "project",
          label: language === "vi" ? "Dự án cá nhân" : "Projects",
          description:
            language === "vi"
              ? "Câu hỏi về các dự án đã thực hiện"
              : "Questions about projects built or contributed to",
          questions: projectQuestions,
        },
        {
          group: "behavioral",
          label: language === "vi" ? "Hành vi & tư duy" : "Behavioral & Mindset",
          description:
            language === "vi"
              ? "Câu hỏi đánh giá tư duy giải quyết vấn đề và cộng tác"
              : "Questions evaluating problem-solving mindset, teamwork, and soft skills",
          questions: behavioralQuestions,
        },
        {
          group: "closing",
          label: language === "vi" ? "Câu hỏi kết thúc" : "Closing Questions",
          description:
            language === "vi"
              ? "Câu hỏi kết thúc phỏng vấn và đánh giá motivation"
              : "Wrap-up questions to assess motivation and cultural fit",
          questions: closingQuestions,
        },
      ],
      total_questions:
        technicalQuestions.length +
        experienceQuestions.length +
        projectQuestions.length +
        behavioralQuestions.length +
        closingQuestions.length,
      generation_mode: "template_fallback",
      llm_metadata: null,
    },
  };
}
