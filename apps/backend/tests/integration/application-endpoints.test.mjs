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
  if (process.env.MONGO_URI_TEST) {
    return process.env.MONGO_URI_TEST;
  }

  const mongoUri = process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
  const dbName = (url.pathname || "/cv_matching").replace(/^\//, "") || "cv_matching";
  url.pathname = `/${dbName}_applications_integration`;
  return url.toString();
}

async function requestJson(baseUrl, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
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
  "application endpoints: create + ranked + history + status + feedback",
  { skip: !RUN_INTEGRATION },
  async () => {
    const mongoUri = getTestMongoUri();
    await mongoose.connect(mongoUri);

    await Promise.all([
      Application.deleteMany({}),
      Job.deleteMany({}),
      Resume.deleteMany({}),
      User.deleteMany({}),
      SystemConfig.deleteMany({}),
    ]);

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    try {
      const recruiter = await User.create({
        email: "recruiter.application@example.com",
        password: "x".repeat(60),
        role: "recruiter",
        fullName: "Recruiter Test",
      });

      const candidate = await User.create({
        email: "candidate.application@example.com",
        password: "x".repeat(60),
        role: "candidate",
        fullName: "Candidate Test",
      });

      const candidate2 = await User.create({
        email: "candidate.application.2@example.com",
        password: "x".repeat(60),
        role: "candidate",
        fullName: "Candidate Second",
      });

      const job = await Job.create({
        recruiterId: recruiter._id,
        title: "Senior Backend Engineer",
        description: "Build and scale APIs",
        requirements: "Node.js MongoDB Redis",
        cleanText: "Build and scale APIs with Node.js MongoDB Redis",
        category: "IT",
        status: "active",
      });

      const resumeA = await Resume.create({
        candidateId: candidate._id,
        fileUrl: "upload://resume-a",
        rawText: "Node.js MongoDB",
        parsedData: {
          personalInfo: { name: "Candidate Test" },
        },
        processingStatus: "ready",
      });

      const resumeB = await Resume.create({
        candidateId: candidate2._id,
        fileUrl: "upload://resume-b",
        rawText: "Node.js only",
        parsedData: {
          personalInfo: { name: "Candidate Second" },
        },
        processingStatus: "ready",
      });

      const createA = await requestJson(baseUrl, "POST", "/applications", {
        job_id: String(job._id),
        resume_id: String(resumeA._id),
      });

      assert.equal(createA.status, 201);
      assert.equal(typeof createA.json?.data?.application_id, "string");

      const createDuplicate = await requestJson(baseUrl, "POST", "/applications", {
        job_id: String(job._id),
        resume_id: String(resumeA._id),
      });
      assert.equal(createDuplicate.status, 409);

      const createdB = await Application.create({
        jobId: job._id,
        resumeId: resumeB._id,
        status: "new",
        aiStatus: "completed",
        aiScores: {
          semanticScore: 0.92,
          keywordScore: 0.8,
          hybridScore: 0.88,
        },
        aiDetails: {
          matchedKeywords: ["node.js", "mongodb"],
          missingKeywords: ["redis"],
        },
      });

      await Application.findByIdAndUpdate(createA.json.data.application_id, {
        $set: {
          aiStatus: "completed",
          aiScores: {
            semanticScore: 0.7,
            keywordScore: 0.5,
            hybridScore: 0.64,
          },
          aiDetails: {
            matchedKeywords: ["node.js"],
            missingKeywords: ["mongodb", "redis"],
          },
        },
      });

      const ranked = await requestJson(
        baseUrl,
        "GET",
        `/applications/ranked?job_id=${encodeURIComponent(String(job._id))}`
      );

      assert.equal(ranked.status, 200);
      assert.equal(Array.isArray(ranked.json?.data?.candidates), true);
      assert.equal(ranked.json.data.candidates.length, 2);
      assert.equal(
        ranked.json.data.candidates[0].scores.hybrid_score >=
          ranked.json.data.candidates[1].scores.hybrid_score,
        true
      );

      const summary = await requestJson(
        baseUrl,
        "GET",
        `/applications/summary?job_id=${encodeURIComponent(String(job._id))}`
      );
      assert.equal(summary.status, 200);
      assert.equal(summary.json?.data?.total, 2);
      assert.equal(summary.json?.data?.by_status?.new, 2);
      assert.equal(summary.json?.data?.by_ai_status?.completed, 2);

      const jobsList = await requestJson(baseUrl, "GET", "/jobs");
      assert.equal(jobsList.status, 200);
      assert.equal(Array.isArray(jobsList.json?.data), true);
      assert.equal(jobsList.json.data[0]?.applications_count, 2);

      const jobDetail = await requestJson(baseUrl, "GET", `/jobs/${encodeURIComponent(String(job._id))}`);
      assert.equal(jobDetail.status, 200);
      assert.equal(jobDetail.json?.applications_count, 2);

      const history = await requestJson(
        baseUrl,
        "GET",
        `/applications/history?candidate_id=${encodeURIComponent(String(candidate._id))}`
      );

      assert.equal(history.status, 200);
      assert.equal(history.json?.data?.candidate_id, String(candidate._id));
      assert.equal(Array.isArray(history.json?.data?.applications), true);
      assert.equal(history.json.data.applications.length, 1);

      const patchStatus = await requestJson(
        baseUrl,
        "PATCH",
        `/applications/${encodeURIComponent(createA.json.data.application_id)}/status`,
        { status: "interview", changed_by: "recruiter-ui" }
      );

      assert.equal(patchStatus.status, 200);
      assert.equal(patchStatus.json?.data?.status, "interview");

      const statusHistory = await requestJson(
        baseUrl,
        "GET",
        `/applications/${encodeURIComponent(createA.json.data.application_id)}/status-history`
      );

      assert.equal(statusHistory.status, 200);
      assert.equal(statusHistory.json?.data?.current_status, "interview");
      assert.equal(Array.isArray(statusHistory.json?.data?.history), true);
      assert.equal(statusHistory.json?.data?.history?.length >= 2, true);
      assert.equal(statusHistory.json?.data?.history?.[0]?.to_status, "interview");
      assert.equal(statusHistory.json?.data?.history?.[0]?.changed_by, "recruiter-ui");

      const recentStatusChanges = await requestJson(
        baseUrl,
        "GET",
        `/applications/status-changes?job_id=${encodeURIComponent(String(job._id))}&status=interview&changed_by=recruiter&changed_after=2000-01-01&changed_before=2100-01-01`
      );

      assert.equal(recentStatusChanges.status, 200);
      assert.equal(Array.isArray(recentStatusChanges.json?.data?.changes), true);
      assert.equal(recentStatusChanges.json?.data?.changes?.length >= 1, true);
      assert.equal(recentStatusChanges.json?.data?.changes?.[0]?.to_status, "interview");
      assert.equal(recentStatusChanges.json?.data?.changes?.[0]?.changed_by, "recruiter-ui");

      const recentStatusChangesInvalidDate = await requestJson(
        baseUrl,
        "GET",
        `/applications/status-changes?job_id=${encodeURIComponent(String(job._id))}&changed_after=not-a-date`
      );

      assert.equal(recentStatusChangesInvalidDate.status, 400);

      const rankedAfterStatus = await requestJson(
        baseUrl,
        "GET",
        `/applications/ranked?job_id=${encodeURIComponent(String(job._id))}`
      );

      assert.equal(rankedAfterStatus.status, 200);
      const updatedCandidate = rankedAfterStatus.json?.data?.candidates?.find(
        (item) => item.application_id === createA.json.data.application_id
      );
      assert.equal(updatedCandidate?.status, "interview");
      assert.equal(updatedCandidate?.status_audit?.to_status, "interview");
      assert.equal(updatedCandidate?.status_audit?.changed_by, "recruiter-ui");

      const feedback = await requestJson(
        baseUrl,
        "GET",
        `/applications/${encodeURIComponent(String(createdB._id))}/feedback`
      );

      assert.equal(feedback.status, 200);
      assert.equal(typeof feedback.json?.data?.scores?.hybrid_score, "number");
      assert.equal(Array.isArray(feedback.json?.data?.explainability?.missing_keywords), true);
      assert.equal(Array.isArray(feedback.json?.data?.recommendations), true);
      assert.equal(feedback.json.data.recommendations.length >= 1, true);

      const withSourceFile = await Resume.create({
        candidateId: candidate._id,
        fileUrl: "upload://resume-download",
        rawText: "Original resume text",
        filename: "candidate-original.txt",
        sourceFile: {
          filename: "candidate-original.txt",
          mimeType: "text/plain",
          size: 20,
          data: Buffer.from("Original resume text", "utf8"),
        },
        parsedData: {},
        processingStatus: "ready",
      });

      const downloadResponse = await fetch(
        `${baseUrl}/resumes/${encodeURIComponent(String(withSourceFile._id))}/download`
      );

      assert.equal(downloadResponse.status, 200);
      assert.match(downloadResponse.headers.get("content-type") || "", /text\/plain/i);
      const downloaded = Buffer.from(await downloadResponse.arrayBuffer()).toString("utf8");
      assert.equal(downloaded, "Original resume text");
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
