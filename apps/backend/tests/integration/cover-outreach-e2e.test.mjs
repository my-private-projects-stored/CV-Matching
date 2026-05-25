import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import mongoose from "mongoose";

import app from "../../src/app.js";
import Application from "../../src/models/Application.js";
import Job from "../../src/models/Job.js";
import Resume from "../../src/models/Resume.js";
import SystemConfig from "../../src/models/SystemConfig.js";
import User from "../../src/models/User.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
  const dbName = (url.pathname || "/cv_matching").replace(/^\//, "") || "cv_matching";
  url.pathname = `/${dbName}_cover_outreach_e2e_integration`;
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

async function signup(baseUrl, payload) {
  const result = await requestJson(baseUrl, "POST", "/auth/signup", payload);
  assert.equal(result.status, 201);
  assert.ok(result.json?.access_token);
  assert.ok(result.json?.user?.id);
  return {
    token: result.json.access_token,
    userId: result.json.user.id,
  };
}

test(
  "cover/outreach generator E2E: privacy + permissions + updates",
  { skip: !RUN_INTEGRATION },
  async () => {
    const mongoUri = getTestMongoUri();
    await mongoose.connect(mongoUri);

    await Promise.all([
      Application.deleteMany({}),
      Job.deleteMany({}),
      Resume.deleteMany({}),
      SystemConfig.deleteMany({}),
      User.deleteMany({}),
    ]);

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    try {
      const recruiter = await signup(baseUrl, {
        email: "recruiter.coveroutreach@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Cover Outreach",
        role: "recruiter",
      });
      const admin = await signup(baseUrl, {
        email: "admin.coveroutreach@example.com",
        password: "StrongPass123",
        full_name: "Admin Cover Outreach",
        role: "admin",
      });
      const candidateA = await signup(baseUrl, {
        email: "candidate.coveroutreach@example.com",
        password: "StrongPass123",
        full_name: "Candidate Cover Outreach",
        role: "candidate",
      });
      const candidateB = await signup(baseUrl, {
        email: "candidate.coveroutreach.b@example.com",
        password: "StrongPass123",
        full_name: "Candidate B",
        role: "candidate",
      });

      const resume = await Resume.create({
        candidateId: candidateA.userId,
        fileUrl: "upload://seed-cover-outreach-resume",
        rawText: "Backend engineer with Node.js and MongoDB experience",
        jobDescription: "Own Node.js APIs and MongoDB data models for hiring platform.",
        parsedData: {
          personalInfo: {
            name: "Candidate Cover",
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

      const privacyPut = await requestJson(baseUrl, "PUT", "/config/privacy", {
        privacy_mode: "local_only",
      }, admin.token);
      assert.equal(privacyPut.status, 200);

      const blockedCover = await requestJson(
        baseUrl,
        "POST",
        `/resumes/${resume._id}/generate-cover-letter`,
        {},
        candidateA.token
      );
      assert.equal(blockedCover.status, 400);
      assert.equal(blockedCover.json?.error_code, "provider_blocked_by_privacy_mode");
      assert.match(blockedCover.json?.message || blockedCover.text, /privacy_mode/i);

      const blockedOutreach = await requestJson(
        baseUrl,
        "POST",
        `/resumes/${resume._id}/generate-outreach`,
        {},
        candidateA.token
      );
      assert.equal(blockedOutreach.status, 400);
      assert.equal(blockedOutreach.json?.error_code, "provider_blocked_by_privacy_mode");
      assert.match(blockedOutreach.json?.message || blockedOutreach.text, /privacy_mode/i);

      const llmPutOllama = await requestJson(baseUrl, "PUT", "/config/llm-api-key", {
        provider: "ollama",
        model: "gemma3:4b",
        api_base: "http://localhost:11434",
      }, admin.token);
      assert.equal(llmPutOllama.status, 200);

      const recruiterCover = await requestJson(
        baseUrl,
        "POST",
        `/resumes/${resume._id}/generate-cover-letter`,
        {},
        recruiter.token
      );
      assert.equal(recruiterCover.status, 403);

      const candidateBCover = await requestJson(
        baseUrl,
        "POST",
        `/resumes/${resume._id}/generate-cover-letter`,
        {},
        candidateB.token
      );
      assert.equal(candidateBCover.status, 403);

      const candidateBOutreach = await requestJson(
        baseUrl,
        "POST",
        `/resumes/${resume._id}/generate-outreach`,
        {},
        candidateB.token
      );
      assert.equal(candidateBOutreach.status, 403);

      const coverLetter = await requestJson(
        baseUrl,
        "POST",
        `/resumes/${resume._id}/generate-cover-letter`,
        {},
        candidateA.token
      );
      assert.equal(coverLetter.status, 200);
      assert.match(String(coverLetter.json?.content || ""), /Dear Hiring Team/i);
      assert.match(String(coverLetter.json?.content || ""), /node\.js/i);

      const outreach = await requestJson(
        baseUrl,
        "POST",
        `/resumes/${resume._id}/generate-outreach`,
        {},
        candidateA.token
      );
      assert.equal(outreach.status, 200);
      assert.match(String(outreach.json?.content || ""), /Hi, I am/i);
      assert.match(String(outreach.json?.content || ""), /Backend Engineer/i);

      const fetched = await requestJson(
        baseUrl,
        "GET",
        `/resumes?resume_id=${encodeURIComponent(String(resume._id))}`,
        undefined,
        candidateA.token
      );
      assert.equal(fetched.status, 200);
      assert.match(String(fetched.json?.data?.cover_letter || ""), /Dear Hiring Team/i);
      assert.match(String(fetched.json?.data?.outreach_message || ""), /Hi, I am/i);

      const candidateBUpdateCover = await requestJson(
        baseUrl,
        "PATCH",
        `/resumes/${resume._id}/cover-letter`,
        { content: "Updated cover letter from another user." },
        candidateB.token
      );
      assert.equal(candidateBUpdateCover.status, 403);

      const candidateBUpdateOutreach = await requestJson(
        baseUrl,
        "PATCH",
        `/resumes/${resume._id}/outreach-message`,
        { content: "Updated outreach message from another user." },
        candidateB.token
      );
      assert.equal(candidateBUpdateOutreach.status, 403);

      const updateCover = await requestJson(
        baseUrl,
        "PATCH",
        `/resumes/${resume._id}/cover-letter`,
        { content: "Updated cover letter from candidate." },
        candidateA.token
      );
      assert.equal(updateCover.status, 200);

      const updateOutreach = await requestJson(
        baseUrl,
        "PATCH",
        `/resumes/${resume._id}/outreach-message`,
        { content: "Updated outreach message from candidate." },
        candidateA.token
      );
      assert.equal(updateOutreach.status, 200);

      const fetchedAfterUpdate = await requestJson(
        baseUrl,
        "GET",
        `/resumes?resume_id=${encodeURIComponent(String(resume._id))}`,
        undefined,
        candidateA.token
      );
      assert.equal(fetchedAfterUpdate.status, 200);
      assert.match(String(fetchedAfterUpdate.json?.data?.cover_letter || ""), /Updated cover letter from candidate/i);
      assert.match(String(fetchedAfterUpdate.json?.data?.outreach_message || ""), /Updated outreach message from candidate/i);
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
