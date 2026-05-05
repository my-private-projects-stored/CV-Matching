import Resume from "../models/Resume.js";

const SUPPORTED_OUTPUT_LANGUAGES = new Set(["en", "vi"]);

function resolveOutputLanguage(language) {
  const normalized = String(language || "").trim().toLowerCase();
  if (SUPPORTED_OUTPUT_LANGUAGES.has(normalized)) {
    return normalized;
  }

  return "en";
}

function getEnrichmentCopy(language) {
  const lang = resolveOutputLanguage(language);

  if (lang === "vi") {
    return {
      weaknessEmpty: "Muc nay chua co bullet do luong ro rang.",
      weaknessBrief: "Mo ta con ngan va can bo sung ket qua cu the.",
      weaknessDefault: "Co the cai thien bang dong tu hanh dong manh va tac dong do luong duoc.",
      impactQuestion: "Ban da tao ra tac dong do luong nao trong vai tro nay?",
      impactPlaceholder: "vd: tang ty le chuyen doi 18%, giam latency 40%",
      projectQuestion: "Du an nay giai quyet van de gi va cong nghe nao quan trong?",
      projectPlaceholder: "vd: xay dung X voi Y, phuc vu Z nguoi dung, giam chi phi ...",
      analysisSummary: (count) =>
        count > 0
          ? `Phat hien ${count} muc can bo sung chi tiet.`
          : "Khong co muc can bo sung dang ke.",
      impactLine: (text) => `Tao tac dong bang viec ${text}.`,
      projectLine: (text) => `Trien khai giai phap giup ${text}.`,
      defaultInstruction: "cai thien do ro rang va tac dong",
      diffSummary: (count) => `Da viet lai ${count} bullet theo huong chi dan.`,
    };
  }

  return {
    weaknessEmpty: "This section has no measurable bullet points yet.",
    weaknessBrief: "Description is brief and can be improved with clearer impact and outcomes.",
    weaknessDefault: "Could be improved with stronger action verbs and quantifiable impact.",
    impactQuestion: "What measurable impact did you deliver in this role?",
    impactPlaceholder: "e.g. improved conversion by 18%, reduced latency by 40%",
    projectQuestion: "What problem did this project solve and what technologies were critical?",
    projectPlaceholder: "e.g. built X with Y, served Z users, reduced cost by ...",
    analysisSummary: (count) =>
      count > 0
        ? `Identified ${count} section(s) that would benefit from stronger detail.`
        : "No major enrichment opportunities found.",
    impactLine: (text) => `Delivered impact by ${text}.`,
    projectLine: (text) => `Implemented solution that ${text}.`,
    defaultInstruction: "improved clarity and impact",
    diffSummary: (count) => `Rewrote ${count} bullet(s) based on instruction.`,
  };
}

