import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import mongoose from "mongoose";

import app from "../../src/app.js";
import Job from "../../src/models/Job.js";
import Resume from "../../src/models/Resume.js";
import User from "../../src/models/User.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
  url.pathname = "/cv_matching_recruiter_read_profile_integration";
  return url.toString();
}

async function requestJson(baseUrl, method, path, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

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

test("recruiter reads candidate profile by application flow", { skip: !RUN_INTEGRATION }, async () => {
  const mongoUri = getTestMongoUri();
  await mongoose.connect(mongoUri);

  await Promise.all([User.deleteMany({}), Job.deleteMany({}), Resume.deleteMany({})]);

  const server = app.listen(0);
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    const candidateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
      email: "candidate.read@example.com",
      password: "StrongPass123",
      role: "candidate",
      full_name: "Candidate Read",
    });
    assert.equal(candidateSignup.status, 201);
    const candidateToken = candidateSignup.json?.access_token;
    const candidateId = candidateSignup.json?.user?.id;
    assert.ok(candidateToken && candidateId);

    const recruiterSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
      email: "recruiter.read@example.com",
      password: "StrongPass123",
      role: "recruiter",
      full_name: "Recruiter Read",
    });
    assert.equal(recruiterSignup.status, 201);
    const recruiterToken = recruiterSignup.json?.access_token;
    assert.ok(recruiterToken);

    const resume = await Resume.create({
      candidateId,
      fileUrl: "upload://r1",
      rawText: "candidate main text",
      processingStatus: "ready",
    });

    const job = await Job.create({
      recruiterId: recruiterSignup.json.user.id,
      title: "Test Job",
      description: "Desc",
      requirements: "At least 2 years of experience with React and Node.js",
      cleanText: "Desc",
      category: "IT",
      status: "active",
    });

    const createApp = await requestJson(baseUrl, "POST", "/applications", {
      job_id: String(job._id),
      resume_id: String(resume._id),
    }, candidateToken);

    assert.equal(createApp.status, 201);

    // recruiter fetches candidate profile by id (via candidate_id resolved from application)
    const recruiterGet = await requestJson(baseUrl, "GET", `/candidate-profile/${candidateId}`, undefined, recruiterToken);
    assert.equal(recruiterGet.status, 200);
    assert.equal(recruiterGet.json?.data?.user_id, candidateId);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
