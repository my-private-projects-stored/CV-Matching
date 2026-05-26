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
  url.pathname = `/${dbName}_tailor_integration`;
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
  "tailor endpoints contract: jobs/upload -> resumes/improve preview+confirm",
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
        email: "recruiter.tailor@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Tailor",
        role: "recruiter",
      });
      assert.equal(recruiterSignup.status, 201);
      const recruiterToken = recruiterSignup.json?.access_token;
      assert.ok(recruiterToken);

      const adminSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "admin.tailor@example.com",
        password: "StrongPass123",
        full_name: "Admin Tailor",
        role: "admin",
      });
      assert.equal(adminSignup.status, 201);
      const adminToken = adminSignup.json?.access_token;
      assert.ok(adminToken);

      const candidateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.tailor@example.com",
        password: "StrongPass123",
        full_name: "Candidate Tailor",
        role: "candidate",
      });
      assert.equal(candidateSignup.status, 201);
      const candidateToken = candidateSignup.json?.access_token;
      const candidateId = candidateSignup.json?.user?.id;
      assert.ok(candidateToken);
      assert.ok(candidateId);

      const masterResume = await Resume.create({
        candidateId,
        fileUrl: "upload://seed-master-resume",
        rawText: "Experienced backend engineer with Node.js and MongoDB expertise",
        parsedData: {
          personalInfo: {
            name: "Integration Candidate",
            title: "Backend Engineer",
            email: "candidate@example.com",
            phone: "",
            location: "",
          },
          summary: "Backend engineer focused on API quality and reliability.",
          workExperience: [],
          education: [],
          personalProjects: [],
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

      const upload = await requestJson(baseUrl, "POST", "/jobs/upload", {
        job_descriptions: [
          "Senior Backend Engineer role requiring Node.js, MongoDB, APIs, Docker, and cloud deployment experience.",
        ],
        resume_id: String(masterResume._id),
      }, recruiterToken);

      assert.equal(upload.status, 200);
      assert.equal(Array.isArray(upload.json?.job_id), true);
      assert.equal(upload.json?.job_id?.length, 1);

      const jobId = upload.json.job_id[0];

      const privacyPut = await requestJson(baseUrl, "PUT", "/config/privacy", {
        privacy_mode: "local_only",
      }, adminToken);
      assert.equal(privacyPut.status, 200);

      const blockedPreview = await requestJson(baseUrl, "POST", "/resumes/improve/preview", {
        resume_id: String(masterResume._id),
        job_id: jobId,
      }, candidateToken);
      assert.equal(blockedPreview.status, 400);
      assert.equal(blockedPreview.json?.error_code, "provider_blocked_by_privacy_mode");
      assert.match(blockedPreview.json?.message || blockedPreview.text, /privacy_mode/i);

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

      const preview = await requestJson(baseUrl, "POST", "/resumes/improve/preview", {
        resume_id: String(masterResume._id),
        job_id: jobId,
      }, candidateToken);

      assert.equal(preview.status, 200);
      assert.equal(typeof preview.json?.data?.request_id, "string");
      assert.equal(preview.json?.data?.resume_id, null);
      assert.equal(preview.json?.data?.job_id, jobId);
      assert.equal(typeof preview.json?.data?.resume_preview?.personalInfo, "object");
      assert.equal(typeof preview.json?.data?.diff_summary?.total_changes, "number");
      assert.equal(Array.isArray(preview.json?.data?.detailed_changes), true);
      assert.ok(["llm", "template_fallback"].includes(preview.json?.data?.generation_mode));
      assert.equal(typeof preview.json?.data?.resume_preview?.summary, "string");
      assert.equal(Array.isArray(preview.json?.data?.improvements), true);
      if (preview.json?.data?.generation_mode === "template_fallback") {
        assert.match(String(preview.json?.data?.resume_preview?.summary || ""), /Tap trung/i);
        assert.match(String(preview.json?.data?.improvements?.[0]?.suggestion || ""), /Nhan manh/i);
      }

      const confirm = await requestJson(baseUrl, "POST", "/resumes/improve/confirm", {
        resume_id: String(masterResume._id),
        job_id: jobId,
        improved_data: preview.json.data.resume_preview,
        improvements: preview.json.data.improvements,
      }, candidateToken);

      assert.equal(confirm.status, 200);
      assert.equal(typeof confirm.json?.data?.resume_id, "string");
      assert.equal(confirm.json?.data?.job_id, jobId);

      const tailoredId = confirm.json.data.resume_id;
      const fetched = await requestJson(
        baseUrl,
        "GET",
        `/resumes?resume_id=${encodeURIComponent(tailoredId)}`,
        undefined,
        candidateToken
      );

      assert.equal(fetched.status, 200);
      assert.equal(fetched.json?.data?.parent_id, String(masterResume._id));
      assert.equal(fetched.json?.data?.raw_resume?.processing_status, "ready");
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
