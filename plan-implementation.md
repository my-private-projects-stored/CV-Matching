# Plan Implementation Log

Last updated: 2026-03-27

## Scope
This file tracks concrete implementation work executed from the project plan, focused on the critical-path Phase B slice (UC-CORE-02/03 parsing + vector readiness) and immediate validation.

## Completed Work

### 1) Parsing Worker Implementation (workers/parsing)
- Added parser service with FastAPI:
	- `workers/parsing/app.py`
	- Endpoints:
		- `GET /health`
		- `POST /parse` (multipart file upload)
	- Behavior:
		- PDF files: extract text via `pypdf`
		- Non-PDF files: UTF-8 fallback decode
		- Returns `raw_text`, `parsed_data`, and parser metadata
- Added worker dependencies:
	- `workers/parsing/requirements.txt`
- Added container image for parser worker:
	- `workers/parsing/Dockerfile`

### 2) Backend Parsing Integration (apps/backend)
- Added parser client service:
	- `apps/backend/src/services/resume-parsing.service.js`
	- Handles multipart call to parser worker and timeout behavior.
- Wired upload flow to parser service first with safe fallback:
	- `apps/backend/src/services/resume.service.js`
	- `createResumeFromUpload` now:
		1. Attempts parser worker extraction.
		2. Falls back to local text extraction when parser is unavailable/fails.
		3. Persists parsed payload when available.

### 3) Runtime Config Hardening for Testability and Ops
- Switched parser URL/timeout resolution to runtime per-call:
	- `apps/backend/src/services/resume-parsing.service.js`
- Switched embedding URL resolution to runtime per-call:
	- `apps/backend/src/services/embedding.service.js`
- Benefit:
	- Environment changes apply immediately without process restart.
	- Integration tests can inject mock service endpoints safely.

### 4) Docker Compose Wiring
- Updated backend environment to include parser endpoint:
	- `PARSING_SERVICE_URL=http://worker-parsing:8020`
- Replaced placeholder parsing worker with real containerized service:
	- `docker-compose.yml`
	- Added:
		- build context for `workers/parsing`
		- parser healthcheck
		- port mapping `8020:8020`
		- inclusion in `app` profile (not only `workers`)

### 5) New Integration Test Coverage
- Added integration test for parser success + fallback behavior:
	- `apps/backend/tests/integration/resume-upload-parsing.test.mjs`
- Test cases covered:
	- Parser reachable -> resume stores parser-provided `rawText` and structured `parsedData`.
	- Parser unreachable -> upload succeeds via fallback text extraction.
- Test architecture:
	- Uses ephemeral mock HTTP servers for parsing and embedding dependencies.
	- Uses isolated MongoDB test database suffix.

### 6) Endpoint-Level Multipart Upload Contract Test
- Added route/controller-level integration test for upload API contract:
	- `apps/backend/tests/integration/resume-upload-endpoint.test.mjs`
- Scope covered:
	- Authenticated candidate `POST /api/resumes/upload` using multipart form-data.
	- Parser success path:
		- upload returns 201 + `processing_status=ready`
		- subsequent `GET /api/resumes?resume_id=...` reflects parser-produced content and structured data
	- Parser unreachable fallback path:
		- upload still returns 201 + `processing_status=ready`
		- stored resume falls back to uploaded raw text and `processed_resume` remains `null`
- Test architecture:
	- Ephemeral in-test mock services for parser and embedding endpoints
	- Isolated MongoDB test DB
	- Runtime env overrides for service URLs

### 7) Service Config Reliability Update
- Updated runtime URL resolution to be evaluated per request (not at module import time):
	- `apps/backend/src/services/embedding.service.js`
	- `apps/backend/src/services/resume-parsing.service.js`
- Rationale:
	- Allows integration tests and local ops scripts to rewire service URLs without restarting node process

### 8) Upload Validation Error-Code Contract
- Added explicit backend `error_code` values for resume upload validation failures:
	- `missing_uploaded_file`
	- `invalid_upload_file_type`
	- `empty_uploaded_file`
	- `uploaded_file_too_large`
	- `unable_to_extract_textual_content`
- File updated:
	- `apps/backend/src/services/resume.service.js`
- Added endpoint-level assertion for invalid file type contract:
	- `apps/backend/tests/integration/resume-upload-endpoint.test.mjs`
	- Verifies `POST /api/resumes/upload` returns `400` + `error_code=invalid_upload_file_type` for unsupported MIME

### 9) Async Scoring Worker Slice (Queue Producer + Worker Consumer)
- Implemented backend queue producer for application scoring:
	- `apps/backend/src/services/application-queue.service.js`
	- Uses Redis list queue (`LPUSH`) with configurable queue name
- Wired enqueue on application creation:
	- `apps/backend/src/services/application.service.js`
	- After creating application, backend enqueues scoring job (non-blocking behavior if queue unavailable)
- Added internal processing endpoint for worker callbacks:
	- `apps/backend/src/controllers/internal-application.controller.js`
	- `apps/backend/src/routes/internal.routes.js`
	- `apps/backend/src/routes/index.js`
	- Endpoint:
		- `POST /api/internal/applications/:id/process-ai`
	- Protected by worker token (`WORKER_INTERNAL_TOKEN`)
- Implemented scoring worker consumer service:
	- `workers/scoring/index.js`
	- `workers/scoring/package.json`
	- `workers/scoring/package-lock.json`
	- `workers/scoring/Dockerfile`
	- Worker behavior:
		- `BRPOP` from Redis queue
		- Calls backend internal endpoint to execute AI pipeline per application
- Updated Docker Compose for scoring worker runtime:
	- `docker-compose.yml`
	- Replaced placeholder python scoring service with Node worker service
	- Added scoring queue + worker token env wiring for backend and worker
	- Enabled scoring worker under `app` profile for default local full-flow

### 10) Backend Dependency Updates
- Added Redis client dependency in backend:
	- `apps/backend/package.json`
	- `apps/backend/package-lock.json`
- Installed worker-scoring dependencies and generated lockfile:
	- `workers/scoring/package-lock.json`

### 11) Worker-Driven AI Status Transition Test Coverage
- Added integration test for internal worker processing endpoint:
	- `apps/backend/tests/integration/application-worker-processing.test.mjs`
- Flow covered:
	- Candidate creates application (`ai_status=pending`)
	- Unauthorized internal worker call rejected (`401`)
	- Authorized worker call processes AI pipeline and transitions application to `completed`
	- Persisted `aiScores` and `aiDetails` verified
- Test-mode deterministic scoring support added (guarded by env flag):
	- `apps/backend/src/controllers/internal-application.controller.js`
	- Env gate: `ALLOW_INTERNAL_MOCK_SCORING=1`

### 12) Oversize Upload Contract Coverage
- Extended upload endpoint integration test:
	- `apps/backend/tests/integration/resume-upload-endpoint.test.mjs`
- Added assertion:
	- oversize file upload returns `413` + `error_code=uploaded_file_too_large`

### 13) Integration Command Profiles + CI Wiring
- Added focused backend integration scripts:
	- `apps/backend/package.json`
		- `test:integration:parsing`
		- `test:integration:worker`
- CI workflow now explicitly runs parsing-focused integration group:
	- `.github/workflows/backend-integration.yml`
	- Runs `npm run test:integration:parsing` with integration env wiring after canonical wrapper step

### 14) Queue Observability Integration Coverage
- Added Redis-backed enqueue observability test:
	- `apps/backend/tests/integration/application-queue-observability.test.mjs`
- Verifies:
	- candidate application creation emits payload to Redis queue
	- payload contains `application_id`, `enqueued_at`, and `retry_count=0`
- Added focused script:
	- `apps/backend/package.json` -> `test:integration:queue`

### 15) Worker Retry + Dead-Letter Behavior
- Enhanced scoring worker consumer reliability:
	- `workers/scoring/index.js`
- New behavior:
	- Parse queue payload safely
	- On processing failure, retry with incremented `retry_count`
	- After max retries, push message to dead-letter queue (DLQ)
- New worker env settings:
	- `SCORING_QUEUE_MAX_RETRIES`
	- `SCORING_DLQ_NAME`
	- `SCORING_RETRY_BACKOFF_MS`
- Compose wiring updated:
	- `docker-compose.yml` includes default values for retry/DLQ worker envs

### 16) Queue Producer Reliability Adjustment
- Updated queue producer to use short-lived Redis clients per enqueue:
	- `apps/backend/src/services/application-queue.service.js`
- Improvements:
	- queue name now resolved at runtime (env-driven per call)
	- avoids long-lived Redis handles in test/runtime edge cases

### 17) Deterministic DLQ-Path Integration Assertion
- Added integration test for DLQ path with intentional internal worker processing failure:
	- `apps/backend/tests/integration/worker-dlq-flow.test.mjs`
- Assertion flow:
	- pushes a queue message at retry limit
	- runs one worker processing cycle against internal endpoint
	- verifies dead-letter payload written to configured DLQ with `dead_lettered_at`
- Added script:
	- `apps/backend/package.json` -> `test:integration:dlq`
- CI worker-focused group now runs:
	- `test:integration:worker`
	- `test:integration:queue`
	- `test:integration:dlq`

### 18) Worker Core Extraction + Exponential Backoff Option
- Extracted reusable worker logic module:
	- `workers/scoring/worker-core.js`
- Entry file now uses shared core:
	- `workers/scoring/index.js`
- Added optional backoff mode support:
	- `SCORING_RETRY_BACKOFF_MODE` = `linear` | `exponential`
	- `SCORING_RETRY_BACKOFF_MAX_MS` cap
- Existing tuning preserved:
	- `SCORING_QUEUE_MAX_RETRIES`
	- `SCORING_RETRY_BACKOFF_MS`
	- `SCORING_DLQ_NAME`

### 19) Queue/DLQ Operational Inspection Tooling
- Added PowerShell helper script:
	- `scripts/queue-inspect.ps1`
- Supports:
	- queue + DLQ depth output
	- optional sample payload printing (`-ShowSamples`)
- Added README usage + troubleshooting guidance:
	- `README.md`

### 20) Worker Heartbeat and Metrics Logging
- Added periodic worker heartbeat log with queue telemetry:
	- `workers/scoring/index.js`
- New heartbeat output includes:
	- queue depth (`queue_name`)
	- DLQ depth (`dlq_name`)
	- processed/retried/dead-lettered counters
	- invalid payload/empty poll/loop error counters
	- last event timestamp
- New env control:
	- `SCORING_METRICS_LOG_INTERVAL_MS` (default `30000`)

### 21) DLQ Replay Tooling
- Added replay script to move messages from DLQ back to main queue after remediation:
	- `scripts/queue-replay-dlq.ps1`
- Capabilities:
	- replay N messages (`-Count`)
	- replay all (`-ReplayAll`)
	- dry-run preview (`-DryRun`)
	- depth summary before/after replay

### 22) Alert Threshold Documentation
- Expanded runbook in `README.md` with practical queue/DLQ thresholds:
	- backlog threshold guidance (`queue_depth` warning/urgent levels)
	- DLQ growth escalation triggers
	- heartbeat-missing detection rule
- Added replay workflow snippet using `queue-replay-dlq.ps1`

### 23) Failure-Type Labeling for DLQ Triage
- Added worker-side failure classification labels:
	- `authorization_error`
	- `resource_not_found`
	- `internal_service_error`
	- `network_error`
	- `processing_error`
- Location:
	- `workers/scoring/worker-core.js`
- Behavior:
	- each retry/dead-letter payload now carries `failure_type` for faster incident triage

### 24) Replay Guardrails (Application + Age Filters)
- Enhanced DLQ replay script with guardrails:
	- `scripts/queue-replay-dlq.ps1`
- New options:
	- `-ApplicationId` to replay only a targeted application
	- `-MaxAgeMinutes` to skip stale DLQ messages
	- safer dry-run scan with eligibility filtering
- Goal:
	- reduce accidental poison-message replay loops

### 25) Worker Heartbeat/Metrics Endpoint Support
- Added optional worker metrics HTTP endpoint (no extra dependencies):
	- `workers/scoring/index.js`
	- endpoints (when `SCORING_METRICS_PORT` is set):
		- `GET /health`
		- `GET /metrics`
