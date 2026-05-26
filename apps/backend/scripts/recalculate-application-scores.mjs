import "dotenv/config";

import mongoose from "mongoose";

import Application from "../src/models/Application.js";
import { bootstrapQdrant } from "../src/bootstrap/qdrant-bootstrap.js";
import { HYBRID_SEMANTIC_WEIGHT } from "../src/constants/scoring.js";
import { ensureVectorsReadyForScoring } from "../src/services/application-vector-readiness.service.js";
import {
  buildHybridScoreForPair,
  computeSemanticScoreForPair,
} from "../src/services/semantic-search.service.js";

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getArgValue(flag, defaultValue = null) {
  const match = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (match) {
    return match.slice(flag.length + 1);
  }

  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) {
    return defaultValue;
  }

  return process.argv[idx + 1];
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recalculateApplication(app, { execute }) {
  if (execute) {
    await ensureVectorsReadyForScoring({
      jobId: app.jobId,
      resumeId: app.resumeId,
    });
  }

  const semanticScore = await computeSemanticScoreForPair({
    jobId: app.jobId,
    resumeId: app.resumeId,
  });
  const score = await buildHybridScoreForPair({
    jobId: app.jobId,
    resumeId: app.resumeId,
    semanticScore,
    semanticWeight: HYBRID_SEMANTIC_WEIGHT,
  });

  if (execute) {
    await Application.findByIdAndUpdate(app._id, {
      $set: {
        aiStatus: "completed",
        aiScores: {
          semanticScore: score.semanticScore,
          keywordScore: score.keywordScore,
          hybridScore: score.hybridScore,
        },
        aiDetails: {
          matchedKeywords: score.matchedKeywords,
          missingKeywords: score.missingKeywords,
        },
      },
    });
  }

  return score;
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is required");
  }

  const execute = hasFlag("--execute");
  const dryRun = !execute || hasFlag("--dry-run");
  const batchSize = parsePositiveInteger(getArgValue("--batch"), 100);
  const delayMs = parsePositiveInteger(getArgValue("--delay-ms"), 500);
  const status = String(getArgValue("--status", "completed") || "completed").trim();

  await mongoose.connect(mongoUri);
  if (!dryRun) {
    await bootstrapQdrant();
  }

  const filter = status === "all" ? {} : { aiStatus: status };
  const total = await Application.countDocuments(filter);
  console.log(
    JSON.stringify({
      mode: dryRun ? "dry-run" : "execute",
      total,
      batch: batchSize,
      delay_ms: delayMs,
      status,
    })
  );

  let processed = 0;
  let updated = 0;
  let failed = 0;
  let lastId = null;

  while (processed < total) {
    const cursorFilter = lastId ? { ...filter, _id: { $gt: lastId } } : filter;
    const applications = await Application.find(cursorFilter)
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean();

    if (!applications.length) {
      break;
    }

    for (const app of applications) {
      try {
        const score = await recalculateApplication(app, { execute: !dryRun });
        updated += dryRun ? 0 : 1;
        console.log(
          JSON.stringify({
            application_id: String(app._id),
            dry_run: dryRun,
            semanticScore: score.semanticScore,
            keywordScore: score.keywordScore,
            hybridScore: score.hybridScore,
          })
        );
      } catch (error) {
        failed += 1;
        console.error(
          JSON.stringify({
            application_id: String(app._id),
            error: error?.message || "unknown error",
            error_code: error?.error_code || error?.code || "recalculate_failed",
          })
        );
      }
    }

    lastId = applications[applications.length - 1]._id;
    processed += applications.length;
    if (processed < total && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log(JSON.stringify({ processed, updated, failed, dry_run: dryRun }));
}

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error("Recalculate failed:", error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
