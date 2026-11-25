export const APPLICATION_STATUSES = new Set([
  "draft",
  "new",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
  "withdrawn",
]);

export const AI_STATUSES = new Set([
  "pending",
  "parsing",
  "scoring",
  "completed",
  "failed",
]);

export const TERMINAL_STATUSES = new Set(["hired", "rejected", "withdrawn"]);

export const ALLOWED_TRANSITIONS = Object.freeze({
  draft: new Set(["new", "withdrawn"]),
  new: new Set(["screening", "rejected", "withdrawn"]),
  screening: new Set(["interview", "rejected", "withdrawn"]),
  interview: new Set(["offer", "rejected", "withdrawn"]),
  offer: new Set(["hired", "rejected", "withdrawn"]),
  hired: new Set(),
  rejected: new Set(),
  withdrawn: new Set(),
});

/**
 * Validate recruitment + AI pipeline status transitions.
 */
export function validateStatusTransition({
  currentStatus,
  nextStatus,
  aiStatus = "pending",
  action = null,
}) {
  const from = String(currentStatus || "").trim().toLowerCase();
  const to = String(nextStatus || "").trim().toLowerCase();

  if (!APPLICATION_STATUSES.has(to)) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: "invalid_application_status",
      message: `Unknown application status '${nextStatus}'`,
    };
  }

  if (TERMINAL_STATUSES.has(from)) {
    return {
      ok: false,
      statusCode: 409,
      errorCode: "terminal_status_immutable",
      message: `Cannot transition from terminal status '${from}'`,
    };
  }

  if (action === "MANUAL_SCREENING" || (aiStatus === "failed" && from === "new" && to === "screening")) {
    if (aiStatus !== "failed") {
      return {
        ok: false,
        statusCode: 409,
        errorCode: "manual_screening_requires_failed_ai",
        message: "Manual screening override is only allowed when aiStatus is 'failed'",
      };
    }
    if (from === "new" && to === "screening") {
      return { ok: true, manualScreeningOverride: true };
    }
  }

  const allowedTargets = ALLOWED_TRANSITIONS[from];
  if (!allowedTargets || !allowedTargets.has(to)) {
    return {
      ok: false,
      statusCode: 409,
      errorCode: "invalid_status_transition",
      message: `Illegal status transition from '${from}' to '${to}'`,
    };
  }

  return { ok: true, manualScreeningOverride: false };
}

export function canTriggerScoringRetry({ currentStatus, aiStatus }) {
  return !TERMINAL_STATUSES.has(String(currentStatus || "").toLowerCase()) && aiStatus === "failed";
}
