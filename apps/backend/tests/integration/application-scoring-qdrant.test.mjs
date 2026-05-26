import test from "node:test";
import assert from "node:assert/strict";

import "dotenv/config";

import mongoose from "mongoose";

import { bootstrapQdrant } from "../../src/bootstrap/qdrant-bootstrap.js";
import Application from "../../src/models/Application.js";
import User from "../../src/models/User.js";
import { runApplicationAiPipeline } from "../../src/services/application-ai.service.js";
import { deleteJobById, createJob } from "../../src/services/job.service.js";
import { createResume, deleteResumeById } from "../../src/services/resume.service.js";

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";

function unitVector(index, size = Number(process.env.QDRANT_VECTOR_SIZE || 384)) {
  return Array.from({ length: size }, (_, i) => (i === index ? 1 : 0));
}

test(
  "application scoring uses Qdrant semantic vectors without mocked scoringStep",
  { skip: !RUN_INTEGRATION },
  async () => {
    assert.ok(process.env.MONGO_URI, "MONGO_URI is required for integration test");

    await mongoose.connect(process.env.MONGO_URI);
    await bootstrapQdrant();

    const suffix = Date.now();
    const recruiter = await User.create({
      email: `qdrant.recruiter.${suffix}@example.com`,
      password: "x".repeat(60),
      role: "recruiter",
      fullName: "Qdrant Recruiter",
    });
    const candidateA = await User.create({
      email: `qdrant.candidate.a.${suffix}@example.com`,
      password: "x".repeat(60),
      role: "candidate",
      fullName: "Qdrant Candidate A",
    });
    const candidateB = await User.create({
      email: `qdrant.candidate.b.${suffix}@example.com`,
      password: "x".repeat(60),
      role: "candidate",
      fullName: "Qdrant Candidate B",
    });

    const job = await createJob({
      recruiterId: recruiter._id,
      title: "Backend Engineer",
      description: "Build Node.js services",
      requirements: "Node.js MongoDB Qdrant",
      cleanText: "Node.js MongoDB Qdrant services",
      keywords: ["node.js", "mongodb", "qdrant"],
      category: "IT",
      embeddingVector: unitVector(0),
    });

    const resumeA = await createResume({
      candidateId: candidateA._id,
      fileUrl: "https://example.com/resume-a.pdf",
      rawText: "Node.js MongoDB Qdrant",
      parsedData: { skills: ["Node.js", "MongoDB", "Qdrant"] },
      embeddingVector: unitVector(0),
    });

    const resumeB = await createResume({
      candidateId: candidateB._id,
      fileUrl: "https://example.com/resume-b.pdf",
      rawText: "Sales CRM",
      parsedData: { skills: ["Sales", "CRM"] },
      embeddingVector: unitVector(1),
    });

    const appA = await Application.create({ jobId: job._id, resumeId: resumeA._id });
    const appB = await Application.create({ jobId: job._id, resumeId: resumeB._id });

    try {
      await runApplicationAiPipeline(appA._id, { parseStep: async () => undefined });
      await runApplicationAiPipeline(appB._id, { parseStep: async () => undefined });

      const [scoredA, scoredB] = await Promise.all([
        Application.findById(appA._id).lean(),
        Application.findById(appB._id).lean(),
      ]);

      assert.equal(scoredA.aiStatus, "completed");
      assert.equal(scoredB.aiStatus, "completed");
      assert.ok(scoredA.aiScores.semanticScore > scoredB.aiScores.semanticScore);
      assert.ok(scoredA.aiScores.hybridScore > scoredB.aiScores.hybridScore);
    } finally {
      await Application.deleteMany({ _id: { $in: [appA._id, appB._id] } });
      await deleteResumeById(resumeA._id);
      await deleteResumeById(resumeB._id);
      await deleteJobById(job._id);
      await User.deleteMany({ _id: { $in: [recruiter._id, candidateA._id, candidateB._id] } });
      await mongoose.disconnect();
    }
  }
);

