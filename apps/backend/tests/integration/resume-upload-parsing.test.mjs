import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import "dotenv/config";

import mongoose from "mongoose";

import Resume from "../../src/models/Resume.js";
import { createResumeFromUpload } from "../../src/services/resume.service.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function getTestMongoUri() {
  const mongoUri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  assert.ok(mongoUri, "MONGO_URI is required for integration test");

  const url = new URL(mongoUri);
  const dbName = (url.pathname || "/cv_matching").replace(/^\//, "") || "cv_matching";
  url.pathname = `/${dbName}_resume_upload_parsing_integration`;
  return url.toString();
}

function createEmbeddingServer() {
  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/embed") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ vector: Array.from({ length: 384 }, () => 0.001) }));
      return;
    }

    if (req.method === "POST" && req.url === "/embed/batch") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          vectors: [Array.from({ length: 384 }, () => 0.001)],
        })
      );
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
            raw_text: "Parsed text from parser worker",
            parsed_data: {
              summary: "Parsed profile summary",
              skills: ["Node.js", "MongoDB"],
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
  "resume upload parsing integration: parser success and parser fallback",
  { skip: !RUN_INTEGRATION },
  async () => {
    const mongoUri = getTestMongoUri();
    await mongoose.connect(mongoUri);
    await Resume.deleteMany({});

    const oldEmbeddingServiceUrl = process.env.EMBEDDING_SERVICE_URL;
    const oldParsingServiceUrl = process.env.PARSING_SERVICE_URL;

    const { server: embeddingServer, baseUrl: embeddingUrl } = await createEmbeddingServer();
    const { server: parsingServer, baseUrl: parsingUrl } = await createParsingServer();

    process.env.EMBEDDING_SERVICE_URL = embeddingUrl;

    try {
      process.env.PARSING_SERVICE_URL = parsingUrl;

      const parsedUpload = await createResumeFromUpload(
        {
          originalname: "parsed.txt",
          mimetype: "text/plain",
          size: Buffer.byteLength("Original upload content"),
          buffer: Buffer.from("Original upload content", "utf8"),
        },
        new mongoose.Types.ObjectId().toString()
      );

      assert.equal(typeof parsedUpload.resume_id, "string");
      const parsedResume = await Resume.findById(parsedUpload.resume_id);
      assert.ok(parsedResume);
      assert.equal(parsedResume.rawText, "Parsed text from parser worker");
      assert.equal(parsedResume.processingStatus, "ready");
      assert.equal(typeof parsedResume.parsedData, "object");
      assert.equal(parsedResume.parsedData?.summary, "Parsed profile summary");

      process.env.PARSING_SERVICE_URL = "http://127.0.0.1:9";

      const fallbackContent = "Fallback textual content from upload";
      const fallbackUpload = await createResumeFromUpload(
        {
          originalname: "fallback.txt",
          mimetype: "text/plain",
          size: Buffer.byteLength(fallbackContent),
          buffer: Buffer.from(fallbackContent, "utf8"),
        },
        new mongoose.Types.ObjectId().toString()
      );

      assert.equal(typeof fallbackUpload.resume_id, "string");
      const fallbackResume = await Resume.findById(fallbackUpload.resume_id);
      assert.ok(fallbackResume);
      assert.equal(fallbackResume.rawText, fallbackContent);
      assert.equal(fallbackResume.processingStatus, "ready");
      assert.equal(fallbackResume.parsedData, null);
    } finally {
      process.env.EMBEDDING_SERVICE_URL = oldEmbeddingServiceUrl;
      process.env.PARSING_SERVICE_URL = oldParsingServiceUrl;

      await closeServer(parsingServer);
      await closeServer(embeddingServer);

      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
);
