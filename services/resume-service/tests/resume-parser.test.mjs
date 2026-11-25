import test from "node:test";
import assert from "node:assert/strict";
import { hasMeaningfulStructuredData, parseRawTextToStructuredData } from "../src/services/resume-parser.js";

const SARAH_CHEN_RAW = `SARAH CHEN
SENIOR SOFTWARE ENGINEER
sarah.chen@example.com, +1 (415) 555-0142, San Francisco, CA, linkedin.com/in/sarahchen-dev,
github.com/sarahchen-dev
SUMMARY
Senior software engineer with 6 years of backend experience in Python and Go, including 3 years shipping LLM
features to production.
EXPERIENCE
Senior Software Engineer Jul 2024 - Present
Fernway Payments San Francisco, CA
•Shipped a RAG support assistant (Python, FastAPI, pgvector) that resolves 38% of merchant tickets without
handoff.
•Built an evaluation suite of 1,200 labeled conversations.
Software Engineer II Apr 2022 - Jun 2024
Kestrel Health Seattle, WA
•Built a clinical note summarizer on Azure OpenAI with PHI redaction.
Software Engineer Jun 2020 - Mar 2022
Bluepine Analytics Seattle, WA
•Built Kafka ingestion workers in Python.
EDUCATION
University of Washington 2016 - 2020
B.S. Computer Science
PROJECTS
promptdiff github.com/sarahchen-dev/promptdiff 2024 - Present
Creator and Maintainer
•Open-source Python CLI that runs a prompt test suite; 1.1k GitHub stars.
SKILLS & AWARDS
Technical Skills: Python, Go, TypeScript, FastAPI, Fine-tuning (LoRA)
Languages: English (Native), Mandarin (Professional)
Certifications: AWS Certified Solutions Architect - Associate`;

test("parseRawTextToStructuredData extracts full structured resume sections", () => {
  const parsed = parseRawTextToStructuredData(SARAH_CHEN_RAW);
  assert.equal(hasMeaningfulStructuredData(parsed), true);
  assert.equal(parsed.personalInfo.name, "SARAH CHEN");
  assert.equal(parsed.personalInfo.title, "SENIOR SOFTWARE ENGINEER");
  assert.equal(parsed.personalInfo.email, "sarah.chen@example.com");
  assert.equal(parsed.personalInfo.location, "San Francisco, CA");
  assert.equal(parsed.personalInfo.linkedin, "linkedin.com/in/sarahchen-dev");
  assert.equal(parsed.personalInfo.github, "github.com/sarahchen-dev");

  assert.equal(parsed.workExperience.length, 3);
  assert.deepEqual(
    parsed.workExperience.map((e) => [e.company, e.location]),
    [
      ["Fernway Payments", "San Francisco, CA"],
      ["Kestrel Health", "Seattle, WA"],
      ["Bluepine Analytics", "Seattle, WA"],
    ]
  );
  assert.equal(parsed.workExperience[0].description.length, 2);

  assert.equal(parsed.education.length, 1);
  assert.equal(parsed.education[0].institution, "University of Washington");
  assert.equal(parsed.education[0].degree, "B.S. Computer Science");

  assert.equal(parsed.personalProjects.length, 1);
  assert.equal(parsed.personalProjects[0].name, "promptdiff");
  assert.equal(parsed.personalProjects[0].github, "github.com/sarahchen-dev/promptdiff");

  assert.ok(parsed.additional.technicalSkills.includes("Fine-tuning (LoRA)"));
  assert.deepEqual(parsed.additional.languages, ["English (Native)", "Mandarin (Professional)"]);
  assert.deepEqual(parsed.additional.certificationsTraining, [
    "AWS Certified Solutions Architect - Associate",
  ]);
});
