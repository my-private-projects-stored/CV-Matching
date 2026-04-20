import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import "dotenv/config";

import mongoose from "mongoose";

import app from "../../src/app.js";
import Application from "../../src/models/Application.js";
import Job from "../../src/models/Job.js";
import Resume from "../../src/models/Resume.js";
import SystemConfig from "../../src/models/SystemConfig.js";
import { ensureVectorCollections } from "../../src/infrastructure/qdrant/vector.repository.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
  const dbName = (url.pathname || "/cv_matching").replace(/^\//, "") || "cv_matching";
  url.pathname = `/${dbName}_product_e2e_candidate_flow_integration`;
  return url.toString();
}

function createEmbeddingServer() {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/embed") {
      req.on("data", () => undefined);
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ vector: Array.from({ length: 384 }, () => 0.001) }));
      });
      return;
    }

    if (req.method === "POST" && req.url === "/embed/batch") {
      req.on("data", () => undefined);
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ vectors: [Array.from({ length: 384 }, () => 0.001)] }));
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "Not found" }));
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
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

  return { status: response.status, json, text, headers: response.headers };
}

async function requestMultipart(baseUrl, path, fileName, mimeType, content, token) {
  const formData = new FormData();
  formData.append("file", new Blob([Buffer.from(content, "utf8")], { type: mimeType }), fileName);

  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { status: response.status, json, text, headers: response.headers };
}

test(
  "product e2e flow: candidate upload -> job ingest -> tailor -> preview -> confirm -> pdf export",
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

    const oldEmbeddingServiceUrl = process.env.EMBEDDING_SERVICE_URL;
    const oldParsingServiceUrl = process.env.PARSING_SERVICE_URL;

    const { server: embeddingServer, baseUrl: embeddingUrl } = await createEmbeddingServer();

    process.env.EMBEDDING_SERVICE_URL = embeddingUrl;
    process.env.PARSING_SERVICE_URL = "http://127.0.0.1:9";
    await ensureVectorCollections();

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    try {
      const recruiterSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "recruiter.product.e2e@example.com",
        password: "StrongPass123",
        full_name: "Recruiter Product E2E",
        role: "recruiter",
      });
      assert.equal(recruiterSignup.status, 201);
      const recruiterToken = recruiterSignup.json?.access_token;
      assert.ok(recruiterToken);

      const llmConfig = await requestJson(
        baseUrl,
        "PUT",
        "/config/llm-api-key",
        {
          provider: "ollama",
          model: "gemma3:4b",
          api_base: "http://localhost:11434",
        },
        recruiterToken
      );
      assert.equal(llmConfig.status, 200);

      const candidateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.product.e2e@example.com",
        password: "StrongPass123",
        full_name: "Candidate Product E2E",
        role: "candidate",
      });
      assert.equal(candidateSignup.status, 201);
      const candidateToken = candidateSignup.json?.access_token;
      assert.ok(candidateToken);

      const candidateForeignSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.foreign.product.e2e@example.com",
        password: "StrongPass123",
        full_name: "Candidate Foreign Product E2E",
        role: "candidate",
      });
      assert.equal(candidateForeignSignup.status, 201);
      const candidateForeignToken = candidateForeignSignup.json?.access_token;
      assert.ok(candidateForeignToken);

      const foreignUpload = await requestMultipart(
        baseUrl,
        "/resumes/upload",
        "candidate-foreign-resume.txt",
        "text/plain",
        "Foreign candidate profile with Java and Spring stack experience.",
        candidateForeignToken
      );
      assert.equal(foreignUpload.status, 201);
      assert.equal(typeof foreignUpload.json?.resume_id, "string");
      const foreignResumeId = foreignUpload.json.resume_id;

      const upload = await requestMultipart(
        baseUrl,
        "/resumes/upload",
        "candidate-resume.txt",
        "text/plain",
        "Backend engineer with Node.js, MongoDB, REST APIs, and Docker experience.",
        candidateToken
      );
      assert.equal(upload.status, 201);
      assert.equal(upload.json?.processing_status, "ready");
      assert.equal(typeof upload.json?.resume_id, "string");

      const masterResumeId = upload.json.resume_id;

      const uploadJobsAsCandidate = await requestJson(
        baseUrl,
        "POST",
        "/jobs/upload",
        {
          job_descriptions: [
            "Senior Backend Engineer role requiring Node.js, MongoDB, API design, observability, and Docker.",
          ],
          resume_id: masterResumeId,
        },
        candidateToken
      );
      assert.equal(uploadJobsAsCandidate.status, 200);
      assert.equal(Array.isArray(uploadJobsAsCandidate.json?.job_id), true);
      assert.equal(uploadJobsAsCandidate.json?.job_id?.length, 1);

      const jobId = uploadJobsAsCandidate.json.job_id[0];

      const preview = await requestJson(
        baseUrl,
        "POST",
        "/resumes/improve/preview",
        {
          resume_id: masterResumeId,
          job_id: jobId,
        },
        candidateToken
      );
      assert.equal(preview.status, 200);
      assert.equal(preview.json?.data?.resume_id, null);
      assert.equal(preview.json?.data?.job_id, jobId);
      assert.equal(typeof preview.json?.data?.diff_summary?.total_changes, "number");
      assert.equal(Array.isArray(preview.json?.data?.detailed_changes), true);

      const confirm = await requestJson(
        baseUrl,
        "POST",
        "/resumes/improve/confirm",
        {
          resume_id: masterResumeId,
          job_id: jobId,
          improved_data: preview.json?.data?.resume_preview,
          improvements: preview.json?.data?.improvements,
        },
        candidateToken
      );
      assert.equal(confirm.status, 200);
      assert.equal(typeof confirm.json?.data?.resume_id, "string");

      const tailoredResumeId = confirm.json.data.resume_id;

      const fetchedTailored = await requestJson(
        baseUrl,
        "GET",
        `/resumes?resume_id=${encodeURIComponent(tailoredResumeId)}`,
        undefined,
        candidateToken
      );
      assert.equal(fetchedTailored.status, 200);
      assert.equal(fetchedTailored.json?.data?.parent_id, masterResumeId);
      assert.equal(fetchedTailored.json?.data?.raw_resume?.processing_status, "ready");

      const createApplicationAsCandidate = await requestJson(
        baseUrl,
        "POST",
        "/applications",
        {
          job_id: jobId,
          resume_id: tailoredResumeId,
        },
        candidateToken
      );
      assert.equal(createApplicationAsCandidate.status, 201);
      assert.equal(typeof createApplicationAsCandidate.json?.data?.application_id, "string");

      const createApplicationWithForeignResume = await requestJson(
        baseUrl,
        "POST",
        "/applications",
        {
          job_id: jobId,
          resume_id: foreignResumeId,
        },
        candidateToken
      );
      assert.equal(createApplicationWithForeignResume.status, 403);

      const duplicateApplicationAsCandidate = await requestJson(
        baseUrl,
        "POST",
        "/applications",
        {
          job_id: jobId,
          resume_id: tailoredResumeId,
        },
        candidateToken
      );
      assert.equal(duplicateApplicationAsCandidate.status, 409);

      const pdfResponse = await fetch(`${baseUrl}/resumes/${tailoredResumeId}/pdf`, {
        headers: { Authorization: `Bearer ${candidateToken}` },
      });
      assert.equal(pdfResponse.status, 200);
      assert.match(pdfResponse.headers.get("content-type") || "", /application\/pdf/i);
      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      assert.match(pdfBuffer.toString("utf8", 0, 8), /%PDF-1\.[0-9]/);
    } finally {
      process.env.EMBEDDING_SERVICE_URL = oldEmbeddingServiceUrl;
      process.env.PARSING_SERVICE_URL = oldParsingServiceUrl;

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      await closeServer(embeddingServer);
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
);

