import { runApplicationAiPipeline } from "../services/application-ai.service.js";

function readWorkerTokenFromHeader(req) {
  const authHeader = String(req.headers?.authorization || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return String(req.headers?.["x-worker-token"] || "").trim();
}

function isWorkerRequestAuthorized(req) {
  const expectedToken = String(process.env.WORKER_INTERNAL_TOKEN || "dev-worker-token").trim();
  const providedToken = readWorkerTokenFromHeader(req);
  return Boolean(expectedToken) && providedToken === expectedToken;
}

function canUseMockScoring() {
  return String(process.env.ALLOW_INTERNAL_MOCK_SCORING || "").trim() === "1";
}

function parseMockScoringResult(body = {}) {
  const raw = body?.mock_scoring_result;
  if (!raw || typeof raw !== "object") {
    return null;
  }

  return {
    semanticScore: Number(raw.semanticScore ?? 0),
    keywordScore: Number(raw.keywordScore ?? 0),
    hybridScore: Number(raw.hybridScore ?? 0),
    matchedKeywords: Array.isArray(raw.matchedKeywords) ? raw.matchedKeywords : [],
    missingKeywords: Array.isArray(raw.missingKeywords) ? raw.missingKeywords : [],
  };
}

export async function processApplicationAiHandler(req, res, next) {
  try {
    if (!isWorkerRequestAuthorized(req)) {
      return res.status(401).json({
        message: "Unauthorized worker request",
        error_code: "unauthorized_worker_request",
      });
    }

    const applicationId = String(req.params?.id || "").trim();
    if (!applicationId) {
      return res.status(400).json({
        message: "Application ID is required",
        error_code: "missing_application_id",
      });
    }

    const mockResult = canUseMockScoring() ? parseMockScoringResult(req.body || {}) : null;

    const updated = await runApplicationAiPipeline(
      applicationId,
      mockResult
        ? {
            parseStep: async () => undefined,
            scoringStep: async () => mockResult,
          }
        : undefined
    );

    return res.status(200).json({
      request_id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      data: {
        application_id: String(updated?._id || applicationId),
        ai_status: String(updated?.aiStatus || "unknown"),
      },
    });
  } catch (error) {
    return next(error);
  }
}
