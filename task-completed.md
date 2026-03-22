# Task Completed Summary

## Thông tin chung
- Thời gian thực hiện: 2026-03-22
- Mục tiêu: Chuyển đổi repository hiện tại sang cấu trúc monorepo chuyên nghiệp bằng Git Subtree và thiết lập nền tảng orchestration.

## Các công việc đã hoàn thành

### 1) Khởi tạo monorepo root
- Đã tạo thư mục gốc mới: `CV-Matching`.
- Đã khởi tạo Git repository tại root monorepo.
- Đã tạo commit khởi tạo rỗng:
  - `chore: initialize CV-Matching monorepo root`

### 2) Tích hợp mã nguồn hiện tại bằng Git Subtree
- Đã thêm remote fork:
  - `resume-matcher-fork -> https://github.com/Loc-1625/Resume-Matcher.git`
- Đã import source từ fork vào đường dẫn:
  - `upstream/resume-matcher`
- Cách thực hiện: `git subtree add --prefix=upstream/resume-matcher resume-matcher-fork main --squash`
- Kết quả: Giữ được liên kết logic với upstream fork để tiếp tục đồng bộ trong tương lai.

### 3) Scaffold cấu trúc monorepo mục tiêu
- Đã tạo các thư mục chính:
  - `apps/frontend`
  - `apps/backend`
  - `workers`
  - `infra`
  - `scripts`
- Đã tạo thêm thư mục con cho workers:
  - `workers/parsing`
  - `workers/scoring`
  - `workers/notification`
- Đã tạo đường dẫn adapter theo định hướng kiến trúc:
  - `apps/backend/app/services/adapters`

### 4) Thiết lập docker-compose master tại root
- Đã tạo file: `docker-compose.yml` tại root monorepo.
- Các service đã được định nghĩa:
  - `mongo` (MongoDB)
  - `redis` (task queue/cache)
  - `qdrant` (vector database)
  - `gateway-backend` (Node gateway scaffold)
  - `frontend` (Next.js scaffold)
  - `worker-parsing`
  - `worker-scoring`
  - `worker-notification`
  - `upstream-ai-core` (build từ `upstream/resume-matcher/apps/backend`, chạy theo profile)
- Đã cấu hình volume/network chuẩn cho vận hành local.
- Đã bổ sung profile để bật/tắt nhóm service theo giai đoạn triển khai (`app`, `workers`, `upstream`).

### 5) Bổ sung tệp môi trường và marker scaffold
- Đã tạo `.env.example` với biến khởi tạo cơ bản:
  - `MONGO_ROOT_USERNAME`
  - `MONGO_ROOT_PASSWORD`
- Đã thêm các file `.gitkeep` để giữ cấu trúc thư mục scaffold trong Git.

### 6) Kiểm tra và xác thực sau khi chuyển đổi
- Đã kiểm tra trạng thái Git tại root monorepo.
- Đã xác nhận remote subtree tồn tại và đúng URL fork.
- Đã validate cú pháp compose:
  - `docker compose -f docker-compose.yml config`
  - Kết quả: **hợp lệ**.

## Tệp/đường dẫn đã tạo hoặc thay đổi chính
- `docker-compose.yml`
- `.env.example`
- `apps/backend/.gitkeep`
- `apps/frontend/.gitkeep`
- `workers/.gitkeep`
- `workers/parsing/.gitkeep`
- `workers/scoring/.gitkeep`
- `workers/notification/.gitkeep`
- `infra/.gitkeep`
- `scripts/.gitkeep`
- `upstream/resume-matcher` (subtree import)

## Trạng thái hiện tại
- Hoàn tất bước chuyển đổi nền tảng monorepo ban đầu.
- Đã mở rộng thêm hạ tầng schema/service để sẵn sàng triển khai flow AI bất đồng bộ theo Clean Architecture.

### 7) Tinh chỉnh Docker networking cho luồng Browser <-> API
- Đã cập nhật `docker-compose.yml` để sửa 2 vấn đề networking quan trọng:
  - Mở cổng backend ra host: thêm `3001:3001` cho `gateway-backend`.
  - Đổi `NEXT_PUBLIC_API_BASE_URL` sang `http://localhost:3001` để client-side Next.js gọi API đúng từ trình duyệt.
- Đã bổ sung thêm biến nội bộ:
  - `INTERNAL_API_BASE_URL=http://gateway-backend:3001`
- Đã validate lại compose sau chỉnh sửa:
  - `docker compose -f docker-compose.yml config`
  - Kết quả: **hợp lệ**.

### 8) Nâng cấp Mongoose models theo hướng production-safe
- Đã chỉnh sửa các model tại `apps/backend/src/models/`:
  - `User.js`: xóa index email khai báo trùng lặp.
  - `Job.js`:
    - thêm `qdrantId` (UUID mapping với Qdrant point_id),
    - thêm `isAnalyzed`,
    - thêm `location`, `experienceLevel`,
    - thêm index `qdrantId` (sparse).
  - `Resume.js`:
    - thêm `qdrantId` (UUID mapping với Qdrant point_id),
    - thêm index `qdrantId` (sparse).
  - `Application.js`:
    - thêm `aiStatus` cho pipeline async (`pending/parsing/scoring/completed/failed`),
    - thêm index `jobId + aiStatus`.
