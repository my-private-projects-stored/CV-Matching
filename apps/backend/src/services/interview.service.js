import Job from "../models/Job.js";
import Resume from "../models/Resume.js";

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
  const supported = new Set(["en", "vi"]);
  const normalized = normalizeText(value).toLowerCase();
  return supported.has(normalized) ? normalized : "en";
}

function safeSlice(arr, n) {
  return Array.isArray(arr) ? arr.slice(0, n) : [];
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
        `Ban co the mo ta mot du an cu the ma ban da su dung ${skill} khong?`,
      depth: (skill) =>
        `Nhung thach thuc pho bien nhat khi lam viec voi ${skill} la gi, va ban da giai quyet nhu the nao?`,
      comparison: (s1, s2) =>
        `Ban so sanh ${s1} va ${s2} nhu the nao? Khi nao ban chon cai nay thay vi cai kia?`,
      generic:
        "Hay mo ta mot van de ky thuat phuc tap ban da giai quyet gan day va cach ban xu ly no.",
    },
    experience: {
      impact: (title, company) =>
        `Tai ${company}, voi vai tro ${title}, du an co tac dong lon nhat cua ban la gi va ban do luong thanh cong nhu the nao?`,
      challenge: (title) =>
        `Thach thuc lon nhat khi lam viec voi vi tri ${title} la gi va ban vuot qua no nhu the nao?`,
      growth: (title) =>
        `Trach nhiem cua ban thay doi nhu the nao trong qua trinh lam ${title}?`,
    },
    behavioral: {
      conflict:
        "Hay ke ve mot lan ban co bat dong voi dong nghiep. Ban xu ly tinh huong do nhu the nao?",
      deadline:
        "Mo ta mot tinh huong ban phai hoan thanh cong viec trong thoi han rat gap. Ban da lam gi?",
      initiative:
        "Cho toi mot vi du khi ban chu dong thuc hien mot viec gi do ma khong ai yeu cau.",
      feedback:
        "Ban phan ung nhu the nao khi nhan duoc phan hoi tieu cuc ve cong viec cua minh?",
      leadership:
        "Hay ke ve lan ban dan dat nhom hoac huong dan mot dong nghiep tre.",
    },
    project: {
      overview: (name) =>
        `Ban co the tom tat tong quan ve du an ${name} va dong gop cu the cua ban khong?`,
      technical: (name) =>
        `Nhung quyet dinh ky thuat nao ban da dua ra trong du an ${name}, va ban co thay doi gi neu lam lai khong?`,
      impact: (name) =>
        `Nhung ket qua do luong duoc nao tu du an ${name}?`,
    },
    closing: {
      motivation:
        "Dieu gi thu hut ban den voi vi tri nay, va no phu hop voi muc tieu nghe nghiep cua ban nhu the nao?",
      strength:
        "Ban coi diem manh nghe nghiep lon nhat cua ban lien quan den vi tri nay la gi?",
      question:
        "Ban co cau hoi nao ve vi tri hoay nhom lam viec khong?",
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

  // Build question groups
  const technicalQuestions = buildTechnicalQuestions(focusSkills, language);
  const experienceQuestions = buildExperienceQuestions(workExperience, language);
  const projectQuestions = buildProjectQuestions(projects, language);
  // Select 3 behavioral questions randomly (deterministic shuffle by skill count)
  const allBehavioral = buildBehavioralQuestions(language);
  const behavioralQuestions = allBehavioral.slice(0, 3);
  const closingQuestions = buildClosingQuestions(language);

  const candidateName =
    normalizeText(parsedData.personalInfo?.fullName) || "the candidate";
  const candidateTitle =
    normalizeText(parsedData.personalInfo?.title) ||
    normalizeText(workExperience[0]?.title) ||
    "";

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
    },
  };
}
