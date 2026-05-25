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
  url.pathname = `/${dbName}_job_update_integration`;
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
  "job update endpoints: support benefits/deadline and keep important history",
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
        email: "recruiter.job-update@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Job Update",
        role: "recruiter",
      });
      assert.equal(recruiterSignup.status, 201);
      const recruiterToken = recruiterSignup.json?.access_token;
      const recruiterId = recruiterSignup.json?.user?.id;
      assert.ok(recruiterToken);
      assert.ok(recruiterId);

      const created = await Job.create({
        recruiterId,
        title: "Backend Engineer",
        description: "Build APIs",
        requirements: "Node.js, MongoDB",
        cleanText: "Backend Engineer\nBuild APIs\nNode.js, MongoDB",
        category: "IT",
        location: "Hanoi",
        experienceLevel: "Mid",
        status: "active",
      });

      const firstUpdate = await requestJson(baseUrl, "PATCH", `/jobs/${created._id}`, {
        benefits: "Remote, yearly bonus",
        applicationDeadline: "2026-12-31T00:00:00.000Z",
        status: "closed",
      }, recruiterToken);

      assert.equal(firstUpdate.status, 200);
      assert.equal(firstUpdate.json?.status, "closed");
      assert.equal(firstUpdate.json?.benefits, "Remote, yearly bonus");
      assert.equal(firstUpdate.json?.applicationDeadline, "2026-12-31T00:00:00.000Z");
      assert.ok(Array.isArray(firstUpdate.json?.importantChangeHistory));
      assert.ok(firstUpdate.json?.importantChangeHistory?.length >= 1);

      const lastHistory = firstUpdate.json?.importantChangeHistory?.at(-1);
      assert.ok(lastHistory?.changedFields?.includes("benefits"));
      assert.ok(lastHistory?.changedFields?.includes("applicationDeadline"));
      assert.ok(lastHistory?.changedFields?.includes("status"));
      assert.ok(Array.isArray(lastHistory?.changes));
      const benefitsChange = lastHistory?.changes?.find((change) => change.field === "benefits");
      assert.ok(benefitsChange?.before === null || benefitsChange?.before === "");
      assert.equal(benefitsChange?.after, "Remote, yearly bonus");
      const statusChange = lastHistory?.changes?.find((change) => change.field === "status");
      assert.equal(statusChange?.before, "active");
      assert.equal(statusChange?.after, "closed");

      const secondUpdate = await requestJson(baseUrl, "PATCH", `/jobs/${created._id}`, {
        status: "active",
      }, recruiterToken);

      assert.equal(secondUpdate.status, 200);
      assert.equal(secondUpdate.json?.status, "active");
      assert.equal(secondUpdate.json?.title, "Backend Engineer");

      const invalidDeadline = await requestJson(baseUrl, "PATCH", `/jobs/${created._id}`, {
        applicationDeadline: "not-a-date",
      }, recruiterToken);
      assert.equal(invalidDeadline.status, 400);
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

test(
  "job delete endpoints: perform soft delete, keep audit, and hide from default listings",
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
        email: "recruiter.soft-delete@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Soft Delete",
        role: "recruiter",
      });
      assert.equal(recruiterSignup.status, 201);
      const recruiterToken = recruiterSignup.json?.access_token;
      const recruiterId = recruiterSignup.json?.user?.id;
      assert.ok(recruiterToken);
      assert.ok(recruiterId);

      const created = await Job.create({
        recruiterId,
        title: "Frontend Engineer",
        description: "Build frontends",
        requirements: "React",
        cleanText: "Frontend Engineer\nBuild frontends\nReact",
        category: "IT",
        location: "HCMC",
        experienceLevel: "Senior",
        status: "active",
      });

      const listBeforeDelete = await requestJson(baseUrl, "GET", "/jobs", undefined, recruiterToken);
      assert.equal(listBeforeDelete.status, 200);
      assert.ok(listBeforeDelete.json?.data?.some((row) => String(row._id) === String(created._id)));

      const deleteResponse = await requestJson(
        baseUrl,
        "DELETE",
        `/jobs/${created._id}`,
        undefined,
        recruiterToken
      );
      assert.equal(deleteResponse.status, 200);
      assert.equal(deleteResponse.json?.status, "deleted");
      assert.ok(deleteResponse.json?.deletedAt);

      const getDeletedDefault = await requestJson(
        baseUrl,
        "GET",
        `/jobs/${created._id}`,
        undefined,
        recruiterToken
      );
      assert.equal(getDeletedDefault.status, 404);

      const getDeletedWithFlag = await requestJson(
        baseUrl,
        "GET",
        `/jobs/${created._id}?include_deleted=true`,
        undefined,
        recruiterToken
      );
      assert.equal(getDeletedWithFlag.status, 200);
      assert.equal(getDeletedWithFlag.json?.status, "deleted");
      assert.ok(Array.isArray(getDeletedWithFlag.json?.importantChangeHistory));

      const deleteHistory = getDeletedWithFlag.json?.importantChangeHistory?.at(-1);
      assert.equal(deleteHistory?.summary, "Soft deleted job");
      const statusChange = deleteHistory?.changes?.find((change) => change.field === "status");
      assert.equal(statusChange?.before, "active");
      assert.equal(statusChange?.after, "deleted");

      const listAfterDelete = await requestJson(baseUrl, "GET", "/jobs", undefined, recruiterToken);
      assert.equal(listAfterDelete.status, 200);
      assert.ok(!listAfterDelete.json?.data?.some((row) => String(row._id) === String(created._id)));

      const listDeletedOnly = await requestJson(
        baseUrl,
        "GET",
        "/jobs?status=deleted",
        undefined,
        recruiterToken
      );
      assert.equal(listDeletedOnly.status, 200);
      assert.ok(listDeletedOnly.json?.data?.some((row) => String(row._id) === String(created._id)));
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