- Added periodic heartbeat logs including queue depth + outcome counters.
- New/updated tuning vars documented and wired:
	- `SCORING_METRICS_PORT`
	- `SCORING_METRICS_LOG_INTERVAL_MS`
	- `SCORING_RETRY_BACKOFF_MODE`
	- `SCORING_RETRY_BACKOFF_MAX_MS`

### 26) Compose and Docs Alignment for Worker Tuning
- Updated `docker-compose.yml` worker-scoring env defaults for retry/backoff/metrics logging.
- Updated `README.md` with:
	- replay guardrail examples
	- optional metrics endpoint note
	- threshold guidance retained and clarified

### 27) Metrics Endpoint Integration Assertion
- Added integration test that boots worker-scoring with metrics enabled and validates endpoint contracts:
	- `apps/backend/tests/integration/application-worker-metrics-endpoint.test.mjs`
- Assertions covered:
	- `GET /health` returns `{ status: "ok" }`
	- `GET /metrics` returns queue names, queue/DLQ depths, startup timestamp, and stats counters
- Worker-focused script updated:
	- `apps/backend/package.json` -> `test:integration:worker-metrics`
- CI worker-focused group updated:
	- `.github/workflows/backend-integration.yml` now runs `test:integration:worker-metrics`

### 28) Replay Audit Trace Output
- Enhanced replay tooling with structured audit output:
	- `scripts/queue-replay-dlq.ps1`
- New capability:
	- emits a compact JSON audit line with timestamp, actor, filters, requested/eligible/scanned/replayed counts, and status (`dry-run`, `executed`, `no-op`)
- Added optional operator attribution:
	- `-Actor <name>` (defaults to `$env:USERNAME`)

### 29) Failure-Type Triage Playbook
- Added quick-routing guidance for worker failure labels in runbook:
	- `README.md`
- Mappings documented:
	- `authorization_error`, `resource_not_found`, `internal_service_error`, `network_error`, `processing_error`

### 30) Replay Audit File Export Mode
- Extended replay tooling with persistent JSONL export mode:
	- `scripts/queue-replay-dlq.ps1`
- New option:
	- `-AuditFile <path>` appends structured replay audit events to file.
- Enables:
	- incident timeline reconstruction
	- CI artifact collection of replay activity records

### 31) CI Replay-Audit Extraction and Validation
- Updated backend integration workflow to collect replay audit evidence:
	- `.github/workflows/backend-integration.yml`
- Added CI steps:
	- generate a dry-run replay audit sample into `scripts/replay-audit-ci.jsonl`
	- validate JSONL format using `jq`
	- upload `replay-audit-ci` artifact

### 32) Queue/DLQ Synthetic Load Integration Test
- Added sustained-failure synthetic load test for queue reliability calibration:
	- `apps/backend/tests/integration/application-queue-synthetic-load.test.mjs`
- Added command:
	- `apps/backend/package.json` -> `test:integration:queue-load`
- CI worker-focused group now runs synthetic queue-load test to guard queue-to-DLQ behavior.

### 33) Replay-Audit Required Field Assertions in CI
- Strengthened replay-audit validation in CI pipeline:
	- `.github/workflows/backend-integration.yml`
- Validation now checks each JSONL line includes required keys:
	- `event`, `status`, `timestamp_utc`, `actor`
- CI now fails if any replay-audit line is missing required fields.

### 34) Replay-Audit Retention Helper
- Added retention/rotation helper script for long-running environments:
	- `scripts/replay-audit-retention.ps1`
- Supports:
	- line-count based rotation (`-MaxLines`)
	- optional archive compression (`-CompressArchive`)
	- preserving a fresh active replay-audit log file after rotation

### 35) Synthetic Failure-Variant Queue Calibration
- Added synthetic integration test that compares failure-mode classification under load:
	- `apps/backend/tests/integration/application-queue-synthetic-failure-variants.test.mjs`
- Variant coverage:
	- transient network failures -> `network_error`
	- internal backend failures -> `internal_service_error`
- Added command and CI wiring:
	- `apps/backend/package.json` -> `test:integration:queue-variants`
	- `.github/workflows/backend-integration.yml` now runs queue variant calibration in worker-focused group

### 36) CI Replay-Audit Status Summary
- Added lightweight replay-audit visibility step in CI:
	- `.github/workflows/backend-integration.yml`
- CI now prints replay-audit counts grouped by `status` after validation, improving incident triage speed.

### 37) Automated Retention Schedule Guidance
- Expanded runbook with retention automation examples:
	- `README.md`
- Added:
	- Windows Task Scheduler command example
	- Linux cron entry example
- Purpose:
	- operationalize replay-audit rotation in long-running environments without manual intervention.

### 38) Parameterized Queue-Load Tiers and Throughput Snapshot
- Enhanced synthetic queue-load integration coverage:
	- `apps/backend/tests/integration/application-queue-synthetic-load.test.mjs`
- Test now runs across multiple load tiers:
	- `50`, `200`, `500`
- Added throughput snapshot logging per tier to support practical queue threshold tuning.

### 39) CI Replay-Audit Status Distribution Thresholds
- Added anomaly guard step in CI for replay-audit status distribution:
	- `.github/workflows/backend-integration.yml`
- Current CI thresholds:
	- `REPLAY_AUDIT_MAX_EXECUTED=0`
	- `REPLAY_AUDIT_MAX_NO_OP=5`
	- `REPLAY_AUDIT_MIN_DRY_RUN=1`
- CI now fails when status distribution crosses configured guardrails.

### 40) Configurable Synthetic Load Tiers via Environment
- Updated synthetic queue-load test to read tiers from env:
	- `SCORING_SYNTHETIC_LOAD_TIERS` (comma-separated, default `50,200,500`)
- File:
	- `apps/backend/tests/integration/application-queue-synthetic-load.test.mjs`
- Added JSONL-friendly throughput output line for trend ingestion:
	- prefixed log marker: `[queue-synthetic-load-json]`

### 41) Throughput Trend Capture Runbook Pattern
- Expanded runbook with practical capture workflow:
	- `README.md`
- Added:
	- command example for tier override
	- command example to persist test output to `scripts/queue-load-trend.log`
	- extraction pattern for JSON throughput snapshot lines

### 42) Environment-Specific Replay-Audit Threshold Profiles
- Extended replay-audit CI guardrails to support profile-based defaults:
	- `.github/workflows/backend-integration.yml`
- Supported profiles:
	- `local`, `ci`, `staging` via `REPLAY_AUDIT_PROFILE`
- Profile defaults can be overridden with:
	- `REPLAY_AUDIT_MAX_EXECUTED`
	- `REPLAY_AUDIT_MAX_NO_OP`
	- `REPLAY_AUDIT_MIN_DRY_RUN`

### 43) Throughput Baseline Regression Guard
- Added configurable throughput regression assertions for synthetic queue-load tiers:
	- `apps/backend/tests/integration/application-queue-synthetic-load.test.mjs`
- New env controls:
	- `SCORING_SYNTHETIC_BASELINE_TPS_JSON` (JSON map by tier)
	- `SCORING_SYNTHETIC_MAX_DROP_PCT` (allowed regression percentage)
- Behavior:
	- test fails when measured throughput drops below baseline beyond configured tolerance.

### 44) Queue-Load Snapshot Append Helper
- Added helper script to extract and append JSON throughput snapshots from test logs to JSONL:
	- `scripts/queue-load-snapshot-append.ps1`
- Supports:
	- configurable input log path
	- configurable output JSONL file path
	- safe skip behavior when no snapshots are found

### 45) CI Queue-Load Trend Artifact Pipeline
- Added dedicated CI queue-load execution with output capture:
	- `.github/workflows/backend-integration.yml`
- New CI behavior:
	- runs `test:integration:queue-load` with output tee to `scripts/queue-load-trend.log`
	- appends JSON throughput snapshots into `scripts/queue-load-trend.jsonl` via helper script
	- uploads `queue-load-trend` artifact for historical analysis

### 46) Throughput Threshold Exception Workflow
- Added exception mode for intentionally slower/shared runners:
	- `apps/backend/tests/integration/application-queue-synthetic-load.test.mjs`
- New env controls:
	- `SCORING_SYNTHETIC_BASELINE_EXCEPTION_MODE` (`enforce` | `warn`)
	- `SCORING_SYNTHETIC_BASELINE_EXCEPTION_REASON`
- Behavior:
	- `warn` mode logs regression warnings without failing, enabling controlled tolerance during noisy runner periods.

### 47) Rolling Baseline Recalibration Guidance
- Expanded runbook with baseline recalibration procedure:
	- `README.md`
- Guidance includes:
	- collect last N CI trend artifacts
	- compute per-tier median throughput
	- refresh `SCORING_SYNTHETIC_BASELINE_TPS_JSON`
	- recalibrate after infra/runtime shifts

### 48) Automatic Baseline Suggestion Output in CI
- Added baseline suggestion generation step in CI:
	- `.github/workflows/backend-integration.yml`
- New script:
	- `scripts/queue-load-baseline-suggest.ps1`
- Behavior:
	- computes per-tier median throughput candidates from trend JSONL when enough samples exist
	- writes `scripts/queue-load-baseline-suggestion.json`
	- includes suggestion file in `queue-load-trend` artifact

### 49) Runner-Class Threshold Presets
- Added runner-class preset resolution in CI:
	- `.github/workflows/backend-integration.yml`
- Supported classes:
	- `github-hosted` (default): `warn` exception mode and more tolerant drop threshold
	- `self-hosted`: `enforce` mode and tighter threshold
- Presets now drive queue-load baseline environment values centrally via `$GITHUB_ENV`.

### 50) Repeated Warn-Mode Regression Hook
- Added warn-streak watcher hook for queue-load trend data:
	- `scripts/queue-load-regression-watch.ps1`
- CI now runs regression watch after trend JSONL append:
	- emits workflow warning when warn streak reaches configured threshold
- Goal:
	- provide early anomaly notification before hard failures in noisy environments.

### 51) Persistent Queue-Load Trend History in CI
- Added cross-run trend history persistence in backend integration workflow:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- restores `scripts/queue-load-trend-history.jsonl` via `actions/cache/restore`
	- merges latest `scripts/queue-load-trend.jsonl` snapshots into history file
	- saves updated history via `actions/cache/save`
	- uploads history file in `queue-load-trend` artifact
- Outcome:
	- baseline suggestion and warn-streak checks now operate on cumulative branch history instead of a single-run sample.

### 52) Optional Strict Fail Mode for Warn-Streak Breaches
- Added CI-controlled strictness for warn-streak monitoring:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- runner-class preset now sets `SCORING_WARN_STREAK_FAIL`
	- `self-hosted` defaults to strict fail mode (`true`)
	- `github-hosted` defaults to warning-only mode (`false`)
- Outcome:
	- environments can retain noisy-runner tolerance while enabling stricter enforcement where performance variance is lower.

### 53) Warn-Streak Webhook Alert Integration
- Extended warn-streak script with optional webhook delivery:
	- `scripts/queue-load-regression-watch.ps1`
- New option:
	- `-WebhookUrl` sends a JSON alert payload when streak threshold is reached
- CI wiring:
	- backend workflow passes `QUEUE_LOAD_WARN_WEBHOOK_URL` secret (when configured)
- Outcome:
	- repeated regression signals can be surfaced to external incident/notification channels.

### 54) Trend-History De-duplication and Retention Controls
- Added queue-load history normalization step in CI:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- de-duplicates identical JSONL lines in `scripts/queue-load-trend-history.jsonl`
	- drops malformed/blank lines during normalization
	- keeps only the most recent `SCORING_TREND_HISTORY_MAX_LINES` entries (default `3000`)
- Outcome:
	- prevents unbounded history growth while preserving recent trend signal quality.

### 55) Richer Warn-Streak Alert Payload Metadata
- Extended watcher payload context fields:
	- `scripts/queue-load-regression-watch.ps1`
- New optional fields:
	- `CommitSha`, `WorkflowRunUrl`, `Repository`, `RefName`, `RunnerClass`
- CI wiring updated:
	- backend workflow now passes GitHub run metadata into watcher webhook payload.
