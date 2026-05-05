import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import mongoose from "mongoose";

import app from "../../src/app.js";
import Resume from "../../src/models/Resume.js";
import SystemConfig from "../../src/models/SystemConfig.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
  const dbName = (url.pathname || "/cv_matching").replace(/^\//, "") || "cv_matching";
  url.pathname = `/${dbName}_resume_restore_integration`;
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
  "resume restore integration: snapshot archive, history, and undo",
  { skip: !RUN_INTEGRATION },
  async () => {
    const mongoUri = getTestMongoUri();
    await mongoose.connect(mongoUri);

    await Promise.all([Resume.deleteMany({}), SystemConfig.deleteMany({})]);

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    try {
      const candidateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.restore@example.com",
        password: "StrongPass123",
        full_name: "Candidate Restore",
        role: "candidate",
      });
      assert.equal(candidateSignup.status, 201);
      const candidateToken = candidateSignup.json?.access_token;
      const candidateId = candidateSignup.json?.user?.id;
      assert.ok(candidateToken);
      assert.ok(candidateId);

      const masterResume = await Resume.create({
        candidateId,
        fileUrl: "upload://seed-master-resume",
        rawText: "Master resume raw text",
        parsedData: {
          personalInfo: {
            name: "Restore Candidate",
            title: "Backend Engineer",
            email: "candidate@example.com",
          },
          summary: "Master summary content.",
          workExperience: [],
          education: [],
          personalProjects: [],
          additional: {
            technicalSkills: ["Node.js"],
            languages: [],
            certificationsTraining: [],
            awards: [],
          },
        },
        filename: "master.pdf",
        title: "Master Resume",
        isMaster: true,
        processingStatus: "ready",
      });

      const tailoredResume = await Resume.create({
        candidateId,
        fileUrl: "upload://seed-tailored-resume",
        rawText: "Tailored resume raw text",
        parsedData: {
          personalInfo: {
            name: "Restore Candidate",
            title: "Backend Engineer",
            email: "candidate@example.com",
          },
          summary: "Tailored summary content.",
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
        filename: "tailored.pdf",
        title: "Tailored Resume",
        isMaster: false,
        parentResumeId: masterResume._id,
        processingStatus: "ready",
        jobDescription: "Backend role",
      });

      const fetchTailored = await requestJson(
        baseUrl,
        "GET",
        `/resumes?resume_id=${encodeURIComponent(String(tailoredResume._id))}`,
        undefined,
        candidateToken
      );
      assert.equal(fetchTailored.status, 200);

      const historyBefore = await requestJson(
        baseUrl,
        "GET",
        `/resumes/${tailoredResume._id}/history`,
        undefined,
        candidateToken
      );
      assert.equal(historyBefore.status, 200);
      assert.equal(Array.isArray(historyBefore.json?.data?.versions), true);
      assert.ok(historyBefore.json?.data?.versions?.length >= 2);

      const countBeforeRestore = await Resume.countDocuments({ candidateId });
      const originalRawText = tailoredResume.rawText;

      const restore = await requestJson(
        baseUrl,
        "PUT",
        `/resumes/${tailoredResume._id}/restore/${masterResume._id}`,
        {},
        candidateToken
      );
      assert.equal(restore.status, 200);

      const restoredDoc = await Resume.findById(tailoredResume._id).lean();
      assert.ok(restoredDoc);
      assert.equal(String(restoredDoc.restoredFromVersionId), String(masterResume._id));
      assert.ok(restoredDoc.restoredAt);
      assert.equal(restoredDoc.rawText, masterResume.rawText);

      const countAfterRestore = await Resume.countDocuments({ candidateId });
      assert.equal(countAfterRestore, countBeforeRestore + 1);

      const snapshot = await Resume.findOne({
        candidateId,
        rawText: originalRawText,
        _id: { $ne: tailoredResume._id },
      }).lean();
      assert.ok(snapshot);

      const historyAfter = await requestJson(
        baseUrl,
        "GET",
        `/resumes/${tailoredResume._id}/history`,
        undefined,
        candidateToken
      );
      assert.equal(historyAfter.status, 200);
      const currentEntry = historyAfter.json?.data?.versions?.find(
        (version) => version.resume_id === String(tailoredResume._id)
      );
      assert.equal(currentEntry?.restored_from_version_id, String(masterResume._id));
      assert.ok(currentEntry?.restored_at);

      const undo = await requestJson(
        baseUrl,
        "PUT",
        `/resumes/${tailoredResume._id}/restore/${snapshot._id}`,
        {},
        candidateToken
      );
      assert.equal(undo.status, 200);

      const undoneDoc = await Resume.findById(tailoredResume._id).lean();
      assert.ok(undoneDoc);
      assert.equal(undoneDoc.rawText, originalRawText);

      const compareFetch = await requestJson(
        baseUrl,
        "GET",
        `/resumes?resume_id=${encodeURIComponent(String(masterResume._id))}`,
        undefined,
        candidateToken
      );
      assert.equal(compareFetch.status, 200);
      assert.equal(compareFetch.json?.data?.resume_id, String(masterResume._id));
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
