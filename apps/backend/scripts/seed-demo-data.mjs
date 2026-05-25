import "dotenv/config";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import Application from "../src/models/Application.js";
import User from "../src/models/User.js";
import { createJob } from "../src/services/job.service.js";
import { createResume } from "../src/services/resume.service.js";

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(mongoUri);

  const suffix = Date.now();
  const demoPassword = "StrongPass123";
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const recruiter = await User.create({
    email: `seed.recruiter.${suffix}@example.com`,
    password: passwordHash,
    role: "recruiter",
    fullName: "Seed Recruiter",
  });

  const candidate = await User.create({
    email: `seed.candidate.${suffix}@example.com`,
    password: passwordHash,
    role: "candidate",
    fullName: "Seed Candidate",
  });

  const dim = Number(process.env.QDRANT_VECTOR_SIZE || 384);
  const vector = Array.from({ length: dim }, (_, i) => (i % 7) / 10);

  const job = await createJob({
    recruiterId: recruiter._id,
    title: "Seed Backend Engineer",
    description: "Build scalable services and data pipelines",
    requirements: "Node.js MongoDB Qdrant",
    cleanText: "Node.js MongoDB Qdrant scalable services",
    keywords: ["node.js", "mongodb", "qdrant"],
    category: "IT",
    embeddingVector: vector,
  });

  const resume = await createResume({
    candidateId: candidate._id,
    fileUrl: "https://example.com/seed-resume.pdf",
    rawText: "Experienced with Node.js MongoDB Qdrant",
    parsedData: {
      skills: ["Node.js", "MongoDB", "Qdrant"],
    },
    embeddingVector: vector,
  });

  const application = await Application.create({
    jobId: job._id,
    resumeId: resume._id,
    status: "new",
    aiStatus: "pending",
  });

  console.log(
    JSON.stringify(
      {
        recruiterId: String(recruiter._id),
        candidateId: String(candidate._id),
        recruiterEmail: recruiter.email,
        candidateEmail: candidate.email,
        password: demoPassword,
        jobId: String(job._id),
        resumeId: String(resume._id),
        applicationId: String(application._id),
      },
      null,
      2
    )
  );
}

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