- Outcome:
	- downstream alerting channels can triage warn streaks faster with direct run/commit context.

### 56) Nightly Baseline Calibration Workflow with PR Automation
- Added dedicated scheduled baseline-calibration workflow:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- Added baseline source-of-truth file:
	- `scripts/queue-load-baseline-current.json`
- New behavior:
	- nightly/manual workflow computes baseline suggestions from trend history
	- updates baseline JSON (runner-class map)
	- opens automated PR when baseline file changes
- Backend CI now supports loading runner-class baseline from baseline JSON when available.
- Outcome:
	- throughput baseline maintenance can be automated without manual copy/paste from artifacts.

### 57) Class-Specific Trend History Feeds
- Updated queue-load trend history handling to isolate runner classes:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- stores trend history in class-specific files (`queue-load-trend-history-github-hosted.jsonl`, `queue-load-trend-history-self-hosted.jsonl`)
	- uses class-specific history for baseline suggestion and warn-streak checks
	- includes all class-specific history files in queue-load trend artifact
- Outcome:
	- avoids cross-runner bias when calibrating or evaluating throughput regressions.

### 58) Nightly Calibration Guardrails to Reduce PR Churn
- Strengthened nightly baseline automation:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New guardrails:
	- minimum significant delta threshold required before baseline update
	- maximum delta sanity cap blocks outlier auto-updates
	- PR creation runs only when guarded baseline update is actually applied
- Outcome:
	- reduces noisy/low-value calibration PRs while preserving meaningful baseline updates.

### 59) Signed Webhook + Auth Header Support for Warn Alerts
- Extended queue-load warn watcher webhook security options:
	- `scripts/queue-load-regression-watch.ps1`
- New options:
	- `-WebhookSigningSecret` (HMAC SHA-256 signature over timestamp + body)
	- `-WebhookSignatureHeader`, `-WebhookTimestampHeader`
	- `-WebhookAuthHeaderName`, `-WebhookAuthToken`
- CI wiring now supports passing optional webhook auth/signing secrets:
	- `.github/workflows/backend-integration.yml`
- Outcome:
	- webhook receivers can verify authenticity and apply strict auth controls.

### 60) Runner-Class Override via Manual Workflow Dispatch
- Added `workflow_dispatch` runner-class input support:
	- `.github/workflows/backend-integration.yml`
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- manual runs can choose `github-hosted` or `self-hosted` threshold/baseline profile without editing workflow YAML
- Outcome:
	- faster controlled calibration/integration experiments across runner classes.

### 61) Calibration Decision Artifact for Governance
- Added calibration decision output in nightly workflow:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New artifact:
	- `scripts/queue-load-baseline-calibration-decision.json`
- Captured fields include:
	- applied/skipped status
	- reason code
	- significant delta count and outlier count
	- runner class and threshold values
- Outcome:
	- baseline update decisions are auditable and easier to review in CI artifacts.

### 62) DLQ Replay Alert Integration with Signed Webhooks
- Extended DLQ replay tooling with outbound alert delivery:
	- `scripts/queue-replay-dlq.ps1`
- New options:
	- `-WebhookUrl`
	- `-WebhookSigningSecret`, `-WebhookSignatureHeader`, `-WebhookTimestampHeader`
	- `-WebhookAuthHeaderName`, `-WebhookAuthToken`
	- optional run metadata fields (`CommitSha`, `WorkflowRunUrl`, `Repository`, `RefName`, `RunnerClass`)
- CI wiring:
	- backend integration replay-audit step now passes optional webhook/signing/auth secrets when configured
	- `.github/workflows/backend-integration.yml`
- Outcome:
	- replay audit events can be propagated to external incident channels with authenticity verification.

### 63) Per-Tier Confidence Scoring in Baseline Suggestion
- Enhanced baseline suggestion analytics output:
	- `scripts/queue-load-baseline-suggest.ps1`
- New output section:
	- `confidence_by_tier` including sample count, p25/p75, IQR, relative IQR %, and confidence score
- Outcome:
	- baseline auto-update decisions can use dispersion-aware confidence instead of raw medians only.

### 64) Branch-Aware Calibration Apply Policy
- Added branch policy controls for nightly baseline automation:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- baseline apply defaults to default branch only
	- non-default branch apply is blocked unless manual dispatch sets `allow_non_default_apply=true`
	- calibration decision artifact captures branch-policy block reason when applicable
- Outcome:
	- reduces accidental baseline drift from non-default branches.

### 65) DLQ Replay Redis-Availability Preflight Guard
- Hardened replay script when Redis service is unavailable:
	- `scripts/queue-replay-dlq.ps1`
- New behavior:
	- detects empty/unavailable Redis CLI response before depth parsing
	- emits explicit operator-facing message instead of null-method exception
- Outcome:
	- clearer operational failure mode for local/CI runs when Redis is down.

### 66) Replay Alert Throttling Controls
- Extended replay webhook behavior with burst-protection settings:
	- `scripts/queue-replay-dlq.ps1`
- New options:
	- `-WebhookMinIntervalSeconds`
	- `-WebhookThrottleStateFile`
- CI wiring now supports optional replay webhook throttle interval secret:
	- `.github/workflows/backend-integration.yml`
- Outcome:
	- reduces replay alert storms during maintenance or high-volume DLQ operations.

### 67) Minimum Confidence Gate for Nightly Baseline Apply
- Added confidence-based guardrail in nightly calibration:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- reads per-tier confidence scores from baseline suggestion output
	- blocks auto-apply when any target tier falls below configured minimum confidence threshold
	- records low-confidence block counts in calibration decision artifact
- Outcome:
	- improves trust in automated baseline updates under high-variance sample conditions.

### 68) Trend Cache Fallback Strategy for New Branches
- Added cache restore fallback keys in integration and nightly workflows:
	- `.github/workflows/backend-integration.yml`
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- attempts branch-specific trend history cache key first
	- falls back to default-branch cache key when branch cache is absent
- Outcome:
	- new branches gain immediate trend context instead of cold-starting with empty history.

### 69) Replay Webhook Idempotency Header/Key Support
- Extended replay audit webhook integration with idempotency controls:
	- `scripts/queue-replay-dlq.ps1`
- New options:
	- `-WebhookIdempotencyHeader` (defaults to `X-CV-Replay-Idempotency-Key`)
	- `-WebhookIdempotencyKey` (optional explicit key)
- New behavior:
	- when key is not provided, script computes deterministic SHA-256 digest of replay audit payload JSON
	- sends idempotency value through configured header for receiver-side dedupe
- CI wiring:
	- backend integration replay-audit step passes optional idempotency header/key secrets when configured
	- `.github/workflows/backend-integration.yml`
- Outcome:
	- reduces duplicate replay alerts in downstream incident channels.

### 70) Per-Tier Confidence Override Policy for Controlled Migrations
- Added per-tier confidence override input to nightly baseline calibration:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- workflow_dispatch accepts `confidence_override_tiers` (comma-separated)
	- specified tiers are exempt from low-confidence auto-apply blocking
	- calibration decision artifact records override tier list for audit traceability
- Outcome:
	- enables controlled baseline migrations where selected tiers are intentionally noisy but operationally approved.

### 71) Adaptive Confidence Threshold Policy by Branch/Run Type
- Replaced fixed confidence threshold with adaptive policy in nightly calibration:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New environment controls:
	- `NIGHTLY_BASELINE_MIN_CONFIDENCE_DEFAULT`
	- `NIGHTLY_BASELINE_MIN_CONFIDENCE_STRICT`
	- `NIGHTLY_BASELINE_MIN_CONFIDENCE_RELAXED`
- New behavior:
	- scheduled runs on default branch use strict threshold
	- default behavior uses default threshold
	- non-default branches use relaxed threshold (still branch-policy gated unless explicitly allowed)
	- decision artifact records effective confidence threshold used for the run
- Outcome:
	- balances baseline safety on protected branches with flexibility for manual validation runs.

### 72) Replay Webhook Delivery Retry/Backoff Controls
- Added resilient webhook delivery options for replay audit notifications:
	- `scripts/queue-replay-dlq.ps1`
- New options:
	- `-WebhookMaxAttempts` (minimum 1)
	- `-WebhookRetryBackoffMs` (base milliseconds, exponential backoff with cap)
- New behavior:
	- retries replay-audit webhook sends on transient failures
	- keeps existing throttle-state updates only on successful send
- CI wiring:
	- backend integration replay-audit step now passes optional retry/backoff secrets when configured
	- `.github/workflows/backend-integration.yml`
- Outcome:
	- reduces dropped replay audit events when webhook receivers are briefly unavailable.

### 73) Calibration Decision Artifact Per-Tier Diff Summary
- Enriched nightly calibration decision artifact for reviewer context:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New artifact fields:
	- `tier_delta_summary[]` with `tier`, `old_tps`, `new_tps`, `delta_pct`, `significant_change`, `over_max_delta`
	- per-tier confidence policy flags: `low_confidence_blocked`, `confidence_override_applied`
	- `low_confidence_tiers[]` sorted list for quick triage
- Behavior:
	- summary is generated for all candidate tiers before apply/skip decision
	- same summary is preserved in both applied and blocked decision outcomes
- Outcome:
	- calibration PR and artifact review is faster, with explicit per-tier change visibility.

### 74) Optional Non-PR Mode for Nightly Calibration
- Added suggestion-only mode controls for baseline calibration workflow:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New manual input:
	- `create_pull_request` (boolean, default `true`)
- Behavior:
	- when `create_pull_request=false`, workflow still computes suggestion, updates decision artifact, and updates baseline file in workspace context
	- PR creation step is skipped even when baseline apply condition is met
	- decision artifact now records `create_pull_request_enabled`
- Outcome:
	- supports artifact-only calibration rehearsals without generating PR noise.

### 75) Replay Webhook Timeout + Response-Code Failure Logging
- Hardened replay-audit webhook network behavior and diagnostics:
	- `scripts/queue-replay-dlq.ps1`
- New option:
	- `-WebhookTimeoutSeconds` (per-attempt HTTP timeout, default `10`)
- New behavior:
	- webhook delivery attempts now enforce timeout to avoid long blocking on slow receivers
	- failure warnings include HTTP status code (when available), timeout used, and error message
- CI wiring:
	- backend integration replay-audit step now passes optional timeout secret when configured
	- `.github/workflows/backend-integration.yml`
- Outcome:
	- improves replay alert delivery resilience and shortens root-cause time during webhook receiver issues.

### 76) Calibration Decision Environment-Profile Annotation
- Added profile annotation in nightly calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `environment_profile` (for example `scheduled_default`, `manual_default`, `manual_non_default`)
- Behavior:
	- profile is derived from event type and branch context before apply/skip decision
	- field is included across all decision outcomes for downstream reporting consistency
- Outcome:
	- simplifies dashboard grouping and run-context analysis for calibration automation.

### 77) Calibration Threshold-Profile Annotation
- Added direct threshold policy annotation in nightly calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `threshold_profile` (`strict` | `default` | `relaxed`)
- Behavior:
	- profile is computed from branch/event confidence policy selection and stored with decision output
- Outcome:
	- improves policy observability when auditing calibration decisions.

### 78) Replay Webhook Retry Jitter Control
- Added retry jitter support to replay webhook delivery logic:
	- `scripts/queue-replay-dlq.ps1`
- New option:
	- `-WebhookRetryJitterMs` (maximum random jitter added per retry)
- Behavior:
	- each retry adds random jitter to exponential backoff delay
	- retry logs now include base delay and jitter components
- CI wiring:
	- backend integration replay-audit step supports optional jitter secret
	- `.github/workflows/backend-integration.yml`
- Outcome:
	- reduces synchronized retry bursts across concurrent runners.

### 79) Calibration Decision Artifact Format Validation in CI
- Added lightweight artifact contract validation in nightly calibration workflow:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- validates required decision fields and `tier_delta_summary` structure using `jq`
	- fails workflow early when decision artifact schema drifts unexpectedly
- Outcome:
	- increases confidence in automation consumers and downstream dashboard parsing.

### 80) Calibration Decision Schema Versioning
- Added explicit artifact schema version for calibration decisions:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `schema_version` (currently `1.0.0`)
- Behavior:
	- included in all decision outcomes and validated in CI artifact contract checks
