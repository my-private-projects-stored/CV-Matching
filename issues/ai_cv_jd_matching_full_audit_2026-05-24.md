# AI CV-JD Matching Full Audit Report

Date: 2026-05-24

Scope: Tong hop tat ca van de da phat hien lien quan den AI, CV-JD matching, recommendations, resume tailoring, cover letter/outreach, interview generator, test coverage va seed data. Bao cao nay chi ghi nhan ket qua kiem tra, chua sua code.

## Executive Summary

He thong hien co nhieu tinh nang duoc goi la AI, nhung mot phan quan trong dang khong dung pipeline AI that theo thiet ke. Rieng luong CV-JD matching cho Application co loi nghiem trong: `semanticScore` bi truyen mac dinh bang `0`, nen worker scoring khong dung Qdrant cosine similarity. Dong thoi keyword data thuong rong, lam `keywordScore` va `hybridScore` de bi trung nhau hoac bang `0`.

Ngoai matching, cac tinh nang generation nhu tailor resume, cover letter, outreach message va interview questions hien chu yeu la rule-based/template-based, chua goi LLM provider tu `systemconfigs.llmConfig`.

## Affected Actors

- Candidate: upload/manage resume, apply job, xem AI feedback, job recommendations, tailor resume, cover letter/outreach.
- Recruiter: ranked candidates, resume recommendations, interview question generator.
- Admin: cau hinh LLM provider/systemconfigs co the khong duoc cac tinh nang generation su dung dung muc dich.

## Affected Data Stores

- MongoDB: `jobs`, `resumes`, `applications`, `systemconfigs`
- Qdrant: `jobs_vectors`, `resumes_vectors`
- Redis: `application_scoring_queue`, notification queues

## Findings

### 1. Application AI scoring khong dung Qdrant semantic score

Severity: High

Files:

- `apps/backend/src/services/application-ai.service.js`
- `apps/backend/src/services/semantic-search.service.js`

Van de:

Trong `runApplicationAiPipeline`, scoring step mac dinh goi `buildHybridScoreForPair` voi:

```js
semanticScore: 0
```

Dieu nay lam `semanticScore` cua Application luon bang `0` neu khong inject `scoringStep` rieng. Pipeline that khong search Qdrant de lay cosine similarity giua JD va CV.

Tac dong:

- `semanticScore` khong phan anh do tuong dong CV-JD.
- `hybridScore` bi tinh dua tren semantic = 0.
- Ranked candidates de bi trung diem.
- UC-CORE-03 va UC-CORE-04 chua dung voi tai lieu thiet ke.

### 2. Keyword score de bi dong loat 0

Severity: High

Files:

- `apps/backend/src/services/semantic-search.service.js`
- `apps/backend/src/services/job.service.js`
- `workers/parsing/app.py`

Van de:

`buildHybridScoreForPair` tinh keyword score tu:

- `job.keywords`
- `resume.parsedData.skills`

Nhung khi tao Job, backend khong tu extract `keywords` neu payload khong co. Worker parsing hien tra ve:

```py
"skills": []
"technicalSkills": []
```

Tac dong:

- `keywordScore` thuong bang `0`.
- Khi ket hop voi finding 1, `hybridScore` co the bang `0` cho nhieu Application.
- AI feedback `matchedKeywords`/`missingKeywords` co the rong hoac khong huu ich.

### 3. Hybrid formula dang dung 0.7 thay vi ALPHA = 0.65

Severity: Medium

Files:

- `apps/backend/src/services/application-ai.service.js`
- `apps/backend/src/services/semantic-search.service.js`
- `apps/backend/src/services/recommendation.service.js`
- `apps/frontend/lib/api.ts`
- Recommendation UI pages

Docs yeu cau:

```txt
hybridScore = 0.65 * semanticScore + 0.35 * keywordScore
```

Code hien default:

```js
semanticWeight = 0.7
```

Tac dong:

- Diem ranking khong dung convention cua du an.
- Frontend hien/submit `semantic_weight` mac dinh 0.7.
- Ket qua giua docs, backend va UI khong nhat quan.

### 4. Frontend recommendations unwrap sai response

Severity: High for recommendation UI

File:

- `apps/frontend/lib/api.ts`

Van de:

Ham `request()` da unwrap `payload.data`, nhung `getJobRecommendations` va `getResumeRecommendations` lai tiep tuc coi `result.data` la object co `{ data, meta }`.

Backend response dang co dang:

```json
{
  "request_id": "req_...",
  "data": [],
  "meta": {}
}
```

