import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import mongoose from "mongoose";

import app from "../../src/app.js";
import Application from "../../src/models/Application.js";
import Job from "../../src/models/Job.js";
import Resume from "../../src/models/Resume.js";
import User from "../../src/models/User.js";
import { parseCsvTable } from "../utils/csv-table.mjs";

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

      const resumeA = await Resume.create({
        candidateId: candidateA.userId,
        fileUrl: "upload://candidate-a",
        rawText: "Candidate A resume",
        parsedData: { personalInfo: { name: "Candidate A" } },
        processingStatus: "ready",
      });
      const resumeAId = String(resumeA._id);

      const resumeB = await Resume.create({
        candidateId: candidateB.userId,
        fileUrl: "upload://candidate-b",
        rawText: "Candidate B resume",
        parsedData: { personalInfo: { name: "Candidate B" } },
        processingStatus: "ready",
      });
      const resumeBId = String(resumeB._id);

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

      const candidateSummaryAccess = await requestJson(
        baseUrl,
        "GET",
        `/applications/summary?job_id=${encodeURIComponent(jobId)}`,
        undefined,
        candidateA.token
      );
      assert.equal(candidateSummaryAccess.status, 403);

      const candidateStatusChangesAccess = await requestJson(
        baseUrl,
        "GET",
        `/applications/status-changes?job_id=${encodeURIComponent(jobId)}`,
        undefined,
        candidateA.token
      );
      assert.equal(candidateStatusChangesAccess.status, 403);

      const candidateStatusChangesExport = await fetch(
        `${baseUrl}/applications/status-changes/export?job_id=${encodeURIComponent(jobId)}`,
        {
          headers: { Authorization: `Bearer ${candidateA.token}` },
        }
      );
      assert.equal(candidateStatusChangesExport.status, 403);

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

      const candidateBulkStatusUpdate = await requestJson(
        baseUrl,
        "PATCH",
        "/applications/status/bulk",
        {
          application_ids: [applicationAId, applicationBId],
          status: "screening",
          changed_by: "spoofed-client-actor",
        },
        candidateA.token
      );
      assert.equal(candidateBulkStatusUpdate.status, 403);

      const recruiterBulkStatusUpdate = await requestJson(
        baseUrl,
        "PATCH",
        "/applications/status/bulk",
        {
          application_ids: [applicationAId, applicationBId],
          status: "screening",
          changed_by: "spoofed-client-actor",
        },
        recruiter.token
      );
      assert.equal(recruiterBulkStatusUpdate.status, 200);

      const statusHistoryAfterRecruiterBulk = await requestJson(
        baseUrl,
        "GET",
        `/applications/${encodeURIComponent(applicationAId)}/status-history`,
        undefined,
        candidateA.token
      );
      assert.equal(statusHistoryAfterRecruiterBulk.status, 200);
      const recruiterBulkEntry = statusHistoryAfterRecruiterBulk.json?.data?.history?.find(
        (entry) => entry?.to_status === "screening"
      );
      assert.equal(Boolean(recruiterBulkEntry), true);
      assert.equal(recruiterBulkEntry?.changed_by, recruiter.email);
      assert.notEqual(recruiterBulkEntry?.changed_by, "spoofed-client-actor");

      const adminSummaryAccess = await requestJson(
        baseUrl,
        "GET",
        `/applications/summary?job_id=${encodeURIComponent(jobId)}`,
        undefined,
        admin.token
      );
      assert.equal(adminSummaryAccess.status, 200);
      assert.equal(typeof adminSummaryAccess.json?.data?.total, "number");
      assert.equal(adminSummaryAccess.json?.data?.total >= 2, true);

      const adminStatusChangesAccess = await requestJson(
        baseUrl,
        "GET",
        `/applications/status-changes?job_id=${encodeURIComponent(jobId)}`,
        undefined,
        admin.token
      );
      assert.equal(adminStatusChangesAccess.status, 200);
      assert.equal(Array.isArray(adminStatusChangesAccess.json?.data?.changes), true);
      assert.equal(adminStatusChangesAccess.json?.data?.changes?.length >= 1, true);

      const adminStatusChangesSpoofedActorFilter = await requestJson(
        baseUrl,
        "GET",
        `/applications/status-changes?job_id=${encodeURIComponent(jobId)}&changed_by=spoofed-client-actor`,
        undefined,
        admin.token
      );
      assert.equal(adminStatusChangesSpoofedActorFilter.status, 200);
      assert.equal(adminStatusChangesSpoofedActorFilter.json?.data?.changes?.length, 0);

      const adminStatusChangesExport = await fetch(
        `${baseUrl}/applications/status-changes/export?job_id=${encodeURIComponent(jobId)}`,
        {
          headers: { Authorization: `Bearer ${admin.token}` },
        }
      );
      assert.equal(adminStatusChangesExport.status, 200);
      assert.match(adminStatusChangesExport.headers.get("content-type") || "", /text\/csv/i);
      const adminExportCsv = await adminStatusChangesExport.text();
      assert.match(adminExportCsv, /application_id,job_id,job_title,candidate_id,candidate_full_name/);

      const adminStatusChangesExportSpoofedActorFilter = await fetch(
        `${baseUrl}/applications/status-changes/export?job_id=${encodeURIComponent(jobId)}&changed_by=spoofed-client-actor`,
        {
          headers: { Authorization: `Bearer ${admin.token}` },
        }
      );
      assert.equal(adminStatusChangesExportSpoofedActorFilter.status, 200);
      const adminSpoofedActorExportCsv = await adminStatusChangesExportSpoofedActorFilter.text();
      const adminSpoofedActorExportRows = parseCsvTable(adminSpoofedActorExportCsv);
      assert.equal(adminSpoofedActorExportRows.length, 1);

      await Application.findByIdAndUpdate(applicationBId, {
        $set: { status: "offer" },
        $push: {
          statusHistory: {
            fromStatus: "screening",
            toStatus: "offer",
            changedBy: "boundary-admin",
            changedAt: new Date("2026-03-10T10:00:00.000Z"),
          },
        },
      });

      await Application.findByIdAndUpdate(applicationAId, {
        $set: { status: "offer" },
        $push: {
          statusHistory: {
            fromStatus: "screening",
            toStatus: "offer",
            changedBy: "boundary-admin",
            changedAt: new Date("2026-03-10T11:00:00.000Z"),
          },
        },
      });

      const adminStatusChangesBoundaryIncluded = await requestJson(
        baseUrl,
        "GET",
        `/applications/status-changes?job_id=${encodeURIComponent(jobId)}&status=offer&changed_by=boundary-admin&changed_after=2026-03-10&changed_before=2026-03-10`,
        undefined,
        admin.token
      );
      assert.equal(adminStatusChangesBoundaryIncluded.status, 200);
      const boundaryIncludedChanges = adminStatusChangesBoundaryIncluded.json?.data?.changes || [];
      assert.equal(boundaryIncludedChanges.length, 2);
      assert.equal(
        boundaryIncludedChanges.every(
          (entry) => entry?.changed_by === "boundary-admin" && entry?.to_status === "offer"
        ),
        true
      );

      const adminStatusChangesBoundaryExport = await fetch(
        `${baseUrl}/applications/status-changes/export?job_id=${encodeURIComponent(jobId)}&status=offer&changed_by=boundary-admin&changed_after=2026-03-10&changed_before=2026-03-10`,
        {
          headers: { Authorization: `Bearer ${admin.token}` },
        }
      );
      assert.equal(adminStatusChangesBoundaryExport.status, 200);
      const adminBoundaryExportCsv = await adminStatusChangesBoundaryExport.text();
      const adminBoundaryExportRows = parseCsvTable(adminBoundaryExportCsv);
      assert.equal(adminBoundaryExportRows.length, 3);
      const boundaryExportDataRows = adminBoundaryExportRows.slice(1);
      assert.equal(
        boundaryExportDataRows.every((columns) => columns[7] === "offer" && columns[9] === "boundary-admin"),
        true
      );
      const boundaryIncludedApplicationIds = boundaryIncludedChanges
        .map((entry) => entry?.application_id)
        .filter(Boolean)
        .sort();
      const boundaryExportApplicationIds = boundaryExportDataRows
        .map((columns) => columns[0])
        .filter(Boolean)
        .sort();
      assert.deepEqual(boundaryExportApplicationIds, boundaryIncludedApplicationIds);
      const boundaryIncludedOrder = boundaryIncludedChanges.map((entry) => entry?.application_id);
      const boundaryExportOrder = boundaryExportDataRows.map((columns) => columns[0]);
      assert.deepEqual(boundaryExportOrder, boundaryIncludedOrder);
      const boundaryIncludedChangedAtOrder = boundaryIncludedChanges.map((entry) =>
        new Date(String(entry?.changed_at)).getTime()
      );
      const boundaryExportChangedAtOrder = boundaryExportDataRows.map((columns) =>
        new Date(String(columns[10])).getTime()
      );
      assert.equal(boundaryIncludedChangedAtOrder.every((value) => Number.isFinite(value)), true);
      assert.equal(boundaryExportChangedAtOrder.every((value) => Number.isFinite(value)), true);
      assert.deepEqual(boundaryExportChangedAtOrder, boundaryIncludedChangedAtOrder);
      assert.equal(
        boundaryIncludedChangedAtOrder[0] > boundaryIncludedChangedAtOrder[1],
        true
      );
      const boundaryIncludedTuples = boundaryIncludedChanges
        .map((entry) => [entry?.application_id, entry?.to_status, entry?.changed_by].join("|"))
        .sort();
      const boundaryExportTuples = boundaryExportDataRows
        .map((columns) => [columns[0], columns[7], columns[9]].join("|"))
        .sort();
      assert.deepEqual(boundaryExportTuples, boundaryIncludedTuples);
      const boundaryIncludedTupleOrder = boundaryIncludedChanges.map((entry) =>
        [entry?.application_id, entry?.to_status, entry?.changed_by].join("|")
      );
      const boundaryExportTupleOrder = boundaryExportDataRows.map((columns) =>
        [columns[0], columns[7], columns[9]].join("|")
      );
      assert.deepEqual(boundaryExportTupleOrder, boundaryIncludedTupleOrder);

      const specialChangedBy = 'ops "qa",lead';
      const specialJobTitle = 'Platform "Core", Engineer\nNorth Region';
      const specialCandidateName = 'Candidate "A", Prime\nTier 1';
      await Job.findByIdAndUpdate(jobId, {
        $set: { title: specialJobTitle },
      });
      await User.findByIdAndUpdate(candidateA.userId, {
        $set: { fullName: specialCandidateName },
      });
      await Application.findByIdAndUpdate(applicationAId, {
        $set: { status: "offer" },
        $push: {
          statusHistory: {
            fromStatus: "offer",
            toStatus: "offer",
            changedBy: specialChangedBy,
            changedAt: new Date("2026-03-10T12:00:00.000Z"),
          },
        },
      });

      const specialFilterQuery =
        `/applications/status-changes?job_id=${encodeURIComponent(jobId)}` +
        `&status=offer&changed_by=${encodeURIComponent(specialChangedBy)}` +
        "&changed_after=2026-03-10&changed_before=2026-03-10";
      const adminStatusChangesSpecialActorFilter = await requestJson(
        baseUrl,
        "GET",
        specialFilterQuery,
        undefined,
        admin.token
      );
      assert.equal(adminStatusChangesSpecialActorFilter.status, 200);
      const specialFilteredChanges = adminStatusChangesSpecialActorFilter.json?.data?.changes || [];
      assert.equal(specialFilteredChanges.length, 1);
      assert.equal(specialFilteredChanges[0]?.changed_by, specialChangedBy);
      assert.equal(specialFilteredChanges[0]?.job?.title, specialJobTitle);
      assert.equal(specialFilteredChanges[0]?.candidate?.full_name, specialCandidateName);

      const adminStatusChangesSpecialActorExport = await fetch(
        `${baseUrl}/applications/status-changes/export?job_id=${encodeURIComponent(jobId)}&status=offer&changed_by=${encodeURIComponent(specialChangedBy)}&changed_after=2026-03-10&changed_before=2026-03-10`,
        {
          headers: { Authorization: `Bearer ${admin.token}` },
        }
      );
      assert.equal(adminStatusChangesSpecialActorExport.status, 200);
      const specialActorExportCsv = await adminStatusChangesSpecialActorExport.text();
      const specialActorExportRows = parseCsvTable(specialActorExportCsv);
      assert.equal(specialActorExportRows.length, 2);
      const specialActorExportDataRow = specialActorExportRows[1];
      assert.equal(specialActorExportDataRow[2], specialJobTitle);
      assert.equal(specialActorExportDataRow[4], specialCandidateName);
      assert.equal(specialActorExportDataRow[9], specialChangedBy);

      const specialFilteredListTuples = specialFilteredChanges
        .map((entry) => [entry?.application_id, entry?.to_status, entry?.changed_by].join("|"))
        .sort();
      const specialFilteredExportTuples = specialActorExportRows
        .slice(1)
        .map((columns) => [columns[0], columns[7], columns[9]].join("|"))
        .sort();
      assert.deepEqual(specialFilteredExportTuples, specialFilteredListTuples);

      const adminStatusChangesBoundaryExcluded = await requestJson(
        baseUrl,
        "GET",
        `/applications/status-changes?job_id=${encodeURIComponent(jobId)}&status=offer&changed_by=boundary-admin&changed_before=2026-03-09`,
        undefined,
        admin.token
      );
      assert.equal(adminStatusChangesBoundaryExcluded.status, 200);
      const boundaryExcludedEntry = adminStatusChangesBoundaryExcluded.json?.data?.changes?.find(
        (entry) => entry?.changed_by === "boundary-admin"
      );
      assert.equal(Boolean(boundaryExcludedEntry), false);

      const adminStatusChangesInvalidDate = await requestJson(
        baseUrl,
        "GET",
        `/applications/status-changes?job_id=${encodeURIComponent(jobId)}&changed_after=not-a-date`,
        undefined,
        admin.token
      );
      assert.equal(adminStatusChangesInvalidDate.status, 400);

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