- Outcome:
	- enables safer downstream parsing and explicit compatibility gating.

### 81) Replay Webhook Delivery Metadata in Audit Payload
- Extended replay audit JSON payload with webhook delivery outcome metadata:
	- `scripts/queue-replay-dlq.ps1`
- New metadata block:
	- `webhook_delivery.configured`
	- `webhook_delivery.attempted`
	- `webhook_delivery.max_attempts`
	- `webhook_delivery.sent`
	- `webhook_delivery.final_status`
	- `webhook_delivery.last_status_code`
	- `webhook_delivery.timeout_seconds`
- Behavior:
	- payload now records final delivery state (for example `success`, `failed`, `throttled`, `not_configured`) after webhook logic completes
- Outcome:
	- improves post-incident triage and receiver/network failure attribution.

### 82) Replay Dry-Run Wiring Assertions in CI
- Added replay argument wiring assertions in backend integration workflow:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validates presence/absence of replay webhook arguments against configured secrets before dry-run invocation
	- logs non-sensitive replay argument names used in invocation
- Outcome:
	- catches workflow wiring regressions early when adding or changing replay webhook options.

### 83) Replay Webhook Delivery Duration Metadata
- Added delivery latency metadata for replay webhook diagnostics:
	- `scripts/queue-replay-dlq.ps1`
- New metadata field:
	- `webhook_delivery.duration_ms`
- Behavior:
	- captures elapsed milliseconds for webhook delivery lifecycle when webhook is attempted
- Outcome:
	- supports trend analysis of webhook receiver latency and timeout tuning decisions.

### 84) Calibration Sample-Count Summary by Tier
- Added per-tier sample count summary to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `sample_counts_by_tier` (tier -> sample count from confidence dataset)
- Behavior:
	- carries sample volume context alongside delta/confidence decisions for reviewer interpretation
	- included in decision artifact format validation step
- Outcome:
	- improves confidence in baseline decisions by exposing sample-size context per tier.

### 85) Calibration Documentation Guard in CI
- Added documentation anchor validation for calibration schema fields:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- workflow verifies README contains `schema_version`, current schema version value, `environment_profile`, `threshold_profile`, and `sample_counts_by_tier`
- Outcome:
	- reduces drift between artifact schema changes and operator-facing runbook documentation.

### 86) Replay Webhook Cumulative Backoff Telemetry
- Added cumulative retry-delay metric to replay webhook metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.total_backoff_ms`
- Behavior:
	- aggregates actual retry wait intervals (base + jitter) across attempts
- Outcome:
	- improves diagnosis of alert-delivery delays under transient receiver failures.

### 87) Calibration Blocked-Tier Listing by Skip Reason
- Added explicit blocked tier list in calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `blocked_tiers`
- Behavior:
	- for `delta_below_threshold`: lists non-significant tiers
	- for `delta_outlier_blocked`: lists outlier tiers exceeding max delta
	- for `low_confidence_blocked`: lists low-confidence tiers after override handling
	- for `applied`: emits empty list
- Outcome:
	- clarifies exactly which tiers blocked automation without manual artifact interpretation.

### 88) Replay-Audit Dry-Run Contract Tightening
- Strengthened replay-audit JSON validation in backend integration CI:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- requires `webhook_delivery` object and key fields (`final_status`, `attempted`) in validated audit lines
- Outcome:
	- prevents regressions that drop delivery metadata from replay audit outputs.

### 89) Replay Endpoint Host Classification Metadata
- Added endpoint routing classification to replay webhook delivery metadata:
	- `scripts/queue-replay-dlq.ps1`
- New fields:
	- `webhook_delivery.endpoint_host`
	- `webhook_delivery.endpoint_host_classification`
- Behavior:
	- classifies endpoint as `loopback`, `private_ipv4`, `internal_dns`, `public_dns_or_ip`, `invalid_url`, or `unknown`
- Outcome:
	- improves multi-endpoint routing analysis and incident segmentation by destination type.

### 90) Calibration Blocked-Reason Counters
- Added blocked-tier counters by guard reason in calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New fields:
	- `blocked_low_confidence`
	- `blocked_outlier`
	- `blocked_below_threshold`
- Behavior:
	- counters are populated consistently with `blocked_tiers` according to skip reason
	- artifact contract validation now enforces numeric types for these counters
- Outcome:
	- enables lightweight dashboard aggregation without post-processing tier arrays.

### 91) Replay Final-Status Pending Guard in CI
- Tightened replay-audit JSON contract validation:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation now rejects emitted replay audit lines where `webhook_delivery.final_status` remains `pending`
- Outcome:
	- ensures final replay audit payloads always carry resolved delivery state.

### 92) Replay Webhook Attempt Error Metadata
- Added bounded per-attempt error capture in replay webhook delivery metadata:
	- `scripts/queue-replay-dlq.ps1`
- New controls and fields:
	- `-WebhookAttemptErrorsMax` (default `5`)
	- `webhook_delivery.attempt_errors[]` with attempt, status code, truncated error message
- Outcome:
	- preserves actionable failure context without unbounded payload growth.

### 93) Calibration Allowed-Override Tier Persistence
- Added explicit override allow-list persistence in calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `allowed_override_tiers`
- Behavior:
	- mirrors normalized confidence override tier input for audit traceability and downstream analytics
- Outcome:
	- clarifies when confidence gate bypass policy was intentionally applied.

### 94) Replay Endpoint-Classification CI Assertion
- Strengthened replay-audit CI contract for webhook-enabled runs:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- when replay webhook URL is configured, validated audit lines must include `webhook_delivery.endpoint_host_classification`
- Outcome:
	- prevents routing metadata regression in webhook-enabled environments.

### 95) Replay Last-Error Timestamp Metadata
- Added replay webhook failure chronology field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.last_error_at_utc`
- Behavior:
	- set whenever webhook send attempt fails, preserving most recent failure timestamp
- Outcome:
	- improves incident timeline reconstruction for intermittent webhook failures.

### 96) Calibration Applied-Tier Count Summary
- Added applied-tier count to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `applied_tier_count`
- Behavior:
	- remains `0` for blocked/no-op outcomes
	- set to significant changed-tier count when apply succeeds
- Outcome:
	- gives quick scale-of-change visibility without scanning per-tier arrays.

### 97) Replay Attempt-Errors Array Contract in CI
- Tightened replay-audit JSON validation contract:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- requires `webhook_delivery.attempt_errors` to be present as an array in emitted audit lines
- Outcome:
	- ensures consistent metadata shape for downstream parsing across success/failure paths.

### 98) Replay Last-Success Timestamp Metadata
- Added replay webhook recovery timestamp field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.last_success_at_utc`
- Behavior:
	- populated when webhook delivery succeeds, including post-retry recovery cases
- Outcome:
	- improves delivery recovery visibility in incident timelines.

### 99) Calibration Decision Elapsed-Time Metric
- Added decision runtime metric to calibration artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `decision_elapsed_ms`
- Behavior:
	- measured from decision flow start to terminal write path across all outcomes
	- validated as numeric in artifact contract checks
- Outcome:
	- provides lightweight observability into calibration computation overhead.

### 100) Replay Endpoint Host/Classification Consistency Guard
- Strengthened replay-audit CI validation invariants:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- when `webhook_delivery.endpoint_host_classification` is present, validation requires `webhook_delivery.endpoint_host`
- Outcome:
	- prevents partial routing metadata emission that complicates downstream analytics.

### 101) Replay Success-After-Retry Signal
- Added recovery-mode marker for replay webhook deliveries:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.success_after_retry`
- Behavior:
	- set `true` when a send succeeds after one or more retries, otherwise `false`
- Outcome:
	- speeds identification of transient failure recovery patterns.

### 102) Calibration Changed-Tier Summary Field
- Added concise changed-tier list to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `changed_tiers`
- Behavior:
	- populated with sorted unique significant tiers on apply success
	- remains empty for blocked or no-op paths
- Outcome:
	- simplifies reviewer scanning for scope of baseline changes.

### 103) Replay Sent-Implied Success Timestamp Guard
- Tightened replay-audit CI contract for delivery consistency:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation requires `webhook_delivery.last_success_at_utc` when `webhook_delivery.sent=true`
- Outcome:
	- enforces coherent success metadata for downstream analytics and incident traces.

### 104) Replay Retry-Count Metadata
- Added explicit retry counter in replay webhook delivery metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.retry_count`
- Behavior:
	- computed as `attempted - 1` with non-negative floor
- Outcome:
	- eliminates inference overhead when analyzing retry behavior.

### 105) Calibration Unchanged-Tiers Summary
- Added unchanged-tier list to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `unchanged_tiers`
- Behavior:
	- derived from per-tier significance evaluation and emitted for all outcomes
- Outcome:
	- improves completeness of review summaries alongside `changed_tiers`.

### 106) Replay Success-After-Retry Consistency Guard
- Tightened replay-audit CI invariant checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation requires `success_after_retry=true` only when `attempted > 1`
- Outcome:
	- prevents inconsistent retry-recovery labeling in emitted replay metadata.

### 107) Replay Delivery-Mode Classification
- Added high-level delivery-path marker to replay webhook metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.delivery_mode`
- Behavior:
	- emits `not_configured`, `attempted`, or `throttled` for quick filtering without deep field inspection
- Outcome:
	- simplifies operational slicing of replay audit streams.

### 108) Calibration Candidate-Tier Count
- Added candidate-tier denominator metric to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `candidate_tier_count`
- Behavior:
	- populated from suggested baseline tier key count before guard decisions
	- validated as numeric in artifact contract checks
- Outcome:
	- improves decision-ratio analysis (changed/blocked vs total candidates).

### 109) Replay Retry-Count Formula Guard
- Tightened replay-audit CI metadata consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation requires `retry_count == max(0, attempted - 1)`
- Outcome:
	- prevents drift between derived retry fields and attempt counters.

### 110) Replay Final Error-Code Normalization
- Added normalized final failure code for replay webhook delivery metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.final_error_code`
- Behavior:
	- maps webhook failures into normalized classes (`rate_limited`, `auth_error`, `not_found`, `server_error`, `client_error`, `timeout`, `network_error`, `transport_error`, etc.)
	- resets to `null` on successful delivery
- Outcome:
	- improves trend analysis and alert routing by failure class.

### 111) Calibration Applied-Ratio Summary
- Added ratio metric to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `applied_ratio`
- Behavior:
	- computed as `applied_tier_count / candidate_tier_count` on apply success
	- defaults to `0` when no candidate tiers are available
	- validated as numeric in artifact contract checks
- Outcome:
	- provides compact KPI for baseline-change magnitude.

### 112) Replay Throttled-Mode Status Invariant
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `delivery_mode=throttled` implies `final_status=throttled`
- Outcome:
	- prevents inconsistent terminal-state metadata for throttled delivery paths.

### 113) Replay Error-Family Classification
- Added broader failure-family grouping for replay webhook outcomes:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.error_family`
- Behavior:
	- maps `final_error_code` into higher-level families (`client`, `server`, `transport`, `protocol`, `unknown`)
	- clears on successful delivery
- Outcome:
	- enables simpler alert routing and aggregate failure reporting.

### 114) Calibration Blocked-Ratio Metric
- Added blocked-ratio KPI in calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `blocked_ratio`
- Behavior:
	- computed as `blocked_tiers / candidate_tier_count` for blocked outcomes
	- set to `0` for apply success and when candidate denominator is zero
	- validated as numeric in artifact contract checks
- Outcome:
	- improves quick governance assessment of how much proposed change was blocked.

### 115) Replay Not-Configured Mode Consistency Guard
- Tightened replay-audit CI invariants:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `delivery_mode=not_configured` implies `configured=false`
- Outcome:
	- prevents contradictory configuration metadata in replay audit outputs.

