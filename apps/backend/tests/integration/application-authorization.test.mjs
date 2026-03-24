import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import mongoose from "mongoose";

import app from "../../src/app.js";
import Application from "../../src/models/Application.js";
import Job from "../../src/models/Job.js";
import Resume from "../../src/models/Resume.js";
import User from "../../src/models/User.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
  const dbName = (url.pathname || "/cv_matching").replace(/^\//, "") || "cv_matching";
  url.pathname = `/${dbName}_application_authorization_integration`;
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

async function signupAndGetToken(baseUrl, payload) {
  const result = await requestJson(baseUrl, "POST", "/auth/signup", payload);
  assert.equal(result.status, 201);
  assert.ok(result.json?.access_token);
  assert.ok(result.json?.user?.id);
  return {
    token: result.json.access_token,
    userId: result.json.user.id,
    email: result.json.user.email,
  };
}

test(
  "application authorization matrix: role gates + ownership + audit actor",
  { skip: !RUN_INTEGRATION },
  async () => {
    const mongoUri = getTestMongoUri();
    await mongoose.connect(mongoUri);

    await Promise.all([
      Application.deleteMany({}),
      Job.deleteMany({}),
      Resume.deleteMany({}),
      User.deleteMany({}),
    ]);

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    try {
      const recruiter = await signupAndGetToken(baseUrl, {
        email: "recruiter.matrix@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Matrix",
        role: "recruiter",
      });
      const candidateA = await signupAndGetToken(baseUrl, {
        email: "candidate.a.matrix@example.com",
        password: "StrongPass123",
        full_name: "Candidate A",
        role: "candidate",
      });
      const candidateB = await signupAndGetToken(baseUrl, {
        email: "candidate.b.matrix@example.com",
        password: "StrongPass123",
        full_name: "Candidate B",
        role: "candidate",
      });
      const admin = await signupAndGetToken(baseUrl, {
        email: "admin.matrix@example.com",
        password: "StrongPass123",
        full_name: "Admin Matrix",
        role: "admin",
      });

      const createdJob = await Job.create({
        recruiterId: recruiter.userId,
        title: "Platform Engineer",
        description: "Build scalable platform services",
        requirements: "Node.js MongoDB Redis",
        cleanText: "Platform Engineer\nBuild scalable platform services\nNode.js MongoDB Redis",
        category: "IT",
        status: "active",
      });
      const jobId = String(createdJob._id);

      const resumeAResponse = await requestJson(
        baseUrl,
        "POST",
        "/resumes",
        {
          fileUrl: "upload://candidate-a",
          rawText: "Candidate A resume",
          parsedData: { personalInfo: { name: "Candidate A" } },
        },
        candidateA.token
      );
      assert.equal(resumeAResponse.status, 201);
      const resumeAId = resumeAResponse.json?.data?.resume_id;
      assert.ok(resumeAId);

      const resumeBResponse = await requestJson(
        baseUrl,
        "POST",
        "/resumes",
        {
          fileUrl: "upload://candidate-b",
          rawText: "Candidate B resume",
          parsedData: { personalInfo: { name: "Candidate B" } },
        },
        candidateB.token
      );
      assert.equal(resumeBResponse.status, 201);
      const resumeBId = resumeBResponse.json?.data?.resume_id;
      assert.ok(resumeBId);

      const createOwnApplication = await requestJson(
        baseUrl,
        "POST",
        "/applications",
        {
          job_id: jobId,
          resume_id: resumeAId,
        },
        candidateA.token
      );
      assert.equal(createOwnApplication.status, 201);
      const applicationAId = createOwnApplication.json?.data?.application_id;
      assert.ok(applicationAId);

      const createForeignApplication = await requestJson(
        baseUrl,
        "POST",
        "/applications",
        {
          job_id: jobId,
          resume_id: resumeBId,
        },
        candidateA.token
      );
      assert.equal(createForeignApplication.status, 403);

      const recruiterCreateApplication = await requestJson(
        baseUrl,
        "POST",
        "/applications",
        {
          job_id: jobId,
          resume_id: resumeAId,
        },
        recruiter.token
      );
      assert.equal(recruiterCreateApplication.status, 403);

      const candidateRankedAccess = await requestJson(
        baseUrl,
        "GET",
        `/applications/ranked?job_id=${encodeURIComponent(jobId)}`,
        undefined,
        candidateA.token
      );
      assert.equal(candidateRankedAccess.status, 403);

      const createBApplication = await requestJson(
        baseUrl,
        "POST",
        "/applications",
        {
          job_id: jobId,
          resume_id: resumeBId,
        },
        candidateB.token
      );
      assert.equal(createBApplication.status, 201);
      const applicationBId = createBApplication.json?.data?.application_id;
      assert.ok(applicationBId);

      const candidateAReadForeignFeedback = await requestJson(
        baseUrl,
        "GET",
        `/applications/${encodeURIComponent(applicationBId)}/feedback`,
        undefined,
        candidateA.token
      );
      assert.equal(candidateAReadForeignFeedback.status, 403);

      const adminStatusUpdate = await requestJson(
        baseUrl,
        "PATCH",
        `/applications/${encodeURIComponent(applicationAId)}/status`,
        {
          status: "interview",
          changed_by: "spoofed-client-actor",
        },
        admin.token
      );
      assert.equal(adminStatusUpdate.status, 200);

      const statusHistoryByOwner = await requestJson(
        baseUrl,
        "GET",
        `/applications/${encodeURIComponent(applicationAId)}/status-history`,
        undefined,
        candidateA.token
      );
      assert.equal(statusHistoryByOwner.status, 200);
      const latestEntry = statusHistoryByOwner.json?.data?.history?.[0];
      assert.equal(latestEntry?.to_status, "interview");
      assert.equal(latestEntry?.changed_by, admin.email);
      assert.notEqual(latestEntry?.changed_by, "spoofed-client-actor");
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
