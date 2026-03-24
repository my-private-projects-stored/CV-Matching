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
  url.pathname = `/${dbName}_pdf_integration`;
  return url.toString();
}

test(
  "pdf endpoints contract: resume pdf + cover-letter pdf",
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
      const signupRes = await fetch(`${baseUrl}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "candidate.pdf@example.com",
          password: "StrongPass123",
          full_name: "Candidate PDF",
          role: "candidate",
        }),
      });
      const signupJson = await signupRes.json();
      assert.equal(signupRes.status, 201);
      const candidateToken = signupJson?.access_token;
      const candidateId = signupJson?.user?.id;
      assert.ok(candidateToken);
      assert.ok(candidateId);

      const resume = await Resume.create({
        candidateId,
        fileUrl: "upload://pdf-seed-resume",
        rawText: "Backend engineer with Node.js and MongoDB",
        parsedData: {
          personalInfo: {
            name: "PDF Candidate",
            title: "Backend Engineer",
          },
          summary: "Engineer focused on API quality and maintainability.",
          workExperience: [
            {
              id: 1,
              title: "Software Engineer",
              company: "Example Inc",
              description: ["Built internal APIs", "Improved service reliability"],
            },
          ],
          education: [],
          personalProjects: [],
          additional: {
            technicalSkills: ["Node.js", "MongoDB", "Docker"],
            languages: [],
            certificationsTraining: [],
            awards: [],
          },
        },
        coverLetter:
          "Dear Hiring Team,\n\nI am excited to apply for this role and contribute measurable impact.\n\nBest regards,\nPDF Candidate",
        processingStatus: "ready",
      });

      const resumePdfResponse = await fetch(`${baseUrl}/resumes/${resume._id}/pdf`, {
        headers: { Authorization: `Bearer ${candidateToken}` },
      });
      assert.equal(resumePdfResponse.status, 200);
      assert.match(resumePdfResponse.headers.get("content-type") || "", /application\/pdf/i);
      const resumePdfBuffer = Buffer.from(await resumePdfResponse.arrayBuffer());
      assert.match(resumePdfBuffer.toString("utf8", 0, 8), /%PDF-1\.[0-9]/);

      const coverPdfResponse = await fetch(`${baseUrl}/resumes/${resume._id}/cover-letter/pdf`, {
        headers: { Authorization: `Bearer ${candidateToken}` },
      });
      assert.equal(coverPdfResponse.status, 200);
      assert.match(coverPdfResponse.headers.get("content-type") || "", /application\/pdf/i);
      const coverPdfBuffer = Buffer.from(await coverPdfResponse.arrayBuffer());
      assert.match(coverPdfBuffer.toString("utf8", 0, 8), /%PDF-1\.[0-9]/);

      const noCoverResume = await Resume.create({
        candidateId,
        fileUrl: "upload://pdf-seed-resume-no-cover",
        rawText: "Resume without cover letter",
        parsedData: { personalInfo: { name: "No Cover" } },
        processingStatus: "ready",
      });

      const missingCoverResponse = await fetch(
        `${baseUrl}/resumes/${noCoverResume._id}/cover-letter/pdf`,
        {
          headers: { Authorization: `Bearer ${candidateToken}` },
        }
      );
      assert.equal(missingCoverResponse.status, 404);
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
