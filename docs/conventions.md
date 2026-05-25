# Coding Conventions & API Standards

## API Design

### Base URL
```
/api
```

The current backend mounts all public API routes at `/api` from `apps/backend/src/app.js`.
Do not use `/api/v1` unless the backend is explicitly migrated to versioned routes.

### REST Endpoint Pattern
```
GET    /api/{resource}        -> list (with pagination and filters)
POST   /api/{resource}        -> create
GET    /api/{resource}/:id    -> get one
PATCH  /api/{resource}/:id    -> partial update where supported
PUT    /api/{resource}/:id    -> update only where the route explicitly supports it
DELETE /api/{resource}/:id    -> delete (soft if deletedAt exists)
```

### Backend Response Format

The Express backend does not always return a `success` wrapper. Frontend code should use
route-specific DTOs or the shared tolerant API helper in `apps/frontend/lib/api.ts`.

List response:
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

Request-tracked response:
```json
{
  "request_id": "req_...",
  "data": {}
}
```

Error response:
```json
{
  "message": "Human readable message",
  "error_code": "optional_error_code"
}
```

### Current Route Map Used by Frontend

Authentication:
```
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/auth/change-password
```

Jobs:
```
GET    /api/jobs
GET    /api/jobs/:id
POST   /api/jobs
PATCH  /api/jobs/:id
DELETE /api/jobs/:id
```

Resumes:
```
GET    /api/resumes/list
GET    /api/resumes?resume_id=:id
GET    /api/resumes/master
POST   /api/resumes
POST   /api/resumes/upload
PATCH  /api/resumes/:id
DELETE /api/resumes/:id
```

Applications:
```
POST  /api/applications
GET   /api/applications/history
GET   /api/applications/ranked?job_id=:jobId
GET   /api/applications/:id/feedback
GET   /api/applications/:id/status-history
PATCH /api/applications/:id/status
PATCH /api/applications/status/bulk
```

Config:
```
GET /api/config/language
GET /api/config/company-profile
PUT /api/config/company-profile
GET /api/config/llm-api-key
PUT /api/config/llm-api-key
GET /api/config/features
PUT /api/config/features
GET /api/config/prompts
PUT /api/config/prompts
GET /api/config/api-keys
```

## Authentication

- JWT Bearer token.
- Header: `Authorization: Bearer <token>`.
- Role middleware runs before route handlers.
- `passwordResetVersion` increments on password change and invalidates existing tokens.

## Frontend Data Conventions

- Backend DTOs often use snake_case (`ai_status`, `hybrid_score`, `matched_keywords`).
- UI components use the established frontend camelCase types (`aiStatus`, `aiScores.hybridScore`, `aiDetails.matchedKeywords`).
- Normalize backend DTOs at the API boundary. Page components should not hand-roll snake_case mapping.
- `hybridScore` is the only ranking signal. Never rank by `semanticScore` or `keywordScore`.
- `aiStatus` and recruitment `status` are independent states and must not be conflated.

## Domain Enums

```ts
type ApplicationStatus = 'new' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
type AiStatus = 'pending' | 'parsing' | 'scoring' | 'completed' | 'failed'
type JobStatus = 'active' | 'closed' | 'deleted'
type JobCategory = 'IT' | 'Accounting' | 'Marketing'
```

## Worker Queue

### Message Format
```json
{
  "type": "embed_job | embed_resume | score_application",
  "payload": {
    "jobId": "...",
    "resumeId": "...",
    "applicationId": "..."
  },
  "attempt": 1,
  "maxAttempts": 3
}
```

### aiStatus Lifecycle
```
pending -> parsing -> scoring -> completed
                    -> failed (retry -> DLQ after maxAttempts)
```

## Qdrant Operations

### Upsert Point
```python
client.upsert(
    collection_name="jobs_vectors",   # or resumes_vectors
    points=[
        PointStruct(
            id=str(qdrant_id),
            vector=embedding,
            payload={
                "mongoId": str(mongo_id),
                "category": category,
                "status": status,
            }
        )
    ]
)
```

### Search (Semantic)
```python
results = client.search(
    collection_name="resumes_vectors",
    query_vector=job_embedding,
    limit=50,
    with_payload=True
)
```

## Hybrid Scoring Formula

```python
ALPHA = 0.65

def compute_hybrid_score(semantic: float, keyword: float) -> float:
    return ALPHA * semantic + (1 - ALPHA) * keyword
```

## Environment & Config

### Key Environment Variables
```
MONGODB_URI=
QDRANT_URL=
QDRANT_API_KEY=
SBERT_MODEL=all-MiniLM-L6-v2
WORKER_QUEUE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
```

### LLM Provider

The single source of truth is `systemconfigs` key `llmConfig`, surfaced through
`/api/config/llm-api-key`.

```json
{
  "provider": "ollama | openai | anthropic | gemini | openrouter | deepseek",
  "model": "...",
  "baseUrl": "...",
  "apiKey": "..."
}
```

## Critical Rules

- Use `hybridScore` for ranking only.
- When Job `status -> closed/deleted`, delete the corresponding Qdrant point in the same request.
- When Resume is deleted, remove the source file, delete the Qdrant point, and delete the MongoDB document.
- Enforce unique `(jobId, resumeId)` at both DB index and service layer.
- Update `aiStatus` independently from recruitment `status`.
- `systemconfigs` is the source of truth for LLM provider, prompt templates, feature flags, and language.
- Never change schema without considering Qdrant sync and worker queue impact.
