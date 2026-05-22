# Coding Conventions & API Standards

## API Design

### Base URL
```
/api/v1/
```

### REST Endpoint Pattern
```
GET    /api/v1/{resource}        → list (with pagination and filters)
POST   /api/v1/{resource}        → create
GET    /api/v1/{resource}/:id    → get one
PUT    /api/v1/{resource}/:id    → update
DELETE /api/v1/{resource}/:id    → delete (soft if deletedAt exists)
```

### Standard Response Format
```json
{
  "success": true,
  "data": { ... },
  "message": "string"
}
```

### Error Format
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable message"
}
```

### Pagination
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

## Authentication

- JWT Bearer token
- Header: `Authorization: Bearer <token>`
- Role middleware runs before route handler
- `passwordResetVersion` increments on password change → invalidates all existing tokens

---

## Worker Queue

### Message Format
```json
{
  "type": "embed_job" | "embed_resume" | "score_application",
  "payload": {
    "jobId": "...",          // for embed_job
    "resumeId": "...",       // for embed_resume
    "applicationId": "..."   // for score_application
  },
  "attempt": 1,
  "maxAttempts": 3
}
```

### aiStatus Lifecycle
```
pending → parsing → scoring → completed
                └──────────→ failed (retry → DLQ after maxAttempts)
```

---

## Qdrant Operations

### Upsert Point
```python
client.upsert(
    collection_name="jobs_vectors",   # or resumes_vectors
    points=[
        PointStruct(
            id=str(qdrant_id),        # UUID string
            vector=embedding,          # list[float], len=384
            payload={
                # jobs_vectors
                "mongoId": str(mongo_id),
                "category": category,
                "status": status,
                # resumes_vectors
                "candidateId": str(candidate_id),
                "isAnalyzed": is_analyzed,
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
# result.score = cosine similarity → Application.aiScores.semanticScore
```

---

## Hybrid Scoring Formula

```python
ALPHA = 0.65  # weight for semantic score

def compute_hybrid_score(semantic: float, keyword: float) -> float:
    return ALPHA * semantic + (1 - ALPHA) * keyword

# semantic : Qdrant cosine similarity, range [0, 1]
# keyword  : BM25 score normalized to [0, 1]
# hybrid   : saved to Application.aiScores.hybridScore
```

---

## Environment & Config

### Key Environment Variables
```
MONGODB_URI=
QDRANT_URL=
QDRANT_API_KEY=
SBERT_MODEL=all-MiniLM-L6-v2   # vector_size=384
WORKER_QUEUE_URL=
JWT_SECRET=
JWT_EXPIRES_IN=
```

### LLM Provider (from systemconfigs key=llmConfig)
```json
{
  "provider": "ollama" | "openai" | "anthropic" | "gemini" | "openrouter" | "deepseek",
  "model": "...",
  "baseUrl": "...",
  "apiKey": "..."
}
```

---

## Critical Rules

- Use `hybridScore` for **ranking only**. Never expose `semanticScore` or `keywordScore` individually as ranking signals.
- When Job `status → closed` or `deletedAt` is set: **immediately** delete the corresponding Qdrant point in the same request.
- When Resume is deleted: remove `fileUrl` from storage + delete Qdrant point + delete MongoDB document.
- `systemconfigs`: Admin has WRITE access. Candidate and Recruiter have READ access only to permitted keys.
