import test from "node:test";
import assert from "node:assert/strict";

import { HYBRID_SEMANTIC_WEIGHT } from "../../src/constants/scoring.js";
import { computeHybridScore } from "../../src/services/semantic-search.service.js";

test("computeHybridScore uses ALPHA 0.65 by default", () => {
  const score = computeHybridScore(0.8, 0.2);
  assert.equal(score, HYBRID_SEMANTIC_WEIGHT * 0.8 + 0.35 * 0.2);
});

test("computeHybridScore allows an explicit zero semantic weight", () => {
  assert.equal(computeHybridScore(1, 0.25, 0), 0.25);
});