- Đã kiểm tra lỗi phân tích tĩnh cho toàn bộ model:
  - Kết quả: **không lỗi**.

### 9) Bổ sung service layer tối thiểu cho UUID + AI status flow
- Đã tạo utility:
  - `apps/backend/src/utils/qdrant-id.js`
  - Chức năng: sinh UUID (`createQdrantId`) và đảm bảo document luôn có `qdrantId` (`ensureQdrantId`).
- Đã tạo services:
  - `apps/backend/src/services/job.service.js`
  - `apps/backend/src/services/resume.service.js`
  - Chức năng: create/update Job, Resume và tự động đảm bảo `qdrantId`.
- Đã tạo service điều phối trạng thái AI:
  - `apps/backend/src/services/application-ai.service.js`
  - Chức năng:
    - cập nhật trạng thái AI (`updateApplicationAiStatus`),
    - chạy flow mẫu parsing -> scoring -> completed/failed (`runApplicationAiPipeline`).

### 10) Tạo script migration backfill qdrantId cho dữ liệu cũ
- Đã tạo script:
  - `apps/backend/scripts/backfill-qdrant-ids.mjs`
- Chức năng:
  - kết nối MongoDB qua `MONGO_URI`,
  - tìm Job/Resume thiếu `qdrantId`,
  - bulk update với UUID mới,
  - in số lượng bản ghi đã backfill.

## Trạng thái sẵn sàng hiện tại
- Hạ tầng monorepo + Docker networking đã ổn định cho local development.
- Data model đã sẵn sàng cho tích hợp MongoDB + Qdrant theo mô hình Hybrid AI.
- Service nền đã được gắn vào controller/route cho luồng tạo/cập nhật Job, Resume.
- Có sẵn migration script để chuẩn hóa dữ liệu cũ trước khi chạy pipeline chính thức.

### 11) Wiring controller/route để API gọi service thay vì thao tác model trực tiếp
- Đã tạo cấu trúc HTTP layer cho backend theo hướng route -> controller -> service:
  - `apps/backend/src/controllers/job.controller.js`
  - `apps/backend/src/controllers/resume.controller.js`
  - `apps/backend/src/routes/job.routes.js`
  - `apps/backend/src/routes/resume.routes.js`
  - `apps/backend/src/routes/index.js`
- Đã tạo app entry và server bootstrap:
  - `apps/backend/src/app.js`
  - `apps/backend/src/server.js`
- Đã tạo database connector:
  - `apps/backend/src/config/database.js`
- Các endpoint đã wiring xong:
  - `POST /api/jobs` -> `createJob` service (tự đảm bảo `qdrantId`)
  - `PATCH /api/jobs/:id` -> `updateJobById` service
  - `POST /api/resumes` -> `createResume` service (tự đảm bảo `qdrantId`)
  - `PATCH /api/resumes/:id` -> `updateResumeById` service
  - `GET /api/health` -> health check
- Đã kiểm tra lỗi tĩnh các file mới:
  - Kết quả: **không lỗi**.

### 12) Hoàn thiện tích hợp Qdrant cho backend (bootstrap + index + search)
- Đã tạo package backend chuẩn ESM và scripts vận hành:
  - `apps/backend/package.json`
  - Scripts: `start`, `dev`, `bootstrap:qdrant`, `smoke:qdrant`, `backfill:qdrant-id`
- Đã bổ sung cấu hình Qdrant client:
  - `apps/backend/src/config/qdrant.js`
  - Quản lý URL/API key, tên collection, vector size, distance metric.
- Đã bổ sung service bootstrap collection:
  - `apps/backend/src/services/qdrant-collection.service.js`
  - Tự tạo 2 collection: `jobs_vectors`, `resumes_vectors` nếu chưa tồn tại.
- Đã bổ sung service index/search vector:
  - `apps/backend/src/services/vector-index.service.js`
  - Hỗ trợ upsert/delete/search cho Job và Resume vectors.
- Đã bổ sung service semantic + hybrid scoring:
  - `apps/backend/src/services/semantic-search.service.js`
  - Hỗ trợ:
    - semantic retrieval top-k,
    - keyword analysis (matched/missing),
    - weighted hybrid score cho cặp Job-Resume.
- Đã nâng cấp service hiện có để đồng bộ vector:
  - `apps/backend/src/services/job.service.js`
  - `apps/backend/src/services/resume.service.js`
  - Nếu payload có `embeddingVector`, hệ thống tự upsert vào Qdrant sau khi save MongoDB.
- Đã nâng cấp pipeline AI Application:
  - `apps/backend/src/services/application-ai.service.js`
  - Mặc định tính hybrid score dựa trên dữ liệu Job/Resume nếu chưa truyền custom scoringStep.
