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
  url.pathname = `/${dbName}_master_resume_integration`;
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
  "master resume endpoints: set-as-master + get master",
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
      const candidateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.master@example.com",
        password: "StrongPass123",
        full_name: "Candidate Master",
        role: "candidate",
      });
      assert.equal(candidateSignup.status, 201);
      const candidateToken = candidateSignup.json?.access_token;
      const candidateId = candidateSignup.json?.user?.id;
      assert.ok(candidateToken);
      assert.ok(candidateId);

      const recruiterSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "recruiter.master@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Master",
        role: "recruiter",
      });
      assert.equal(recruiterSignup.status, 201);
      const recruiterToken = recruiterSignup.json?.access_token;
      assert.ok(recruiterToken);

      const first = await Resume.create({
        candidateId,
        fileUrl: "upload://master-1",
        rawText: "Master resume 1",
        processingStatus: "ready",
        isMaster: true,
      });
      const second = await Resume.create({
        candidateId,
        fileUrl: "upload://master-2",
        rawText: "Master resume 2",
        processingStatus: "ready",
        isMaster: false,
      });

      const setMaster = await requestJson(
        baseUrl,
        "POST",
        `/resumes/${encodeURIComponent(String(second._id))}/set-as-master`,
        undefined,
        candidateToken
      );

      assert.equal(setMaster.status, 200);
      assert.equal(setMaster.json?.data?.resume_id, String(second._id));
      assert.equal(setMaster.json?.data?.is_master, true);

      const [reloadedFirst, reloadedSecond] = await Promise.all([
        Resume.findById(first._id),
        Resume.findById(second._id),
      ]);

      assert.equal(Boolean(reloadedFirst?.isMaster), false);
      assert.equal(Boolean(reloadedSecond?.isMaster), true);

      const getMaster = await requestJson(
        baseUrl,
        "GET",
        `/resumes/master?candidate_id=${encodeURIComponent(String(candidateId))}`,
        undefined,
        candidateToken
      );

      assert.equal(getMaster.status, 200);
      assert.equal(getMaster.json?.data?.resume_id, String(second._id));
      assert.equal(getMaster.json?.data?.is_master, true);

      const invalidCandidate = await requestJson(baseUrl, "GET", "/resumes/master?candidate_id=abc", undefined, recruiterToken);
      assert.equal(invalidCandidate.status, 400);
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
