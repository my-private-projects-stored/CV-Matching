import "dotenv/config";
import { createRequire } from "node:module";
import {
  MINIO_BUCKETS,
  createMinioStorage,
  detectFileTypeByMagicBytes,
} from "../packages/shared/src/index.js";

const require = createRequire(new URL("../apps/backend/package.json", import.meta.url));
const mongoose = require("mongoose");

const DRY_RUN = process.argv.includes("--dry-run");

function resolveExtension(filename, buffer) {
  const detected = detectFileTypeByMagicBytes(buffer);
  if (detected === "pdf" || detected === "docx" || detected === "doc" || detected === "txt") {
    return detected;
  }
  const match = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "bin";
}

async function main() {
  const mongoUri = process.env.MONGO_URI || "mongodb://admin:admin123@localhost:27017/?authSource=admin";
  await mongoose.connect(mongoUri);

  const resumesCol = mongoose.connection.db.collection("resumes");
  const minio = createMinioStorage();

  const cursor = resumesCol.find({
    "sourceFile.data": { $ne: null },
    fileUrl: { $not: /^resumes-bucket\// },
  });

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    scanned += 1;
    const rawData = doc.sourceFile?.data;
    const buffer = rawData?.buffer ? Buffer.from(rawData.buffer) : Buffer.from(rawData || "");

    if (!buffer.length) {
      skipped += 1;
      continue;
    }

    const ext = resolveExtension(doc.sourceFile?.filename || doc.filename, buffer);
    const objectKey = `${String(doc.candidateId)}/${String(doc._id)}.${ext}`;
    const newFileUrl = `${MINIO_BUCKETS.RESUMES}/${objectKey}`;

    if (DRY_RUN) {
      console.log(`[migrate-resumes][dry-run] ${doc._id} -> ${newFileUrl} (${buffer.length} bytes)`);
      migrated += 1;
      continue;
    }

    await minio.uploadObject({
      bucket: MINIO_BUCKETS.RESUMES,
      objectKey,
      buffer,
      contentType: doc.sourceFile?.mimeType || "application/octet-stream",
    });

    await resumesCol.updateOne(
      { _id: doc._id },
      {
        $set: {
          fileUrl: newFileUrl,
          updatedAt: new Date(),
        },
      }
    );
    migrated += 1;
  }

  console.log(
    `[migrate-resumes] Done. scanned=${scanned}, migrated=${migrated}, skipped=${skipped}, dryRun=${DRY_RUN}`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[migrate-resumes] Failed:", err);
  process.exitCode = 1;
});