Sau khi qua `request()`, frontend chi nhan array trong `result.data`, nen logic tiep theo co the tra ve `[]` va meta mac dinh.

Tac dong:

- Candidate job recommendations co the hien rong du backend co data.
- Recruiter resume recommendations co the hien rong du backend co data.
- Nguoi dung co the nham tuong matching engine khong hoat dong.

### 5. Tests hien tai khong bat duoc pipeline scoring that

Severity: Medium

Files:

- `apps/backend/tests/integration/application-worker-processing.test.mjs`
- `apps/backend/tests/integration/async-pipeline.test.mjs`
- `apps/backend/tests/integration/application-endpoints.test.mjs`

Van de:

Nhieu test dang inject `mock_scoring_result`, `scoringStep`, hoac update thang `Application.aiScores`. Khi chay `npm.cmd run test:integration:worker`, test bi skip neu khong co `RUN_INTEGRATION_TESTS=1`.

Tac dong:

- Tests co the pass du production pipeline khong dung Qdrant.
- Chua co test dam bao Application scoring lay cosine similarity that tu vector store.
- Chua co test bat loi `semanticScore` bi hardcode `0`.

### 6. Seed/demo vector co the gay ket qua giong nhau

Severity: Medium

File:

- `apps/backend/scripts/seed-demo-data.mjs`

Van de:

Seed data tao vector gia lap va gan cung vector cho Job/Resume mau:

```js
const vector = Array.from({ length: dim }, (_, i) => (i % 7) / 10);
```

Tac dong:

- Neu moi truong local chu yeu dung seed data, Qdrant search co the cho diem semantic rat giong nhau.
- Khong nen dung seed vector gia lap de danh gia chat luong matching that.

Ghi chu:

Finding nay dung voi seed data, nhung cau "Qdrant chi luu tru vector mau giong nhau" chi dung neu moi truong khong co du lieu moi duoc embedding that hoac embedding worker khong chay.

### 7. AI Tailor Resume la rule-based tinh, chua goi LLM

Severity: High for AI generation expectation

Files:

- `apps/backend/src/services/resume.service.js`
- `apps/backend/src/controllers/resume.controller.js`

Van de:

`applyJobImprovements()` chi:

- Extract keyword tu JD.
- Lay toi da 6 keyword dau tien.
- Them chung vao `additional.technicalSkills`.
- Noi them summary bang cau mau trong `getTailorCopy()`.

Vi du cau mau:

```txt
Targeted for this role with emphasis on {keywords}.
Tap trung vao vai tro nay, nhan manh {keywords}.
```

Controller co check feature flag/language config qua `systemconfigs`, nhung service khong goi LLM provider/model/prompt tu `systemconfigs.llmConfig` hoac `promptConfig`.

Tac dong:

- Ket qua tailor resume lap lai va thieu tuy bien ngu canh.
- Khong dung ky vong "AI tailor resume to JD".
- `systemconfigs` chua thuc su la single source of truth cho generation behavior.

### 8. Cover Letter va Outreach Message dung template cung

Severity: High for AI generation expectation

Files:

- `apps/backend/src/services/resume.service.js`
- `apps/backend/src/controllers/resume.controller.js`

Van de:

`generateCoverLetterContent()` va `generateOutreachContent()` ghep noi dung tu cac chuoi co dinh, chi thay name/role/context line.

Vi du:

```txt
Dear Hiring Team,
My name is {name} and I am a {role}
```

```txt
Hi, I am {name}, a {role}.
```

Tac dong:

- Cover letter/outreach cho nhieu CV/JD se co cau truc va ngon ngu rat giong nhau.
- Khong co LLM viet lai noi dung dua tren JD/candidate context.
- LLM provider config trong `systemconfigs.llmConfig` khong duoc su dung cho tinh nang nay.

### 9. Interview Question Generator la template-based, chua goi LLM

Severity: Medium to High

Files:

- `apps/backend/src/services/interview.service.js`
- `apps/backend/src/controllers/interview.controller.js`

Van de:

`interview.service.js` dinh nghia `TEMPLATES` co dinh cho technical, experience, behavioral, project va closing questions. `generateInterviewQuestions()` lay skills/work experience/projects tu CV, them mot it keyword tu JD, roi sinh cau hoi bang template.

Vi du:

```txt
Can you walk me through a project where you applied {skill}?
```

Behavioral questions con duoc lay bang:

```js
allBehavioral.slice(0, 3)
```

khong phai random hay LLM-generated.

Tac dong:

