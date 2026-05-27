import { completeJson } from "./llm.service.js";
import { resolveLlmRuntimeConfig } from "./config.service.js";

const PARSE_RESUME_PROMPT = `Parse this resume into JSON. Output ONLY the JSON object, no other text.

Map content to standard sections when possible. For non-standard sections (like Publications, Volunteer Work, Research, Hobbies), add them to customSections with an appropriate type.

Example output format:
{
  "personalInfo": {
    "name": "John Doe",
    "title": "Software Engineer",
    "email": "john@example.com",
    "phone": "+1-555-0100",
    "location": "San Francisco, CA",
    "website": "https://johndoe.dev",
    "linkedin": "linkedin.com/in/johndoe",
    "github": "github.com/johndoe"
  },
  "summary": "Experienced software engineer with 5+ years...",
  "workExperience": [
    {
      "title": "Senior Software Engineer",
      "company": "Tech Corp",
      "location": "San Francisco, CA",
      "years": "Jan 2020 - Present",
      "description": [
        "Led development of microservices architecture",
        "Improved system performance by 40%"
      ]
    }
  ],
  "education": [
    {
      "institution": "University of California",
      "degree": "B.S. Computer Science",
      "years": "2014 - 2018",
      "description": "Graduated with honors"
    }
  ],
  "personalProjects": [
    {
      "name": "Open Source Tool",
      "role": "Creator & Maintainer",
      "years": "Mar 2021 - Present",
      "description": [
        "Built CLI tool with 1000+ GitHub stars",
        "Used by 50+ companies worldwide"
      ]
    }
  ],
  "additional": {
    "technicalSkills": ["Python", "JavaScript", "AWS", "Docker"],
    "languages": ["English (Native)", "Spanish (Conversational)"],
    "certificationsTraining": ["AWS Solutions Architect"],
    "awards": ["Employee of the Year 2022"]
  }
}

Custom section types:
- "text": Single text block (e.g., objective, statement)
- "itemList": List of items with title, subtitle, years, description (e.g., publications, research)
- "stringList": Simple list of strings (e.g., hobbies, interests)

Rules:
- Use "" for missing text fields, [] for missing arrays, null for optional fields
- Format dates preserving the original precision. Keep months when present: "Jan 2020 - Dec 2023", "May 2021 - Present". Use "YYYY - YYYY" only when the source has no months.
- Normalize date separators: "2020-2021" → "2020 - 2021", "Current"/"Ongoing" → "Present". Do NOT discard months.

Resume to parse:
{resume_text}`;

function getParsingServiceUrl() {
  return process.env.PARSING_SERVICE_URL || "http://localhost:8020";
}

function getParsingServiceTimeoutMs() {
  return Number.parseInt(process.env.PARSING_SERVICE_TIMEOUT_MS || "12000", 10);
}

function toAbortSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000;
  const timer = setTimeout(() => controller.abort(), timeout);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

function parseAsStructuredObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value;
}

/**
 * Extract raw text from an uploaded resume file using the parsing microservice.
 * This is the fast step — returns raw text only, no LLM involved.
 */
export async function extractRawTextFromFile(file) {
  if (!file || !file.buffer || Number(file.size || 0) <= 0) {
    throw new Error("Uploaded file content is missing");
  }

  const formData = new FormData();
  const blob = new Blob([file.buffer], {
    type: String(file.mimetype || "application/octet-stream"),
  });
  formData.append("file", blob, String(file.originalname || "resume"));

  const { signal, clear } = toAbortSignal(getParsingServiceTimeoutMs());

  let response;
  try {
    response = await fetch(`${getParsingServiceUrl()}/parse`, {
      method: "POST",
      body: formData,
      signal,
    });
  } catch (error) {
    clear();
    if (error?.name === "AbortError") {
      throw new Error("Resume parsing service timed out");
    }
    throw new Error(`Resume parsing service unreachable: ${error?.message || "unknown error"}`);
  }

  clear();

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resume parsing service failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  const rawText = String(data?.raw_text || "").trim();

  if (!rawText) {
    throw new Error("Resume parsing service returned empty text");
  }

  return rawText;
}

/**
 * Parse structured CV data from raw text using LLM.
 * This is the slow step — can be run in the background after saving the resume.
 */
export async function parseStructuredDataFromText(rawText) {
  try {
    const runtimeConfig = await resolveLlmRuntimeConfig();
    const prompt = PARSE_RESUME_PROMPT.replace("{resume_text}", rawText);
    const result = await completeJson({
      feature: "resume_parse",
      prompt,
      systemPrompt: "You are a JSON extraction engine. Output only valid JSON, no explanations.",
      maxTokens: 4096,
      retries: 1,
      config: runtimeConfig,
    });
    return result.data || null;
  } catch (error) {
    console.error("Failed to parse resume structured data using LLM:", error);
    return null;
  }
}

/**
 * @deprecated Use extractRawTextFromFile + parseStructuredDataFromText separately.
 * Full two-step parsing (text extraction + LLM structured data) in one call.
 */
export async function parseUploadedResume(file) {
  const rawText = await extractRawTextFromFile(file);
  const parsedData = await parseStructuredDataFromText(rawText);
  return { rawText, parsedData };
}
