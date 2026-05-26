import "dotenv/config";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import Application from "../src/models/Application.js";
import User from "../src/models/User.js";
import { createJob } from "../src/services/job.service.js";
import { createResume } from "../src/services/resume.service.js";

// Seed data is for UI smoke tests only; do not use it to judge real matching quality.
function createDemoVector(seedText, size = Number(process.env.QDRANT_VECTOR_SIZE || 384)) {
  let seed = 0;
  for (const char of String(seedText || "seed")) {
    seed = (seed * 31 + char.charCodeAt(0)) % 100_000;
  }

  return Array.from({ length: size }, (_, index) => {
    const raw = Math.sin(seed + index * 17) * 10_000;
    return raw - Math.floor(raw);
  });
}

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

  const candidate2 = await User.create({
    email: `seed.candidate.marketing.${suffix}@example.com`,
    password: passwordHash,
    role: "candidate",
    fullName: "Seed Marketing Candidate",
  });

  const job = await createJob({
    recruiterId: recruiter._id,
    title: "Seed Backend Engineer",
    description: "Build scalable services and data pipelines",
    requirements: "Node.js MongoDB Qdrant",
    cleanText: "Node.js MongoDB Qdrant scalable services",
    keywords: ["node.js", "mongodb", "qdrant"],
    category: "IT",
    embeddingVector: createDemoVector("backend-engineer-job"),
  });

  const job2 = await createJob({
    recruiterId: recruiter._id,
    title: "Seed Marketing Analyst",
    description: "Analyze campaign performance and improve lifecycle marketing",
    requirements: "SEO analytics content strategy",
    cleanText: "SEO analytics content strategy campaign performance",
    keywords: ["seo", "analytics", "content"],
    category: "Marketing",
    embeddingVector: createDemoVector("marketing-analyst-job"),
  });

  const resume = await createResume({
    candidateId: candidate._id,
    fileUrl: "https://example.com/seed-resume.pdf",
    rawText: "Experienced with Node.js MongoDB Qdrant",
    parsedData: {
      skills: ["Node.js", "MongoDB", "Qdrant"],
    },
    embeddingVector: createDemoVector("backend-engineer-resume"),
  });

  const resume2 = await createResume({
    candidateId: candidate2._id,
    fileUrl: "https://example.com/seed-marketing-resume.pdf",
    rawText: "Marketing analyst focused on SEO analytics and content strategy",
    parsedData: {
      skills: ["SEO", "Analytics", "Content Strategy"],
      additional: {
        technicalSkills: ["SEO", "Analytics", "Content Strategy"],
      },
    },
    embeddingVector: createDemoVector("marketing-analyst-resume"),
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
        candidate2Id: String(candidate2._id),
        recruiterEmail: recruiter.email,
        candidateEmail: candidate.email,
        candidate2Email: candidate2.email,
        password: demoPassword,
        jobId: String(job._id),
        job2Id: String(job2._id),
        resumeId: String(resume._id),
        resume2Id: String(resume2._id),
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
