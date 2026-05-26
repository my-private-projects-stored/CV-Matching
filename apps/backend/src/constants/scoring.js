export const HYBRID_SEMANTIC_WEIGHT = 0.65;
export const HYBRID_KEYWORD_WEIGHT = 1 - HYBRID_SEMANTIC_WEIGHT;

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const ENSURE_INDEX_TIMEOUT_MS = normalizePositiveInteger(
  process.env.ENSURE_INDEX_TIMEOUT_MS,
  30_000
);

