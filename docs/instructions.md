# Smart CV Matching & Recruitment Platform — Copilot Instructions

## Project Overview

A multi-user recruitment platform forked from open-source **Resume Matcher**, upgraded into a full-featured system with an AI scoring pipeline.

- **Upstream**: github.com/srbhr/Resume-Matcher (single-user, TinyDB, word-by-word matching)
- **This project**: multi-user, role-based, MongoDB + Qdrant, Hybrid SBERT + BM25 scoring

**Three main actors**: Candidate · Recruiter/HR · Admin

---

## Product Goals by Actor

| Actor | Goal |
|---|---|
| **Candidate** | Upload resume, view match score against JD, receive AI feedback on missing keywords, edit and export resume |
| **Recruiter/HR** | Post JDs, view AI-ranked candidate list, manage recruitment pipeline |
| **Admin** | Configure system settings, LLM provider, feature flags |

---

## Comparison with Upstream Resume Matcher

| Feature | Upstream Resume Matcher | This Project |
|---|---|---|
| Users | Single user, local | Multi-user, role-based |
| Database | TinyDB (JSON file) | MongoDB + Qdrant |
| Matching | Word-by-word (basic) | Hybrid SBERT + BM25 |
| Deployment | Local only | Docker, multi-service |
| Resume versioning | None | Yes (parentResumeId) |
| Recruitment pipeline | None | Yes (full UC-BASIC) |
| AI Scoring | None | Yes (full UC-CORE) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.13+, LiteLLM |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Database | MongoDB (Mongoose) + Qdrant (vector size=384, Cosine) |
| AI | SBERT embedding worker + BM25/TF-IDF keyword scoring |
| Queue | Worker-based with DLQ |
| PDF | Playwright Headless Chromium |
| Deploy | Docker Compose multi-service |

---

## Service Architecture

```
backend/          → FastAPI REST API
frontend/         → Next.js UI
worker-embedding/ → SBERT embedding (resume + JD → vector → Qdrant)
worker-scoring/   → Hybrid score (semantic + keyword → Application.aiScores)
qdrant/           → Vector store
mongodb/          → Operational store
```

---

## Database Schema

### users
```
email: String (unique, index)
password: String (hashed, minlength=60)
role: enum[candidate, recruiter, admin] default=candidate
fullName: String
avatar: String|null
candidateProfile: Mixed
passwordResetVersion: Number
timestamps: createdAt, updatedAt
```

### jobs
```
recruiterId: ObjectId → users (index)
title, description, requirements: String
benefits: String
applicationDeadline: Date
cleanText: String          # normalized text for AI embedding
qdrantId: String|null      # 1-1 map to Qdrant point (index)
isAnalyzed: Boolean default=false
keywords: String[]
category: enum[IT, Accounting, Marketing] (index)
location: String
experienceLevel: String
status: enum[active, closed] default=active
deletedAt: Date            # soft delete
importantChangeHistory: ChangeHistory[]
timestamps: createdAt, updatedAt
```

### resumes
```
candidateId: ObjectId → users (index)
fileUrl: String
rawText: String
qdrantId: String|null      # 1-1 map to Qdrant point (index)
parsedData: Mixed
processingStatus: String
filename: String
sourceFile: { filename, mimeType, size, data: Buffer }
isMaster: Boolean
parentResumeId: ObjectId → resumes   # versioning
restoredFromVersionId: ObjectId → resumes
restoredAt: Date
title: String
coverLetter: String
outreachMessage: String
jobDescription: String
jobId: String
isAnalyzed: Boolean default=false
timestamps: createdAt, updatedAt
```

### applications
```
jobId: ObjectId → jobs (index)
resumeId: ObjectId → resumes (index)
UNIQUE compound: (jobId, resumeId)
status: enum[new, screening, interview, hired, rejected] default=new
aiStatus: enum[pending, parsing, scoring, completed, failed] default=pending
aiScores: {
  semanticScore: Number default=0   # SBERT cosine similarity
  keywordScore: Number default=0    # BM25/TF-IDF
  hybridScore: Number default=0     # α×semantic + (1-α)×keyword
}
aiDetails: {
  matchedKeywords: String[]
  missingKeywords: String[]
}
statusHistory: [{ fromStatus, toStatus, changedAt, changedBy }]
timestamps: createdAt, updatedAt
```

### systemconfigs
```
key: String (unique, index)
value: Mixed
# Keys: featureConfig | languageConfig | llmConfig | promptConfig | apiKeysConfig
timestamps: createdAt, updatedAt
```

### Qdrant collections
```
jobs_vectors:    { point_id=qdrantId, vector[384], payload: { mongoId, category, status } }
resumes_vectors: { point_id=qdrantId, vector[384], payload: { mongoId, candidateId, isAnalyzed } }
```

---

## AI Scoring Pipeline

```
[Resume upload] → parse text → SBERT → upsert resumes_vectors
[JD created]    → clean text → SBERT → upsert jobs_vectors
[Apply]         → trigger worker-scoring
                  ├── semanticScore  = Qdrant cosine similarity
                  ├── keywordScore   = BM25 matching(cleanText, rawText)
                  └── hybridScore    = 0.65×semantic + 0.35×keyword
                  → save Application.aiScores + aiDetails
[Recruiter]     → GET /jobs/:id/applications?sort=hybridScore DESC
[Candidate]     → GET /applications/:id/feedback → matchedKeywords, missingKeywords
```

---

## Mandatory Coding Rules

1. **Soft delete Job** via `deletedAt`, never remove the document. Hard delete Resume (remove file + Qdrant point).
2. **Qdrant sync**: every Job or Resume create/update with embedding → upsert Qdrant. Delete/close → delete Qdrant point.
3. **Unique application**: enforce compound unique `(jobId, resumeId)` at both DB index and service layer.
4. **aiStatus flow**: `pending → parsing → scoring → completed` (or `failed`). Always update `aiStatus` before `status`.
5. **hybridScore** is the only field used for sorting/ranking — never use `semanticScore` or `keywordScore` alone.
6. **systemconfigs** is the single source of truth for LLM provider, prompt templates, feature flags. Never hardcode.
7. **Never change schema** without considering the impact on Qdrant sync and worker queue.

---

## Role Permissions

| Feature | candidate | recruiter | admin |
|---|---|---|---|
| Upload & manage resumes | ✅ | ❌ | ❌ |
| Create & manage JDs | ❌ | ✅ | ✅ |
| View ranked candidate dashboard | ❌ | ✅ | ✅ |
| View personal AI feedback | ✅ | ❌ | ❌ |
| Download original resume file | ❌ | ✅ | ✅ |
| Write systemconfigs | ❌ | ❌ | ✅ |
---

## Phase 2 Test Notes

- Backend unit tests must run without Docker: `npm run test:unit` from `apps/backend`.
- Qdrant-backed integration tests are opt-in: set `RUN_INTEGRATION_TESTS=1` and provide running `mongo`, `redis`, and `qdrant` services before running backend integration scripts.
- The dedicated production-path scoring test is `npm run test:integration:qdrant-scoring`; it must not inject a mocked `scoringStep`.
- Frontend verification for recommendation response unwrapping is covered by `npm test -- --run` from `apps/frontend`.