### 116) Replay Result-Bucket Field
- Added direct outcome bucket for replay webhook delivery metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.result_bucket`
- Behavior:
	- emits normalized outcome bucket values (`success`, `throttled`, `failed`, `not_configured`)
- Outcome:
	- simplifies dashboard grouping without condition chains over multiple fields.

### 117) Calibration Decision Outcome Bucket
- Added normalized outcome bucket to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `decision_outcome_bucket`
- Behavior:
	- emits `applied`, `blocked`, or `no_op` across all terminal decision paths
	- validated by artifact contract checks
- Outcome:
	- improves aggregation and downstream policy analytics.

### 118) Replay Success/Error-Code Consistency Guard
- Tightened replay-audit CI invariants:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `final_status=success` implies `final_error_code=null`
- Outcome:
	- prevents contradictory success/failure metadata in replay audit streams.

### 119) Replay Terminal-State Canonical Field
- Added canonical terminal sink field for replay webhook delivery:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.terminal_state`
- Behavior:
	- captures final state directly (`success`, `failed`, `throttled`, `not_configured`) independent of intermediate statuses
- Outcome:
	- simplifies downstream state handling without inspecting transitional fields.

### 120) Calibration Decision-Reason Family Grouping
- Added grouped reason taxonomy to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `decision_reason_family`
- Behavior:
	- normalizes outcome reasons into families (`applied`, `policy`, `input`, `threshold`, `confidence`, `none`)
	- validated by artifact contract checks
- Outcome:
	- improves roll-up analytics for automation decision causes.

### 121) Replay Success-Bucket Sent Invariant
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `result_bucket=success` implies `sent=true`
- Outcome:
	- prevents contradictory success classification when send flag is false.

### 122) Replay Delivery State-Transition Count
- Added transition complexity telemetry for replay webhook delivery:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.state_transition_count`
- Behavior:
	- increments whenever replay webhook `final_status` changes across send lifecycle stages
- Outcome:
	- provides lightweight path-complexity signal for troubleshooting unstable webhook deliveries.

### 123) Calibration Guardrail Trigger Counter
- Added guardrail activation counter to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_trigger_count`
- Behavior:
	- increments to reflect blocked/no-op guardrail terminal paths
	- remains `0` for apply-success outcomes
	- validated by artifact contract checks
- Outcome:
	- simplifies reporting on how frequently calibration runs are blocked by governance conditions.

### 124) Replay Terminal-State/Final-Status Consistency Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `terminal_state=success` implies `final_status=success`
- Outcome:
	- prevents contradictory success terminal labeling in replay audit outputs.

### 125) Replay Last-Transition Timestamp
- Added final-status transition timestamp to replay webhook delivery metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.last_transition_at_utc`
- Behavior:
	- updated whenever replay webhook `final_status` changes
- Outcome:
	- improves temporal debugging of multi-step webhook delivery lifecycles.

### 126) Calibration Normalized Decision Reason Code
- Added normalized reason-code taxonomy field to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `decision_reason_code_normalized`
- Behavior:
	- emits stable machine-oriented reason codes (`applied`, `branch_policy_blocked`, `missing_suggestion`, `missing_suggested_baseline_tps`, `delta_below_threshold`, `delta_outlier_blocked`, `low_confidence_blocked`, `none`)
	- validated by artifact contract checks
- Outcome:
	- reduces downstream mapping ambiguity for analytics and policy reporting.

### 127) Replay Not-Configured Transition-Count Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `delivery_mode=not_configured` implies `state_transition_count=0`
- Outcome:
	- prevents impossible lifecycle-transition telemetry for non-configured webhook paths.

### 128) Replay Attempt-Status Sequence Telemetry
- Added bounded lifecycle sequence telemetry for replay webhook delivery:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence`
- Behavior:
	- appends each `final_status` transition in order
	- keeps only the most recent bounded sequence entries to avoid payload growth
- Outcome:
	- exposes transition progression without requiring external log correlation.

### 129) Calibration Guardrail Trigger-Type Taxonomy
- Added normalized guardrail category list to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_trigger_types`
- Behavior:
	- emits normalized categories (`branch_policy`, `input_missing`, `delta_below_threshold`, `delta_outlier`, `low_confidence`)
	- empty array on successful apply paths
	- validated by artifact contract checks
- Outcome:
	- improves governance analytics by separating guardrail class from reason strings.

### 130) Replay Throttled Terminal/Mode Consistency Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `terminal_state=throttled` implies `delivery_mode=throttled`
- Outcome:
	- prevents contradictory throttling metadata in replay audit outputs.

### 131) Replay Status-Sequence Truncation Marker
- Added bounded-sequence truncation marker for replay webhook lifecycle telemetry:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_truncated`
- Behavior:
	- set to `true` when sequence capping drops older status transitions
- Outcome:
	- clarifies when exported status sequence is partial rather than full-history.

### 132) Calibration Guardrail Trigger Summary Map
- Added aggregation-ready guardrail summary map to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_trigger_summary`
- Behavior:
	- emits normalized guardrail category -> count entries
	- remains empty for apply-success outcomes
	- validated by artifact contract checks (allowed keys, numeric non-negative values)
- Outcome:
	- improves downstream trend aggregation without custom post-processing.

### 133) Replay Sequence-Termination Consistency Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces non-empty `attempt_status_sequence` to end with `final_status`
- Outcome:
	- prevents lifecycle-sequence drift from terminal replay status values.

### 134) Replay Transition-Window Metadata
- Added explicit status-sequence cap metadata for replay webhook lifecycle telemetry:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.status_transition_window_size`
- Behavior:
	- publishes active bounded window size used for sequence truncation
- Outcome:
	- enables consistent interpretation of truncated status sequences by downstream consumers.

### 135) Calibration Guardrail Trigger Boolean
- Added dashboard-friendly boolean guardrail indicator to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_triggered`
- Behavior:
	- set `true` for blocked/no-op guardrail terminal paths
	- set `false` for apply-success paths
	- validated by artifact contract checks
- Outcome:
	- improves rapid filtering of guarded runs in reporting tools.

### 136) Replay Truncation-Implied Transition Invariant
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_truncated=true` implies `state_transition_count > status_transition_window_size`
- Outcome:
	- prevents impossible truncation metadata when transition count does not exceed configured sequence window.

### 137) Replay Status-Sequence Last-Index Telemetry
- Added sequence-index convenience metadata for replay lifecycle telemetry:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_last_index`
- Behavior:
	- updates with each status transition to reflect current tail index in bounded sequence
	- defaults to `-1` when no sequence entries exist
- Outcome:
	- simplifies index-based diagnostics without array-length recomputation.

### 138) Calibration Primary Guardrail Category
- Added single-value primary guardrail label to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_trigger_primary`
- Behavior:
	- emits normalized category (`branch_policy`, `input_missing`, `delta_below_threshold`, `delta_outlier`, `low_confidence`, `none`)
	- validated by artifact contract checks
- Outcome:
	- improves fast filtering and faceting for guarded calibration runs.

### 139) Replay Non-Truncated Window Consistency Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_truncated=false` implies `state_transition_count <= status_transition_window_size`
- Outcome:
	- enforces complete bounded-sequence consistency for non-truncated replay delivery paths.

### 140) Replay Sequence-Count Telemetry
- Added explicit bounded-sequence length metric for replay lifecycle telemetry:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_count`
- Behavior:
	- synchronized with emitted `attempt_status_sequence` on each status transition
- Outcome:
	- provides direct sequence cardinality without client-side recomputation.

### 141) Calibration Guardrail Trigger Total
- Added normalized guardrail total metric to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_trigger_total`
- Behavior:
	- stores total activation count represented by `guardrail_trigger_summary`
	- validated against summary-map value sum in artifact contract checks
- Outcome:
	- improves consistency and aggregation simplicity for guardrail analytics.

### 142) Replay Sequence Last-Index Formula Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces non-empty sequence to satisfy `attempt_status_sequence_last_index = (attempt_status_sequence length - 1)`
- Outcome:
	- prevents index/array-length drift in replay sequence telemetry.

### 143) Replay Empty-Sequence Boolean Telemetry
- Added explicit empty-state flag for replay status-sequence telemetry:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_is_empty`
- Behavior:
	- synchronized with `attempt_status_sequence_count`
	- defaults to `true` prior to any status transitions
- Outcome:
	- enables branch-free empty-sequence handling for downstream consumers.

### 144) Calibration Non-Triggered Guardrail Consistency Rule
- Tightened calibration decision artifact contract checks:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- validation enforces `guardrail_triggered=false` implies `guardrail_trigger_total=0` and `guardrail_trigger_primary=none`
- Outcome:
	- prevents contradictory non-triggered guardrail metadata in calibration artifacts.

### 145) Replay Empty-Sequence Last-Index Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces empty `attempt_status_sequence` to imply `attempt_status_sequence_last_index=-1`
- Outcome:
	- enforces canonical index semantics for empty replay status sequences.

### 146) Replay Sequence-Consistency Boolean
- Added pre-computed sequence consistency signal for replay lifecycle metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_consistent`
- Behavior:
	- true when count/index/sequence relationships are internally consistent
	- updated on each status transition
- Outcome:
	- simplifies downstream quality checks without duplicated formula logic.

### 147) Calibration Triggered-Guardrail Total Rule
- Tightened calibration decision artifact contract checks:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- validation enforces `guardrail_triggered=true` implies `guardrail_trigger_total>=1`
- Outcome:
	- prevents contradictory triggered guardrail states with zero aggregate counts.

### 148) Replay Sequence-Count Equality Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_count == (attempt_status_sequence | length)`
- Outcome:
	- prevents sequence-count drift from actual replay status sequence arrays.

### 149) Replay Window Utilization Ratio Telemetry
- Added bounded-sequence window utilization metric for replay lifecycle telemetry:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_window_utilization_ratio`
- Behavior:
	- computed as `attempt_status_sequence_count / status_transition_window_size`
	- rounded to 4 decimals with zero fallback when window size is non-positive
- Outcome:
	- improves observability of sequence-window pressure during replay delivery state churn.

### 150) Calibration Guardrail Total-Consistency Boolean
- Added explicit total-consistency boolean to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_trigger_total_consistent`
- Behavior:
	- mirrors whether `guardrail_trigger_total` matches sum of `guardrail_trigger_summary` values
	- validated as boolean in artifact contract checks
- Outcome:
	- provides direct integrity signal for guardrail aggregate consistency.

### 151) Replay Empty-Flag Length Equality Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_is_empty == ((attempt_status_sequence | length) == 0)`
- Outcome:
	- prevents boolean empty-state drift from actual replay status sequence arrays.

### 152) Replay Sequence-Window Headroom Telemetry
- Added bounded-sequence remaining-capacity metric for replay lifecycle telemetry:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_window_headroom`
- Behavior:
	- computed as `status_transition_window_size - attempt_status_sequence_count` (floored at zero)
- Outcome:
	- improves quick monitoring of sequence-window exhaustion risk.

### 153) Calibration Total-Consistency Truthiness Guard
- Tightened calibration decision artifact contract checks:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- validation enforces `guardrail_trigger_total_consistent=true` in all emitted decisions
- Outcome:
	- blocks artifact emission when internal guardrail total integrity is not explicitly consistent.

### 154) Replay Sequence-Consistency Truthiness Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_consistent=true`
- Outcome:
	- prevents replay audit ingestion of internally inconsistent sequence/index/count states.

### 155) Replay Sequence Tail-Status Telemetry
- Added explicit tail-status mirror field for replay lifecycle sequence metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status`
- Behavior:
	- mirrors the last status entry when sequence is non-empty
	- remains `null` when sequence is empty
- Outcome:
	- simplifies consumers that need tail status without sequence traversal.

### 156) Calibration None-Consistency Boolean
- Added explicit none-consistency signal to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_trigger_none_consistent`
- Behavior:
	- evaluates and validates equivalence: `guardrail_trigger_primary=none` iff `guardrail_triggered=false`
	- validated as boolean in artifact contract checks
- Outcome:
	- prevents contradictory primary/triggered guardrail states.

### 157) Replay Tail-Status/Final-Status Consistency Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces non-empty `attempt_status_sequence` to imply `attempt_status_sequence_tail_status == final_status`
- Outcome:
	- prevents tail-status drift from terminal replay status.

