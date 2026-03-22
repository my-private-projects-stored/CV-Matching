import mongoose from "mongoose";

import Job from "../src/models/Job.js";
import Resume from "../src/models/Resume.js";
import { createQdrantId } from "../src/utils/qdrant-id.js";

function createMissingQdrantFilter() {
  return {
    $or: [
      { qdrantId: { $exists: false } },
      { qdrantId: null },
      { qdrantId: "" },
    ],
  };
}

async function backfillModelQdrantId(Model, modelName) {
  const docs = await Model.find(createMissingQdrantFilter(), { _id: 1 }).lean();

  if (docs.length === 0) {
    console.log(`[${modelName}] no documents to backfill`);
    return 0;
  }

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { qdrantId: createQdrantId() } },
    },
  }));

  const result = await Model.bulkWrite(ops, { ordered: false });
  const modified = result.modifiedCount ?? 0;
  console.log(`[${modelName}] backfilled: ${modified}`);
  return modified;
}

async function main() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const [jobsUpdated, resumesUpdated] = await Promise.all([
    backfillModelQdrantId(Job, "Job"),
    backfillModelQdrantId(Resume, "Resume"),
  ]);

  console.log(`Done. Total backfilled: ${jobsUpdated + resumesUpdated}`);
}

main()
  .then(async () => {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  })
  .catch(async (error) => {
    console.error("Backfill failed:", error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
