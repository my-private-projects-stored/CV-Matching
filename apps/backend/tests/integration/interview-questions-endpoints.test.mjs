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
  url.pathname = `/${dbName}_interview_questions_integration`;
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
  return {
    token: result.json.access_token,
    userId: result.json.user.id,
  };
}

test("interview questions use LLM/fallback and enforce recruiter resume access", { skip: !RUN_INTEGRATION }, async () => {
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
      email: "recruiter.interview@example.com",
      password: "StrongPass123",
      full_name: "Recruiter Interview",
      role: "recruiter",
    });
    const otherRecruiter = await signup(baseUrl, {
      email: "recruiter.interview.other@example.com",
      password: "StrongPass123",
      full_name: "Other Recruiter",
      role: "recruiter",
    });
    const admin = await signup(baseUrl, {
      email: "admin.interview@example.com",
      password: "StrongPass123",
      full_name: "Admin Interview",
      role: "admin",
    });
    const candidate = await signup(baseUrl, {
      email: "candidate.interview@example.com",
      password: "StrongPass123",
      full_name: "Candidate Interview",
      role: "candidate",
    });

    await requestJson(baseUrl, "PUT", "/config/privacy", {
      privacy_mode: "local_only",
    }, admin.token);
    await requestJson(baseUrl, "PUT", "/config/llm-api-key", {
      provider: "ollama",
      model: "gemma3:4b",
      api_base: "http://localhost:11434",
    }, admin.token);

    const resume = await Resume.create({
      candidateId: candidate.userId,
      fileUrl: "upload://interview-resume",
      rawText: "Backend engineer with Node.js, MongoDB, and API ownership.",
      parsedData: {
        personalInfo: { name: "Interview Candidate", title: "Backend Engineer" },
        summary: "Backend engineer focused on reliable APIs.",
        workExperience: [
          {
            title: "Software Engineer",
            company: "Example Inc",
            description: ["Built Node.js APIs and MongoDB services."],
          },
        ],
        personalProjects: [
          {
            name: "CV Matcher",
            role: "Developer",
            description: ["Built a matching pipeline."],
          },
        ],
        additional: {
          technicalSkills: ["Node.js", "MongoDB"],
        },
      },
      processingStatus: "ready",
    });

    const job = await Job.create({
      recruiterId: recruiter.userId,
      title: "Backend Engineer",
      description: "Build APIs for a hiring platform.",
      requirements: "Node.js, MongoDB, API design",
      cleanText: "Backend Engineer Node.js MongoDB API design",
      category: "IT",
    });
    await Application.create({ jobId: job._id, resumeId: resume._id });

    const forbidden = await requestJson(baseUrl, "POST", "/interviews/questions", {
      resume_id: String(resume._id),
      job_id: String(job._id),
      language: "en",
    }, otherRecruiter.token);
    assert.equal(forbidden.status, 403);

    const result = await requestJson(baseUrl, "POST", "/interviews/questions", {
      resume_id: String(resume._id),
      job_id: String(job._id),
      language: "en",
    }, recruiter.token);
    assert.equal(result.status, 200);
    assert.equal(result.json?.data?.resume_id, String(resume._id));
    assert.equal(result.json?.data?.job_id, String(job._id));
    assert.ok(["llm", "template_fallback"].includes(result.json?.data?.generation_mode));
    assert.equal(Array.isArray(result.json?.data?.question_groups), true);
    assert.ok(result.json.data.question_groups.length > 0);
    assert.ok(result.json.data.total_questions > 0);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
