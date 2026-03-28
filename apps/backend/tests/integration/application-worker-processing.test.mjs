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
  url.pathname = `/${dbName}_application_worker_processing_integration`;
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
  "application worker processing: pending -> completed via internal endpoint",
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

    const oldWorkerToken = process.env.WORKER_INTERNAL_TOKEN;
    const oldAllowMock = process.env.ALLOW_INTERNAL_MOCK_SCORING;
    const oldRedisUrl = process.env.REDIS_URL;

    process.env.WORKER_INTERNAL_TOKEN = "integration-worker-token";
    process.env.ALLOW_INTERNAL_MOCK_SCORING = "1";
    process.env.REDIS_URL = "redis://127.0.0.1:9";

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    try {
      const recruiterSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "recruiter.worker.flow@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Worker Flow",
        role: "recruiter",
      });
      assert.equal(recruiterSignup.status, 201);
      const recruiterId = recruiterSignup.json?.user?.id;
      assert.ok(recruiterId);

      const candidateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.worker.flow@example.com",
        password: "StrongPass123",
        full_name: "Candidate Worker Flow",
        role: "candidate",
      });
      assert.equal(candidateSignup.status, 201);
      const candidateId = candidateSignup.json?.user?.id;
      const candidateToken = candidateSignup.json?.access_token;
      assert.ok(candidateId);
      assert.ok(candidateToken);

      const job = await Job.create({
        recruiterId,
        title: "Worker Flow Job",
        description: "Drive async AI processing",
        requirements: "Node.js Redis",
        cleanText: "Node.js Redis",
        category: "IT",
      });

      const resume = await Resume.create({
        candidateId,
        fileUrl: "upload://worker-flow",
        rawText: "Node.js Redis MongoDB",
        parsedData: {
          personalInfo: { name: "Worker Candidate" },
          additional: { technicalSkills: ["Node.js", "Redis", "MongoDB"] },
        },
        processingStatus: "ready",
      });

      const createApplicationResponse = await requestJson(
        baseUrl,
        "POST",
        "/applications",
        {
          job_id: String(job._id),
          resume_id: String(resume._id),
        },
        candidateToken
      );

      assert.equal(createApplicationResponse.status, 201);
      const applicationId = createApplicationResponse.json?.data?.application_id;
      assert.ok(applicationId);
      assert.equal(createApplicationResponse.json?.data?.ai_status, "pending");

      const unauthorizedProcess = await requestJson(
        baseUrl,
        "POST",
        `/internal/applications/${encodeURIComponent(applicationId)}/process-ai`,
        {
          mock_scoring_result: {
            semanticScore: 0.9,
            keywordScore: 0.8,
            hybridScore: 0.87,
            matchedKeywords: ["node.js", "redis"],
            missingKeywords: ["kafka"],
          },
        }
      );
      assert.equal(unauthorizedProcess.status, 401);

      const processResponse = await requestJson(
        baseUrl,
        "POST",
        `/internal/applications/${encodeURIComponent(applicationId)}/process-ai`,
        {
          mock_scoring_result: {
            semanticScore: 0.9,
            keywordScore: 0.8,
            hybridScore: 0.87,
            matchedKeywords: ["node.js", "redis"],
            missingKeywords: ["kafka"],
          },
        },
        "integration-worker-token"
      );

      assert.equal(processResponse.status, 200);
      assert.equal(processResponse.json?.data?.ai_status, "completed");

      const reloaded = await Application.findById(applicationId).lean();
      assert.ok(reloaded);
      assert.equal(reloaded.aiStatus, "completed");
      assert.equal(Number(reloaded.aiScores?.hybridScore || 0), 0.87);
      assert.deepEqual(reloaded.aiDetails?.matchedKeywords || [], ["node.js", "redis"]);
      assert.deepEqual(reloaded.aiDetails?.missingKeywords || [], ["kafka"]);
    } finally {
      process.env.WORKER_INTERNAL_TOKEN = oldWorkerToken;
      process.env.ALLOW_INTERNAL_MOCK_SCORING = oldAllowMock;
      process.env.REDIS_URL = oldRedisUrl;

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
