import Application from "../models/Application.js";
import { HYBRID_SEMANTIC_WEIGHT } from "../constants/scoring.js";
import { ensureVectorsReadyForScoring } from "./application-vector-readiness.service.js";
import { buildHybridScoreForPair, computeSemanticScoreForPair } from "./semantic-search.service.js";

export const AI_STATUS = {
  PENDING: "pending",
  PARSING: "parsing",
  SCORING: "scoring",
  COMPLETED: "completed",
  FAILED: "failed",
};

// Cap nhat trang thai AI processing cho Application.
export async function updateApplicationAiStatus(applicationId, aiStatus, extraSet = {}) {
  return Application.findByIdAndUpdate(
    applicationId,
    {
      $set: {
        aiStatus,
        ...extraSet,
      },
    },
    { new: true }
  );
}

// Chay luong async parsing -> scoring -> completed/failed.
export async function runApplicationAiPipeline(
  applicationId,
  {
    parseStep = async () => undefined,
    scoringStep,
    semanticWeight = HYBRID_SEMANTIC_WEIGHT,
  } = {}
) {
  const app = await Application.findById(applicationId);
  if (!app) {
    throw new Error("Application not found");
  }

  try {
    await updateApplicationAiStatus(applicationId, AI_STATUS.PARSING);
    await parseStep(app);

    await updateApplicationAiStatus(applicationId, AI_STATUS.SCORING);
    const resolvedScoringStep =
      scoringStep ||
      (async () => {
        await ensureVectorsReadyForScoring({
          jobId: app.jobId,
          resumeId: app.resumeId,
        });
        const semanticScore = await computeSemanticScoreForPair({
          jobId: app.jobId,
          resumeId: app.resumeId,
        });
        return buildHybridScoreForPair({
          jobId: app.jobId,
          resumeId: app.resumeId,
          semanticScore,
          semanticWeight,
        });
      });

    const scoreResult = await resolvedScoringStep(app);

    return updateApplicationAiStatus(applicationId, AI_STATUS.COMPLETED, {
      aiScores: {
        semanticScore: Number(scoreResult.semanticScore ?? 0),
        keywordScore: Number(scoreResult.keywordScore ?? 0),
        hybridScore: Number(scoreResult.hybridScore ?? 0),
      },
      aiDetails: {
        matchedKeywords: Array.isArray(scoreResult.matchedKeywords)
          ? scoreResult.matchedKeywords
          : [],
        missingKeywords: Array.isArray(scoreResult.missingKeywords)
          ? scoreResult.missingKeywords
          : [],
      },
    });
  } catch (error) {
    const retryable = Boolean(error?.retryable || error?.statusCode === 503);
    await updateApplicationAiStatus(
      applicationId,
      retryable ? AI_STATUS.PENDING : AI_STATUS.FAILED
    );
    throw error;
  }
}