### 158) Replay Tail-Matches-Final Boolean
- Added direct tail/final equality signal in replay lifecycle metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_matches_final`
- Behavior:
	- true when sequence is empty or tail status equals final status
	- updated on each status transition
- Outcome:
	- simplifies consumers that need binary tail/final consistency checks.

### 159) Calibration None-Consistency Truthiness Guard
- Tightened calibration decision artifact contract checks:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- validation enforces `guardrail_trigger_none_consistent=true` in emitted decisions
- Outcome:
	- guarantees normalized none/triggered consistency is always explicitly satisfied.

### 160) Replay Empty-Tail Null Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces empty `attempt_status_sequence` to imply `attempt_status_sequence_tail_status=null`
- Outcome:
	- enforces canonical null-tail semantics for empty replay status sequences.

### 161) Replay Tail-Status Presence Boolean
- Added explicit tail-status presence signal for replay lifecycle metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_present`
- Behavior:
	- true when tail status is non-null, false otherwise
	- synchronized on each status transition
- Outcome:
	- helps strict-schema consumers avoid null checks when only presence is needed.

### 162) Calibration Aggregate Guardrail-Consistency Indicator
- Added aggregate guardrail consistency signal to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_all_passed`
- Behavior:
	- computed/validated against guardrail consistency checks
	- enforced true in artifact contract validation
- Outcome:
	- provides a single high-level integrity flag for guardrail consistency logic.

### 163) Replay Non-Empty Tail Non-Null Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation explicitly enforces non-empty sequence to imply non-null `attempt_status_sequence_tail_status`
- Outcome:
	- prevents ambiguous non-empty sequence payloads with missing tail status.

### 164) Replay Expected Tail-Status Mirror
- Added expected-tail mirror field for replay lifecycle sequence checks:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_expected`
- Behavior:
	- mirrors current `final_status` value for direct tail-vs-expected comparisons
- Outcome:
	- reduces client-side derivation needed for sequence-tail drift checks.

### 165) Calibration Guardrail Consistency Hash
- Added deterministic guardrail consistency digest to calibration decision artifact:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_hash`
- Behavior:
	- computed as SHA-256 over core guardrail consistency fields
	- validated as lowercase 64-char hex digest in artifact contract checks
- Outcome:
	- improves drift detection and tamper-evident comparison for guardrail consistency state.

### 166) Replay Tail-Match Truthiness Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_matches_final=true`
- Outcome:
	- prevents replay audit payloads with explicit tail/final mismatch flags.

### 167) Replay Tail-Status Deviation Signal
- Added direct tail-vs-expected mismatch signal for replay sequence metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_deviation`
- Behavior:
	- computed as `tail_status != tail_status_expected`
	- synchronized on status transitions
- Outcome:
	- improves direct anomaly detection for tail status drift scenarios.

### 168) Calibration Recomputed-Hash Equality Guard
- Added pre-write guard that recomputes guardrail consistency hash and enforces equality:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New behavior:
	- each terminal decision path recomputes hash and asserts it equals emitted `guardrail_consistency_hash`
- Outcome:
	- strengthens drift/tamper resistance by validating hash integrity before artifact write.

### 169) Replay Tail-Presence/Length Equivalence Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_present == ((attempt_status_sequence | length) > 0)`
- Outcome:
	- prevents inconsistent presence-flag semantics for replay sequence tails.

### 170) Replay Tail-Status Consistency Boolean
- Added explicit aggregate tail-status consistency flag in replay metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistent`
- Behavior:
	- combines tail presence, expected-tail equivalence, and tail/final consistency checks into one boolean
- Outcome:
	- simplifies downstream validation and dashboarding of tail-status integrity.

### 171) Calibration Hash-Verified Signal
- Added explicit guardrail hash verification status to calibration artifacts:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_hash_verified`
- Behavior:
	- set true only after recomputed hash matches emitted hash in decision paths
	- validated and enforced true in artifact contract checks
- Outcome:
	- makes hash-verification state machine-readable for audits.

### 172) Replay Tail-Deviation False Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_deviation=false`
- Outcome:
	- blocks replay audit payloads with any explicit tail-vs-expected mismatch.

### 173) Replay Tail-Consistency Reason Code
- Added normalized tail-consistency reason code to replay metadata:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason`
- Behavior:
	- emits normalized reasons (`ok`, `tail_presence_mismatch`, `tail_expected_mismatch`, `tail_final_mismatch`, `unknown_inconsistency`)
	- synchronized with tail consistency evaluation
- Outcome:
	- improves explainability for tail consistency failures without external derivation.

### 174) Calibration Validation-Mode Annotation
- Added explicit validation-mode marker to calibration decision artifacts:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_validation_mode`
- Behavior:
	- currently set and validated as `strict-v1`
- Outcome:
	- allows future profile evolution while preserving audit traceability of validation strictness.

### 175) Replay Tail-Consistency Truthiness Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistent=true`
- Outcome:
	- blocks replay audit payloads that carry inconsistent tail relationship states.

### 176) Replay Tail-Consistency Reason Code Companion
- Added compact numeric companion for tail consistency reason indexing:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_code`
- Behavior:
	- maps normalized reason strings to stable codes (`ok=0`, `tail_presence_mismatch=1`, `tail_expected_mismatch=2`, `tail_final_mismatch=3`, `unknown_inconsistency=9`)
- Outcome:
	- improves analytics indexing and low-cardinality aggregation for consistency outcomes.

### 177) Calibration Guardrail Contract-Version Field
- Added explicit guardrail contract-version marker to decision artifacts:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_contract_version`
- Behavior:
	- set and validated as `guardrail-contract-v1`
- Outcome:
	- decouples contract evolution tracking from broader schema versioning.

### 178) Replay Tail-Consistency Reason-OK Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason == "ok"`
- Outcome:
	- ensures replay audits only pass when normalized tail consistency reasons indicate healthy state.

### 179) Replay Tail-Consistency Reason-Detail Field
- Added human-readable tail-consistency reason detail field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_detail`
- Behavior:
	- emits concise explanatory text aligned with normalized reason codes
- Outcome:
	- improves operator debugging context without external lookup tables.

### 180) Calibration Guardrail Check Accounting Fields
- Added explicit guardrail check accounting fields to calibration artifacts:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New fields:
	- `guardrail_consistency_checks_total`
	- `guardrail_consistency_checks_passed`
- Behavior:
	- validated as numeric fields and enforced with `checks_passed == checks_total` under strict contract profile
- Outcome:
	- provides transparent accounting of guardrail consistency checks.

### 181) Replay Tail-Consistency Reason-Code Zero Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_code == 0`
- Outcome:
	- enforces compact-code parity with normalized `ok` tail consistency state.

### 182) Replay Tail-Consistency Reason Source Field
- Added replay webhook provenance field for tail-consistency reason origin:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_source`
- Behavior:
	- emits `derived` for healthy derived state and `validated` for mismatch/error-detected states
- Outcome:
	- improves triage by distinguishing computed-happy-path from validation-detected inconsistency branches.

### 183) Calibration Failed-Checks Counter Contract
- Added calibration artifact failed-check counter under strict accounting contract:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_failed`
- Behavior:
	- validated as numeric, enforced as `checks_total - checks_passed`, and constrained to non-negative values
- Outcome:
	- hardens guardrail-check accounting semantics against counter drift.

### 184) Replay Reason-Detail Conditional Non-Empty Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces non-empty `attempt_status_sequence_tail_status_consistency_reason_detail` whenever `attempt_status_sequence_tail_status_consistency_reason_code != 0`
- Outcome:
	- prevents opaque non-zero reason-code states without actionable detail text.

### 185) Replay Tail-Consistency Reason Scope Field
- Added replay webhook scope metadata for tail-consistency evaluation:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope`
- Behavior:
	- emits `tail_only` when sequence is empty and `tail_and_final` when terminal sequence state is present
- Outcome:
	- improves downstream interpretation of which consistency dimensions were evaluable.

### 186) Calibration Consistency Checks-Profile Field
- Added calibration artifact check-profile annotation:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile`
- Behavior:
	- populated as `strict-v1` and validated as non-empty string in artifact schema checks
- Outcome:
	- makes consistency-counter semantics explicit for downstream analytics.

### 187) Replay Reason-Source Derived-When-Zero Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_source="derived"` whenever `attempt_status_sequence_tail_status_consistency_reason_code == 0`
- Outcome:
	- ensures canonical healthy reason-code states are provenance-aligned.

### 188) Replay Tail-Consistency Scope Code Field
- Added compact replay webhook scope-code metadata for tail-consistency evaluation:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_code`
- Behavior:
	- emits `0` for `tail_only` and `1` for `tail_and_final` in lockstep with scope label logic
- Outcome:
	- supports compact numeric telemetry consumers without losing normalized scope semantics.

### 189) Calibration Checks-Profile Version Field
- Added calibration artifact checks-profile version annotation:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_version`
- Behavior:
	- populated as non-empty string and validated by decision artifact contract checks
- Outcome:
	- decouples profile versioning cadence from profile-name evolution.

### 190) Replay Non-Empty Sequence Scope Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope == "tail_and_final"` whenever replay attempt-status sequence length is greater than zero
- Outcome:
	- prevents scope labeling drift for non-empty sequence evaluations.

### 191) Replay Scope Label/Code Consistency Boolean
- Added replay webhook scope consistency parity field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_consistent`
- Behavior:
	- derives boolean parity between scope label (`tail_only`/`tail_and_final`) and scope code (`0`/`1`)
- Outcome:
	- enables direct consumer checks for scope label/code drift.

### 192) Calibration Checks Profile-Consistency Boolean
- Added calibration artifact checks-profile pairing integrity field:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_consistent`
- Behavior:
	- validated as boolean and enforced to match expected `strict-v1` + profile-version `1` pairing
- Outcome:
	- hardens profile/version coupling guarantees for consistency counter semantics.

### 193) Replay Non-Empty Sequence Scope-Code Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_code == 1` whenever replay attempt-status sequence length is greater than zero
- Outcome:
	- prevents numeric scope-code drift for non-empty sequence evaluations.

### 194) Replay Scope Label-Code Pair Field
- Added compact replay webhook scope-pair field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_label_code_pair`
- Behavior:
	- emits normalized `scope:code` strings (for example, `tail_only:0`, `tail_and_final:1`) derived from existing scope metadata
- Outcome:
	- simplifies low-cost aggregation keys for downstream telemetry consumers.

### 195) Calibration Checks Profile Signature Field
- Added calibration artifact checks-profile signature field:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature`
- Behavior:
	- enforced as non-empty string and validated to equal `checks_profile + "@" + checks_profile_version`
- Outcome:
	- provides compact immutable identity for checks profile/version combinations.

### 196) Replay Scope-Consistency Truthiness Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_consistent == true`
- Outcome:
	- blocks replay records where scope label/code parity is inconsistent.

### 197) Replay Scope-Code Domain Validity Boolean
- Added replay webhook compact-code domain validity field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_code_valid`
- Behavior:
	- emits boolean validation that scope code stays within `{0,1}` domain
- Outcome:
	- provides direct compact-code domain hygiene signal for downstream consumers.

### 198) Calibration Profile-Signature Verification Boolean
- Added calibration artifact profile-signature verification field and runtime assertion helper:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_verified`
- Behavior:
	- recomputes expected signature from `checks_profile` + `checks_profile_version`, throws on mismatch, and sets verification boolean true on success
- Outcome:
	- ensures profile-signature integrity is verified during decision generation, not only by static schema checks.

### 199) Replay Scope Pair-Recomputation CI Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_label_code_pair == (scope + ":" + tostring(scope_code))`
- Outcome:
	- prevents compact pair-string drift from canonical scope label/code metadata.

### 200) Replay Scope-Code-Matches-Scope Alias Boolean
- Added replay webhook alias boolean for scope parity readability:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_code_matches_scope`
- Behavior:
	- mirrors `attempt_status_sequence_tail_status_consistency_reason_scope_consistent` for consumer-friendly rule naming
- Outcome:
	- improves rule readability in downstream monitoring and analytics systems.

### 201) Calibration Profile-Signature Source Field
- Added calibration artifact profile-signature provenance field:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_source`
- Behavior:
	- emitted as `derived` and validated against allowed values
- Outcome:
	- clarifies provenance of checks-profile signature construction.

