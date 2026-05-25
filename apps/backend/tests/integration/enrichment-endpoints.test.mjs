import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import mongoose from "mongoose";

import app from "../../src/app.js";
import Application from "../../src/models/Application.js";
import Job from "../../src/models/Job.js";
import Resume from "../../src/models/Resume.js";
import SystemConfig from "../../src/models/SystemConfig.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
  const dbName = (url.pathname || "/cv_matching").replace(/^\//, "") || "cv_matching";
  url.pathname = `/${dbName}_enrichment_integration`;
  return url.toString();
}

async function requestJson(baseUrl, method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { status: response.status, json, text };
}

test(
  "enrichment endpoints contract: analyze -> enhance -> apply -> regenerate -> apply-regenerated",
  { skip: !RUN_INTEGRATION },
  async () => {
    const mongoUri = getTestMongoUri();
    await mongoose.connect(mongoUri);

    await Promise.all([
      Application.deleteMany({}),
      Job.deleteMany({}),
      Resume.deleteMany({}),
      SystemConfig.deleteMany({}),
    ]);

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    try {
      const recruiterSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "recruiter.enrichment@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Enrichment",
        role: "recruiter",
      });
      assert.equal(recruiterSignup.status, 201);
      const recruiterToken = recruiterSignup.json?.access_token;
      assert.ok(recruiterToken);

      const adminSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "admin.enrichment@example.com",
        password: "StrongPass123",
        full_name: "Admin Enrichment",
        role: "admin",
      });
      assert.equal(adminSignup.status, 201);
      const adminToken = adminSignup.json?.access_token;
      assert.ok(adminToken);

      const candidateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.enrichment@example.com",
        password: "StrongPass123",
        full_name: "Candidate Enrichment",
        role: "candidate",
      });
      assert.equal(candidateSignup.status, 201);
      const candidateToken = candidateSignup.json?.access_token;
      const candidateId = candidateSignup.json?.user?.id;
      assert.ok(candidateToken);
      assert.ok(candidateId);

      const resume = await Resume.create({
        candidateId,
        fileUrl: "upload://seed-enrichment-resume",
        rawText: "Backend engineer with Node.js and MongoDB experience",
        parsedData: {
          personalInfo: {
            name: "Enrichment Candidate",
            title: "Backend Engineer",
            email: "candidate@example.com",
          },
          summary: "Backend engineer focused on maintainable APIs.",
          workExperience: [
            {
              id: 1,
              title: "Software Engineer",
              company: "Example Inc",
              description: ["Built APIs"],
            },
          ],
          education: [],
          personalProjects: [
            {
              id: 1,
              name: "CV Matcher",
              role: "Developer",
              description: ["Matching resumes to jobs"],
            },
          ],
          additional: {
            technicalSkills: ["Node.js", "MongoDB"],
            languages: [],
            certificationsTraining: [],
            awards: [],
          },
        },
        isMaster: true,
        processingStatus: "ready",
      });

      const privacyPut = await requestJson(baseUrl, "PUT", "/config/privacy", {
        privacy_mode: "local_only",
      }, adminToken);
      assert.equal(privacyPut.status, 200);

      const analyzeBlocked = await requestJson(
        baseUrl,
        "POST",
        `/enrichment/analyze/${resume._id}`,
        undefined,
        candidateToken
      );
      assert.equal(analyzeBlocked.status, 400);
      assert.equal(analyzeBlocked.json?.error_code, "provider_blocked_by_privacy_mode");
      assert.match(analyzeBlocked.json?.message || analyzeBlocked.json?.detail || analyzeBlocked.text, /privacy_mode/i);

      const llmPutOllama = await requestJson(baseUrl, "PUT", "/config/llm-api-key", {
        provider: "ollama",
        model: "gemma3:4b",
        api_base: "http://localhost:11434",
      }, adminToken);
      assert.equal(llmPutOllama.status, 200);

      const languagePut = await requestJson(baseUrl, "PUT", "/config/language", {
        ui_language: "vi",
        content_language: "vi",
      }, adminToken);
      assert.equal(languagePut.status, 200);

      const analyze = await requestJson(baseUrl, "POST", `/enrichment/analyze/${resume._id}`, undefined, candidateToken);
      assert.equal(analyze.status, 200);
      assert.equal(Array.isArray(analyze.json?.items_to_enrich), true);
      assert.equal(Array.isArray(analyze.json?.questions), true);
      assert.ok(analyze.json?.items_to_enrich?.length >= 1);
      assert.match(String(analyze.json?.analysis_summary || ""), /Phat hien/i);

      const firstQuestion = analyze.json.questions[0];
      assert.equal(typeof firstQuestion?.question_id, "string");

      const enhance = await requestJson(baseUrl, "POST", "/enrichment/enhance", {
        resume_id: String(resume._id),
        answers: [
          {
            question_id: firstQuestion.question_id,
            answer: "reduced API response time by 35% and cut incidents by 20%",
          },
        ],
      }, candidateToken);

      assert.equal(enhance.status, 200);
      assert.equal(Array.isArray(enhance.json?.enhancements), true);
      assert.equal(enhance.json.enhancements.length, 1);
      assert.match(
        String(enhance.json.enhancements[0]?.enhanced_description?.[0] || ""),
        /Tao tac dong/i
      );

      const apply = await requestJson(baseUrl, "POST", `/enrichment/apply/${resume._id}`, {
        enhancements: enhance.json.enhancements,
      }, candidateToken);

      assert.equal(apply.status, 200);
      assert.equal(typeof apply.json?.updated_items, "number");
      assert.equal(apply.json.updated_items, 1);

      const updatedAfterApply = await Resume.findById(resume._id).lean();
      assert.ok(updatedAfterApply);
      const updatedDescriptions =
        updatedAfterApply.parsedData.workExperience[0].description || [];
      assert.equal(updatedDescriptions.length >= 2, true);

      const regenerate = await requestJson(baseUrl, "POST", "/enrichment/regenerate", {
        resume_id: String(resume._id),
        items: [
          {
            item_id: "exp_0",
            item_type: "experience",
            title: "Software Engineer",
            subtitle: "Example Inc",
            current_content: updatedDescriptions,
          },
        ],
        instruction: "",
      }, candidateToken);

      assert.equal(regenerate.status, 200);
      assert.equal(Array.isArray(regenerate.json?.regenerated_items), true);
      assert.equal(regenerate.json.regenerated_items.length, 1);
      assert.equal(Array.isArray(regenerate.json?.errors), true);
      assert.match(String(regenerate.json.regenerated_items[0]?.diff_summary || ""), /Da viet lai/i);

      const applyRegenerated = await requestJson(
        baseUrl,
        "POST",
        `/enrichment/apply-regenerated/${resume._id}`,
        regenerate.json.regenerated_items,
        candidateToken
      );

      assert.equal(applyRegenerated.status, 200);
      assert.equal(applyRegenerated.json?.updated_items, 1);

      const finalResume = await Resume.findById(resume._id).lean();
      assert.ok(finalResume);
      assert.match(
        String(finalResume.parsedData.workExperience[0].description[0]),
        /cai thien do ro rang va tac dong/i
      );
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
);
