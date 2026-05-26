# Phase 3 Remaining Gaps - Real LLM Generation

Date: 2026-05-26

This document tracks what is still missing before Phase 3 can be considered fully complete against `plans/fix_ai_audit_issues_plan_v3.md`.

## Current Status

Phase 3 is partially implemented and usable on the backend with real Ollama calls:

- `llm.service.js` exists with `checkLlmHealth`, `completeText`, and `completeJson`.
- `/config/llm-test` calls a real provider and keeps the existing `healthy` response contract.
- Ollama local contract passes with `gemma3:4b`.
- Tailor resume, cover letter, outreach, enrichment, and interview generator are wired as LLM-primary with template/rule fallback.
- Interview now has privacy guard and recruiter access guard.
- Enrichment apply/regenerate paths now avoid stale Qdrant vectors by going through `updateResumeById`.

Phase 3 is not fully complete yet. The remaining gaps are below.

## Blocking Gaps

### 1. Interview LLM Output Is Not Stable Enough

Current behavior:

- Interview generator calls Ollama through `completeJson`.
- In the current integration run, Ollama returned JSON that did not satisfy the expected `question_groups` contract, so the service fell back to templates.
- The endpoint works, but it does not yet reliably produce LLM-generated interview questions.

Required completion:

- Harden the interview prompt and/or JSON schema instructions.
- Normalize common LLM output variants into the expected shape where safe.
- Add a test that proves `generation_mode: "llm"` for interview with Ollama, not only fallback.

### 2. Cloud Provider Paths Are Not Contract-Tested

Current behavior:

- Adapter code exists for OpenAI-compatible providers, Anthropic, and Gemini.
- Only Ollama has a real integration contract test.

Required completion:

- Add optional contract tests gated by env/API keys for:
  - OpenAI
  - OpenRouter
  - DeepSeek
  - Anthropic
  - Gemini
- Verify request shape, response extraction, error handling, and token metadata for each provider.

### 3. Prompt Runtime Is Still Minimal

Current behavior:

- `promptConfig` has default templates and basic truthfulness rules.
- It does not fully port upstream prompt quality.
- Admin UI does not expose prompt templates/truthfulness rules for editing.

Required completion:

- Port the relevant upstream prompts for:
  - Tailor resume
  - Cover letter
  - Outreach
  - Interview
  - Enrichment analyze/enhance/regenerate
- Preserve truthfulness rules against invented skills, metrics, timelines, company names, seniority, and certifications.
- Add tests proving custom `systemconfigs.promptConfig.templates` are used by generation services.

## Product / UI Gaps

### 4. Frontend Does Not Surface Generation Mode

Current behavior:

- Backend returns `generation_mode` and `llm_metadata` for generation endpoints.
- Frontend mostly ignores these fields.

Required completion:

- Show `AI-generated` vs `Template fallback` badge where generation output is shown.
- Keep the badge optional so older responses still render.

### 5. Cover Letter / Outreach Client Drops Metadata

Current behavior:

- Backend returns `{ content, generation_mode, llm_metadata }`.
- Frontend API helpers return only `content` as `string`.

Required completion:

- Update frontend API types and helpers to return an object:
  - `content`
  - `generation_mode`
  - `llm_metadata`
- Update consuming pages to use `content` while optionally showing metadata.

### 6. Tailor Confirm Does Not Fully Preserve Preview Metadata From Frontend

Current behavior:

- Backend confirm handler can accept `generation_mode` and `llm_metadata`.
- Frontend confirm payload does not yet include these fields from preview.

Required completion:

- Extend `ImproveResumeConfirmRequest`.
- Pass preview `generation_mode` and `llm_metadata` into confirm.
- Ensure saved/confirmed response reflects the original preview generation mode.

## Observability / Health Gaps

### 7. System Status LLM Health Is Not A Real Health Check

Current behavior:

- `/config/llm-test` performs a real health check.
- `getSystemStatus().llm_healthy` still mostly reflects whether config is present.

Required completion:

- Decide whether system status should run a real health check or expose a cached health value.
- Avoid making dashboard status slow by calling LLM on every request unless there is caching.

### 8. Fallback Logging Exists But Is Not Queryable

Current behavior:

- Services log `llm_generation_fallback` to console.

Required completion:

- Decide whether logs are enough for Phase 3 or whether fallback events should be stored in a collection/metrics system.
- At minimum, standardize fields across all generation services:
  - `feature`
  - `provider`
  - `model`
  - `reason`
  - request/correlation id if available

## Test Gaps

### 9. LLM Path Tests Are Uneven Across Features

Current behavior:

- Ollama contract tests prove health, text completion, and JSON completion.
- Cover/outreach E2E passed with `generation_mode: "llm"`.
- Enrichment and interview can still fallback depending on model output quality.

Required completion:

- Add deterministic service-level tests that mock the LLM boundary and prove each feature handles a valid LLM response correctly.
- Keep real Ollama contract tests for end-to-end provider behavior.

### 10. Frontend Typecheck Is Currently Blocked By Generated `.next` Types

Current behavior:

- `npm run typecheck` in `apps/frontend` fails in `.next/dev/types/validator.ts`.
- This appears to be generated cache state, not the Phase 3 type addition.

Required completion:

- Clean/regenerate `.next` dev types or exclude broken generated dev cache.
- Re-run frontend typecheck after frontend metadata changes are completed.

## Acceptance Criteria To Close Phase 3

Phase 3 can be marked complete when:

- `/config/llm-test` passes with Ollama and at least one cloud provider when a valid API key is configured.
- Tailor, cover letter, outreach, interview, and enrichment each have a passing test for `generation_mode: "llm"`.
- Each generation feature has a passing fallback test for timeout/no key/invalid JSON.
- Frontend displays or safely carries `generation_mode` and `llm_metadata`.
- Prompt templates are configurable through `systemconfigs.promptConfig` and covered by tests.
- Interview access control prevents recruiter access to unrelated resumes.
- Tailor/enrichment create/update paths do not leave stale Qdrant vectors.