### 202) Replay Scope-Code-Matches-Scope CI Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_code_matches_scope == true`
- Outcome:
	- guarantees alias parity signal remains synchronized with canonical scope consistency checks.

### 203) Replay Scope Pair-Consistency Boolean
- Added replay webhook pair-consistency boolean:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_consistent`
- Behavior:
	- attests that emitted `scope_label_code_pair` equals recomputed `scope + ":" + scope_code`
- Outcome:
	- provides direct pair-string integrity signal for compact telemetry consumers.

### 204) Calibration Profile-Signature Consistency Boolean
- Added calibration artifact signature-consistency boolean:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_consistent`
- Behavior:
	- derived during signature assertion to ensure signature value and provenance (`derived`) align with recomputed profile/version identity
- Outcome:
	- strengthens profile-signature governance beyond raw signature equality checks.

### 205) Replay Alias-Canonical Scope Parity Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_code_matches_scope == attempt_status_sequence_tail_status_consistency_reason_scope_consistent`
- Outcome:
	- guarantees alias and canonical parity signals cannot drift.

### 206) Replay Scope Pair-Consistency Signal
- Added replay webhook pair-integrity signal:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_consistent`
- Behavior:
	- emits boolean showing pair-string recomputation consistency with scope label and scope code
- Outcome:
	- enables direct detection of compact pair-field drift in downstream consumers.

### 207) Calibration Profile-Signature Consistency Signal
- Added calibration artifact signature consistency signal:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_consistent`
- Behavior:
	- derived during signature assertion to require `signature_source=derived` and exact profile/version recomputation match
- Outcome:
	- tightens signature governance from static format checks to runtime consistency enforcement.

### 208) Replay Scope-Pair Consistency Truthiness Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_pair_consistent == true`
- Outcome:
	- blocks replay records where compact scope pair-string integrity is not explicitly confirmed.

### 209) Replay Scope-Pair Source Field
- Added replay webhook scope-pair provenance field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_source`
- Behavior:
	- emitted as `derived` alongside scope pair-string metadata
- Outcome:
	- clarifies provenance for compact scope pair-field generation.

### 210) Calibration Profile-Signature Pair Field
- Added calibration artifact compact profile-signature pair field:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_pair`
- Behavior:
	- derived as `checks_profile_signature + "|" + checks_profile_signature_source` and enforced by artifact contract checks
- Outcome:
	- provides aggregation-friendly compact identity/provenance token.

### 211) Replay Scope-Pair Source Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_pair_source == "derived"`
- Outcome:
	- prevents provenance drift for scope pair-string metadata.

### 212) Replay Scope-Pair Version Field
- Added replay webhook compact pair-version metadata field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version`
- Behavior:
	- emitted as `v1` for both initialized and finalized delivery payload paths
- Outcome:
	- versions compact scope pair semantics for compatibility-safe downstream interpretation.

### 213) Calibration Profile-Signature Pair-Consistency Field
- Added calibration artifact pair-token consistency boolean:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_pair_consistent`
- Behavior:
	- derived by recomputing `profile_signature + "|" + profile_signature_source` and asserting exact equality with emitted pair token
	- contract validation requires field presence/type and enforces the computed parity invariant
- Outcome:
	- strengthens compact signature token governance with explicit recomputation attestation.

### 214) Replay Scope-Pair Conditional Source Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_pair_source == "derived"` whenever `attempt_status_sequence_tail_status_consistency_reason_scope_pair_consistent == true`
- Outcome:
	- codifies provenance requirements directly on pair-consistency truthy records while preserving stricter global source guard enforcement.

### 215) Replay Scope-Pair Version-Consistency Field
- Added replay webhook scope-pair version-consistency metadata field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_consistent`
- Behavior:
	- derived as `scope_pair_version == "v1"` for both initialized and finalized replay metadata paths
- Outcome:
	- adds explicit boolean attestation for scope-pair version compatibility.

### 216) Calibration Profile-Signature Pair-Version Field
- Added calibration artifact compact signature-pair version field:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_pair_version`
- Behavior:
	- emitted as `v1` during decision construction and enforced by artifact contract checks
	- check accounting totals updated to include version-contract enforcement
- Outcome:
	- versions signature-pair semantics for compatibility-safe downstream consumers.

### 217) Replay Scope-Pair Version Conditional Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version == "v1"` whenever `attempt_status_sequence_tail_status_consistency_reason_scope_pair_consistent == true`
	- validation also enforces `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_consistent == true`
- Outcome:
	- prevents version-contract drift on truthy scope-pair consistency records.

### 218) Replay Scope-Pair Version-Source Field
- Added replay webhook scope-pair version provenance field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source`
- Behavior:
	- emitted as `derived` alongside scope-pair version metadata in initialized and finalized payload paths
- Outcome:
	- makes scope-pair version provenance explicit for downstream contract checks.

### 219) Calibration Profile-Signature Pair-Version Consistency Field
- Added calibration artifact pair-version consistency boolean:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_pair_version_consistent`
- Behavior:
	- derived as `profile_signature_pair_version == "v1"` and enforced by artifact contract checks
	- check-accounting totals updated to include the new pair-version consistency invariant
- Outcome:
	- strengthens signature pair-version governance with explicit boolean attestation.

### 220) Replay Scope-Pair Version-Source Conditional Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source == "derived"` whenever `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_consistent == true`
- Outcome:
	- codifies provenance requirements for scope-pair version consistency records.

### 221) Replay Scope-Pair Version-Source Consistency Field
- Added replay webhook scope-pair version-source consistency metadata field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_consistent`
- Behavior:
	- derived as `scope_pair_version_source == "derived"` for initialized and finalized replay payload paths
- Outcome:
	- provides explicit boolean attestation for version-source provenance integrity.

### 222) Calibration Profile-Signature Pair-Version Source Field
- Added calibration artifact pair-version provenance field:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_pair_version_source`
- Behavior:
	- emitted as `derived` and enforced by artifact contract checks
	- check-accounting totals updated to include the new provenance invariant
- Outcome:
	- makes pair-version provenance explicit for downstream governance consumers.

### 223) Replay Scope-Pair Version-Source Consistency Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_consistent == true`
- Outcome:
	- blocks replay records missing explicit version-source provenance integrity confirmation.

### 224) Replay Scope-Pair Version-Source Code Field
- Added replay webhook scope-pair version-source compact code field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code`
- Behavior:
	- emitted as `1` for `scope_pair_version_source="derived"` in initialized and finalized replay payload paths
- Outcome:
	- provides compact numeric provenance encoding for downstream replay consumers.

### 225) Calibration Pair-Version Source Consistency Field
- Added calibration artifact pair-version source consistency boolean:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_pair_version_source_consistent`
- Behavior:
	- derived as `profile_signature_pair_version_source == "derived"` and enforced by artifact contract checks
	- check-accounting totals updated to include this additional consistency invariant
- Outcome:
	- strengthens provenance integrity guarantees for profile-signature pair-version source metadata.

### 226) Replay Version-Source Code Conditional Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code == 1` whenever `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_consistent == true`
- Outcome:
	- ensures compact version-source provenance code remains contract-aligned when source consistency is asserted.

### 227) Replay Version-Source Code Validity Field
- Added replay webhook version-source code-domain validity boolean:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_valid`
- Behavior:
	- derived as `scope_pair_version_source_code in {1}` and emitted in initialized and finalized replay payload paths
- Outcome:
	- provides explicit compact-code domain attestation for replay provenance metadata.

### 228) Calibration Pair-Version Source Code Field
- Added calibration artifact pair-version source compact code field:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_pair_version_source_code`
- Behavior:
	- emitted as `1` for `pair_version_source="derived"` and enforced by artifact contract checks
	- check-accounting totals updated to include this additional provenance-code invariant
- Outcome:
	- enables compact source-code provenance encoding for calibration signature-pair governance.

### 229) Replay Version-Source Code Validity + Parity Guards
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_valid == true`
	- validation enforces `scope_pair_version_source_code_valid == (scope_pair_version_source_code == 1)`
	- validation enforces source/code parity: `scope_pair_version_source="derived" -> scope_pair_version_source_code=1`
- Outcome:
	- blocks replay records with invalid code-domain flags or mismatched version-source compact encoding.

### 230) Replay Version-Source Code/Source Parity Alias Field
- Added replay webhook compact source/code parity alias field:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source`
- Behavior:
	- derived as `(scope_pair_version_source == "derived") and (scope_pair_version_source_code == 1)`
	- emitted in initialized and finalized replay payload paths
- Outcome:
	- improves readability for source/code parity checks without recomputing equivalence in downstream consumers.

### 231) Calibration Pair-Version Source-Code Consistency Field
- Added calibration artifact source/code parity consistency boolean:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_pair_version_source_code_consistent`
- Behavior:
	- derived as `(pair_version_source == "derived") and (pair_version_source_code == 1)` and enforced by artifact contract checks
	- check-accounting totals updated to include this additional parity invariant
- Outcome:
	- strengthens calibration compact provenance governance with explicit source/code parity attestation.

### 232) Replay Source-Code Parity Alias CI Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source == true`
	- validation enforces alias/equivalence parity with source and source-code fields
- Outcome:
	- blocks replay records where compact source-code parity alias is missing or inconsistent with canonical parity logic.

### 233) Replay Source-Code Alias Consistency Field
- Added replay webhook alias/equivalence consistency boolean:
	- `scripts/queue-replay-dlq.ps1`
- New field:
	- `webhook_delivery.attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistent`
- Behavior:
	- derived as equality between the alias field and canonical parity expression
	- emitted in initialized and finalized replay payload paths
- Outcome:
	- provides explicit integrity attestation for alias/canonical source-code parity equivalence.

### 234) Calibration Pair-Version Source-Code Validity Field
- Added calibration artifact source-code domain validity boolean:
	- `.github/workflows/queue-load-baseline-calibration.yml`
- New field:
	- `guardrail_consistency_checks_profile_signature_pair_version_source_code_valid`
- Behavior:
	- derived as `pair_version_source_code in {1}` and enforced by artifact contract checks
	- check-accounting totals updated to include this additional code-domain invariant
- Outcome:
	- strengthens calibration compact source-code governance with explicit domain validity attestation.

### 235) Replay Alias-Consistency CI Guard
- Tightened replay-audit CI consistency checks:
	- `.github/workflows/backend-integration.yml`
- New behavior:
	- validation enforces `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistent == true`
	- validation enforces alias-consistency parity against alias value and canonical source/code equivalence
- Outcome:
	- blocks replay records with inconsistent alias-integrity metadata for compact source-code parity.

## Verification Performed
- Compose validation:
	- `docker compose -f docker-compose.yml config` -> valid
	- `docker compose --profile app -f docker-compose.yml config` confirms parser wiring
- Backend test command:
	- `npm run test:integration` -> command passes with suites skipped when `RUN_INTEGRATION_TESTS` is not set
- New parsing test registration:
	- `node --test tests/integration/resume-upload-parsing.test.mjs` -> file loads and skips cleanly without integration env
- New endpoint upload contract test registration:
	- `node --test tests/integration/resume-upload-endpoint.test.mjs` -> file loads and skips cleanly without integration env
- Backend integration command after queue/worker wiring:
	- `npm run test:integration` -> command completes, integration files register (skipped unless enabled)
- Dependency installation checks:
	- `apps/backend`: `npm install` successful
	- `workers/scoring`: `npm install` successful
- Focused script checks:
	- `npm run test:integration:parsing` -> command executes and registers parsing tests
	- `npm run test:integration:worker` -> command executes and registers worker-processing test
- Queue-focused script check:
	- `npm run test:integration:queue` -> command executes and registers queue observability test
- DLQ-focused script check:
	- `npm run test:integration:dlq` -> command executes and registers DLQ flow test
- Worker package install check after heartbeat updates:
	- `workers/scoring`: `npm install` successful
- Compose re-validation after retry/DLQ updates:
	- `docker compose -f docker-compose.yml config` -> valid
- Re-validation after replay guardrail + failure-label updates:
	- `npm run test:integration:dlq` / `queue` / `worker` -> commands execute and register test groups
- Metrics endpoint integration command check:
	- `npm run test:integration:worker-metrics` -> command executes and registers worker metrics test (skips when integration env gate is off)
