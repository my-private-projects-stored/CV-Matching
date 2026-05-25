# AI CV-JD Matching Audit Report

Date: 2026-05-24

Scope: Kiem tra cac tinh nang lien quan den AI va so khop CV voi JD. Yeu cau hien tai la chi kiem tra, chua sua code.

## Summary

Ket luan ngan: cac tinh nang AI/matching hien chua chay dung theo thiet ke SBERT + BM25. Trieu chung "luon cho ra cung 1 ket qua" rat co kha nang den tu pipeline scoring that dang khong dung semantic search tu Qdrant.

Collections lien quan:

- MongoDB: `jobs`, `resumes`, `applications`, `systemconfigs`
- Qdrant: `jobs_vectors`, `resumes_vectors`

Actors bi anh huong:

- Candidate: apply job, xem AI feedback, xem job recommendations.
- Recruiter: xem ranked candidates, tim CV phu hop voi JD.

## Findings

### 1. Application AI scoring khong dung Qdrant semantic score

File: `apps/backend/src/services/application-ai.service.js`

Trong flow mac dinh cua `runApplicationAiPipeline`, scoring step goi `buildHybridScoreForPair` voi:

```js
semanticScore: 0
```

Vi vay khi worker xu ly Application, `semanticScore` luon bang `0`, khong search `resumes_vectors` hoac `jobs_vectors` de lay cosine similarity.

Tac dong:

- `semanticScore` khong phan anh do tuong dong CV-JD.
- `hybridScore` bi tinh dua tren semantic = 0.
- Neu keyword data rong hoac giong nhau, nhieu application se co cung diem.

Muc do: High.

### 2. Keyword score de bi dong loat 0

Files:

- `apps/backend/src/services/semantic-search.service.js`
- `apps/backend/src/services/job.service.js`
- `workers/parsing/app.py`

`buildHybridScoreForPair` tinh keyword score bang:

- `job.keywords`
- `resume.parsedData.skills`

Nhung form tao Job hien khong gui `keywords`, backend cung khong tu extract `keywords` khi tao Job. Worker parsing hien tra ve:

```py
"skills": []
"technicalSkills": []
```

Tac dong:

- `job.keywords` thuong rong.
- `resume.parsedData.skills` thuong rong.
- `keywordScore` thuong bang `0`.
- Khi ket hop voi finding 1, `hybridScore` de thanh `0` cho nhieu ket qua.

Muc do: High.

### 3. Hybrid formula dang dung 0.7 thay vi 0.65

Files:

- `apps/backend/src/services/application-ai.service.js`
- `apps/backend/src/services/semantic-search.service.js`
- `apps/backend/src/services/recommendation.service.js`

Docs yeu cau:

```txt
hybridScore = 0.65 * semanticScore + 0.35 * keywordScore
```

Nhung code hien default:

```js
semanticWeight = 0.7
```

Tac dong:

- Diem ranking khong dung convention cua du an.
- Frontend cung hien `semantic_weight` mac dinh 0.7 trong recommendation UI.

Muc do: Medium.

### 4. Frontend recommendations unwrap sai response

File: `apps/frontend/lib/api.ts`

Ham `request()` da unwrap `payload.data`. Tuy nhien `getJobRecommendations` va `getResumeRecommendations` lai tiep tuc coi `result.data` la object co `{ data, meta }`.

Backend response dang co dang:

```json
{
  "request_id": "req_...",
  "data": [],
  "meta": {}
}
```

Sau khi qua `request()`, frontend chi nhan duoc array trong `result.data`, nen logic:

```ts
const payload = getObject(result.data);
data: Array.isArray(payload.data) ? payload.data : []
```

co the bien ket qua thanh `[]` va meta mac dinh.

Tac dong:

- Candidate job recommendations co the hien rong/ket qua mac dinh du backend co tra data.
- Recruiter resume recommendations co the gap loi tuong tu.

Muc do: High cho UI recommendations.

### 5. Tests hien tai khong bat duoc loi pipeline that

Files:

- `apps/backend/tests/integration/application-worker-processing.test.mjs`
- `apps/backend/tests/integration/async-pipeline.test.mjs`

Quan sat:

- `npm.cmd run test:integration:worker` pass vi test bi skip khi khong co `RUN_INTEGRATION_TESTS=1`.
- Mot so test inject `mock_scoring_result` hoac `scoringStep`, nen khong xac minh scoring implementation that.

Tac dong:

- Tests co the pass du pipeline production khong dung Qdrant.
- Khong co test nao dam bao Application scoring lay cosine similarity that tu vector store.

Muc do: Medium.

### 6. Seed/demo vector co the gay ket qua giong nhau

File: `apps/backend/scripts/seed-demo-data.mjs`

Seed data tao vector gia lap va gan cung vector cho Job/Resume mau. Neu du lieu test local dua vao seed nay, Qdrant search co the cho diem semantic rat giong nhau.

Tac dong:

- De gay cam giac recommendation/matching "khong thay doi".
- Khong nen dung seed vector gia lap de ket luan chat luong matching that.

Muc do: Medium.

## Overall Diagnosis

Pipeline mong doi:

```txt
Resume upload -> parse text -> SBERT embedding -> upsert resumes_vectors
JD created -> clean text -> SBERT embedding -> upsert jobs_vectors
Apply -> worker scoring -> Qdrant cosine semanticScore + keywordScore -> hybridScore
```

Pipeline hien tai cho Application scoring:

```txt
Apply -> worker scoring -> semanticScore = 0 -> keywordScore from sparse fields -> hybridScore
```

Do do loi "chi cho ra cung 1 ket qua" la hop ly, dac biet khi:

- `job.keywords` rong.
- `resume.parsedData.skills` rong.
- Parsing worker khong extract skill.
- Application scoring khong lay semantic score tu Qdrant.

## Recommended Next Checks Before Fixing

1. Kiem tra data that trong MongoDB:
   - `jobs.keywords`
   - `jobs.cleanText`
   - `jobs.qdrantId`
   - `jobs.isAnalyzed`
   - `resumes.rawText`
   - `resumes.parsedData.skills`
   - `resumes.qdrantId`
   - `resumes.isAnalyzed`
   - `applications.aiScores`
   - `applications.aiStatus`

2. Kiem tra Qdrant:
   - Collection `jobs_vectors` co point khong.
   - Collection `resumes_vectors` co point khong.
   - Payload co `mongoId` dung voi MongoDB document khong.
   - Vector dimension co bang 384 khong.

3. Kiem tra worker/runtime:
   - `worker-embedding-sbert` co healthy khong.
   - `worker-scoring` co consume Redis queue khong.
   - `application_scoring_queue` co message pending khong.
   - Internal endpoint `/api/internal/applications/:id/process-ai` co duoc goi khong.

4. Them test that cho pipeline:
   - Tao 1 Job voi vector A.
   - Tao 2 Resume voi vector gan/xa.
   - Apply ca 2 Resume.
   - Worker scoring phai tao `semanticScore` khac nhau.
   - Ranked list phai sort bang `aiScores.hybridScore`.

## Suggested Fix Direction Later

Chua sua trong audit nay, nhung huong sua nen la:

- Trong Application scoring, lay Job/Resume vector hoac generate embedding tu `cleanText`/`rawText`, search Qdrant de tinh `semanticScore`.
- Tu dong extract/fallback keywords tu JD text va resume raw text khi `keywords`/`parsedData.skills` rong.
- Dung ALPHA = 0.65 theo docs.
- Sua frontend recommendations unwrap response.
- Bo sung integration test khong mock scoring.

