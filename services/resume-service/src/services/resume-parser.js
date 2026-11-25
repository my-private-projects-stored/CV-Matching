const MONTH_RE =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?|Tháng\\s*\\d{1,2}|T\\d{1,2})";
const DATE_TOKEN_RE = `(?:${MONTH_RE}\\s+\\d{4}|\\d{1,2}/\\d{4}|\\d{4})`;
const DATE_RANGE_RE = new RegExp(
  `(${DATE_TOKEN_RE}\\s*(?:-|–|—|to|đến)\\s*(?:${DATE_TOKEN_RE}|Present|Current|Now|Hiện\\s*tại))`,
  "i"
);

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,|;]+/i;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s,|;]+/i;
const URL_RE = /(?:https?:\/\/[^\s,|;]+|www\.[^\s,|;]+)/i;
const BULLET_RE = /^[•\-*▪–◦]\s*(.+)$/;

const SECTION_ALIASES = {
  summary: "summary",
  "professional summary": "summary",
  profile: "summary",
  about: "summary",
  "about me": "summary",
  objective: "summary",
  "tóm tắt": "summary",
  "giới thiệu": "summary",
  "mục tiêu": "summary",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  employment: "experience",
  "employment history": "experience",
  "kinh nghiệm": "experience",
  "kinh nghiệm làm việc": "experience",
  education: "education",
  "academic background": "education",
  "học vấn": "education",
  "trình độ học vấn": "education",
  projects: "projects",
  "personal projects": "projects",
  "selected projects": "projects",
  "dự án": "projects",
  "dự án cá nhân": "projects",
  skills: "skills_awards",
  "technical skills": "skills_awards",
  "core skills": "skills_awards",
  "skills & awards": "skills_awards",
  "skills and awards": "skills_awards",
  additional: "skills_awards",
  "additional information": "skills_awards",
  "kỹ năng": "skills_awards",
  "kỹ năng chuyên môn": "skills_awards",
  certifications: "certifications",
  certificates: "certifications",
  "certifications & training": "certifications",
  "chứng chỉ": "certifications",
  languages: "languages",
  "ngôn ngữ": "languages",
  awards: "awards",
  "honors & awards": "awards",
  "giải thưởng": "awards",
};

function dedupe(items, limit = 50) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const normalized = String(item || "")
      .replace(/\s+/g, " ")
      .replace(/^[ \t\r\n,;|]+|[ \t\r\n,;|]+$/g, "");
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function detectSectionHeading(line) {
  const cleaned = String(line || "")
    .trim()
    .replace(/[:\-–—]+$/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return SECTION_ALIASES[cleaned] || null;
}

function splitTopLevelItems(text) {
  const items = [];
  let buf = "";
  let depth = 0;
  for (const ch of String(text || "")) {
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if ((ch === ")" || ch === "]" || ch === "}") && depth > 0) depth -= 1;

    if (depth === 0 && (ch === "," || ch === ";" || ch === "|")) {
      const token = buf.replace(/^[ \t\r\n•\-*]+|[ \t\r\n•\-*]+$/g, "");
      if (token) items.push(token);
      buf = "";
    } else {
      buf += ch;
    }
  }
  const tail = buf.replace(/^[ \t\r\n•\-*]+|[ \t\r\n•\-*]+$/g, "");
  if (tail) items.push(tail);
  return items;
}

function parsePersonalInfo(headerLines) {
  const joined = headerLines.join("\n");
  const emailMatch = joined.match(EMAIL_RE);
  const phoneMatch = joined.match(PHONE_RE);
  const linkedinMatch = joined.match(LINKEDIN_RE);
  const githubMatch = joined.match(GITHUB_RE);

  let website = "";
  const urlMatches = joined.match(new RegExp(URL_RE.source, "gi")) || [];
  for (const candidateRaw of urlMatches) {
    const candidate = candidateRaw.replace(/[.,;)]+$/, "");
    const low = candidate.toLowerCase();
    if (!low.includes("linkedin.com") && !low.includes("github.com")) {
      website = candidate;
      break;
    }
  }

  const contactLinesRemoved = [];
  const nonContactLines = [];
  for (const line of headerLines) {
    const hasContact =
      EMAIL_RE.test(line) ||
      PHONE_RE.test(line) ||
      LINKEDIN_RE.test(line) ||
      GITHUB_RE.test(line) ||
      URL_RE.test(line);
    if (!hasContact) {
      nonContactLines.push(line.trim());
    } else {
      let cleaned = line;
      for (const rx of [EMAIL_RE, PHONE_RE, LINKEDIN_RE, GITHUB_RE, URL_RE]) {
        cleaned = cleaned.replace(new RegExp(rx.source, "gi"), " ");
      }
      cleaned = cleaned
        .replace(/\s*[|•·]\s*/g, " ")
        .replace(/^[ \s,|•·]+|[ \s,|•·]+$/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (cleaned) contactLinesRemoved.push(cleaned);
    }
  }

  const name = nonContactLines[0] || "";
  const title =
    nonContactLines[1] && nonContactLines[1].length <= 80 ? nonContactLines[1] : "";
  const location = contactLinesRemoved[0] || nonContactLines[2] || "";

  return {
    name,
    title,
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0].trim() : "",
    location,
    website: website || null,
    linkedin: linkedinMatch ? linkedinMatch[0].replace(/[.,;)]+$/, "") : null,
    github: githubMatch ? githubMatch[0].replace(/[.,;)]+$/, "") : null,
  };
}