test(
  "product e2e guardrails: candidate job ingest requires own resume_id",
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
      const candidateA = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.a.product.e2e@example.com",
        password: "StrongPass123",
        full_name: "Candidate A Product E2E",
        role: "candidate",
      });
      assert.equal(candidateA.status, 201);
      const candidateAToken = candidateA.json?.access_token;
      const candidateAId = candidateA.json?.user?.id;
      assert.ok(candidateAToken);
      assert.ok(candidateAId);

      const candidateB = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.b.product.e2e@example.com",
        password: "StrongPass123",
        full_name: "Candidate B Product E2E",
        role: "candidate",
      });
      assert.equal(candidateB.status, 201);
      const candidateBId = candidateB.json?.user?.id;
      assert.ok(candidateBId);

      const candidateAResume = await Resume.create({
        candidateId: candidateAId,
        fileUrl: "upload://candidate-a-resume",
        rawText: "Candidate A resume",
        parsedData: { personalInfo: { name: "Candidate A" } },
        isMaster: true,
        processingStatus: "ready",
      });

      const candidateBResume = await Resume.create({
        candidateId: candidateBId,
        fileUrl: "upload://candidate-b-resume",
        rawText: "Candidate B resume",
        parsedData: { personalInfo: { name: "Candidate B" } },
        isMaster: true,
        processingStatus: "ready",
      });

      const missingResumeId = await requestJson(
        baseUrl,
        "POST",
        "/jobs/upload",
        {
          job_descriptions: ["Backend role with Node.js and MongoDB"],
        },
        candidateAToken
      );
      assert.equal(missingResumeId.status, 400);
      assert.match(missingResumeId.text, /resume_id/i);

      const foreignResume = await requestJson(
        baseUrl,
        "POST",
        "/jobs/upload",
        {
          job_descriptions: ["Backend role with Docker and observability"],
          resume_id: String(candidateBResume._id),
        },
        candidateAToken
      );
      assert.equal(foreignResume.status, 403);

      const ownResume = await requestJson(
        baseUrl,
        "POST",
        "/jobs/upload",
        {
          job_descriptions: ["Backend role with API design"],
          resume_id: String(candidateAResume._id),
        },
        candidateAToken
      );
      assert.equal(ownResume.status, 200);
      assert.equal(Array.isArray(ownResume.json?.job_id), true);
      assert.equal(ownResume.json?.job_id?.length, 1);
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
