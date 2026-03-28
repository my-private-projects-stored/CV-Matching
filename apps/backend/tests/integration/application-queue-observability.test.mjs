import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import Redis from "ioredis";
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
  url.pathname = `/${dbName}_application_queue_observability_integration`;
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

async function waitForQueueMessage(redis, queueName, timeoutMs = 5000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const messages = await redis.lrange(queueName, 0, -1);
    if (messages.length > 0) {
      return messages;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return [];
}

test(
  "application enqueue observability: queue payload is emitted to Redis",
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

    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    const oldQueueName = process.env.SCORING_QUEUE_NAME;
    const testQueueName = `application_scoring_queue_test_${Date.now()}`;
    process.env.SCORING_QUEUE_NAME = testQueueName;

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    try {
      await redis.del(testQueueName);

      const recruiterSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "recruiter.queue.obs@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Queue Observability",
        role: "recruiter",
      });
      assert.equal(recruiterSignup.status, 201);
      const recruiterId = recruiterSignup.json?.user?.id;
      assert.ok(recruiterId);

      const candidateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.queue.obs@example.com",
        password: "StrongPass123",
        full_name: "Candidate Queue Observability",
        role: "candidate",
      });
      assert.equal(candidateSignup.status, 201);
      const candidateId = candidateSignup.json?.user?.id;
      const candidateToken = candidateSignup.json?.access_token;
      assert.ok(candidateId);
      assert.ok(candidateToken);

      const job = await Job.create({
        recruiterId,
        title: "Queue Observability Job",
        description: "Validate queue emissions",
        requirements: "Node.js Redis",
        cleanText: "Node.js Redis",
        category: "IT",
      });

      const resume = await Resume.create({
        candidateId,
        fileUrl: "upload://queue-observability",
        rawText: "Node.js Redis",
        parsedData: {
          personalInfo: { name: "Queue Candidate" },
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

      const queueMessages = await waitForQueueMessage(redis, testQueueName);
      assert.equal(queueMessages.length > 0, true);

      const firstPayload = JSON.parse(queueMessages[0]);
      assert.equal(firstPayload.application_id, applicationId);
      assert.equal(firstPayload.retry_count, 0);
      assert.equal(typeof firstPayload.enqueued_at, "string");
      assert.equal(firstPayload.enqueued_at.length > 0, true);
    } finally {
      process.env.SCORING_QUEUE_NAME = oldQueueName;

      await redis.del(testQueueName);
      redis.disconnect();

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