function isStructuredData(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeLines(value) {
  if (Array.isArray(value)) {
    return value
      .map((line) => String(line || "").trim())
      .filter(Boolean);
  }

  const text = String(value || "").trim();
  return text ? [text] : [];
}

function parseIndex(itemId, prefix) {
  const match = String(itemId || "").match(new RegExp(`^${prefix}_(\\d+)$`));
  if (!match) return null;

  const index = Number.parseInt(match[1], 10);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function getResumeData(resume) {
  return isStructuredData(resume?.parsedData) ? clone(resume.parsedData) : {};
}

function getWeaknessReason(lines, language) {
  const copy = getEnrichmentCopy(language);
  if (lines.length === 0) {
    return copy.weaknessEmpty;
  }

  const totalChars = lines.join(" ").length;
  if (lines.length < 2 || totalChars < 120) {
    return copy.weaknessBrief;
  }

  return copy.weaknessDefault;
}

function buildAnalyzePayload(parsedData, outputLanguage) {
  const copy = getEnrichmentCopy(outputLanguage);
  const items = [];
  const questions = [];

  const experiences = Array.isArray(parsedData.workExperience) ? parsedData.workExperience : [];
  experiences.forEach((exp, index) => {
    const current = normalizeLines(exp?.description);
    const weak = current.length < 2 || current.join(" ").length < 120;
    if (!weak) return;

    const itemId = `exp_${index}`;
    items.push({
      item_id: itemId,
      item_type: "experience",
      title: String(exp?.title || "Experience").trim() || "Experience",
      subtitle: String(exp?.company || "").trim() || undefined,
      current_description: current,
      weakness_reason: getWeaknessReason(current, outputLanguage),
    });

    questions.push({
      question_id: `q_${itemId}_impact`,
      item_id: itemId,
      question: copy.impactQuestion,
      placeholder: copy.impactPlaceholder,
    });
  });

  const projects = Array.isArray(parsedData.personalProjects) ? parsedData.personalProjects : [];
  projects.forEach((project, index) => {
    const current = normalizeLines(project?.description);
    const weak = current.length < 2 || current.join(" ").length < 120;
    if (!weak) return;

    const itemId = `proj_${index}`;
    items.push({
      item_id: itemId,
      item_type: "project",
      title: String(project?.name || "Project").trim() || "Project",
      subtitle: String(project?.role || "").trim() || undefined,
      current_description: current,
      weakness_reason: getWeaknessReason(current, outputLanguage),
    });

    questions.push({
      question_id: `q_${itemId}_detail`,
      item_id: itemId,
      question: copy.projectQuestion,
      placeholder: copy.projectPlaceholder,
    });
  });

  return {
    items_to_enrich: items,
    questions,
    analysis_summary: copy.analysisSummary(items.length),
  };
}

export async function analyzeResumeEnrichment(resumeId, outputLanguage = "en") {
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  const parsedData = getResumeData(resume);
  return buildAnalyzePayload(parsedData, outputLanguage);
}

function groupAnswersByItem(answers = []) {
  const grouped = new Map();

  for (const answer of answers) {
    const questionId = String(answer?.question_id || "").trim();
    const text = String(answer?.answer || "").trim();
    if (!questionId || !text) continue;

    const match = questionId.match(/^q_(exp_\d+|proj_\d+)_/);
    if (!match) continue;

    const itemId = match[1];
    if (!grouped.has(itemId)) {
      grouped.set(itemId, []);
    }

    grouped.get(itemId).push(text);
  }

  return grouped;
}

export async function enhanceResumeDescriptions({ resumeId, answers, outputLanguage }) {
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  const copy = getEnrichmentCopy(outputLanguage);
  const parsedData = getResumeData(resume);
  const grouped = groupAnswersByItem(answers);
  const enhancements = [];

  for (const [itemId, answerTexts] of grouped.entries()) {
    if (itemId.startsWith("exp_")) {
      const index = parseIndex(itemId, "exp");
      if (index === null) continue;
      const exp = Array.isArray(parsedData.workExperience) ? parsedData.workExperience[index] : null;
      if (!exp) continue;

      const original = normalizeLines(exp.description);
      const generated = answerTexts.map((text) => copy.impactLine(text));
      enhancements.push({
        item_id: itemId,
        item_type: "experience",
        title: String(exp.title || "Experience").trim() || "Experience",
        original_description: original,
        enhanced_description: generated,
      });
    }

    if (itemId.startsWith("proj_")) {
      const index = parseIndex(itemId, "proj");
      if (index === null) continue;
      const project = Array.isArray(parsedData.personalProjects) ? parsedData.personalProjects[index] : null;
      if (!project) continue;

      const original = normalizeLines(project.description);
      const generated = answerTexts.map((text) => copy.projectLine(text));
      enhancements.push({
        item_id: itemId,
        item_type: "project",
        title: String(project.name || "Project").trim() || "Project",
        original_description: original,
        enhanced_description: generated,
      });
    }
  }

  return { enhancements };
}

export async function applyResumeEnhancements(resumeId, enhancements = []) {
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  const parsedData = getResumeData(resume);

  for (const enhancement of enhancements) {
    const itemType = String(enhancement?.item_type || "");
    const itemId = String(enhancement?.item_id || "");
    const addedBullets = normalizeLines(enhancement?.enhanced_description);

    if (itemType === "experience") {
      const index = parseIndex(itemId, "exp");
      if (index === null || !Array.isArray(parsedData.workExperience) || !parsedData.workExperience[index]) {
        continue;
      }

      const existing = normalizeLines(parsedData.workExperience[index].description);
      parsedData.workExperience[index].description = [...existing, ...addedBullets];
    }

    if (itemType === "project") {
      const index = parseIndex(itemId, "proj");
      if (
        index === null ||
        !Array.isArray(parsedData.personalProjects) ||
        !parsedData.personalProjects[index]
      ) {
        continue;
      }

      const existing = normalizeLines(parsedData.personalProjects[index].description);
      parsedData.personalProjects[index].description = [...existing, ...addedBullets];
    }
  }

  resume.parsedData = parsedData;
  await resume.save();

  return {
    message: "Enhancements applied successfully",
    updated_items: enhancements.length,
  };
}

function rewriteBullet(line, instruction) {
  const base = String(line || "").trim();
  if (!base) return "";

  return `${base} (${instruction})`;
}

export async function regenerateResumeItems({ resumeId, items, instruction, outputLanguage }) {
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  const copy = getEnrichmentCopy(outputLanguage);
  const normalizedInstruction = String(instruction || "").trim() || copy.defaultInstruction;
  const regeneratedItems = [];
  const errors = [];

  for (const item of Array.isArray(items) ? items : []) {
    const itemType = String(item?.item_type || "");
    const itemId = String(item?.item_id || "");
    const current = normalizeLines(item?.current_content);

    if (!itemId || !itemType || current.length === 0) {
      errors.push({
        item_id: itemId || "unknown",
        item_type: itemType || "experience",
        title: String(item?.title || "Item").trim() || "Item",
        subtitle: String(item?.subtitle || "").trim() || undefined,
        message: "Failed to regenerate this item. Please try again.",
      });
      continue;
    }

    const newContent = current.map((line) => rewriteBullet(line, normalizedInstruction)).filter(Boolean);
    regeneratedItems.push({
      item_id: itemId,
      item_type: itemType,
      title: String(item?.title || "Item").trim() || "Item",
      subtitle: String(item?.subtitle || "").trim() || undefined,
      original_content: current,
      new_content: newContent,
      diff_summary: copy.diffSummary(newContent.length),
    });
  }

  if (regeneratedItems.length === 0) {
    return {
      regenerated_items: [],
      errors,
    };
  }

  return {
    regenerated_items: regeneratedItems,
    errors,
  };
}

export async function applyRegeneratedResumeItems(resumeId, regeneratedItems = []) {
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  const parsedData = getResumeData(resume);

  for (const item of regeneratedItems) {
    const itemType = String(item?.item_type || "");
    const itemId = String(item?.item_id || "");
    const newContent = normalizeLines(item?.new_content);

    if (itemType === "experience") {
      const index = parseIndex(itemId, "exp");
      if (index === null || !Array.isArray(parsedData.workExperience) || !parsedData.workExperience[index]) {
        continue;
      }

      parsedData.workExperience[index].description = newContent;
    }

    if (itemType === "project") {
      const index = parseIndex(itemId, "proj");
      if (
        index === null ||
        !Array.isArray(parsedData.personalProjects) ||
        !parsedData.personalProjects[index]
      ) {
        continue;
      }

      parsedData.personalProjects[index].description = newContent;
    }

    if (itemType === "skills") {
      if (!isStructuredData(parsedData.additional)) {
        parsedData.additional = {};
      }
      parsedData.additional.technicalSkills = newContent;
    }
  }

  resume.parsedData = parsedData;
  await resume.save();

  return {
    message: "Regenerated content applied successfully",
    updated_items: regeneratedItems.length,
  };
}