- Cac ung vien co skill/JD tuong tu se nhan bo cau hoi gan nhu trung nhau.
- Khong co phan tich sau cua LLM theo resume/JD.
- `systemconfigs.llmConfig` va `promptConfig` khong duoc su dung.

### 10. Recommendation keyword matching chi so sanh exact skill tokens

Severity: Medium

File:

- `apps/backend/src/services/recommendation.service.js`

Van de:

Recommendation service tinh keyword score bang exact match giua keyword source va target skill list. Resume keywords chi lay tu `parsedData.skills`, trong khi nhieu resume data trong app dung `parsedData.additional.technicalSkills`.

Tac dong:

- Keyword score trong recommendations de bang `0` du CV co skill trong `additional.technicalSkills`.
- Ket qua hybrid recommendations phu thuoc qua nhieu vao semantic score.

### 11. Resume recommendation candidate name co the sai field

Severity: Low to Medium

File:

- `apps/backend/src/services/recommendation.service.js`

Van de:

Khi lay user cho resume recommendations, code select:

```js
.select("_id name email")
```

Nhung schema user dung `fullName`, khong phai `name`. Sau do response dung:

```js
candidate_name: user?.name || parsedData?.personalInfo?.fullName || null
```

Tac dong:

- Candidate name trong recruiter resume recommendations co the null hoac fallback khong dung.
- Khong anh huong core score, nhung anh huong UI/UX.

## Root Cause Themes

1. Pipeline AI scoring chua noi dung Qdrant search vao Application scoring.
2. Keyword extraction/parsing chua du manh va field mapping chua nhat quan.
3. Mot so AI generation feature thuc chat la template/rule-based.
4. `systemconfigs.llmConfig` chua duoc dung lam single source of truth cho generation services.
5. Tests dang verify mock behavior hon la production behavior.
6. Frontend API normalization co bug voi response co `data` + `meta`.

## Expected Pipeline vs Current Pipeline

Expected:

```txt
Resume upload -> parse text -> SBERT embedding -> upsert resumes_vectors
JD created -> clean text -> SBERT embedding -> upsert jobs_vectors
Apply -> worker scoring -> Qdrant cosine semanticScore + keywordScore -> hybridScore
Recruiter -> ranked candidates sorted by hybridScore DESC
Candidate -> feedback with matched/missing keywords
```

Current Application scoring:

```txt
Apply -> worker scoring -> semanticScore = 0 -> keywordScore from sparse fields -> hybridScore
```

Expected generation:

```txt
Feature request -> read systemconfigs feature/language/llm/prompt config -> call configured LLM provider -> save/use generated content
```

Current generation:

```txt
Feature request -> read feature/language config -> apply local rule/template -> save/use generated content
```

## Recommended Verification Before Fixing

### MongoDB checks

- `jobs.keywords`
- `jobs.cleanText`
- `jobs.qdrantId`
- `jobs.isAnalyzed`
- `resumes.rawText`
- `resumes.parsedData.skills`
- `resumes.parsedData.additional.technicalSkills`
- `resumes.qdrantId`
- `resumes.isAnalyzed`
- `applications.aiStatus`
- `applications.aiScores.semanticScore`
- `applications.aiScores.keywordScore`
- `applications.aiScores.hybridScore`

### Qdrant checks

- `jobs_vectors` point count.
- `resumes_vectors` point count.
- Payload `mongoId` maps to MongoDB documents.
- Vector dimension is 384.
- Search scores differ for clearly different CV/JD pairs.

### Runtime checks

- `worker-embedding-sbert` healthy.
- `worker-parsing` healthy.
- `worker-scoring` consuming Redis queue.
- `application_scoring_queue` has no stuck messages.
- `/api/internal/applications/:id/process-ai` is called by worker.

### Test checks

- Add non-mock test where scoring computes different `semanticScore` for two resumes.
- Add test for fallback keyword extraction from raw JD/CV text.
- Add test for ALPHA = 0.65.
- Add test for frontend recommendations preserving both `data` and `meta`.
- Add tests proving generation services either call configured LLM or are explicitly labelled template-based.

## Suggested Fix Direction Later

No code fix is included in this report. Suggested direction:

- Implement real semantic scoring in Application pipeline using Qdrant.
- Standardize `ALPHA = 0.65`.
- Extract/fallback keywords from JD and resume raw text when structured skills are missing.
- Include `parsedData.additional.technicalSkills` in keyword extraction.
- Fix frontend recommendation response handling.
- Replace or clearly label template-based generation; if intended as AI, route through `systemconfigs.llmConfig` and `promptConfig`.
- Add integration tests that do not mock scoring.

