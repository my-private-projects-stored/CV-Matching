import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import mongoose from "mongoose";

import { bootstrapQdrant } from "../../src/bootstrap/qdrant-bootstrap.js";
import Application from "../../src/models/Application.js";
import User from "../../src/models/User.js";
import { createJob } from "../../src/services/job.service.js";
import { createResume, deleteResumeById } from "../../src/services/resume.service.js";
import { runApplicationAiPipeline } from "../../src/services/application-ai.service.js";
import { deleteJobById } from "../../src/services/job.service.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

test(
  "async pipeline parsing -> scoring -> ranking",
  { skip: !RUN_INTEGRATION },
  async () => {
    const mongoUri = process.env.MONGO_URI;
    assert.ok(mongoUri, "MONGO_URI is required for integration test");

    await mongoose.connect(mongoUri);
    await bootstrapQdrant();

    const suffix = Date.now();

    const recruiter = await User.create({
      email: `recruiter.${suffix}@example.com`,
      password: "x".repeat(60),
      role: "recruiter",
      fullName: "Recruiter Integration",
    });

    const candidateA = await User.create({
      email: `candidate.a.${suffix}@example.com`,
      password: "x".repeat(60),
      role: "candidate",
      fullName: "Candidate A",
    });

    const candidateB = await User.create({
      email: `candidate.b.${suffix}@example.com`,
      password: "x".repeat(60),
      role: "candidate",
      fullName: "Candidate B",
    });

    const dim = Number(process.env.QDRANT_VECTOR_SIZE || 384);
    const vectorA = Array.from({ length: dim }, (_, i) => (i % 5) / 10);
    const vectorB = Array.from({ length: dim }, (_, i) => (i % 3) / 10);

    const job = await createJob({
      recruiterId: recruiter._id,
      title: "Backend Engineer",
      description: "Build APIs and data processing pipelines",
      requirements: "Node.js MongoDB Qdrant",
      cleanText: "Node.js MongoDB Qdrant APIs pipeline",
      keywords: ["node.js", "mongodb", "qdrant"],
      category: "IT",
      embeddingVector: vectorA,
    });

    const resumeA = await createResume({
      candidateId: candidateA._id,
      fileUrl: "https://example.com/resume-a.pdf",
      rawText: "Node.js MongoDB Qdrant",
      parsedData: { skills: ["Node.js", "MongoDB", "Qdrant"] },
      embeddingVector: vectorA,
    });

    const resumeB = await createResume({
      candidateId: candidateB._id,
      fileUrl: "https://example.com/resume-b.pdf",
      rawText: "Node.js only",
      parsedData: { skills: ["Node.js"] },
      embeddingVector: vectorB,
    });

    const appA = await Application.create({
      jobId: job._id,
      resumeId: resumeA._id,
      status: "new",
      aiStatus: "pending",
    });

    const appB = await Application.create({
      jobId: job._id,
      resumeId: resumeB._id,
      status: "new",
      aiStatus: "pending",
    });

    await runApplicationAiPipeline(appA._id, {
      parseStep: async () => undefined,
      scoringStep: async () => ({
        semanticScore: 0.95,
        keywordScore: 1,
        hybridScore: 0.965,
        matchedKeywords: ["node.js", "mongodb", "qdrant"],
        missingKeywords: [],
      }),
    });

    await runApplicationAiPipeline(appB._id, {
      parseStep: async () => undefined,
      scoringStep: async () => ({
        semanticScore: 0.6,
        keywordScore: 0.33,
        hybridScore: 0.52,
        matchedKeywords: ["node.js"],
        missingKeywords: ["mongodb", "qdrant"],
      }),
    });

    const ranked = await Application.find({ jobId: job._id }).sort({ "aiScores.hybridScore": -1 });

    assert.equal(ranked.length, 2);
    assert.equal(ranked[0].aiStatus, "completed");
    assert.equal(ranked[1].aiStatus, "completed");
    assert.ok(ranked[0].aiScores.hybridScore >= ranked[1].aiScores.hybridScore);

    await Application.deleteMany({ _id: { $in: [appA._id, appB._id] } });
    await deleteResumeById(resumeA._id);
    await deleteResumeById(resumeB._id);
    await deleteJobById(job._id);
    await User.deleteMany({ _id: { $in: [recruiter._id, candidateA._id, candidateB._id] } });

    await mongoose.disconnect();
  }
);
