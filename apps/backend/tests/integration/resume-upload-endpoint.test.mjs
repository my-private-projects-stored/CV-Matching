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

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
  const dbName = (url.pathname || "/cv_matching").replace(/^\//, "") || "cv_matching";
  url.pathname = `/${dbName}_resume_upload_endpoint_integration`;
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

async function requestMultipart(baseUrl, path, fileName, mimeType, content, token) {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([Buffer.from(content, "utf8")], { type: mimeType }),
    fileName
  );

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

  return { status: response.status, json, text };
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

function createParsingServer() {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/parse") {
      req.on("data", () => undefined);
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            raw_text: "Parsed text from upload endpoint parser",
            parsed_data: {
              summary: "Parsed endpoint summary",
              skills: ["Node.js", "Qdrant"],
              workExperience: [],
              education: [],
              personalProjects: [],
              additional: {
                technicalSkills: ["Node.js", "Qdrant"],
                languages: [],
                certificationsTraining: [],
                awards: [],
              },
            },
          })
        );
      });
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
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

test(
  "resume upload endpoint contract: parser success and fallback",
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
    const { server: parsingServer, baseUrl: parsingUrl } = await createParsingServer();

    process.env.EMBEDDING_SERVICE_URL = embeddingUrl;
    process.env.PARSING_SERVICE_URL = parsingUrl;

    const server = app.listen(0);
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    try {
      const candidateSignup = await requestJson(baseUrl, "POST", "/auth/signup", {
        email: "candidate.upload.endpoint@example.com",
        password: "StrongPass123",
        full_name: "Candidate Upload Endpoint",
        role: "candidate",
      });
      assert.equal(candidateSignup.status, 201);
      const candidateToken = candidateSignup.json?.access_token;
      assert.ok(candidateToken);

      const parsedUpload = await requestMultipart(
        baseUrl,
        "/resumes/upload",
        "resume-parsed.txt",
        "text/plain",
        "Original upload text should be replaced by parser",
        candidateToken
      );

      assert.equal(parsedUpload.status, 201);
      assert.equal(parsedUpload.json?.processing_status, "ready");
      assert.equal(typeof parsedUpload.json?.resume_id, "string");

      const invalidTypeUpload = await requestMultipart(
        baseUrl,
        "/resumes/upload",
        "resume.png",
        "image/png",
        "not-an-allowed-type",
        candidateToken
      );

      assert.equal(invalidTypeUpload.status, 400);
      assert.equal(invalidTypeUpload.json?.error_code, "invalid_upload_file_type");

      const oversizedContent = "a".repeat(4 * 1024 * 1024 + 1);
      const oversizedUpload = await requestMultipart(
        baseUrl,
        "/resumes/upload",
        "resume-oversize.txt",
        "text/plain",
        oversizedContent,
        candidateToken
      );
      assert.equal(oversizedUpload.status, 413);
      assert.equal(oversizedUpload.json?.error_code, "uploaded_file_too_large");

      const fetchedParsed = await requestJson(
        baseUrl,
        "GET",
        `/resumes?resume_id=${encodeURIComponent(parsedUpload.json.resume_id)}`,
        undefined,
        candidateToken
      );

      assert.equal(fetchedParsed.status, 200);
      assert.equal(
        fetchedParsed.json?.data?.raw_resume?.content,
        "Parsed text from upload endpoint parser"
      );
      assert.equal(fetchedParsed.json?.data?.processed_resume?.summary, "Parsed endpoint summary");

      process.env.PARSING_SERVICE_URL = "http://127.0.0.1:9";

      const fallbackText = "Fallback endpoint content";
      const fallbackUpload = await requestMultipart(
        baseUrl,
        "/resumes/upload",
        "resume-fallback.txt",
        "text/plain",
        fallbackText,
        candidateToken
      );

      assert.equal(fallbackUpload.status, 201);
      assert.equal(fallbackUpload.json?.processing_status, "ready");

      const fetchedFallback = await requestJson(
        baseUrl,
        "GET",
        `/resumes?resume_id=${encodeURIComponent(fallbackUpload.json.resume_id)}`,
        undefined,
        candidateToken
      );

      assert.equal(fetchedFallback.status, 200);
      assert.equal(fetchedFallback.json?.data?.raw_resume?.content, fallbackText);
      assert.equal(fetchedFallback.json?.data?.processed_resume, null);
    } finally {
      process.env.EMBEDDING_SERVICE_URL = oldEmbeddingServiceUrl;
      process.env.PARSING_SERVICE_URL = oldParsingServiceUrl;

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      await closeServer(parsingServer);
      await closeServer(embeddingServer);

      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
);