function splitCompanyLocation(line) {
  for (const sep of [" | ", " — ", " – ", " - "]) {
    if (line.includes(sep)) {
      const idx = line.indexOf(sep);
      return [line.slice(0, idx).trim(), line.slice(idx + sep.length).trim() || null];
    }
  }
  const locMatch = line.match(
    /\s+((?:(?:San|Santa|Los|Las|New|Fort|Mount|St\.?|Salt\s+Lake|El|La|North|South|East|West|Palo|Mountain|Menlo|Redwood)\s+)?[A-Z][a-z.]+,\s*[A-Z]{2}(?:\s+\d{5})?|Remote|Hybrid|Onsite|Hanoi|Ho Chi Minh(?:\s+City)?|Da Nang|Singapore|London|Tokyo)\s*$/
  );
  if (locMatch && locMatch.index > 0) {
    const company = line.slice(0, locMatch.index).replace(/[ ,|\-]+$/, "").trim();
    if (company) return [company, locMatch[1].trim()];
  }
  return [line.trim(), null];
}

function collectBullets(lines) {
  const bullets = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(BULLET_RE);
    if (m) {
      bullets.push(m[1].trim());
    } else if (bullets.length > 0) {
      bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${line}`.trim();
    } else {
      bullets.push(line);
    }
  }
  return bullets;
}

function parseExperience(lines) {
  const entries = [];
  let current = [];
  for (const line of lines) {
    if (DATE_RANGE_RE.test(line) && !BULLET_RE.test(line)) {
      if (current.length > 0) entries.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) entries.push(current);

  const parsed = [];
  entries.forEach((block, i) => {
    const header = block[0] || "";
    const dateMatch = header.match(DATE_RANGE_RE);
    const years = dateMatch ? dateMatch[1].trim() : "";
    const title = dateMatch
      ? header.replace(DATE_RANGE_RE, "").replace(/^[ |,\-–—]+|[ |,\-–—]+$/g, "")
      : header.trim();

    let company = "";
    let location = null;
    let bulletStart = 1;
    if (block.length > 1 && !BULLET_RE.test(block[1])) {
      [company, location] = splitCompanyLocation(block[1]);
      bulletStart = 2;
    }

    const description = collectBullets(block.slice(bulletStart));
    if (title || company || description.length > 0) {
      parsed.push({
        id: i + 1,
        title,
        company,
        location,
        years,
        description,
      });
    }
  });
  return parsed;
}

function parseEducation(lines) {
  const entries = [];
  let current = [];
  for (const line of lines) {
    if (DATE_RANGE_RE.test(line) && !BULLET_RE.test(line)) {
      if (current.length > 0) entries.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) entries.push(current);

  const parsed = [];
  entries.forEach((block, i) => {
    const header = block[0] || "";
    const dateMatch = header.match(DATE_RANGE_RE);
    const years = dateMatch ? dateMatch[1].trim() : "";
    const institution = dateMatch
      ? header.replace(DATE_RANGE_RE, "").replace(/^[ |,\-–—]+|[ |,\-–—]+$/g, "")
      : header.trim();
    const degree = block[1] ? block[1].trim() : "";
    const descLines = block.slice(2).map((l) => l.trim()).filter(Boolean);
    const description = descLines.length > 0 ? descLines.join(" ") : null;
    if (institution || degree) {
      parsed.push({
        id: i + 1,
        institution,
        degree,
        years,
        description,
      });
    }
  });
  return parsed;
}

function parseProjects(lines) {
  const entries = [];
  let current = [];
  for (const line of lines) {
    const isHeader =
      !BULLET_RE.test(line) &&
      (DATE_RANGE_RE.test(line) || GITHUB_RE.test(line) || URL_RE.test(line));
    if (isHeader) {
      if (current.length > 0) entries.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) entries.push(current);

  const parsed = [];
  entries.forEach((block, i) => {
    const header = block[0] || "";
    const dateMatch = header.match(DATE_RANGE_RE);
    const githubMatch = header.match(GITHUB_RE);
    const websiteMatch = githubMatch ? null : header.match(URL_RE);

    const years = dateMatch ? dateMatch[1].trim() : "";
    const github = githubMatch ? githubMatch[0].replace(/[.,;)]+$/, "") : null;
    const website = websiteMatch ? websiteMatch[0].replace(/[.,;)]+$/, "") : null;

    const name = header
      .replace(DATE_RANGE_RE, "")
      .replace(GITHUB_RE, "")
      .replace(URL_RE, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[ |,\-–—]+|[ |,\-–—]+$/g, "");

    let role = "";
    let bulletStart = 1;
    if (block.length > 1 && !BULLET_RE.test(block[1])) {
      role = block[1].trim();
      bulletStart = 2;
    }

    const description = collectBullets(block.slice(bulletStart));
    if (name || role || description.length > 0) {
      parsed.push({
        id: i + 1,
        name,
        role,
        years,
        github,
        website,
        description,
      });
    }
  });
  return parsed;
}

function parseAdditional(skillsLines, certLines, langLines, awardLines) {
  const labelRe =
    /^(technical\s+skills|skills|technologies|tools|languages|ngôn\s+ngữ|certifications(?:\s*&\s*training)?|certificates|chứng\s+chỉ|awards|honors(?:\s*&\s*awards)?|giải\s+thưởng)\s*:\s*(.*)$/i;

  let activeBucket = "technicalSkills";
  const buckets = {
    technicalSkills: [],
    languages: [],
    certificationsTraining: [],
    awards: [],
  };

  for (const line of skillsLines) {
    const m = line.match(labelRe);
    if (m) {
      const lbl = m[1].toLowerCase();
      const rest = m[2].trim();
      if (lbl.includes("language") || lbl.includes("ngôn ngữ")) {
        activeBucket = "languages";
      } else if (lbl.includes("certif") || lbl.includes("chứng chỉ")) {
        activeBucket = "certificationsTraining";
      } else if (lbl.includes("award") || lbl.includes("honor") || lbl.includes("giải thưởng")) {
        activeBucket = "awards";
      } else {
        activeBucket = "technicalSkills";
      }
      if (rest) buckets[activeBucket].push(rest);
    } else {
      buckets[activeBucket].push(line);
    }
  }

  const technicalSkills = buckets.technicalSkills.length
    ? splitTopLevelItems(buckets.technicalSkills.join(" "))
    : [];
  const languages = [
    ...(buckets.languages.length ? splitTopLevelItems(buckets.languages.join(" ")) : []),
    ...(langLines.length ? splitTopLevelItems(langLines.join(" ")) : []),
  ];
  const certificationsTraining = [
    ...(buckets.certificationsTraining.length
      ? splitTopLevelItems(buckets.certificationsTraining.join(" "))
      : []),
    ...(certLines.length ? splitTopLevelItems(certLines.join(" ")) : []),
  ];
  const awards = [
    ...(buckets.awards.length ? splitTopLevelItems(buckets.awards.join(" ")) : []),
    ...(awardLines.length ? splitTopLevelItems(awardLines.join(" ")) : []),
  ];

  return {
    technicalSkills: dedupe(technicalSkills, 50),
    languages: dedupe(languages, 20),
    certificationsTraining: dedupe(certificationsTraining, 20),
    awards: dedupe(awards, 20),
  };
}

export function parseRawTextToStructuredData(rawText = "") {
  const lines = String(rawText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const sections = {
    header: [],
    summary: [],
    experience: [],
    education: [],
    projects: [],
    skills_awards: [],
    certifications: [],
    languages: [],
    awards: [],
  };

  let currentSection = "header";
  for (const line of lines) {
    const detected = detectSectionHeading(line);
    if (detected) {
      currentSection = detected;
      continue;
    }
    sections[currentSection].push(line);
  }

  const personalInfo = parsePersonalInfo(sections.header);
  let summary = sections.summary.join(" ").trim();
  if (!summary && sections.experience.length === 0 && sections.header.length > 0) {
    summary = sections.header.slice(0, 5).join(" ").slice(0, 700);
  }

  const workExperience = parseExperience(sections.experience);
  const education = parseEducation(sections.education);
  const personalProjects = parseProjects(sections.projects);
  const additional = parseAdditional(
    sections.skills_awards,
    sections.certifications,
    sections.languages,
    sections.awards
  );

  return {
    personalInfo,
    summary,
    skills: additional.technicalSkills,
    workExperience,
    education,
    personalProjects,
    additional,
  };
}

export function hasMeaningfulStructuredData(data) {
  if (!data || typeof data !== "object") return false;
  return Boolean(
    data.personalInfo?.name ||
      data.summary ||
      (Array.isArray(data.workExperience) && data.workExperience.length > 0) ||
      (Array.isArray(data.education) && data.education.length > 0) ||
      (Array.isArray(data.personalProjects) && data.personalProjects.length > 0) ||
      (Array.isArray(data.additional?.technicalSkills) &&
        data.additional.technicalSkills.length > 0)
  );
}
