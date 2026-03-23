import Resume from "../models/Resume.js";

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

function getWeaknessReason(lines) {
  if (lines.length === 0) {
    return "This section has no measurable bullet points yet.";
  }

  const totalChars = lines.join(" ").length;
  if (lines.length < 2 || totalChars < 120) {
    return "Description is brief and can be improved with clearer impact and outcomes.";
  }

  return "Could be improved with stronger action verbs and quantifiable impact.";
}

function buildAnalyzePayload(parsedData) {
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
      weakness_reason: getWeaknessReason(current),
    });

    questions.push({
      question_id: `q_${itemId}_impact`,
      item_id: itemId,
      question: "What measurable impact did you deliver in this role?",
      placeholder: "e.g. improved conversion by 18%, reduced latency by 40%",
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
      weakness_reason: getWeaknessReason(current),
    });

    questions.push({
      question_id: `q_${itemId}_detail`,
      item_id: itemId,
      question: "What problem did this project solve and what technologies were critical?",
      placeholder: "e.g. built X with Y, served Z users, reduced cost by ...",
    });
  });

  return {
    items_to_enrich: items,
    questions,
    analysis_summary:
      items.length > 0
        ? `Identified ${items.length} section(s) that would benefit from stronger detail.`
        : "No major enrichment opportunities found.",
  };
}

export async function analyzeResumeEnrichment(resumeId) {
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  const parsedData = getResumeData(resume);
  return buildAnalyzePayload(parsedData);
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

export async function enhanceResumeDescriptions({ resumeId, answers }) {
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

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
      const generated = answerTexts.map((text) => `Delivered impact by ${text}.`);
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
      const generated = answerTexts.map((text) => `Implemented solution that ${text}.`);
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

export async function regenerateResumeItems({ resumeId, items, instruction }) {
  const resume = await Resume.findById(resumeId);
  if (!resume) return null;

  const normalizedInstruction = String(instruction || "").trim() || "improved clarity and impact";
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
      diff_summary: `Rewrote ${newContent.length} bullet(s) based on instruction.`,
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