- Đã thêm API cho vector operations:
  - `apps/backend/src/controllers/vector.controller.js`
  - `apps/backend/src/routes/vector.routes.js`
  - `apps/backend/src/routes/index.js`
  - Endpoints:
    - `POST /api/vectors/jobs/:jobId/index`
    - `POST /api/vectors/resumes/:resumeId/index`
    - `POST /api/vectors/search/resumes`
    - `POST /api/vectors/search/jobs`
    - `POST /api/vectors/score/pair`
- Đã cập nhật startup backend:
  - `apps/backend/src/server.js`
  - Tự load `.env`, connect MongoDB, và bootstrap Qdrant collections khi khởi động.

### 13) Kiểm chứng tích hợp Qdrant thực tế
- Đã chạy `npm install` tại backend (bổ sung đầy đủ dependencies, gồm `express`).
- Đã chạy bootstrap collections thành công:
  - `npm run bootstrap:qdrant`
  - Kết quả: tạo thành công `jobs_vectors` và `resumes_vectors`.
- Đã chạy smoke test end-to-end thành công:
  - `npm run smoke:qdrant`
  - Kết quả: upsert vector -> search trả kết quả -> cleanup delete hoàn tất.

### 14) Refactor kiến trúc Qdrant theo hướng Infrastructure/Adapter
- Đã tách lớp Qdrant SDK khỏi service:
  - `apps/backend/src/infrastructure/qdrant/client.js`
  - `apps/backend/src/infrastructure/qdrant/vector.repository.js`
- Đã tách bootstrap Qdrant riêng:
  - `apps/backend/src/bootstrap/qdrant-bootstrap.js`
- Đã cập nhật startup backend dùng bootstrap module:
  - `apps/backend/src/server.js`
- Đã giữ tương thích ngược import config:
  - `apps/backend/src/config/qdrant.js` (re-export về infrastructure).

### 15) Hoàn thành 4 hạng mục còn thiếu cho database/vector pipeline
- **(A) Worker SBERT thực tế**:
  - `workers/embedding-sbert/app.py`
  - `workers/embedding-sbert/requirements.txt`
  - `workers/embedding-sbert/Dockerfile`
  - Backend gọi worker qua `apps/backend/src/services/embedding.service.js`.
- **(B) Đồng bộ vòng đời MongoDB <-> Qdrant (update/delete/close)**:
  - Cập nhật `apps/backend/src/services/job.service.js`:
    - auto-generate embedding khi cần,
    - upsert vector khi create/update,
    - delete vector khi `status=closed` hoặc xóa Job.
  - Cập nhật `apps/backend/src/services/resume.service.js`:
    - auto-generate embedding,
    - upsert vector khi create/update,
    - delete vector khi xóa Resume.
  - Bổ sung endpoint delete:
    - `DELETE /api/jobs/:id`
    - `DELETE /api/resumes/:id`
- **(C) Integration test full async pipeline**:
  - `apps/backend/tests/integration/async-pipeline.test.mjs`
  - Bao phủ luồng parsing -> scoring -> ranking.
- **(D) Ops script re-index toàn bộ khi đổi model embedding**:
  - `apps/backend/scripts/reindex-vectors.mjs`
  - Hỗ trợ `--target all|jobs|resumes` và `--model-version`.

### 16) Đồng bộ môi trường chính và xác minh lại end-to-end
- Đã xử lý conflict MongoDB cũ chiếm cổng 27017, đưa stack về `mongo:7` chuẩn của project.
- Đã nâng Qdrant image lên `v1.17.0` để đồng bộ với backend client.
- Đã chạy lại các bước xác minh trên môi trường chính (không dùng DB tạm):
  - `npm run bootstrap:qdrant` -> thành công
  - `npm run smoke:qdrant` -> thành công
  - `RUN_INTEGRATION_TESTS=1 npm run test:integration` -> PASS
  - `npm run reindex:vectors -- --target all --model-version sbert-v1` -> thành công

### 17) Hardening vận hành local + CI
- Đã thêm healthcheck cho các services chính trong `docker-compose.yml`:
  - `mongo`, `redis`, `qdrant`, `worker-embedding-sbert`.
- Đã bổ sung `depends_on` theo condition `service_healthy` cho service phụ thuộc.
- Đã thêm seed script dữ liệu demo:
  - `apps/backend/scripts/seed-demo-data.mjs`
  - Script package: `npm run seed:demo`.
- Đã thêm one-shot verify script:
  - `scripts/full-verify.ps1`
  - Luồng: up stack -> wait healthy -> bootstrap -> seed -> integration test.
- Đã thêm GitHub Actions workflow integration:
  - `.github/workflows/backend-integration.yml`
  - Tự động chạy stack infra + embedding worker + seed + integration test trên CI.

## Trạng thái hoàn thiện hiện tại
- Nền tảng database và vector database đã hoàn chỉnh ở mức vận hành thực tế (local + CI).
- Pipeline tích hợp MongoDB <-> Qdrant đã có đầy đủ:
  - bootstrap,
  - indexing,
  - search,
  - cleanup lifecycle,
  - re-index model version,
  - integration test không skip.
- Sẵn sàng chuyển sang giai đoạn phát triển nghiệp vụ cao hơn (queue production, fairness metrics, optimization ranking).