- Synthetic queue-load command check:
	- `npm run test:integration:queue-load` -> command executes and registers synthetic load test (skips when integration env gate is off)
- Synthetic queue-variant command check:
	- `npm run test:integration:queue-variants` -> command executes and registers synthetic failure-variant test (skips when integration env gate is off)
- Updated synthetic queue-load command check:
	- `npm run test:integration:queue-load` -> command executes and registers multi-tier load profiling test (skips when integration env gate is off)
- Re-validation after status-threshold and env-tier updates:
	- command wiring remains healthy; compose remains valid
- Snapshot append helper smoke-check:
	- script executes safely and reports no-op when input log is missing
- Re-validation after CI trend pipeline updates:
	- workflow structure remains valid and compose remains valid
- Re-validation after baseline suggestion and warn-streak hooks:
	- workflow diagnostics clean and compose remains valid
- Re-validation after trend-history cache + strict/watch alert wiring:
	- workflow diagnostics clean and compose remains valid
- Re-validation after trend-history normalization + nightly calibration workflow:
	- workflow diagnostics clean and compose remains valid
- Re-validation after class-specific trend feeds + calibration guardrails + signed webhook support:
	- workflow diagnostics clean and compose remains valid
- Re-validation after workflow-dispatch runner override + calibration decision artifact:
	- workflow diagnostics clean and compose remains valid
- Re-validation after replay webhook alerts + confidence scoring + branch policy gating:
	- workflow diagnostics clean and compose remains valid
- Re-validation after replay Redis-availability preflight guard:
	- script now fails with explicit operator message when Redis is unavailable
- Re-validation after replay throttling + confidence gate + cache fallback strategy:
	- workflow diagnostics clean and compose remains valid
- Re-validation after replay idempotency + adaptive confidence policy updates:
	- workflow/script diagnostics clean after resolving effective confidence variable mismatch
- Re-validation after replay webhook retry/backoff controls:
	- workflow/script diagnostics clean and no static errors reported
- Re-validation after calibration decision per-tier diff summary:
	- workflow diagnostics clean and artifact schema updates parse correctly
- Re-validation after optional non-PR calibration mode:
	- workflow diagnostics clean and PR step gating works from boolean input/env condition
- Re-validation after webhook timeout + response-code logging + environment profile annotation:
	- script/workflow diagnostics clean and updated fields/options parse correctly
- Re-validation after threshold-profile annotation + jitter retries + decision-format validation:
	- workflow/script diagnostics clean and new guard step parses decision artifact fields as expected
- Re-validation after schema versioning + replay delivery metadata + wiring assertions:
	- workflow/script diagnostics clean and new metadata/assertion logic parses successfully
- Re-validation after delivery duration + sample-count summary + documentation guard:
	- workflow/script diagnostics clean and new decision fields/docs assertions are syntactically valid
- Re-validation after cumulative backoff + blocked tier lists + replay payload contract tightening:
	- workflow/script diagnostics clean and updated validation filters parse expected metadata fields
- Re-validation after endpoint classification + blocked counters + pending-status guard:
	- workflow/script diagnostics clean and stricter replay payload terminal-state check parses correctly
- Re-validation after attempt error metadata + allowed override persistence + endpoint-classification assertion:
	- workflow/script diagnostics clean and new metadata contract checks parse successfully
- Re-validation after last-error timestamp + applied tier count + attempt-errors array guard:
	- workflow/script diagnostics clean and updated replay/calibration metadata contracts parse correctly
- Re-validation after last-success timestamp + decision elapsed metric + endpoint-host consistency guard:
	- workflow/script diagnostics clean and added metadata invariants parse successfully
- Re-validation after success-after-retry + changed-tiers summary + sent-implies-success-timestamp guard:
	- workflow/script diagnostics clean and new replay/calibration metadata checks parse correctly
- Re-validation after retry-count + unchanged-tiers + retry-success invariant guard:
	- workflow/script diagnostics clean and added replay/calibration invariants parse as expected
- Re-validation after delivery-mode + candidate-tier-count + retry-count formula guard:
	- workflow/script diagnostics clean and newly added invariants parse correctly
- Re-validation after final-error-code + applied-ratio + throttled-mode invariant:
	- workflow/script diagnostics clean and added metadata guards parse successfully
- Re-validation after error-family + blocked-ratio + not-configured consistency guard:
	- workflow/script diagnostics clean and new replay/calibration invariants parse correctly
- Re-validation after result-bucket + decision-outcome-bucket + success/error-code guard:
	- workflow/script diagnostics clean and new consistency guards parse successfully
- Re-validation after terminal-state + reason-family + success-bucket/sent invariant:
	- workflow/script diagnostics clean and new canonical-state/reason grouping checks parse correctly
- Re-validation after transition-count + guardrail-trigger-count + terminal-state/final-status invariant:
	- workflow/script diagnostics clean and new lifecycle/guardrail consistency checks parse correctly
- Re-validation after last-transition timestamp + normalized reason code + not-configured transition-count guard:
	- workflow/script diagnostics clean and new transition/reason normalization checks parse correctly
- Re-validation after attempt-status sequence + guardrail-trigger-types + throttled terminal/mode invariant:
	- workflow/script diagnostics clean and new lifecycle/guardrail taxonomy checks parse correctly
- Re-validation after sequence-truncation marker + guardrail-summary map + sequence-termination invariant:
	- workflow/script diagnostics clean and new bounded-sequence/summary consistency checks parse correctly
- Re-validation after transition-window metadata + guardrail-triggered boolean + truncation implication invariant:
	- workflow/script diagnostics clean and new truncation/guardrail boolean consistency checks parse correctly
- Re-validation after sequence-last-index + primary guardrail category + non-truncated window invariant:
	- workflow/script diagnostics clean and new index/primary-category consistency checks parse correctly
- Re-validation after sequence-count + guardrail-total + last-index formula invariant:
	- workflow/script diagnostics clean and new sequence/guardrail aggregate consistency checks parse correctly
- Re-validation after empty-sequence boolean + non-triggered guardrail consistency + empty-sequence index invariant:
	- workflow/script diagnostics clean and new empty-state/guardrail consistency checks parse correctly
- Re-validation after sequence-consistency boolean + triggered-total rule + sequence-count equality guard:
	- workflow/script diagnostics clean and new sequence/guardrail aggregate consistency checks parse correctly
- Re-validation after window-utilization ratio + total-consistency boolean + empty-flag length equality guard:
	- workflow/script diagnostics clean and new sequence-utilization/integrity checks parse correctly
- Re-validation after window-headroom + total-consistency truthiness + sequence-consistency truthiness guards:
	- workflow/script diagnostics clean and new consistency enforcement checks parse correctly
- Re-validation after tail-status telemetry + none-consistency boolean + tail-status/final-status guard:
	- workflow/script diagnostics clean and new sequence-tail/guardrail-consistency checks parse correctly
- Re-validation after tail-matches-final boolean + none-consistency truthiness + empty-tail null guard:
	- workflow/script diagnostics clean and new tail/null consistency checks parse correctly
- Re-validation after tail-status-present boolean + aggregate guardrail consistency + non-empty-tail non-null guard:
	- workflow/script diagnostics clean and new tail-presence/aggregate-consistency checks parse correctly
- Re-validation after expected-tail mirror + consistency hash + tail-match truthiness guard:
	- workflow/script diagnostics clean and new expected-tail/hash integrity checks parse correctly
- Re-validation after tail-deviation signal + recomputed-hash equality guard + tail-presence/length equivalence:
	- workflow/script diagnostics clean and new deviation/hash/presence consistency checks parse correctly
- Re-validation after tail-status-consistent boolean + hash-verified signal + tail-deviation false guard:
	- workflow/script diagnostics clean and new tail/hash verification consistency checks parse correctly
- Re-validation after tail-consistency reason + validation-mode annotation + tail-consistency truthiness guard:
	- workflow/script diagnostics clean and new reason/profile/consistency checks parse correctly
- Re-validation after reason-code companion + contract-version field + reason-ok guard:
	- workflow/script diagnostics clean and new code/version/reason guard checks parse correctly
- Re-validation after reason-detail field + check-accounting fields + reason-code-zero guard:
	- workflow/script diagnostics clean and new detail/accounting/code parity checks parse correctly
- Re-validation after reason-source provenance + failed-check counter + conditional reason-detail guard:
	- workflow/script diagnostics clean and new provenance/counter/conditional-detail checks parse correctly
- Re-validation after reason-scope metadata + checks-profile annotation + zero-code derived-source guard:
	- workflow/script diagnostics clean and new scope/profile/source-consistency checks parse correctly
- Re-validation after scope-code telemetry + checks-profile-version annotation + non-empty-sequence scope guard:
	- workflow/script diagnostics clean and new scope-code/profile-version/scope-length checks parse correctly
- Re-validation after scope-consistency boolean + profile-consistency boolean + non-empty-sequence scope-code guard:
	- workflow/script diagnostics clean and new parity/profile-coupling/scope-code checks parse correctly
- Re-validation after scope label-code pair + profile signature + scope-consistency truthiness guard:
	- workflow/script diagnostics clean and new compact-pair/signature/parity-enforcement checks parse correctly
- Re-validation after scope-code-domain boolean + profile-signature verification + pair-recomputation guard:
	- workflow/script diagnostics clean and new code-domain/signature-verify/pair-recompute checks parse correctly
- Re-validation after scope parity alias + signature provenance + alias truthiness guard:
	- workflow/script diagnostics clean and new alias/provenance/alias-consistency checks parse correctly
- Re-validation after scope pair-consistency boolean + signature-consistency boolean + alias/canonical parity guard:
	- workflow/script diagnostics clean and new pair-integrity/signature-governance/alias-canonical checks parse correctly
- Re-validation after pair-consistency signal + signature-consistency signal + scope-pair truthiness guard:
	- workflow/script diagnostics clean and new replay/calibration consistency signals and scope-pair integrity checks parse correctly
- Re-validation after scope-pair source + profile-signature pair + scope-pair source guard:
	- workflow/script diagnostics clean and new provenance/pair-token/source-guard checks parse correctly

## Files Changed
- `workers/parsing/app.py`
- `workers/parsing/requirements.txt`
- `workers/parsing/Dockerfile`
- `apps/backend/src/services/resume-parsing.service.js`
- `apps/backend/src/services/resume.service.js`
- `apps/backend/src/services/embedding.service.js`
- `apps/backend/src/services/resume.service.js`
- `apps/backend/src/services/application-queue.service.js`
- `apps/backend/src/services/application.service.js`
- `apps/backend/src/controllers/internal-application.controller.js`
- `apps/backend/src/routes/internal.routes.js`
- `apps/backend/src/routes/index.js`
- `apps/backend/tests/integration/application-worker-processing.test.mjs`
- `apps/backend/tests/integration/application-queue-observability.test.mjs`
- `apps/backend/tests/integration/worker-dlq-flow.test.mjs`
- `apps/backend/tests/integration/resume-upload-parsing.test.mjs`
- `apps/backend/tests/integration/resume-upload-endpoint.test.mjs`
- `apps/backend/package.json`
- `apps/backend/package-lock.json`
- `.github/workflows/backend-integration.yml`
- `docker-compose.yml`
- `README.md`
- `scripts/queue-inspect.ps1`
- `scripts/queue-replay-dlq.ps1`
- `workers/scoring/index.js`
- `workers/scoring/worker-core.js`
- `workers/scoring/package.json`
- `workers/scoring/package-lock.json`
- `workers/scoring/Dockerfile`
- `scripts/queue-load-baseline-current.json`
- `.github/workflows/queue-load-baseline-calibration.yml`
- `plan-implementation.md`

## Remaining Recommended Next Steps
1. Add replay webhook metadata field `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version` (for example, `v1`) to version alias-integrity semantics.
2. Add calibration artifact field `guardrail_consistency_checks_profile_signature_pair_version_source_code_matches_source` boolean alias for compact source/code parity readability.
3. Add CI replay-audit guard requiring `attempt_status_sequence_tail_status_consistency_reason_scope_pair_version_source_code_matches_source_consistency_version == "v1"` whenever `..._matches_source_consistent == true`.

