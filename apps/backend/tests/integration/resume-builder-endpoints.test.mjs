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
  url.pathname = `/${dbName}_resume_builder_integration`;
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

async function signup(baseUrl, email) {
  const result = await requestJson(baseUrl, "POST", "/auth/signup", {
    email,
    password: "StrongPass123",
    full_name: email.split("@")[0],
    role: "candidate",
  });
  assert.equal(result.status, 201);
  return {
    token: result.json?.access_token,
    userId: result.json?.user?.id,
  };
}

test(
  "resume builder section endpoints mutate builderData with ownership",
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
      const owner = await signup(baseUrl, "candidate.builder.owner@example.com");
      const foreign = await signup(baseUrl, "candidate.builder.foreign@example.com");
      assert.ok(owner.token);
      assert.ok(owner.userId);
      assert.ok(foreign.token);

      const resume = await Resume.create({
        candidateId: owner.userId,
        fileUrl: "upload://builder-resume",
        rawText: "Builder resume",
        parsedData: {
          personalInfo: { name: "Builder Candidate" },
          summary: "Original summary",
          workExperience: [],
        },
        builderData: {
          sections: {
            personalInfo: { name: "Builder Candidate" },
            summary: "Original summary",
            workExperience: [],
          },
          sectionMeta: [
            { id: "personalInfo", key: "personalInfo", displayName: "Personal Info", isDefault: true, isVisible: true, order: 0 },
            { id: "summary", key: "summary", displayName: "Summary", isDefault: true, isVisible: true, order: 1 },
            { id: "workExperience", key: "workExperience", displayName: "Experience", isDefault: true, isVisible: true, order: 2 },
          ],
          template: "classic-single",
          formatSettings: { pageSize: "A4" },
          customSections: {},
        },
        processingStatus: "ready",
      });

      const foreignUpdate = await requestJson(
        baseUrl,
        "PATCH",
        `/resumes/${resume._id}/sections/summary`,
        { displayName: "Stolen" },
        foreign.token
      );
      assert.equal(foreignUpdate.status, 403);

      const addCustom = await requestJson(
        baseUrl,
        "POST",
        `/resumes/${resume._id}/sections`,
        { id: "publications", displayName: "Publications", content: "Published API design notes." },
        owner.token
      );
      assert.equal(addCustom.status, 201);
      assert.equal(addCustom.json?.data?.builder_data?.sections?.publications, "Published API design notes.");

      const hideSummary = await requestJson(
        baseUrl,
        "PATCH",
        `/resumes/${resume._id}/sections/summary`,
        { displayName: "Profile", isVisible: false, content: "Updated summary" },
        owner.token
      );
      assert.equal(hideSummary.status, 200);
      const summaryMeta = hideSummary.json?.data?.builder_data?.sectionMeta?.find((item) => item.id === "summary");
      assert.equal(summaryMeta?.displayName, "Profile");
      assert.equal(summaryMeta?.isVisible, false);
      assert.equal(hideSummary.json?.data?.builder_data?.sections?.summary, "Updated summary");
      assert.equal(hideSummary.json?.data?.processed_resume?.summary, "Updated summary");

      const reorder = await requestJson(
        baseUrl,
        "PATCH",
        `/resumes/${resume._id}/sections/reorder`,
        { section_ids: ["publications", "summary", "personalInfo", "workExperience"] },
        owner.token
      );
      assert.equal(reorder.status, 200);
      assert.equal(reorder.json?.data?.builder_data?.sectionMeta?.[0]?.id, "publications");

      const deleteDefault = await requestJson(
        baseUrl,
        "DELETE",
        `/resumes/${resume._id}/sections/summary`,
        undefined,
        owner.token
      );
      assert.equal(deleteDefault.status, 400);

      const deleteCustom = await requestJson(
        baseUrl,
        "DELETE",
        `/resumes/${resume._id}/sections/publications`,
        undefined,
        owner.token
      );
      assert.equal(deleteCustom.status, 200);
      assert.equal(deleteCustom.json?.data?.builder_data?.sections?.publications, undefined);
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
  }
);
