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
  url.pathname = `/${dbName}_language_output_integration`;
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
  "language config applies to cover letter and outreach generators",
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
        email: "recruiter.language@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Language",
        role: "recruiter",
      });
      assert.equal(recruiterSignup.status, 201);
      const recruiterToken = recruiterSignup.json?.access_token;
      assert.ok(recruiterToken);

      const adminSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "admin.language@example.com",
        password: "StrongPass123",
        full_name: "Admin Language",
        role: "admin",
      });
      assert.equal(adminSignup.status, 201);
      const adminToken = adminSignup.json?.access_token;
      assert.ok(adminToken);

      const candidateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.language@example.com",
        password: "StrongPass123",
        full_name: "Candidate Language",
        role: "candidate",
      });
      assert.equal(candidateSignup.status, 201);
      const candidateToken = candidateSignup.json?.access_token;
      const candidateId = candidateSignup.json?.user?.id;
      assert.ok(candidateToken);
      assert.ok(candidateId);

      const resume = await Resume.create({
        candidateId,
        fileUrl: "upload://seed-language-resume",
        rawText: "Backend engineer with Node.js and MongoDB experience",
        parsedData: {
          personalInfo: {
            name: "Nguyen Candidate",
            title: "Backend Engineer",
            email: "candidate@example.com",
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

      const privacyPut = await requestJson(baseUrl, "PUT", "/config/privacy", {
        privacy_mode: "local_only",
      }, adminToken);
      assert.equal(privacyPut.status, 200);

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

      const coverLetter = await requestJson(
        baseUrl,
        "POST",
        `/resumes/${resume._id}/generate-cover-letter`,
        {},
        candidateToken
      );
      assert.equal(coverLetter.status, 200);
      assert.match(String(coverLetter.json?.content || ""), /Kinh gui/i);

      const outreach = await requestJson(
        baseUrl,
        "POST",
        `/resumes/${resume._id}/generate-outreach`,
        {},
        candidateToken
      );
      assert.equal(outreach.status, 200);
      assert.match(String(outreach.json?.content || ""), /Chao/i);
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
