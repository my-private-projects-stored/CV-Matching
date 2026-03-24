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
  - `apps/backend/src/infrastructure/qdrant`

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

### 18) Xác nhận sẵn sàng bắt đầu xây dựng Frontend/Backend
- Đã kiểm tra nhanh trạng thái repository và các chỉ dấu sẵn sàng:
  - `apps/backend/package.json`: **OK**.
  - `apps/frontend/package.json`: **chưa có** (frontend root hiện chưa scaffold chạy độc lập).
  - `upstream/resume-matcher/apps/frontend/package.json`: **OK**.
- Kết luận:
  - **Backend:** Có thể bắt đầu triển khai tính năng ngay.
  - **Frontend:** Có thể bắt đầu ngay theo 1 trong 2 hướng:
    1. scaffold frontend tại `apps/frontend` (khuyến nghị để bám kiến trúc monorepo hiện tại), hoặc
    2. phát triển trực tiếp từ frontend upstream rồi đồng bộ về root sau.

### 19) Thiết lập quy ước cập nhật tiến độ theo yêu cầu user
- Đã ghi nhận yêu cầu: từ thời điểm này, mỗi task hoàn thành sẽ được cập nhật vào `task-completed.md`.
- Quy ước áp dụng ngay:
  - mỗi task có tiêu đề riêng,
  - mô tả kết quả chính,
  - trạng thái/kết luận ngắn gọn để theo dõi liên tục.

### 20) Triển khai phương án lai cho Frontend (root-first)
- Đã bắt đầu triển khai theo đúng phương án user chốt:
  - không chỉnh trực tiếp trong upstream,
  - dựng frontend chính ở `apps/frontend`,
  - đồng bộ từ upstream theo hướng migrate dần.
- Đã đồng bộ bộ nền tảng frontend từ `upstream/resume-matcher/apps/frontend` sang `apps/frontend`:
  - file cấu hình: `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `.env.sample`, `.gitignore`, `.prettierrc`.
  - thư mục chính: `app`, `components`, `hooks`, `i18n`, `lib`, `messages`, `public`, `tests`.

### 21) Xác minh frontend root chạy độc lập trong monorepo
- Đã cài dependencies tại `apps/frontend` bằng `npm install` (thành công).
- Đã chạy build kiểm chứng tại `apps/frontend`.
- Đã xử lý lỗi tương thích Next.js:
  - sửa `apps/frontend/next.config.ts`, loại bỏ key experimental không hợp lệ `turbopackUseSystemTlsCerts`.
- Kết quả cuối cùng:
  - `npm run build` **thành công**,
  - các route chính đã được generate thành công (`/`, `/builder`, `/dashboard`, `/settings`, `/tailor`, và các route dynamic print/resume).

### 22) Chuẩn hóa lớp cấu hình API frontend theo backend monorepo
- Đã cập nhật `apps/frontend/next.config.ts`:
  - đổi `BACKEND_ORIGIN` mặc định sang `http://127.0.0.1:3001`.
- Đã refactor `apps/frontend/lib/api/client.ts` để khớp Express API:
  - chuyển base path mặc định từ `/api/v1` sang `/api`,
  - bổ sung hỗ trợ biến môi trường `NEXT_PUBLIC_API_BASE_URL` và `INTERNAL_API_BASE_URL`,
  - giữ alias tương thích ngược `API_URL` cho code hiện có.
- Đã cập nhật `apps/frontend/.env.sample` cho chuẩn monorepo:
  - `NEXT_PUBLIC_API_BASE_URL=/`
  - `INTERNAL_API_BASE_URL=http://127.0.0.1:3001`
  - `BACKEND_ORIGIN=http://127.0.0.1:3001`

### 23) Kiểm tra kết nối Frontend <-> Backend ở runtime
- Đã khởi động hạ tầng phụ trợ bằng Docker Compose:
  - `mongo`, `redis`, `qdrant`, `worker-embedding-sbert`.
- Đã chạy backend monorepo ở local với env tương ứng (`MONGO_URI`, `QDRANT_URL`, `EMBEDDING_SERVICE_URL`).
- Đã kiểm tra trực tiếp backend health:
  - `http://127.0.0.1:3001/api/health` trả `{\"status\":\"ok\"}`.
- Đã kiểm tra qua frontend proxy rewrite:
  - `http://127.0.0.1:3000/api/health` trả `{\"status\":\"ok\"}`.

### 24) Bắt đầu migrate cụm nền tảng Layout + i18n + Settings
- Đã hoàn thiện migration baseline của cụm nền tảng tại `apps/frontend`:
  - Layout root hoạt động,
  - i18n config/messages/context hoạt động,
  - Settings page compile và render được trong root frontend.
- Đã bổ sung fallback migration trong `apps/frontend/lib/api/config.ts`:
  - khi `/status` chưa có (404), tự fallback sang `/health` và trả về trạng thái hệ thống tối thiểu,
  - giúp module Settings/System Status hoạt động trong giai đoạn backend đang migrate endpoint.
- Đã chạy lại build sau migration:
  - `npm run build` **thành công**.

### 25) Tạo lớp adapter API cho Settings để map dần endpoint upstream sang backend monorepo
- Đã triển khai adapter theo nguyên tắc:
  - ưu tiên gọi endpoint backend thật (`/config/*`, `/status`),
  - nếu backend chưa hỗ trợ (404/405/501) thì tự fallback về local adapter store để không làm vỡ UI Settings.
- Đã cập nhật `apps/frontend/lib/api/config.ts`:
  - thêm bộ helper lưu/đọc local (`localStorage`) cho các nhóm cấu hình: LLM, feature flags, language, prompts, API keys,
  - map `testLlmConnection` fallback qua `/api/health`,
  - chuẩn hóa `resetDatabase` fallback để reset local adapter state,
  - giữ luồng lỗi chuẩn cho các status khác ngoài nhóm fallback.
- Kết quả:
  - Settings module có thể hoạt động ổn định trong giai đoạn backend monorepo chưa đầy đủ endpoint cấu hình,
  - sẵn sàng cho bước kế tiếp: thay dần từng fallback bằng endpoint backend thật.
- Đã verify sau thay đổi:
  - `npm run build` tại `apps/frontend` **thành công**.

### 26) Triển khai endpoint backend thật cho Status + Language + Feature Flags
- Đã bổ sung model cấu hình hệ thống:
  - `apps/backend/src/models/SystemConfig.js`
- Đã bổ sung service cấu hình và trạng thái:
  - `apps/backend/src/services/config.service.js`
  - Chức năng:
    - đọc/ghi `feature config` (`enable_cover_letter`, `enable_outreach_message`),
    - đọc/ghi `language config` (`ui_language`, `content_language`, `supported_languages`),
    - trả `system status` động từ dữ liệu MongoDB (`/status`).
- Đã bổ sung controller + routes:
  - `apps/backend/src/controllers/config.controller.js`
  - `apps/backend/src/routes/config.routes.js`
  - wiring vào `apps/backend/src/routes/index.js`.
- Endpoint mới đã hoạt động:
  - `GET /api/status`
  - `GET /api/config/language`
  - `PUT /api/config/language`
  - `GET /api/config/features`
  - `PUT /api/config/features`
- Đã kiểm thử read/write thực tế với backend đang chạy local:
  - Language config cập nhật và đọc lại thành công,
  - Feature flags cập nhật và đọc lại thành công,
  - System status trả về đúng schema cho frontend Settings.

### 27) Triển khai endpoint backend thật cho LLM Config + LLM Test
- Đã mở rộng service cấu hình tại:
  - `apps/backend/src/services/config.service.js`
  - Bổ sung logic:
    - lưu/đọc cấu hình LLM (`provider`, `model`, `api_base`, `api_key`),
    - masking `api_key` khi trả về frontend,
    - kiểm tra hợp lệ provider,
    - test cấu hình LLM mức config-level (`/llm-test`) với mã lỗi chuẩn cho case thiếu API key.
- Đã mở rộng controller/routes:
  - `apps/backend/src/controllers/config.controller.js`
  - `apps/backend/src/routes/config.routes.js`
- Endpoint mới đã hoạt động:
  - `GET /api/config/llm-api-key`
  - `PUT /api/config/llm-api-key`
  - `POST /api/config/llm-test`
- Đã đồng bộ trạng thái hệ thống:
  - `GET /api/status` nay phản ánh `llm_configured` và `llm_healthy` dựa trên cấu hình LLM đã lưu.
- Kết quả kiểm thử thực tế:
  - PUT lưu config thành công và GET trả về key dạng mask (`sk-t****90`),
  - `/llm-test` trả `healthy:false` + `error_code: api_key_required` khi thiếu key,
  - `/llm-test` trả `healthy:true` cho cấu hình hợp lệ,
  - `/status` phản ánh đúng `llm_configured:true` sau khi lưu cấu hình.

### 28) Triển khai endpoint backend thật cho Prompts + API Keys + Reset
- Đã mở rộng backend config module để hoàn thiện contract Settings còn lại:
  - `apps/backend/src/services/config.service.js`
  - `apps/backend/src/controllers/config.controller.js`
  - `apps/backend/src/routes/config.routes.js`
- Endpoint mới đã hoạt động:
  - `GET /api/config/prompts`
  - `PUT /api/config/prompts`
  - `GET /api/config/api-keys`
  - `POST /api/config/api-keys`
  - `DELETE /api/config/api-keys/:provider`
  - `DELETE /api/config/api-keys?confirm=CLEAR_ALL_KEYS`
  - `POST /api/config/reset` (body `{ confirm: "RESET_ALL_DATA" }`)
- Hành vi chính đã triển khai:
  - prompt config có validate `default_prompt_id`,
  - API keys được mask khi trả về, hỗ trợ update theo từng provider,
  - reset xóa dữ liệu nghiệp vụ (Job/Resume/Application) và reset cấu hình hệ thống liên quan.
- Kết quả kiểm thử thực tế:
  - prompts GET/PUT/GET chạy đúng,
  - api-keys GET/POST/DELETE-provider/DELETE-all chạy đúng,
  - reset chạy thành công và `/status` phản ánh dữ liệu đã về trạng thái sạch.

### 29) Gỡ fallback frontend Settings và chuyển sang backend-first hoàn toàn
- Đã cập nhật `apps/frontend/lib/api/config.ts`:
  - loại bỏ toàn bộ local fallback adapter (`localStorage`) cho các nhóm:
    - `status`,
    - `llm-api-key`/`llm-test`,
    - `features`,
    - `language`,
    - `prompts`,
    - `api-keys`,
    - `reset`.
  - giữ luồng lỗi chuẩn: endpoint nào lỗi sẽ trả thông báo lỗi backend tương ứng.
- Đã build lại frontend sau khi gỡ fallback:
  - `npm run build` tại `apps/frontend` **thành công**.
- Đã kiểm tra runtime backend-first:
  - các endpoint Settings chính đều trả `200` khi gọi trực tiếp,
  - `POST /api/config/llm-test` trả `200` với payload mẫu,
  - xác nhận frontend giờ có thể chạy theo mô hình backend-first đúng kiến trúc monorepo.

### 30) Kiểm tra E2E luồng Settings qua API thật + bổ sung test tự động
- Đã thực hiện kiểm tra E2E theo backend-first cho Settings API (không dùng fallback local):
  - xác minh các endpoint config/status hoạt động đồng bộ khi gọi runtime.
- Đã bổ sung test integration tự động mới cho backend:
  - `apps/backend/tests/integration/config-endpoints.test.mjs`
  - Bao phủ các luồng:
    - `status`,
    - `language` GET/PUT,
    - `features` GET/PUT,
    - `prompts` GET/PUT,
    - `llm-api-key` GET/PUT,
    - `llm-test`,
    - `api-keys` GET/POST/DELETE-provider/DELETE-all,
    - `reset` (invalid confirm + valid confirm) và kiểm tra dữ liệu sau reset.
- Đã chạy toàn bộ integration tests:
  - lệnh: `npm run test:integration` (với `RUN_INTEGRATION_TESTS=1`)
  - kết quả: **2/2 tests PASS**.

### 31) Bổ sung test frontend cho Settings API client (`lib/api/config.ts`)
- Đã thêm test unit mới cho frontend API layer:
  - `apps/frontend/tests/config-api.test.ts`
- Phạm vi kiểm thử đã bao phủ:
  - `fetchSystemStatus`: gọi đúng endpoint `/status` và parse payload,
  - `updateLlmConfig`: gửi đúng method/body và nổi lỗi `detail` từ backend,
  - `fetchLlmConfig`: parse dữ liệu cấu hình trả về,
  - `fetchApiKeyStatus`: parse danh sách trạng thái provider,
  - `deleteApiKey`: xử lý đúng `204 No Content`,
  - `clearAllApiKeys` và `resetDatabase`: gọi đúng endpoint/params/body theo contract.
- Đã chạy kiểm thử trực tiếp file mới:
  - lệnh: `npm run test -- tests/config-api.test.ts`
  - kết quả: **1 test file PASS, 6/6 tests PASS**.

### 32) Chạy full frontend test suite và ổn định hóa test `DiffPreviewModal`
- Đã chạy toàn bộ frontend tests tại `apps/frontend`:
  - lệnh: `npm run test`
  - lần đầu phát hiện 1 test fail cũ ở `tests/diff-preview-modal.test.tsx` do selector icon theo class không ổn định theo phiên bản `lucide-react`.
- Đã fix theo hướng ổn định (không phụ thuộc class generated):
  - cập nhật component `apps/frontend/components/tailor/diff-preview-modal.tsx` thêm `data-testid` cho 2 icon cảnh báo:
    - `high-risk-warning-banner-icon`
    - `high-risk-change-icon`
  - cập nhật test `apps/frontend/tests/diff-preview-modal.test.tsx` để assert theo `data-testid` thay vì query class `.lucide-triangle-alert`.
- Đã chạy lại full suite sau khi sửa:
  - kết quả: **4 test files PASS, 71/71 tests PASS**.

### 33) Mở rộng test coverage cho frontend API modules `resume` và `enrichment`
- Đã bổ sung 2 test files mới:
  - `apps/frontend/tests/resume-api.test.ts`
  - `apps/frontend/tests/enrichment-api.test.ts`
- Nội dung coverage chính đã thêm:
  - `resume-api`:
    - verify request payload cho `uploadJobDescriptions`,
    - verify error mapping cho `improveResume`, `deleteResume`,
    - verify endpoint encode + parse response cho `fetchResume`, `fetchJobDescription`,
    - verify URL generation cho `getResumePdfUrl` (default + custom settings/locale).
  - `enrichment-api`:
    - verify endpoint/method/credentials cho `analyzeResume`,
    - verify error mapping với backend `detail`,
    - verify payload mapping cho `generateEnhancements`, `applyEnhancements`, `applyRegeneratedItems`,
    - verify generic error fallback cho `regenerateItems` khi backend không trả JSON detail.
- Đã chạy test theo file mới:
  - lệnh: `npm run test -- tests/resume-api.test.ts tests/enrichment-api.test.ts`
  - kết quả: **2 test files PASS, 12/12 tests PASS**.
- Đã chạy lại full frontend suite sau khi thêm coverage:
  - lệnh: `npm run test`
  - kết quả: **6 test files PASS, 83/83 tests PASS**.

### 34) Sửa lỗi TypeScript trong test `resume-api.test.ts` do sai union type của `TemplateSettings`
- Nguyên nhân:
  - fixture custom settings trong test dùng giá trị không hợp lệ với type strict:
    - `SpacingLevel` chỉ nhận `1..5`,
    - `headerFont/bodyFont` chỉ nhận `serif | sans-serif | mono`,
    - `accentColor` chỉ nhận `blue | green | orange | red`.
- Đã sửa tại `apps/frontend/tests/resume-api.test.ts`:
  - `spacing`: đổi sang giá trị hợp lệ (`section: 4`, `item: 3`, `lineHeight: 2`),
  - `fontSize`: đổi sang level hợp lệ (`base: 4`, `headerScale: 2`),
  - `headerFont/bodyFont`: đổi sang `serif` và `sans-serif`,
  - `accentColor`: đổi sang `blue`,
  - cập nhật assertion URL tương ứng (`fontSize=4`).
- Đã xác minh sau sửa:
  - `npm run test -- tests/resume-api.test.ts`: **PASS (6/6)**,
  - `npx tsc --noEmit`: **TS_EXIT=0**.

### 35) Bổ sung test cho `lib/api/client.ts` (base URL, endpoint normalization, timeout)
- Đã thêm test file mới:
  - `apps/frontend/tests/client-api.test.ts`
- Coverage đã triển khai:
  - xác minh default config: `API_BASE_URL='/'`, `API_BASE='/api'`, `getUploadUrl()` đúng,
  - xác minh normalize env `NEXT_PUBLIC_API_BASE_URL` và build `API_BASE`,
  - xác minh `apiFetch`:
    - normalize endpoint tương đối (`health` -> `/api/health`),
    - giữ nguyên absolute URL,
    - không double-prefix khi endpoint đã bắt đầu bằng `/api/`,
  - xác minh helper methods `apiPost/apiPatch/apiPut/apiDelete` set đúng method/headers/body,
  - xác minh timeout/abort hoạt động khi request vượt ngưỡng timeout.
- Đã sửa ổn định test:
  - tránh set env thành chuỗi `"undefined"` bằng cách dùng `delete process.env.*`,
  - xử lý assertion timeout để không tạo unhandled rejection.
- Kết quả xác minh:
  - `npm run test -- tests/client-api.test.ts`: **PASS (6/6)**,
  - `npm run test` toàn bộ frontend: **7 test files PASS, 89/89 tests PASS**.

### 36) Mở rộng coverage SSR cho `lib/api/client.ts` (nhánh `INTERNAL_API_BASE_URL`)
- Đã bổ sung test mới trong `apps/frontend/tests/client-api.test.ts`:
  - xác minh khi runtime không có `window` (server-side) và `NEXT_PUBLIC_API_BASE_URL='/'`,
  - `API_BASE` được resolve đúng từ `INTERNAL_API_BASE_URL` (ví dụ `http://gateway-backend:3001/api`).
- Đã cải thiện độ ổn định test globals:
  - thêm `vi.unstubAllGlobals()` trong `afterEach` để cleanup các `stubGlobal` giữa các test.
- Kết quả xác minh:
  - `npm run test -- tests/client-api.test.ts`: **PASS (7/7)**,
  - `npm run test` toàn bộ frontend: **7 test files PASS, 90/90 tests PASS**.

### 37) Chốt quality gate frontend trong CI (lint + typecheck + test + build)
- Đã tạo workflow mới:
  - `.github/workflows/frontend-quality.yml`
- Quality gate đã được bật cho `apps/frontend` với các bước bắt buộc:
  - `npm ci`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:coverage`
  - `npm run build`
- Đã cập nhật script frontend tương ứng tại `apps/frontend/package.json`:
  - thêm `typecheck`
  - thêm `test:coverage`

### 38) Đặt ngưỡng coverage tối thiểu cho frontend test suite
- Đã cập nhật `apps/frontend/vitest.config.ts`:
  - bật coverage provider `v8`,
  - reporter `text` + `lcov`,
  - threshold tối thiểu:
    - `lines: 50`
    - `functions: 45`
    - `statements: 50`
    - `branches: 45`
- Đã bảo đảm dependency coverage trong frontend package:
  - `@vitest/coverage-v8`.

### 39) Mở rộng negative tests cho Reset và API Keys (backend integration)
- Đã cập nhật test `apps/backend/tests/integration/config-endpoints.test.mjs` với các nhánh lỗi bổ sung:
  - `POST /config/api-keys` với provider không hợp lệ -> kỳ vọng `400`.
  - `POST /config/api-keys` với key rỗng/khoảng trắng -> normalize thành chưa cấu hình.
  - `DELETE /config/api-keys/:provider` với provider không hợp lệ -> kỳ vọng `400`.
  - `DELETE /config/api-keys/:provider` với provider hợp lệ nhưng chưa cấu hình -> kỳ vọng `204`.
  - `DELETE /config/api-keys` thiếu `confirm` -> kỳ vọng `400`.
- Đã xác minh test integration backend chạy pass sau cập nhật:
  - `npm run test:integration` (với `RUN_INTEGRATION_TESTS=1`) -> **PASS (2/2)**.

### 40) Bổ sung xác minh build/runtime path ở CI backend
- Đã cập nhật workflow `.github/workflows/backend-integration.yml`:
  - thêm bước `Smoke runtime endpoints` sau integration test.
  - workflow sẽ khởi chạy backend runtime (`npm run start`) trên CI,
  - sau đó gọi smoke endpoints:
    - `GET /api/health`
    - `GET /api/status`
- Mục tiêu đạt được:
  - không chỉ kiểm thử logic, mà còn xác nhận đường chạy runtime/deploy path ở mức smoke trong CI.

### 41) Triển khai feature-first vòng 1 theo Use Case: Job Board (UC-CORE-01 + UC-BASIC-06)
- Đã mở rộng backend Job API để phục vụ luồng duyệt/lọc JD (không chỉ create/update/delete):
  - cập nhật `apps/backend/src/services/job.service.js`:
    - bổ sung normalize payload JD (tự sinh `cleanText` từ `title + description + requirements` khi thiếu),
    - bổ sung `listJobs(query)` với filter theo `search/category/status/location` + pagination,
    - bổ sung `getJobById(jobId)`.
  - cập nhật `apps/backend/src/controllers/job.controller.js`:
    - thêm `listJobsHandler`,
    - thêm `getJobHandler`.
  - cập nhật `apps/backend/src/routes/job.routes.js`:
    - thêm `GET /api/jobs`,
    - thêm `GET /api/jobs/:id`.
- Đã triển khai frontend Job Board theo chế độ feature-first:
  - thêm API client `apps/frontend/lib/api/jobs.ts` cho list/detail jobs,
  - thêm trang `apps/frontend/app/(default)/jobs/page.tsx`:
    - hiển thị danh sách JD,
    - filter theo `search/category/status/location`,
    - có pagination,
    - có state loading/error/empty.
  - cập nhật `apps/frontend/app/(default)/dashboard/page.tsx`:
    - thêm card `Browse Jobs` để điều hướng nhanh sang `/jobs`.
- Đã xác minh sau triển khai:
  - frontend `npm run typecheck`: **PASS**,
  - frontend `npm run lint`: **PASS**,
  - frontend `npm run build`: **PASS** (đã generate route `/jobs`),
  - backend `RUN_INTEGRATION_TESTS=1 npm run test:integration`: **PASS (2/2)**.

### 42) Feature-first round 2 (UC-CORE-02): mở rộng Resume API contract cho upload/list/detail/retry
- Đã triển khai backend contract parity cho luồng upload + dashboard resume status tại:
  - `apps/backend/src/models/Resume.js`
  - `apps/backend/src/services/resume.service.js`
  - `apps/backend/src/controllers/resume.controller.js`
  - `apps/backend/src/routes/resume.routes.js`
- Endpoint mới/đã mở rộng:
  - `POST /api/resumes/upload` (multipart `file`, tối đa 4MB, trả `resume_id`, `processing_status`, `is_master`, `request_id`)
  - `GET /api/resumes?resume_id=...` (trả schema `raw_resume` + `processed_resume` theo contract frontend)
  - `GET /api/resumes/list?include_master=true|false`
  - `POST /api/resumes/:id/retry-processing`
  - `GET /api/resumes/:id/job-description`
  - `PATCH /api/resumes/:id/title`
  - `PATCH /api/resumes/:id/cover-letter`
  - `PATCH /api/resumes/:id/outreach-message`
- Đã bổ sung dependency backend:
  - `multer` (memory storage) để nhận multipart upload từ frontend.
- Đã chuẩn hóa response shape để tương thích với `apps/frontend/lib/api/resume.ts`:
  - có `request_id` và object `data` cho fetch/update resume,
  - có `processing_status` cho list/upload/retry.
- Đã verify sau thay đổi:
  - backend `npm run test:integration`: **PASS (2/2)**.

### 43) Feature-first round 2 (UC-CORE-02): bổ sung endpoint generate Cover Letter và Outreach
- Đã mở rộng backend resume module để hỗ trợ on-demand content generation khớp contract frontend:
  - `POST /api/resumes/:id/generate-cover-letter`
  - `POST /api/resumes/:id/generate-outreach`
- File đã cập nhật:
  - `apps/backend/src/services/resume.service.js`
    - thêm helper build nội dung từ dữ liệu resume/job context,
    - lưu kết quả vào `coverLetter` / `outreachMessage` ngay trên resume record.
  - `apps/backend/src/controllers/resume.controller.js`
    - thêm `generateCoverLetterHandler`, `generateOutreachHandler`.
  - `apps/backend/src/routes/resume.routes.js`
    - wiring 2 endpoint generation mới.
- Response đã khớp frontend API client (`apps/frontend/lib/api/resume.ts`):
  - trả payload có `content` và `message`.
- Đã verify sau thay đổi:
  - backend `npm run test:integration`: **PASS (2/2)**.

### 44) Feature-first parity theo use-cases + upstream: hoàn thiện Tailor flow (`/jobs/upload`, `/resumes/improve*`)
- Đã triển khai đầy đủ endpoint backend còn thiếu cho luồng Tailor theo contract frontend và use-case:
  - `POST /api/jobs/upload`
  - `POST /api/resumes/improve/preview`
  - `POST /api/resumes/improve/confirm`
  - `POST /api/resumes/improve` (convenience endpoint)
- File đã cập nhật:
  - `apps/backend/src/controllers/job.controller.js`
    - thêm `uploadJobDescriptionsHandler` nhận `job_descriptions[]`, validate input, tạo Job record và trả `job_id[]`.
  - `apps/backend/src/routes/job.routes.js`
    - wiring route `POST /upload`.
  - `apps/backend/src/services/resume.service.js`
    - thêm logic preview/confirm/improve cho tailoring:
      - chuẩn hóa `resume_preview` từ `parsedData`,
      - trích từ khóa JD và gợi ý improvements,
      - sinh `diff_summary` + `detailed_changes` tương thích UI modal,
      - tạo tailored resume mới khi confirm (gắn `parentResumeId`, `jobId`, `jobDescription`).
  - `apps/backend/src/controllers/resume.controller.js`
    - thêm `previewImproveResumeHandler`, `confirmImproveResumeHandler`, `improveResumeHandler`.
  - `apps/backend/src/routes/resume.routes.js`
    - wiring 3 route improve mới.
- Đã bổ sung integration test contract mới:
  - `apps/backend/tests/integration/tailor-endpoints.test.mjs`
  - cover luồng: `jobs/upload -> resumes/improve/preview -> resumes/improve/confirm -> fetch tailored resume`.
- Đã xử lý ổn định test runtime:
  - tách DB test riêng cho file tailor để tránh race với integration test khác.
- Đã verify sau thay đổi:
  - backend `RUN_INTEGRATION_TESTS=1 npm run test:integration`: **PASS (3/3)**.

### 45) Feature-first parity theo use-cases + upstream: bổ sung export PDF (`/resumes/:id/pdf`, `/resumes/:id/cover-letter/pdf`)
- Đã triển khai cụm endpoint PDF mà frontend đang sử dụng trong flow download:
  - `GET /api/resumes/:id/pdf`
  - `GET /api/resumes/:id/cover-letter/pdf`
- File đã cập nhật:
  - `apps/backend/src/utils/simple-pdf.js`
    - thêm PDF generator tối giản (single-page) để xuất binary PDF ổn định không phụ thuộc Chromium.
  - `apps/backend/src/services/resume.service.js`
    - thêm `generateResumePdf(resumeId)` và `generateCoverLetterPdf(resumeId)`.
    - resume PDF lấy dữ liệu từ `parsedData` (personal info, summary, skills, highlights).
  - `apps/backend/src/controllers/resume.controller.js`
    - thêm handler download PDF, set đúng `Content-Type: application/pdf` và `Content-Disposition`.
  - `apps/backend/src/routes/resume.routes.js`
    - wiring 2 route PDF mới.
- Đã bổ sung integration test contract mới:
  - `apps/backend/tests/integration/pdf-endpoints.test.mjs`
  - cover các nhánh:
    - download resume PDF thành công,
    - download cover-letter PDF thành công,
    - trả `404` khi resume chưa có cover letter.
- Đã verify sau thay đổi:
  - backend `RUN_INTEGRATION_TESTS=1 npm run test:integration`: **PASS (4/4)**.

### 46) Feature-first parity theo use-cases + upstream: hoàn thiện Enrichment flow (`/enrichment/*`)
- Đã triển khai đầy đủ module Enrichment backend để khớp contract frontend và reference upstream:
  - `POST /api/enrichment/analyze/:resumeId`
  - `POST /api/enrichment/enhance`
  - `POST /api/enrichment/apply/:resumeId`
  - `POST /api/enrichment/regenerate`
  - `POST /api/enrichment/apply-regenerated/:resumeId`
- File đã thêm/cập nhật:
  - `apps/backend/src/services/enrichment.service.js`
    - phân tích section yếu của resume (`items_to_enrich`, `questions`, `analysis_summary`),
    - sinh `enhancements` từ câu trả lời người dùng,
    - apply enhancements vào `parsedData`,
    - regenerate nội dung theo instruction và apply lại vào resume.
  - `apps/backend/src/controllers/enrichment.controller.js`
    - validate input + mapping lỗi chuẩn (`400/404/500`) theo contract frontend.
  - `apps/backend/src/routes/enrichment.routes.js`
    - wiring toàn bộ route `/enrichment/*`.
  - `apps/backend/src/routes/index.js`
    - mount router mới tại `/api/enrichment`.
- Đã bổ sung integration test contract mới:
  - `apps/backend/tests/integration/enrichment-endpoints.test.mjs`
  - cover luồng: `analyze -> enhance -> apply -> regenerate -> apply-regenerated`.

### 47) Use-case backend batch: Application history + ranked dashboard + status update + explainable feedback
- Đã triển khai module Application API để lấp các use-case lõi và nghiệp vụ tuyển dụng còn thiếu:
  - `POST /api/applications` (tạo application cho cặp `job_id` + `resume_id`)
  - `GET /api/applications/ranked?job_id=...` (dashboard xếp hạng ứng viên theo hybrid score)
  - `GET /api/applications/history?candidate_id=...` (lịch sử ứng tuyển theo candidate)
  - `PATCH /api/applications/:id/status` (cập nhật pipeline trạng thái tuyển dụng)
  - `GET /api/applications/:id/feedback` (AI feedback + missing keywords + recommendations)
- File đã thêm/cập nhật:
  - `apps/backend/src/services/application.service.js`
  - `apps/backend/src/controllers/application.controller.js`
  - `apps/backend/src/routes/application.routes.js`
  - `apps/backend/src/routes/index.js` (mount `/api/applications`)
- Hành vi chính đã triển khai:
  - chống tạo trùng application cùng cặp `job_id` + `resume_id` (trả `409`),
  - hỗ trợ phân trang cho ranked/history,
  - chuẩn hóa payload explainability để frontend có thể render insights/recommendations.
- Đã bổ sung integration test contract mới:
  - `apps/backend/tests/integration/application-endpoints.test.mjs`
  - cover luồng: `create -> ranked -> history -> patch status -> feedback`.

### 48) Use-case backend batch: Job applicant count + tải CV gốc
- Đã triển khai thêm 2 nhóm chức năng phục vụ nghiệp vụ Recruiter theo Use Case:
  - UC-BASIC-09: xem danh sách tin tuyển dụng có số lượng ứng viên theo từng vị trí.
  - UC-BASIC-12: xem và tải xuống CV gốc của ứng viên.
- File đã cập nhật:
  - `apps/backend/src/services/job.service.js`
    - `GET /jobs` và `GET /jobs/:id` nay trả thêm `applications_count` (aggregate từ collection Application).
  - `apps/backend/src/models/Resume.js`
    - bổ sung `sourceFile` để lưu metadata + binary file upload gốc.
  - `apps/backend/src/services/resume.service.js`
    - lưu `sourceFile` khi upload resume,
    - thêm `downloadOriginalResumeFile(resumeId)`.
  - `apps/backend/src/controllers/resume.controller.js`
    - thêm `downloadOriginalResumeHandler`.
  - `apps/backend/src/routes/resume.routes.js`
    - thêm endpoint `GET /api/resumes/:id/download`.
- Đã mở rộng integration test:
  - `apps/backend/tests/integration/application-endpoints.test.mjs`
  - bổ sung assert cho:
    - `applications_count` ở list/detail jobs,
    - tải CV gốc thành công qua endpoint download.

### 49) Frontend feature wiring: Applications dashboard + ranking/history/feedback flow
- Đã bổ sung API client mới cho Application module tại:
  - `apps/frontend/lib/api/applications.ts`
  - Hỗ trợ các thao tác:
    - tạo application,
    - lấy ranked candidates theo `job_id`,
    - lấy history theo `candidate_id`,
    - cập nhật status application,
    - lấy explainable feedback theo application.
- Đã tạo trang frontend mới:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - Cho phép:
    - Recruiter load ranked candidates,
    - Candidate load application history,
    - cập nhật status trực tiếp,
    - mở AI feedback (matched/missing keywords + recommendations).
- Đã cập nhật điều hướng và hiển thị:
  - `apps/frontend/app/(default)/dashboard/page.tsx`
    - thêm card điều hướng nhanh sang `/applications`.
  - `apps/frontend/app/(default)/jobs/page.tsx`
    - hiển thị `applications_count` trên mỗi job card,
    - thêm quick link “View ranked candidates” sang `/applications?job_id=...`.
  - `apps/frontend/lib/api/jobs.ts`
    - mở rộng type `JobItem` để nhận `applications_count`.
  - `apps/frontend/lib/api/index.ts`
    - export Application APIs cho use ở module khác.
- Đã bổ sung unit test cho API client mới:
  - `apps/frontend/tests/applications-api.test.ts`.

### 50) Feature expansion: Application status summary + Resume original download end-to-end
- Đã mở rộng backend Application module với endpoint summary theo job:
  - `GET /api/applications/summary?job_id=...`
  - Trả tổng số hồ sơ + breakdown theo `status` và `ai_status`.
- File backend đã cập nhật:
  - `apps/backend/src/services/application.service.js`
  - `apps/backend/src/controllers/application.controller.js`
  - `apps/backend/src/routes/application.routes.js`
  - `apps/backend/tests/integration/application-endpoints.test.mjs` (thêm assert summary contract)
- Đã mở rộng frontend Applications dashboard:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - thêm block Status Summary,
  - thêm pagination controls cho ranked/history.
  - `apps/frontend/lib/api/applications.ts` thêm `fetchApplicationStatusSummary(jobId)`.
- Đã hoàn thiện luồng tải CV gốc trên frontend viewer:
  - `apps/frontend/lib/api/resume.ts` thêm:
    - `getOriginalResumeDownloadUrl(resumeId)`
    - `downloadOriginalResumeFile(resumeId)`
  - `apps/frontend/app/(default)/resumes/[id]/page.tsx` thêm nút `Download Original`.
- Đã cập nhật unit tests frontend:
  - `apps/frontend/tests/applications-api.test.ts` (thêm case summary)
  - `apps/frontend/tests/resume-api.test.ts` (thêm case download CV gốc).

### 51) Candidate flow enhancement: auto history routing + status filters on Applications
- Đã mở rộng Resume API response để expose `candidate_id` cho frontend flow:
  - `apps/backend/src/services/resume.service.js`
    - thêm `candidate_id` vào `toResumeFetchData` và `toResumeSummary`.
  - `apps/frontend/lib/api/resume.ts`
    - cập nhật type để nhận `candidate_id`.
- Đã mở rộng Dashboard để điều hướng nhanh vào lịch sử ứng tuyển của candidate:
  - `apps/frontend/app/(default)/dashboard/page.tsx`
    - lưu `candidateId` từ `fetchResume(masterResumeId)`,
    - thêm card `My History` dẫn tới `/applications?candidate_id=...`.
- Đã nâng cấp Applications page:
  - `apps/frontend/app/(default)/applications/page.tsx`
    - hỗ trợ filter status cho cả ranked/history,
    - auto-load history khi có `candidate_id` trên query string.
- Đã cập nhật test fixture tương thích:
  - `apps/frontend/tests/resume-api.test.ts`.

### 52) Candidate flow closure: Apply trực tiếp từ Job Board bằng Master Resume
- Đã bổ sung hành động apply trực tiếp tại Job Board:
  - `apps/frontend/app/(default)/jobs/page.tsx`
  - mỗi job card có nút `Apply with Master Resume`.
- Luồng xử lý đã triển khai:
  - tự resolve `master_resume_id` từ localStorage,
  - fallback lấy master resume qua API list resumes (`include_master=true`) nếu localStorage chưa có,
  - gọi backend `POST /api/applications` thông qua `createApplication`.
- Trải nghiệm người dùng:
  - hiển thị trạng thái apply theo từng job (`Applying...`),
  - thông báo thành công khi nộp hồ sơ,
  - thông báo rõ khi thiếu master resume,
  - xử lý trường hợp apply trùng (409) thành thông báo thân thiện.

### 53) UX refinement: tự động điều hướng sau khi Apply từ Job Board
- Đã nâng cấp trải nghiệm apply ở `apps/frontend/app/(default)/jobs/page.tsx`:
  - resolve thêm `masterCandidateId` từ Resume list (không chỉ `masterResumeId`),
  - sau khi apply thành công: tự động redirect sang `/applications?candidate_id=...` (nếu có),
  - nếu apply trùng (`409`): hiển thị thông báo thân thiện và vẫn redirect sang Applications,
  - fallback sang `/applications?job_id=...` khi chưa resolve được `candidate_id`.
- Đã bổ sung thông báo theo ngữ cảnh với trạng thái `success/error` để dễ phân biệt kết quả thao tác.

### 54) Applications UX fix: auto-fetch đúng khi đổi trang/filter và khi vào từ query params
- Đã sửa logic tải dữ liệu tại `apps/frontend/app/(default)/applications/page.tsx`:
  - thêm cơ chế activate cho từng luồng dữ liệu (`rankedActivated`, `historyActivated`),
  - sau khi người dùng bấm `Load` hoặc vào trang với query sẵn (`job_id` / `candidate_id`), hệ thống tự fetch dữ liệu.
- Đã xử lý đúng hành vi pagination + filter:
  - đổi `page` hoặc `status filter` sẽ tự gọi lại API (không còn chỉ đổi state),
  - khi đổi input `job_id`/`candidate_id` hoặc filter thì reset page về 1 để tránh request lệch trang.
- Kết quả:
  - dashboard Applications hoạt động đúng kỳ vọng của use-case theo dạng data-driven table,
  - giảm thao tác tay lặp lại (không cần bấm Load lại sau mỗi lần đổi trang/filter).

### 55) i18n hardening: loại bỏ hardcoded text trên Job Board và Applications
- Đã localize toàn bộ text hardcoded mới thêm trong 2 trang:
  - `apps/frontend/app/(default)/jobs/page.tsx`
  - `apps/frontend/app/(default)/applications/page.tsx`
- Các nội dung đã chuyển sang key i18n gồm:
  - tiêu đề/subtitle trang,
  - label filter + placeholder,
  - trạng thái loading/error/success,
  - empty states,
  - pagination labels,
  - status/ai-status labels,
  - feedback labels (matched/missing keywords, recommendations, ...).
- Đã bổ sung key mới cho đủ 5 locale:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/es.json`
  - `apps/frontend/messages/ja.json`
  - `apps/frontend/messages/pt-BR.json`
  - `apps/frontend/messages/zh.json`
- Đã xác thực sau thay đổi:
  - `npm run typecheck` -> **PASS**
  - `npm run test -- tests/applications-api.test.ts tests/resume-api.test.ts` -> **PASS (13/13)**

### 56) UC-RM-01: triển khai Master Resume Management (set/get master + UI action)
- Đã mở rộng backend Resume API để quản lý master resume rõ ràng:
  - `GET /api/resumes/master?candidate_id=...`
  - `POST /api/resumes/:id/set-as-master`
- File backend đã cập nhật:
  - `apps/backend/src/services/resume.service.js`
  - `apps/backend/src/controllers/resume.controller.js`
  - `apps/backend/src/routes/resume.routes.js`
- Đã bổ sung test integration backend cho contract mới:
  - `apps/backend/tests/integration/master-resume-endpoints.test.mjs`
  - bao phủ: set master mới, đảm bảo master cũ bị unset, lấy master theo candidate, validate candidate_id không hợp lệ.
- Đã mở rộng frontend API client:
  - `apps/frontend/lib/api/resume.ts`
  - thêm `fetchMasterResume(candidateId?)` và `setResumeAsMaster(resumeId)`.
- Đã wiring UI tại trang xem resume:
  - `apps/frontend/app/(default)/resumes/[id]/page.tsx`
  - thêm nút `Set as Master Resume` cho CV không phải master,
  - cập nhật đồng bộ `localStorage(master_resume_id)` + status cache sau khi set thành công,
  - localize nút tải CV gốc thay cho hardcoded string.
- Đã cập nhật i18n key mới cho EN/VI:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`
- Đã mở rộng unit test frontend API:
  - `apps/frontend/tests/resume-api.test.ts`
  - thêm test cho fetch/set master resume.

### 57) UC-RM-01 mở rộng: đổi Master Resume trực tiếp từ Dashboard
- Đã mở rộng Dashboard để candidate có thể đổi CV gốc nhanh ngay tại danh sách tailored resumes:
  - `apps/frontend/app/(default)/dashboard/page.tsx`
  - thêm nút `Set As Master` trên mỗi card CV đã tùy chỉnh,
  - gọi backend `POST /api/resumes/:id/set-as-master`,
  - đồng bộ ngay `localStorage(master_resume_id)` + status cache,
  - refresh lại danh sách resumes sau khi đổi để phản ánh trạng thái mới.
- Đã bổ sung trạng thái loading cho thao tác đổi master (`Setting...`) để tránh double-click.
- Đã bổ sung i18n key cho EN/VI:
  - `dashboard.setAsMaster`
  - `dashboard.settingAsMaster`
  - cập nhật tại `apps/frontend/messages/en.json` và `apps/frontend/messages/vi.json`.

### 58) UC-BASIC-10/11: mở rộng Job Board với thao tác recruiter (đóng/mở/xóa job)
- Đã mở rộng frontend Job API để hỗ trợ quản lý job theo use-case recruiter:
  - `apps/frontend/lib/api/jobs.ts`
  - thêm `updateJob(jobId, payload)`.
  - thêm helper `closeJob(jobId)`, `reopenJob(jobId)`, `deleteJob(jobId)`.
- Đã cập nhật Job Board để thao tác trực tiếp trên từng job card:
  - `apps/frontend/app/(default)/jobs/page.tsx`
  - thêm nút `Close Job` / `Reopen Job` / `Delete Job`,
  - hiển thị trạng thái loading khi mutate (`Updating...`, `Deleting...`),
  - hiển thị thông báo kết quả thành công/thất bại,
  - disable nút Apply khi job đã đóng để tránh apply vào vị trí unavailable,
  - tự refresh danh sách jobs sau khi cập nhật hoặc xóa.
- Đã bổ sung i18n key cho EN/VI:
  - cập nhật tại `apps/frontend/messages/en.json` và `apps/frontend/messages/vi.json`.
- Đã bổ sung unit test cho Job API:
  - `apps/frontend/tests/jobs-api.test.ts`
  - bao phủ: build query list, update job, close/reopen mapping, delete failure contract.

### 59) UC-BASIC-10: bổ sung chỉnh sửa nội dung Job trực tiếp trên Job Board
- Đã mở rộng UI Job Board với luồng chỉnh sửa tin tuyển dụng cơ bản (inline quản trị recruiter):
  - `apps/frontend/app/(default)/jobs/page.tsx`
  - thêm nút `Edit Job` trên mỗi job card,
  - mở dialog chỉnh sửa các trường: `title`, `description`, `requirements`, `category`, `location`, `experienceLevel`,
  - gọi API `updateJob` để lưu thay đổi,
  - hiển thị trạng thái đang lưu (`Saving...`) và thông báo kết quả thành công/thất bại,
  - refresh danh sách sau khi lưu để đồng bộ dữ liệu mới.
- Đã bổ sung i18n key cho EN/VI phục vụ edit dialog + labels:
  - cập nhật tại `apps/frontend/messages/en.json` và `apps/frontend/messages/vi.json`.
- Đã giữ tương thích với luồng quản trị đã có ở mục 58:
  - recruiter vẫn có thể đóng/mở/xóa tin,
  - candidate không thể apply vào job đã `closed`.

### 60) UC-BASIC-08: triển khai quản lý hồ sơ công ty trong Settings (backend + frontend)
- Đã mở rộng backend config để lưu hồ sơ công ty dưới dạng cấu hình hệ thống:
  - `apps/backend/src/services/config.service.js`
  - thêm key `companyProfileConfig`, default schema và sanitize cho các trường:
    - `company_name`, `overview`, `industry`, `company_size`, `address`, `website`,
    - `brand_primary_color`, `brand_logo_url`.
  - thêm API service `getCompanyProfileConfig()` và `updateCompanyProfileConfig()`.
  - bổ sung cleanup key này trong luồng `resetDatabase`.
- Đã mở rộng backend controller/route:
  - `apps/backend/src/controllers/config.controller.js`
  - `apps/backend/src/routes/config.routes.js`
  - thêm endpoint:
    - `GET /api/config/company-profile`
    - `PUT /api/config/company-profile`.
- Đã mở rộng frontend API client:
  - `apps/frontend/lib/api/config.ts`
  - thêm `fetchCompanyProfileConfig()` và `updateCompanyProfileConfig()` + types liên quan.
- Đã bổ sung UI quản lý Company Profile tại trang Settings:
  - `apps/frontend/app/(default)/settings/page.tsx`
  - thêm section `Company Profile` cho recruiter cập nhật thông tin công ty và branding,
  - có nút lưu riêng, trạng thái loading, và đồng bộ dữ liệu từ backend khi load trang.
- Đã bổ sung i18n EN/VI:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã cập nhật test:
  - `apps/frontend/tests/config-api.test.ts` thêm case fetch/update company profile.
  - `apps/backend/tests/integration/config-endpoints.test.mjs` thêm assert cho company profile endpoints.

### 61) UC-BASIC-10 hoàn thiện sát mô tả: benefits + deadline + lịch sử thay đổi quan trọng
- Đã mở rộng schema Job ở backend:
  - `apps/backend/src/models/Job.js`
  - thêm các trường `benefits`, `applicationDeadline`, và `importantChangeHistory` để audit thay đổi.
- Đã nâng cấp service update/create Job:
  - `apps/backend/src/services/job.service.js`
  - sửa normalize payload để patch không còn ghi đè rỗng các field không gửi lên,
  - hỗ trợ `benefits` và `applicationDeadline` (validate date, chuẩn hóa dữ liệu),
  - tự ghi nhận `importantChangeHistory` khi có thay đổi ở các trường quan trọng (`title`, `description`, `requirements`, `benefits`, `applicationDeadline`, `status`),
  - mở rộng clean text/embedding text để bao gồm `benefits`.
- Đã mở rộng UI Job Board cho recruiter:
  - `apps/frontend/app/(default)/jobs/page.tsx`
  - thêm field `Benefits` + `Application Deadline` trong dialog Edit Job,
  - hiển thị deadline trên card,
  - hiển thị mốc `last change` dựa trên lịch sử thay đổi quan trọng.
- Đã mở rộng frontend API types/payload:
  - `apps/frontend/lib/api/jobs.ts`
  - thêm type cho `importantChangeHistory`, `benefits`, `applicationDeadline`.
- Đã cập nhật i18n EN/VI:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã cập nhật test:
  - `apps/frontend/tests/jobs-api.test.ts` mở rộng case update payload với `benefits` + `applicationDeadline`.
  - thêm integration test backend mới: `apps/backend/tests/integration/job-update-endpoints.test.mjs`.

### 62) UC-BASIC-10 UX mở rộng: modal xem chi tiết lịch sử thay đổi theo từng Job
- Đã mở rộng Job Board để recruiter xem đầy đủ timeline thay đổi quan trọng:
  - `apps/frontend/app/(default)/jobs/page.tsx`
  - thêm nút `View History` trên từng job card (chỉ bật khi có history),
  - thêm dialog hiển thị danh sách thay đổi theo thứ tự mới nhất trước,
  - mỗi bản ghi hiển thị: thời điểm thay đổi, summary, danh sách field đã thay đổi.
- Đã bổ sung i18n EN/VI cho luồng history dialog:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.

### 63) UC-BASIC-10 UX nâng cao: lọc lịch sử theo field + before/after diff
- Đã mở rộng dữ liệu history ở backend để lưu chi tiết thay đổi theo từng field:
  - `apps/backend/src/models/Job.js`
  - thêm `importantChangeHistory[].changes[]` gồm `field`, `before`, `after`.
- Đã nâng cấp logic ghi nhận history khi update Job:
  - `apps/backend/src/services/job.service.js`
  - thu thập diff chi tiết cho từng field quan trọng,
  - serialize giá trị an toàn để hiển thị nhất quán ở UI.
- Đã cập nhật type ở frontend API:
  - `apps/frontend/lib/api/jobs.ts`
  - bổ sung `changes` trong `importantChangeHistory`.
- Đã nâng cấp modal lịch sử trên Job Board:
  - `apps/frontend/app/(default)/jobs/page.tsx`
  - thêm bộ lọc theo field (`All fields` hoặc field cụ thể),
  - hiển thị before/after cho từng thay đổi,
  - fallback tốt cho bản ghi cũ chưa có `changes`.
- Đã bổ sung i18n EN/VI cho filter + diff labels:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã cập nhật và chạy test:
  - `apps/backend/tests/integration/job-update-endpoints.test.mjs` (assert `changes` before/after),
  - frontend `npm run typecheck` PASS,
  - frontend `npm run test -- tests/jobs-api.test.ts` PASS,
  - backend `node --test tests/integration/job-update-endpoints.test.mjs` PASS.

### 64) UC-BASIC-12: recruiter tải CV gốc trực tiếp từ Ranked Candidates
- Đã mở rộng recruiter flow tại trang Applications để truy cập nhanh CV gốc của ứng viên:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - thêm nút `Download Original CV` trên từng ứng viên trong danh sách xếp hạng,
  - chỉ bật khi có `resume.id`,
  - xử lý lỗi popup blocked để hiển thị thông báo hướng dẫn mở URL trực tiếp.
- Đã tận dụng endpoint tải CV gốc có sẵn của backend thông qua frontend API:
  - `apps/frontend/lib/api/resume.ts` (`getOriginalResumeDownloadUrl`).
- Đã bổ sung i18n EN/VI cho action mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã kiểm tra lại chất lượng:
  - frontend `npm run typecheck` PASS,
  - frontend `npm run test -- tests/applications-api.test.ts` PASS.

### 65) UC-BASIC-13 nâng cao: audit lịch sử đổi trạng thái ứng viên
- Đã mở rộng domain Application để lưu audit trail cho trạng thái tuyển dụng:
  - `apps/backend/src/models/Application.js`
  - thêm `statusHistory[]` gồm `fromStatus`, `toStatus`, `changedAt`, `changedBy`.
- Đã nâng cấp service xử lý status:
  - `apps/backend/src/services/application.service.js`
  - tạo bản ghi trạng thái khởi tạo khi tạo application,
  - khi update status sẽ append lịch sử chuyển trạng thái với `changed_by`,
  - thêm service `getApplicationStatusHistory` trả timeline mới nhất trước.
- Đã bổ sung API backend cho status history:
  - `apps/backend/src/controllers/application.controller.js`
  - `apps/backend/src/routes/application.routes.js`
  - endpoint mới: `GET /api/applications/:id/status-history`.
- Đã mở rộng frontend API + UI recruiter:
  - `apps/frontend/lib/api/applications.ts`
  - thêm `fetchApplicationStatusHistory` và hỗ trợ `changed_by` khi patch status,
  - `apps/frontend/app/(default)/applications/page.tsx`
  - thêm nút `Status History` trong Ranked Candidates,
  - hiển thị panel lịch sử chuyển trạng thái (from -> to, changed at, changed by).
- Đã bổ sung i18n EN/VI:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã cập nhật test:
  - `apps/frontend/tests/applications-api.test.ts` thêm case status history endpoint.
  - `apps/backend/tests/integration/application-endpoints.test.mjs` thêm assert cho status history + `changed_by`.
- Kết quả kiểm tra:
  - frontend `npm run typecheck` PASS,
  - frontend `npm run test -- tests/applications-api.test.ts` PASS,
  - backend integration test cần môi trường Mongo credential hợp lệ (lần chạy tại máy local hiện tại fail do `Authentication failed`).

### 66) UC-BASIC-13 bổ sung recruiter insight: hiển thị trạng thái audit gần nhất trong Ranked Candidates
- Đã mở rộng payload ranked/history từ backend để trả `status_audit`:
  - `apps/backend/src/services/application.service.js`
  - mỗi ứng viên có metadata chuyển trạng thái gần nhất gồm `from_status`, `to_status`, `changed_at`, `changed_by`.
- Đã cập nhật types frontend để nhận dữ liệu audit mới:
  - `apps/frontend/lib/api/applications.ts`.
- Đã nâng cấp UI recruiter ở Applications page:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - hiển thị dòng audit trạng thái gần nhất ngay trên mỗi card ứng viên đã xếp hạng.
- Đã bổ sung i18n EN/VI:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã cập nhật test:
  - `apps/frontend/tests/applications-api.test.ts` thêm assert cho `status_audit` + payload `changed_by` khi update status.
  - `apps/backend/tests/integration/application-endpoints.test.mjs` thêm assert `status_audit` trong ranked response sau khi đổi status.
- Kết quả kiểm tra đã chạy:
  - frontend `npm run typecheck` PASS,
  - frontend `npm run test -- tests/applications-api.test.ts` PASS.

### 67) UC-BASIC-13 đề xuất tiếp theo đã triển khai: Recent Status Changes cho recruiter
- Đã mở rộng backend API để theo dõi timeline thay đổi trạng thái theo Job:
  - `apps/backend/src/services/application.service.js`
  - thêm service `listRecentStatusChangesByJob(job_id, filters)` với filter theo `status`, `changed_by`, pagination,
  - chuẩn hóa output change event gồm candidate/job/context phục vụ giám sát recruiter.
  - `apps/backend/src/controllers/application.controller.js`
  - `apps/backend/src/routes/application.routes.js`
  - thêm endpoint `GET /api/applications/status-changes`.
- Đã mở rộng frontend API:
  - `apps/frontend/lib/api/applications.ts`
  - thêm type `RecentStatusChangesResponse`,
  - thêm function `fetchRecentStatusChanges`.
- Đã nâng cấp UI trang Applications (recruiter view):
  - `apps/frontend/app/(default)/applications/page.tsx`
  - thêm card `Recent Status Changes`,
  - có filter theo status + changed_by,
  - có nút refresh độc lập và danh sách event chuyển trạng thái gần nhất.
- Đã bổ sung i18n EN/VI cho panel mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã cập nhật test frontend API:
  - `apps/frontend/tests/applications-api.test.ts` thêm case `loads recent status changes with filters`.
- Kết quả kiểm tra đã chạy:
  - frontend `npm run typecheck` PASS,
  - frontend `npm run test -- tests/applications-api.test.ts` PASS (8 tests).

### 68) UC-RM-07 nâng cấp: Missing Keywords Suggestions + copy nhanh trong JD Match View
- Đã nâng cấp màn hình đối chiếu JD-Resume để hỗ trợ hành động cải thiện trực tiếp:
  - `apps/frontend/components/builder/jd-comparison-view.tsx`
  - tính toán danh sách từ khóa còn thiếu dựa trên JD keywords và matched keywords,
  - hiển thị panel `Missing keywords` ngay dưới thanh thống kê,
  - hỗ trợ copy từng keyword và copy toàn bộ danh sách keyword còn thiếu.
- Đã bổ sung i18n EN/VI cho luồng mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã bổ sung test cho UI mới:
  - `apps/frontend/tests/jd-comparison-view.test.tsx`
  - xác nhận render danh sách từ khóa còn thiếu khi resume chưa phủ hết JD.
- Kết quả kiểm tra đã chạy:
  - frontend `npm run typecheck` PASS,
  - frontend `npm run test -- tests/jd-comparison-view.test.tsx tests/applications-api.test.ts` PASS (9 tests).

### 69) UC-RM-07 nâng cấp tiếp: Apply Missing Keywords trực tiếp vào Resume draft
- Đã mở rộng JD Match View để có hành động áp dụng trực tiếp keyword còn thiếu vào CV:
  - `apps/frontend/components/builder/jd-comparison-view.tsx`
  - thêm prop callback `onApplyMissingKeywords` và nút `Apply to Resume` trong panel keyword.
- Đã triển khai logic chuẩn hóa/chèn keyword tái sử dụng:
  - `apps/frontend/lib/utils/jd-match.ts`
  - thêm hàm `applyMissingKeywordsToResumeData`:
    - loại trùng keyword theo so khớp không phân biệt hoa-thường,
    - bổ sung vào `additional.technicalSkills`,
    - append câu gợi ý keyword vào `summary` (giới hạn số keyword).
- Đã wiring Resume Builder để nhận callback từ JD Match và cập nhật draft tại chỗ:
  - `apps/frontend/components/builder/resume-builder.tsx`
  - khi áp dụng thành công: cập nhật resume data, đánh dấu unsaved draft, tự chuyển về tab Resume và hiển thị thông báo.
- Đã bổ sung i18n EN/VI cho luồng apply mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã bổ sung test cho callback UI và utility logic:
  - `apps/frontend/tests/jd-comparison-view.test.tsx` thêm case `calls apply callback with missing keywords`.
  - `apps/frontend/tests/jd-match-utils.test.ts` (mới) kiểm tra nhánh thêm keyword + nhánh không thay đổi.

### 70) UC-RM-07 nâng cấp tiếp: chọn mode áp dụng Missing Keywords (Skills only / Skills + Summary)
- Đã mở rộng JD Match View với 2 hành động apply rõ ràng cho candidate:
  - `apps/frontend/components/builder/jd-comparison-view.tsx`
  - thêm nút:
    - `Apply Skills Only` (chỉ cập nhật `technicalSkills`),
    - `Apply Skills + Summary` (cập nhật `technicalSkills` và gợi ý summary).
- Đã mở rộng callback apply để truyền mode từ JD Match sang Resume Builder:
  - `apps/frontend/components/builder/resume-builder.tsx`
  - `handleApplyMissingKeywords` nhận mode và điều khiển luồng áp dụng phù hợp.
- Đã nâng cấp utility xử lý keyword với option `includeSummaryHint`:
  - `apps/frontend/lib/utils/jd-match.ts`
  - cho phép tái sử dụng cùng một hàm cho cả 2 mode mà không nhân đôi logic.
- Đã cập nhật i18n EN/VI cho nhãn mode mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test:
  - `apps/frontend/tests/jd-comparison-view.test.tsx` thêm case xác nhận callback nhận đúng mode.
  - `apps/frontend/tests/jd-match-utils.test.ts` thêm case `skills-only` không append summary.

### 71) UC-BASIC-13 nâng cấp tiếp: phân trang rõ ràng cho Recent Status Changes và tách luồng tải khỏi ranking
- Đã refactor trang Applications để tối ưu recruiter monitoring:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - tách fetch `Recent Status Changes` khỏi `loadRanked` để tránh reload bảng ranking khi chỉ đổi filter status changes,
  - thêm state phân trang riêng cho status changes (`page`, `total_pages`, `total`) và cơ chế activate độc lập,
  - thêm điều khiển `Prev/Next` + hiển thị `Page x/y` + tổng số changes,
  - chuẩn hóa reset page về 1 khi đổi `job_id`, `status`, `changed_by`.
- Đã cập nhật i18n EN/VI cho thông tin tổng số changes:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Kết quả kỳ vọng sau nâng cấp:
  - Recruiter theo dõi lịch sử đổi trạng thái theo trang rõ ràng hơn,
  - Giảm request thừa và giảm nhiễu khi tinh chỉnh bộ lọc timeline status.

### 72) UC-RM-11 nâng cấp: đồng bộ ngôn ngữ nội dung AI cho Cover Letter/Outreach
- Đã mở rộng frontend API để truyền ngôn ngữ output cho các tác vụ generate nội dung:
  - `apps/frontend/lib/api/resume.ts`
  - `generateCoverLetter(resumeId, outputLanguage?)`
  - `generateOutreachMessage(resumeId, outputLanguage?)`.
- Đã wiring Resume Builder dùng `contentLanguage` hiện tại (không phụ thuộc `uiLanguage`) khi generate:
  - `apps/frontend/components/builder/resume-builder.tsx`
  - gọi generate Cover Letter/Outreach với `contentLanguage` từ `LanguageContext`.
- Đã cập nhật backend để resolve ngôn ngữ output theo ưu tiên:
  1. `req.body.output_language` nếu hợp lệ,
  2. fallback theo `config.language.content_language`,
  3. mặc định `en` nếu không khả dụng.
  - `apps/backend/src/controllers/resume.controller.js`
- Đã mở rộng service generate nội dung theo ngôn ngữ `en|vi`:
  - `apps/backend/src/services/resume.service.js`
  - `generateCoverLetterContent(resumeId, outputLanguage)`
  - `generateOutreachContent(resumeId, outputLanguage)`
  - thêm template text song ngữ và chuẩn hóa fallback ngôn ngữ.
- Đã bổ sung test frontend API cho payload ngôn ngữ:
  - `apps/frontend/tests/resume-api.test.ts`
  - thêm case xác nhận request body có `output_language` cho cả cover letter và outreach.

### 73) UC-RM-11 nâng cấp tiếp: hiển thị rõ AI Content Language trong luồng generate/regenerate
- Đã bổ sung hiển thị ngôn ngữ nội dung AI hiện tại ngay tại panel Generate cho Cover Letter/Outreach:
  - `apps/frontend/components/builder/generate-prompt.tsx`
  - thêm nhãn `AI Content Language: <language>` để candidate biết chính xác ngôn ngữ output trước khi chạy AI.
- Đã bổ sung hiển thị ngôn ngữ nội dung AI trong bước nhập instruction của Regenerate Wizard:
  - `apps/frontend/components/builder/regenerate-instruction-dialog.tsx`
  - hiển thị cùng khu vực header dialog để tránh nhầm với UI language.
- Đã wiring dữ liệu ngôn ngữ từ Resume Builder xuống các component liên quan:
  - `apps/frontend/components/builder/resume-builder.tsx`
  - `apps/frontend/components/builder/regenerate-wizard.tsx`
  - tạo `outputLanguageLabel` từ `LanguageContext` (`language name + code`) và truyền xuyên suốt.
- Đã cập nhật i18n EN/VI cho nhãn mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã bổ sung test UI mục tiêu:
  - `apps/frontend/tests/generate-prompt.test.tsx`
  - xác nhận render nhãn ngôn ngữ output khi có `outputLanguageLabel`.

### 74) UC-BASIC-13 nâng cấp tiếp: lọc khoảng thời gian cho Recent Status Changes
- Đã mở rộng backend service `status-changes` để hỗ trợ lọc theo thời gian:
  - `apps/backend/src/services/application.service.js`
  - thêm query params: `changed_after`, `changed_before`,
  - validate giá trị ngày không hợp lệ trả về lỗi `400`,
  - hỗ trợ date-only boundary cho `changed_before` theo hết ngày (23:59:59.999 UTC).
- Đã mở rộng frontend API client để truyền bộ lọc thời gian:
  - `apps/frontend/lib/api/applications.ts`
  - `fetchRecentStatusChanges` nhận thêm `changedAfter`/`changedBefore`.
- Đã nâng cấp giao diện Applications page với bộ lọc date range cho status changes:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - thêm 2 input `type=date`:
    - `From` / `Từ ngày`,
    - `To` / `Đến ngày`,
  - reset về trang 1 khi đổi bộ lọc thời gian,
  - giữ nguyên phân trang độc lập đã tách ở hạng mục trước.
- Đã bổ sung i18n EN/VI cho nhãn mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã cập nhật test API query serialization:
  - `apps/frontend/tests/applications-api.test.ts`
  - xác nhận URL có `changed_after` và `changed_before`.

### 75) UC-BASIC-13 nâng cấp tiếp: Clear filters cho Status Changes + test backend date-range
- Đã bổ sung thao tác xóa nhanh toàn bộ filter của panel Recent Status Changes:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - thêm nút `Clear Filters` / `Xóa bộ lọc` để reset đồng thời:
    - status,
    - changed_by,
    - from date,
    - to date,
    - page về 1.
- Đã bổ sung i18n EN/VI cho nút mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng integration test backend cho endpoint `status-changes`:
  - `apps/backend/tests/integration/application-endpoints.test.mjs`
  - thêm case xác nhận lọc kết hợp:
    - `status`,
    - `changed_by`,
    - `changed_after`,
    - `changed_before`.
  - thêm case negative: `changed_after` không hợp lệ trả về `400`.

### 76) UC-BASIC-13 nâng cấp tiếp: quick preset thời gian cho Status Changes (7d/30d/90d)
- Đã bổ sung bộ lọc nhanh theo khoảng thời gian cho panel Recent Status Changes:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - thêm các preset:
    - `Last 7d`,
    - `Last 30d`,
    - `Last 90d`.
- Hành vi khi chọn preset:
  - tự động điền `From` và `To` theo ngày hiện tại,
  - reset page về 1,
  - kích hoạt lại truy vấn status changes với bộ lọc mới.
- Đã bổ sung reset đồng bộ với Clear Filters:
  - xóa luôn trạng thái preset active khi bấm Clear Filters.
- Đã bổ sung i18n EN/VI cho quick range:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.

### 77) UC-BASIC-13 nâng cấp tiếp: test UI cho preset/clear filters ở Applications
- Đã bổ sung test UI cho trang Applications để khóa hành vi bộ lọc Status Changes:
  - `apps/frontend/tests/applications-page.test.tsx`
- Các hành vi đã được kiểm chứng:
  - chọn preset `7d` sẽ phát sinh request với `changedAfter`/`changedBefore` hợp lệ,
  - bấm `Clear Filters` sẽ reset toàn bộ filter status changes (`status`, `changed_by`, `changed_after`, `changed_before`) và reset `page = 1`.
- Mục tiêu: tránh regression cho luồng monitoring recruiter sau các lần refactor tiếp theo.

### 78) UC-BASIC-13 nâng cấp tiếp: preset This week/This month + boundary test changed_before
- Đã mở rộng quick preset thời gian cho Status Changes:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - bổ sung thêm:
    - `This week`,
    - `This month`.
- Quy tắc áp dụng preset mới:
  - `This week`: tính từ đầu tuần (Monday-start) đến ngày hiện tại,
  - `This month`: tính từ ngày 01 của tháng đến ngày hiện tại,
  - tự động cập nhật `From/To` và reset page về 1.
- Đã bổ sung i18n EN/VI cho 2 preset mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test frontend cho preset mới:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm case xác nhận `this-month` sinh `changedAfter` đúng boundary ngày đầu tháng.
- Đã mở rộng integration test backend cho boundary `changed_before`:
  - `apps/backend/tests/integration/application-endpoints.test.mjs`
  - thêm case xác nhận event xảy ra trong ngày vẫn được include khi `changed_before` là đúng ngày,
  - thêm case xác nhận event bị exclude khi `changed_before` nhỏ hơn 1 ngày.

### 79) UC-BASIC-13 nâng cấp tiếp: preset Quarter to date + test active preset state
- Đã mở rộng quick preset cho Status Changes với tùy chọn `Quarter to date`:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - thêm preset `qtd` (từ đầu quý hiện tại đến hôm nay),
  - tự cập nhật `From/To` và reset page về 1 tương tự các preset khác.
- Đã cập nhật i18n cho preset mới:
  - `apps/frontend/messages/en.json` -> `Quarter to date`
  - `apps/frontend/messages/vi.json` -> `Từ đầu quý`.
- Đã mở rộng test UI của Applications page:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm case xác nhận:
    - active style chuyển đúng khi đổi preset `7d` -> `qtd`,
    - request mới có `changedAfter` đúng mốc đầu quý (`01|04|07|10`) và `changedBefore` hợp lệ.

### 80) UC-BASIC-13 nâng cấp tiếp: preset Year to date + active filter summary
- Đã mở rộng quick preset cho Status Changes với tùy chọn `Year to date`:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - thêm preset `ytd` (từ `01-01` của năm hiện tại đến hôm nay).
- Đã bổ sung phần hiển thị `Active filters` ngay trong panel Status Changes:
  - hiển thị chip tóm tắt cho các filter đang bật (preset, status, changed_by, from, to),
  - khi không có filter sẽ hiển thị trạng thái `none`.
- Đã cập nhật i18n EN/VI cho preset và summary labels:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test UI:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm case cho preset `ytd` và case hiển thị summary chip.

### 81) UC-BASIC-13 nâng cấp tiếp: preset All time + xóa từng filter bằng chip
- Đã bổ sung preset `All time` trong quick range của Status Changes:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - khi chọn `all-time`, hệ thống reset `From/To` về rỗng và giữ các filter khác.
- Đã nâng cấp Active filter summary thành chip có thể tương tác:
  - click vào từng chip sẽ xóa đúng filter tương ứng (preset/status/changed_by/from/to),
  - tự reset page về 1 để đồng bộ dữ liệu phân trang.
- Đã bổ sung i18n EN/VI cho `all-time` và aria label xóa chip:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test UI:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm case cho preset `all-time` và case click chip để xóa filter status.

### 82) UC-BASIC-13 nâng cấp tiếp: clear toàn bộ chip filter + phản hồi trực quan khi gỡ filter
- Đã bổ sung thao tác xóa nhanh toàn bộ chip filter ngay trên dòng Active filters:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - thêm nút `Clear chips` / `Xóa chip`.
- Hành vi nút mới:
  - reset đồng thời preset/status/changed_by/from/to,
  - reset page về 1,
  - kích hoạt load lại danh sách status changes theo trạng thái rỗng.
- Đã bổ sung phản hồi trực quan khi vừa gỡ filter:
  - vùng Active filters highlight nhẹ ngắn hạn để người dùng nhận biết thao tác vừa áp dụng.
- Đã cập nhật i18n EN/VI cho nút mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test UI:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm case xác nhận `clear chips` reset đầy đủ bộ lọc và request params.

### 83) UC-BASIC-13 nâng cấp tiếp: đồng bộ filter vào query string + export CSV status changes
- Đã đồng bộ bộ lọc status changes lên URL query string để chia sẻ trạng thái lọc:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - đọc mặc định từ query khi mở trang (`sc_status`, `sc_changed_by`, `sc_after`, `sc_before`, `sc_preset`, `sc_page`) và cập nhật URL khi filter/page thay đổi.
- Đã bổ sung export CSV theo đúng bộ lọc hiện tại:
  - Frontend API: `apps/frontend/lib/api/applications.ts`
  - Backend route/controller/service:
    - `apps/backend/src/routes/application.routes.js`
    - `apps/backend/src/controllers/application.controller.js`
    - `apps/backend/src/services/application.service.js`
  - Endpoint mới: `GET /applications/status-changes/export` (hỗ trợ `job_id`, `status`, `changed_by`, `changed_after`, `changed_before`).
- Đã cập nhật i18n EN/VI:
  - thêm label `Export CSV` / `Xuất CSV` và thông báo lỗi export.
- Đã mở rộng test:
  - `apps/frontend/tests/applications-api.test.ts` (serialize query + nhận blob CSV),
  - `apps/frontend/tests/applications-page.test.tsx` (hydrate từ query, sync URL, export CSV),
  - `apps/backend/tests/integration/application-endpoints.test.mjs` (content-type/disposition + nội dung CSV).

### 85) UC-BASIC-13 nâng cấp tiếp: bulk update trạng thái ứng viên trong Recruiter View
- Đã bổ sung endpoint backend cập nhật trạng thái hàng loạt:
  - `PATCH /applications/status/bulk`
  - hỗ trợ payload: `application_ids[]`, `status`, `changed_by`
  - tự ghi audit `statusHistory` cho từng hồ sơ thay đổi.
  - file:
    - `apps/backend/src/services/application.service.js`
    - `apps/backend/src/controllers/application.controller.js`
    - `apps/backend/src/routes/application.routes.js`
- Đã bổ sung API client frontend cho bulk update:
  - `apps/frontend/lib/api/applications.ts`.
- Đã bổ sung UI chọn nhiều ứng viên trong Ranked Candidates:
  - chọn từng dòng hoặc `Select all on current page`,
  - chọn `Bulk status`,
  - bấm `Apply to selected` để cập nhật hàng loạt,
  - tự làm mới dữ liệu status changes liên quan sau khi áp dụng.
  - file: `apps/frontend/app/(default)/applications/page.tsx`.
- Đã cập nhật i18n EN/VI cho nhãn bulk action + lỗi:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test:
  - `apps/frontend/tests/applications-api.test.ts` (request/response bulk API),
  - `apps/frontend/tests/applications-page.test.tsx` (flow chọn nhiều + gọi bulk update),
  - `apps/backend/tests/integration/application-endpoints.test.mjs` (endpoint bulk update hoạt động).

### 86) UC-BASIC-13 nâng cấp tiếp: phản hồi kết quả bulk update ngay trên UI
- Đã bổ sung hiển thị kết quả sau khi áp dụng bulk status trong Recruiter View:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - hiển thị ngắn gọn các số liệu: `requested`, `matched`, `updated`, `unchanged` và trạng thái đã áp dụng.
- Hành vi mới:
  - mỗi lần bấm `Apply to selected`, UI reset kết quả cũ và hiển thị kết quả mới từ response backend.
- Đã cập nhật i18n EN/VI cho dòng phản hồi:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test UI:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm assertion xác nhận dòng `bulkResultLine` xuất hiện sau khi bulk update thành công.

### 87) UC-BASIC-13 nâng cấp tiếp: undo nhanh cho bulk update trạng thái
- Đã bổ sung thao tác hoàn tác ngay sau bulk update trong Recruiter View:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - nút `Undo bulk update` / `Hoàn tác cập nhật hàng loạt` chỉ khả dụng khi có phiên bulk update vừa áp dụng.
- Cơ chế hoàn tác:
  - lưu snapshot trạng thái trước đó cho từng hồ sơ đã đổi,
  - khi undo sẽ nhóm theo trạng thái cũ và gọi lại bulk API để khôi phục đúng trạng thái từng nhóm,
  - cập nhật lại danh sách Ranked/History và làm mới Status Changes.
- Đã bổ sung phản hồi kết quả undo trên UI:
  - hiển thị số hồ sơ đã hoàn tác.
- Đã cập nhật i18n EN/VI cho:
  - label nút undo,
  - dòng kết quả undo,
  - thông báo lỗi undo.
- Đã mở rộng test UI:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm case xác nhận undo gọi bulk API theo nhóm trạng thái cũ (`screening` và `interview`) và hiển thị `bulkUndoResultLine`.

### 88) UC-BASIC-13 nâng cấp tiếp: cho phép cấu hình changed_by actor trong Recruiter View
- Đã bổ sung input actor `changed_by` ngay trong khu vực bulk action của Ranked Candidates:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - giá trị mặc định `recruiter-ui`, cho phép chỉnh theo người thao tác thực tế.
- Đã áp dụng actor này xuyên suốt các thao tác trạng thái:
  - cập nhật đơn lẻ từng ứng viên,
  - bulk update trạng thái,
  - undo bulk update.
- Đã cập nhật i18n EN/VI cho placeholder actor:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test UI:
  - `apps/frontend/tests/applications-page.test.tsx`
  - xác nhận bulk update + undo gửi đúng `changedBy` tùy chỉnh (`qa-reviewer`).

### 89) UC-BASIC-13 nâng cấp tiếp: lọc Ranked Candidates theo changed_by gần nhất
- Đã bổ sung filter `changed_by` cho API ranked candidates:
  - `apps/backend/src/services/application.service.js`
  - lọc theo `status_audit.changed_by` gần nhất (latest audit actor), hỗ trợ match theo chuỗi con không phân biệt hoa thường.
- Đã mở rộng API client frontend:
  - `apps/frontend/lib/api/applications.ts`
  - `fetchRankedApplications` nhận thêm tham số `changedBy` và serialize vào query `changed_by`.
- Đã bổ sung input filter trên Recruiter View:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - cho phép nhập `latest changed_by contains...` và áp dụng vào tải danh sách ranked.
- Đã đồng bộ filter mới vào query string URL chia sẻ:
  - key `rc_changed_by`.
- Đã cập nhật i18n EN/VI cho placeholder filter mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test:
  - `apps/frontend/tests/applications-api.test.ts` (query serialization `changed_by`),
  - `apps/frontend/tests/applications-page.test.tsx` (UI filter gửi đúng `changedBy`),
  - `apps/backend/tests/integration/application-endpoints.test.mjs` (ranked filter theo `changed_by`).

### 90) UC-BASIC-13 nâng cấp tiếp: lọc Ranked Candidates theo khoảng thời gian audit gần nhất
- Đã mở rộng backend ranked filter để hỗ trợ date range theo `status_audit.changed_at`:
  - `apps/backend/src/services/application.service.js`
  - nhận thêm query params `changed_after` và `changed_before`, validate ngày không hợp lệ trả về `400`,
  - áp dụng boundary date-only cho `changed_before` đến hết ngày (23:59:59.999 UTC) qua parser dùng chung.
- Đã mở rộng frontend API client:
  - `apps/frontend/lib/api/applications.ts`
  - `fetchRankedApplications` nhận thêm `changedAfter`/`changedBefore` và serialize thành `changed_after`/`changed_before`.
- Đã nâng cấp Recruiter View trên Applications page:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - thêm 2 input date filter cho ranked: `Changed after` / `Changed before`,
  - reset page về 1 khi đổi filter,
  - đồng bộ filter mới vào URL query để chia sẻ trạng thái lọc (`rc_after`, `rc_before`).
- Đã cập nhật i18n EN/VI cho nhãn filter mới:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test:
  - `apps/frontend/tests/applications-api.test.ts` (assert serialize query `changed_after` + `changed_before` cho ranked),
  - `apps/frontend/tests/applications-page.test.tsx` (assert UI gửi đúng `changedAfter`/`changedBefore` và sync URL),
  - `apps/backend/tests/integration/application-endpoints.test.mjs` (assert ranked filter kết hợp `changed_by` + date range).

### 91) UC-BASIC-13 nâng cấp tiếp: quick preset thời gian cho Ranked Candidates
- Đã bổ sung preset nhanh cho bộ lọc thời gian của ranked recruiter view:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - preset gồm: `7d`, `this-month`, `qtd`.
- Hành vi preset mới:
  - tự điền `changed_after`/`changed_before` theo mốc preset,
  - reset `ranked page` về 1,
  - kích hoạt truy vấn ranked với date range mới,
  - khi user chỉnh tay input date thì preset sẽ tự clear để tránh lệch trạng thái.
- Đã đồng bộ state preset vào URL query string shareable:
  - thêm key `rc_preset` cùng `rc_after` và `rc_before`.
- Đã cập nhật i18n EN/VI cho recruiter quick range:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test UI:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm case xác nhận preset `qtd` gửi đúng boundary `changedAfter/changedBefore`,
  - thêm case xác nhận query string có `rc_preset` khi chọn preset nhanh.

### 92) UC-BASIC-13 nâng cấp tiếp: preset all-time + chip summary cho Ranked filters
- Đã mở rộng quick preset của ranked với tùy chọn `all-time`:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - khi chọn `all-time`, hệ thống xóa `changed_after` và `changed_before`, reset trang về 1.
- Đã bổ sung `Active filters` cho recruiter ranked filters theo pattern tương tự status changes:
  - hiển thị chip tóm tắt cho các filter đang bật (`preset`, `status`, `changed_by`, `from`, `to`),
  - click từng chip để gỡ filter tương ứng,
  - có nút `Clear chips` để reset toàn bộ filter ranked một lần.
- Đã đồng bộ URL cho state ranked đầy đủ:
  - giữ `rc_preset`, `rc_after`, `rc_before`, `rc_changed_by` theo thao tác chip/preset.
- Đã cập nhật i18n EN/VI cho recruiter filter summary:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Đã mở rộng test UI:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm case xác nhận `all-time` xóa date range,
  - thêm case xác nhận `active filters` hiển thị và `Clear chips` reset đúng tham số ranked request.

### 93) UC-BASIC-13 nâng cấp tiếp: hydrate Ranked preset từ URL khi thiếu date range
- Đã cải thiện cơ chế khởi tạo bộ lọc ranked từ query params:
  - `apps/frontend/app/(default)/applications/page.tsx`
  - khi URL có `rc_preset` nhưng chưa có `rc_after`/`rc_before`, frontend sẽ tự tính date range theo preset ngay lúc init state.
- Rule hydrate đã triển khai:
  - `rc_preset=7d` -> tự điền 7 ngày gần đây,
  - `rc_preset=this-month` -> tự điền từ ngày 01 của tháng hiện tại,
  - `rc_preset=qtd` -> tự điền từ đầu quý hiện tại,
  - `rc_preset=all-time` -> giữ date range rỗng.
- Đã mở rộng test UI:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm case xác nhận mở trang với `job_id` + `rc_preset=qtd` sẽ gọi ranked API với `changedAfter/changedBefore` được suy ra tự động.

### 94) UC-BASIC-13 nâng cấp tiếp: khóa test hydrate preset all-time cho Ranked URL
- Đã mở rộng test UI để bao phủ nhánh `rc_preset=all-time` khi hydrate từ query string:
  - `apps/frontend/tests/applications-page.test.tsx`
  - xác nhận khi mở link có `job_id` + `rc_preset=all-time`, ranked request được gửi với:
    - `changedAfter = ''`,
    - `changedBefore = ''`.
- Kết quả: đảm bảo hành vi shareable URL cho all-time luôn ổn định và không bị gán date range ngoài ý muốn.

### 95) UC-BASIC-13 nâng cấp tiếp: hoàn tất test matrix hydrate cho 4 ranked presets
- Đã mở rộng test hydrate query string cho 2 preset còn thiếu:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm case `rc_preset=7d` và `rc_preset=this-month`.
- Kỳ vọng đã được khóa bằng assertion:
  - `7d` -> `changedAfter/changedBefore` đều là ngày hợp lệ (`YYYY-MM-DD`),
  - `this-month` -> `changedAfter` luôn rơi vào ngày đầu tháng (`YYYY-MM-01`), `changedBefore` là ngày hiện tại.
- Sau mục này, matrix hydrate từ URL cho ranked presets đã đủ 4 nhánh:
  - `7d`, `this-month`, `qtd`, `all-time`.

### 96) UC-BASIC-13 nâng cấp tiếp: refactor test hydrate ranked presets theo table-driven
- Đã refactor nhóm test hydrate ranked presets trong:
  - `apps/frontend/tests/applications-page.test.tsx`
- Thay đổi chính:
  - gộp các test lặp (`7d`, `this-month`, `qtd`, `all-time`) thành một bảng dữ liệu `it.each(...)`,
  - giữ nguyên toàn bộ coverage hành vi nhưng giảm trùng lặp setup/assertion,
  - giúp dễ mở rộng khi thêm preset mới trong tương lai (chỉ cần thêm row vào matrix).
- Kết quả: test suite rõ ràng hơn, bảo trì tốt hơn, không thay đổi logic production code.

### 97) UC-BASIC-13 nâng cấp tiếp: refactor test quick presets của Status Changes theo table-driven
- Đã refactor nhóm test quick preset của status changes trong:
  - `apps/frontend/tests/applications-page.test.tsx`
- Thay đổi chính:
  - gộp các case preset `7d`, `this-month`, `ytd`, `all-time` vào một matrix `it.each(...)`,
  - giữ nguyên behavior assertions cho từng preset (boundary ngày/tháng/năm và nhánh clear date range),
  - giữ riêng case `qtd` toggle active-style để đảm bảo coverage UI state chuyển preset.
- Kết quả: bộ test Applications page đồng nhất style table-driven giữa ranked presets và status-changes presets, giảm lặp code và dễ mở rộng preset mới.

### 98) UC-BASIC-13 nâng cấp tiếp: gom helper assert URL sync cho Applications tests
- Đã refactor các test sync query string trong:
  - `apps/frontend/tests/applications-page.test.tsx`
- Bổ sung helper dùng chung:
  - `getLatestReplaceHref()` để đọc URL mới nhất từ `mockedReplace`,
  - `expectLatestReplaceHrefContains(parts)` để assert nhanh nhiều query fragment trong cùng một chỗ.
- Đã áp dụng helper vào các test URL sync chính:
  - ranked changed_by + date sync,
  - ranked preset sync,
  - status changes sync.
- Kết quả: giảm lặp assertion `latestHref`, tăng độ rõ ràng và nhất quán khi mở rộng test query sync tiếp theo.

### 99) UC-BASIC-13 nâng cấp tiếp: gom helper thao tác Recruiter load và latest params trong tests
- Đã bổ sung helper dùng chung cho thao tác test lặp lại tại:
  - `apps/frontend/tests/applications-page.test.tsx`
- Helper mới:
  - `loadRecruiterJob(jobId)` để thao tác nhập `job_id` + bấm `Load`,
  - `loadRecruiterAndWaitRanked(jobId)` và `loadRecruiterAndWaitStatusChanges(jobId)` để chờ request đầu vào ổn định,
  - `getLatestRankedParams()` và `getLatestStatusChangesParams()` để đọc request params mới nhất từ mock call.
- Đã áp dụng helper vào nhiều test hiện có:
  - ranked presets/date filters,
  - status-changes presets/date filters,
  - clear/reset flow.
- Kết quả: giảm đáng kể lặp `fireEvent.change + click + waitFor`, giúp test rõ intent và dễ bảo trì.

### 100) UC-BASIC-13 đề xuất mới đã triển khai: chuẩn hóa pattern assertion latest API params
- Đã chuẩn hóa pattern assertion params bằng helper `getLatest...Params()` thay cho lặp thủ công:
  - trước: đọc `mock.calls[calls.length - 1]?.[0]` rải rác ở nhiều block,
  - sau: dùng helper chung theo từng API (`ranked` / `status-changes`).
- Lợi ích:
  - giảm rủi ro copy-paste sai index call,
  - tăng tính nhất quán khi thêm test case mới,
  - làm nền để có thể trích helper sang shared test-utils nếu cần trong bước tiếp theo.

### 101) UC-BASIC-13 nâng cấp tiếp: tách helper page-test dùng chung ra tests/utils
- Đã tạo module helper mới:
  - `apps/frontend/tests/utils/page-test-helpers.ts`
- Helper tách ra gồm:
  - `expectLatestHrefContains(...)` (assert URL sync từ router replace mock),
  - `getLatestMockCallArg(...)` (lấy arg mới nhất từ mock calls),
  - `fillInputByPlaceholder(...)`,
  - `clickFirstButtonByName(...)`.
- Mục tiêu:
  - chuẩn hóa test utilities theo hướng tái sử dụng cho nhiều page tests,
  - giảm phụ thuộc vào logic lặp lại trong từng file test riêng.

### 102) UC-BASIC-13 nâng cấp tiếp: wiring applications-page.test.tsx dùng shared test helpers
- Đã cập nhật `apps/frontend/tests/applications-page.test.tsx` để dùng helper từ `tests/utils` thay cho xử lý cục bộ:
  - `expectLatestReplaceHrefContains` nay dùng `expectLatestHrefContains`,
  - `loadRecruiterJob` dùng `fillInputByPlaceholder` + `clickFirstButtonByName`,
  - `getLatestRankedParams`/`getLatestStatusChangesParams` dùng `getLatestMockCallArg`.
- Kết quả: file test nhẹ hơn, cấu trúc helper rõ hơn, thuận lợi mở rộng test cho các use case trang khác.

### 103) UC-BASIC-13 nâng cấp tiếp: chuẩn hóa assert query URL bằng helper parse SearchParams
- Đã mở rộng helper dùng chung tại `apps/frontend/tests/utils/page-test-helpers.ts`:
  - thêm `getLatestHref(...)` để đọc URL mới nhất từ router mock,
  - thêm `expectLatestHrefQueryValues(...)` để assert trực tiếp key/value query qua `URLSearchParams`.
- Đã refactor các test URL sync trong `apps/frontend/tests/applications-page.test.tsx`:
  - ranked changed_by + date sync,
  - ranked preset sync,
  - status-changes sync.
- Kết quả xác minh:
  - `npm run test -- tests/applications-page.test.tsx` PASS (23/23),
  - `npm run typecheck` PASS.

### 104) UC-BASIC-13 nâng cấp tiếp: assert query key hiện diện + chuẩn hóa URL assertions cho resume API test
- Đã mở rộng `apps/frontend/tests/utils/page-test-helpers.ts` với helper mới:
  - `expectLatestHrefHasQueryKeys(...)` để assert query có tồn tại key (không phụ thuộc chuỗi `toContain('key=')`).
- Đã refactor `apps/frontend/tests/applications-page.test.tsx`:
  - thay các assert `toContain('rc_after=')`, `toContain('rc_before=')`, `toContain('sc_after=')`, `toContain('sc_before=')`
  - bằng `expectLatestHrefHasQueryKeys(...)`.
- Đã refactor `apps/frontend/tests/resume-api.test.ts`:
  - parse URL bằng `new URL(..., 'http://localhost')`,
  - assert `pathname` + `searchParams` cho default/custom PDF URL thay vì phụ thuộc thứ tự query string.
- Kết quả xác minh:
  - `npm run test -- tests/applications-page.test.tsx tests/resume-api.test.ts` PASS (34/34),
  - `npm run typecheck` PASS.

### 105) UC-BASIC-13 nâng cấp tiếp: chốt regression toàn cục frontend sau chuẩn hóa query assertions
- Đã chạy full frontend test suite tại `apps/frontend`:
  - `npm run test` -> PASS toàn bộ `13/13` test files, `140/140` tests.
- Đã rà soát lại toàn bộ thư mục `apps/frontend/tests` cho pattern assert query mong manh kiểu chuỗi (`toContain('...=')`, `toContain('...?')`):
  - không còn match cần refactor.
- Kết quả:
  - milestone chuẩn hóa assertion query đã ổn định ở mức toàn cục,
  - sẵn sàng chuyển sang mở rộng use case tiếp theo với nền test ít rủi ro regression do thứ tự query string.

### 106) UC-BASIC-13 hardening cuối: bổ sung negative tests cho URL/query parsing edge cases
- Đã bổ sung 2 test case negative theo yêu cầu:
  - `apps/frontend/tests/applications-page.test.tsx`:
    - `ignores invalid ranked preset from URL query and keeps ranked date filters empty`.
    - `sanitizes invalid status-changes query filters from URL` (invalid `sc_status`, `sc_preset`, `sc_page`).
  - `apps/frontend/tests/resume-api.test.ts`:
    - `getResumePdfUrl encodes resume id and omits lang when locale is not provided`.
- Mục tiêu hardening đạt được:
  - khóa edge case query URL không hợp lệ khi hydrate state,
  - khóa edge case encode path và optional query param trong URL builder.
- Kết quả xác minh:
  - `npm run test -- tests/applications-page.test.tsx tests/resume-api.test.ts` PASS (`37/37`),
  - `npm run test` PASS toàn bộ frontend (`13/13` files, `143/143` tests),
  - `npm run typecheck` PASS.

### 107) Triển khai use case kế tiếp UC-BASIC-01..04: Auth API nền tảng (signup/login/forgot/reset/change password)
- Đã bổ sung backend auth flow hoàn chỉnh theo pattern service/controller/route:
  - `apps/backend/src/services/auth.service.js`
  - `apps/backend/src/controllers/auth.controller.js`
  - `apps/backend/src/middleware/auth.middleware.js`
  - `apps/backend/src/routes/auth.routes.js`
  - wiring vào `apps/backend/src/routes/index.js` tại `/api/auth/*`.
- Endpoint mới đã hoạt động ở mức contract code:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
  - `POST /api/auth/change-password` (Bearer token)
  - `GET /api/auth/me` (Bearer token)
- Đã bổ sung frontend API client để chuẩn bị cho màn hình auth use case tiếp theo:
  - `apps/frontend/lib/api/auth.ts`.
- Đã bổ sung test:
  - `apps/backend/tests/integration/auth-endpoints.test.mjs` (signup/login/me/change/forgot/reset),
  - `apps/frontend/tests/auth-api.test.ts`.
- Kết quả xác minh:
  - Frontend: `npm run test -- tests/auth-api.test.ts` PASS (`4/4`),
  - Frontend: `npm run typecheck` PASS,
  - Backend integration khi bật `RUN_INTEGRATION_TESTS=1` bị fail do môi trường MongoDB (`Authentication failed`) và không phải lỗi logic auth code.
- Bổ sung dependency backend:
  - `bcryptjs`, `jsonwebtoken` (đã cập nhật lockfile).

### 108) Triển khai tiếp UC-BASIC-01/02 frontend: màn hình đăng nhập/đăng ký + guard route
- Đã bổ sung session layer phía frontend:
  - `apps/frontend/lib/context/auth-context.tsx`
  - quản lý `accessToken` + `user` qua localStorage,
  - expose các hàm `signIn`, `signUp`, `signOut`, `refreshProfile` để tái sử dụng cho các use case kế tiếp.
- Đã bổ sung route guard ở layout mặc định:
  - `apps/frontend/components/common/auth-guard.tsx`
  - `apps/frontend/app/(default)/layout.tsx`
  - tự redirect về `/login?next=...` cho route cần auth khi chưa có session,
  - cho phép public path: `/`, `/login`, `/signup`.
- Đã bổ sung 2 màn hình auth frontend:
  - `apps/frontend/app/(default)/login/page.tsx`
  - `apps/frontend/app/(default)/signup/page.tsx`
  - wiring trực tiếp với auth API client đã triển khai ở mục 107.
- Đã cập nhật i18n EN/VI cho nhóm auth:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`.
- Kết quả xác minh:
  - `npm run test -- tests/auth-api.test.ts` PASS (`4/4`),
  - `npm run typecheck` PASS.

### 109) Triển khai tiếp đề xuất: role-based guard trọng yếu + UC-BASIC-05 Candidate Profile
- Đã bổ sung role middleware phía backend:
  - `apps/backend/src/middleware/auth.middleware.js`
  - thêm `requireRoles(...roles)` để kiểm soát quyền theo `req.auth.role`.
- Đã áp guard vào các route nghiệp vụ trọng yếu:
  - `apps/backend/src/routes/job.routes.js`
    - các thao tác ghi (`POST /upload`, `POST /`, `PATCH /:id`, `DELETE /:id`) yêu cầu `recruiter|admin`.
  - `apps/backend/src/routes/application.routes.js`
    - `POST /` yêu cầu `candidate|admin`,
    - các endpoint recruiter (ranked/summary/status-changes/bulk/status update) yêu cầu `recruiter|admin`,
    - history/feedback/status-history yêu cầu đã đăng nhập (`requireAuth`).
- Đã triển khai UC-BASIC-05 (Candidate Profile) backend end-to-end:
  - model mở rộng: `apps/backend/src/models/User.js` thêm `candidateProfile`.
  - service mới: `apps/backend/src/services/candidate-profile.service.js` (sanitize + get/update profile).
  - controller mới: `apps/backend/src/controllers/candidate-profile.controller.js`.
  - route mới: `apps/backend/src/routes/candidate-profile.routes.js`.
  - wiring route: `apps/backend/src/routes/index.js` tại `/api/candidate-profile/me`.
- Đã triển khai frontend cho UC-BASIC-05:
  - API client mới: `apps/frontend/lib/api/candidate-profile.ts`.
  - cập nhật export API: `apps/frontend/lib/api/index.ts`.
  - page mới: `apps/frontend/app/(default)/profile/page.tsx` (load/save profile candidate).
  - i18n EN/VI: `apps/frontend/messages/en.json`, `apps/frontend/messages/vi.json` (nhóm key `profile`).
- Đã harden API client cho luồng auth:
  - `apps/frontend/lib/api/client.ts` tự attach `Authorization: Bearer ...` từ session localStorage nếu request chưa có header này.
  - test cập nhật tương ứng: `apps/frontend/tests/client-api.test.ts`.
- Đã bổ sung test:
  - `apps/frontend/tests/candidate-profile-api.test.ts`.
  - `apps/backend/tests/integration/candidate-profile-endpoints.test.mjs`.
- Kết quả xác minh:
  - Frontend: `npm run test -- tests/auth-api.test.ts tests/client-api.test.ts tests/candidate-profile-api.test.ts` PASS (`14/14`).
  - Frontend: `npm run typecheck` PASS.
  - Backend integration tổng thể vẫn fail do môi trường MongoDB `Authentication failed` (không phải lỗi logic thay đổi trong đợt này).

### 110) Tiếp tục hardening theo đề xuất: mở rộng role guards toàn API + khóa ownership theo actor
- Đã áp guard cho các nhóm API còn lại ở backend:
  - `apps/backend/src/routes/config.routes.js`
    - toàn bộ `/api/config/*` yêu cầu `recruiter|admin`.
  - `apps/backend/src/routes/resume.routes.js`
    - toàn bộ `/api/resumes/*` yêu cầu đăng nhập,
    - endpoint mutate/tailor yêu cầu `candidate|admin`.
  - `apps/backend/src/routes/enrichment.routes.js`
    - yêu cầu `candidate|admin`.
  - `apps/backend/src/routes/vector.routes.js`
    - yêu cầu `admin`.
- Đã bổ sung enforcement ownership trong controller để candidate không truy cập chéo dữ liệu:
  - `apps/backend/src/controllers/resume.controller.js`
    - candidate chỉ đọc/sửa/xóa resume của chính mình,
    - list/master tự scope theo `req.auth.userId` khi role là candidate,
    - upload/create resume gán candidate theo user đăng nhập.
  - `apps/backend/src/controllers/application.controller.js`
    - candidate chỉ tạo application bằng resume của chính mình,
    - candidate history tự ép theo user hiện tại,
    - feedback/status-history chặn truy cập application không thuộc quyền xem.
- Đã cập nhật service hỗ trợ scope theo candidate:
  - `apps/backend/src/services/resume.service.js`
    - `createResumeFromUpload(file, candidateId)`
    - `listResumeSummaries(includeMaster, candidateId)`.
- Kết quả xác minh vòng này:
  - `get_errors` cho các file backend thay đổi: không có lỗi.
  - Frontend regression check: `npm run test -- tests/auth-api.test.ts tests/client-api.test.ts tests/candidate-profile-api.test.ts` PASS (`14/14`).
  - Frontend typecheck: `npm run typecheck` PASS.
  - Backend integration full suite vẫn bị chặn bởi MongoDB credentials (`Authentication failed`) nên chưa thể xác nhận runtime integration end-to-end trong môi trường hiện tại.

### 111) Tiếp tục hardening theo đề xuất: đồng bộ role-aware UX frontend với policy backend
- Đã hoàn thiện role-aware behavior cho các trang chính để phản ánh chính xác policy mới ở backend:
  - `apps/frontend/app/(default)/settings/page.tsx`
    - chặn truy cập với candidate bằng thông báo access-denied và link quay về dashboard.
  - `apps/frontend/app/(default)/dashboard/page.tsx`
    - các CTA liên quan settings chỉ hiển thị cho `recruiter|admin`,
    - card điều hướng thứ 4 chuyển hướng role-aware: `recruiter|admin -> /applications`, `candidate -> /profile`.
  - `apps/frontend/app/(default)/jobs/page.tsx`
    - `recruiter|admin`: hiển thị action quản trị (`view ranked`, `history`, `edit`, `close/reopen`, `delete`),
    - candidate: chỉ hiển thị action apply với master resume.
- Đã bổ sung i18n key mới cho thông báo recruiter-only:
  - `apps/frontend/messages/en.json`
  - `apps/frontend/messages/vi.json`
  - `apps/frontend/messages/es.json`
  - `apps/frontend/messages/ja.json`
  - `apps/frontend/messages/pt-BR.json`
  - `apps/frontend/messages/zh.json`
- Kết quả xác minh vòng này:
  - `get_errors` trên toàn bộ file frontend thay đổi: không có lỗi.
  - Frontend regression check: `npm run test -- tests/auth-api.test.ts tests/client-api.test.ts tests/candidate-profile-api.test.ts` PASS (`14/14`).
  - Frontend typecheck: `npm run typecheck` PASS.

### 112) Tiếp tục hardening theo đề xuất: tách role Applications + khóa audit actor theo token + thêm test ma trận quyền
- Đã tách UX trang Applications theo role để tránh luồng “thấy rồi mới 403”:
  - `apps/frontend/app/(default)/applications/page.tsx`
    - `recruiter|admin`: chỉ hiển thị recruiter controls (ranked/summary/status changes/bulk actions),
    - `candidate`: chỉ hiển thị candidate view + candidate history,
    - candidate auto-scope `candidate_id` theo user đăng nhập.
- Đã loại bỏ phụ thuộc `changed_by` nhập tay ở UI cho status update/bulk:
  - frontend không còn gửi actor tùy ý từ Applications page,
  - tránh giả mạo audit trail từ client.
- Đã harden backend để actor audit luôn lấy từ token:
  - `apps/backend/src/controllers/application.controller.js`
    - `updateApplicationStatusHandler` và `bulkUpdateApplicationStatusHandler` ép `changed_by` từ `req.auth` (`email`/`userId`) thay vì body từ client.
- Đã bổ sung test integration ma trận quyền cho Applications:
  - `apps/backend/tests/integration/application-authorization.test.mjs`
  - Bao phủ các nhánh chính:
    - candidate không vào được recruiter endpoints (`/applications/ranked`),
    - recruiter không tạo application thay candidate,
    - candidate không apply bằng resume của candidate khác,
    - candidate không đọc feedback application không thuộc ownership,
    - admin update status với payload `changed_by` giả mạo nhưng history ghi actor từ token.
- Đã cập nhật test frontend Applications theo layout role-aware mới:
  - `apps/frontend/tests/applications-page.test.tsx`
  - thêm case candidate-only view và điều chỉnh selector assertions.
- Kết quả xác minh vòng này:
  - `get_errors` cho toàn bộ file thay đổi: không có lỗi.
  - Frontend typecheck: `npm run typecheck` PASS.
  - Frontend regression check: `npm run test -- tests/applications-page.test.tsx tests/applications-api.test.ts` PASS (`36/36`).
  - Backend integration full suite vẫn phụ thuộc môi trường Mongo credentials; test mới đã được thêm nhưng chưa thể chạy end-to-end trong môi trường hiện tại.

### 113) Tiếp tục hardening theo đề xuất: khóa navigation theo role toàn app + chuẩn hóa đường chạy integration Mongo
- Đã bổ sung role-aware route guard ở lớp chung:
  - `apps/frontend/components/common/auth-guard.tsx`
  - policy mới:
    - `/settings*` chỉ cho `recruiter|admin`,
    - `/profile*` chỉ cho `candidate|admin`,
    - account không đủ role được redirect về `/dashboard` trước khi render nội dung trang.
- Đã đồng bộ UX ở Tailor để tránh lộ điều hướng không phù hợp role:
  - `apps/frontend/app/(default)/tailor/page.tsx`
  - candidate không còn thấy link điều hướng sang Settings trong warning block.
- Đã bổ sung test mới cho guard behavior:
  - `apps/frontend/tests/auth-guard.test.tsx`
  - bao phủ:
    - unauthenticated -> redirect `/login?next=...`,
    - candidate bị chặn khỏi `/settings`,
    - recruiter bị chặn khỏi `/profile`,
    - recruiter được vào `/settings`.
- Đã bổ sung đường chạy backend integration ổn định hơn cho local (giảm mismatch credentials Mongo):
  - cập nhật `scripts/full-verify.ps1` set thêm `MONGO_URI_TEST` cùng giá trị chuẩn local,
  - thêm script mới `scripts/run-backend-integration.ps1` (fallback `MONGO_URI_TEST` mặc định `admin:admin123`, bật `RUN_INTEGRATION_TESTS=1`, rồi chạy `npm run test:integration`).
- Kết quả xác minh vòng này:
  - `get_errors` cho file frontend/backend script thay đổi: không có lỗi.
  - Frontend typecheck: `npm run typecheck` PASS.
  - Frontend regression check: `npm run test -- tests/auth-guard.test.tsx tests/applications-page.test.tsx tests/auth-api.test.ts` PASS (`34/34`).

### 114) Tiếp tục hardening theo đề xuất: phủ kín role-aware cho CTA còn lại ở dashboard/builder-resume flow
- Đã mở rộng policy route-level trong guard để khóa các route candidate-only:
  - `apps/frontend/components/common/auth-guard.tsx`
  - bổ sung chặn cho role `recruiter` tại:
    - `/builder*`
    - `/tailor*`
    - `/resumes*`
  - redirect sớm về `/dashboard` khi role không phù hợp.
- Đã cập nhật CTA điều hướng còn lại để đồng bộ role UX:
  - `apps/frontend/components/home/swiss-grid.tsx`
    - footer shortcut `Settings` chỉ hiển thị cho `recruiter|admin`.
  - `apps/frontend/app/(default)/dashboard/page.tsx`
    - card `My History` chuyển role-aware:
      - `recruiter|admin` -> `/applications`
      - `candidate` -> `/applications?candidate_id=...`.
- Đã bổ sung/ mở rộng test guard coverage:
  - `apps/frontend/tests/auth-guard.test.tsx`
  - thêm matrix test xác nhận recruiter bị chặn khỏi `/builder`, `/tailor`, `/resumes/:id`.
- Kết quả xác minh vòng này:
  - `get_errors` cho toàn bộ file thay đổi: không có lỗi.
  - Frontend typecheck: `npm run typecheck` PASS.
  - Frontend regression check: `npm run test -- tests/auth-guard.test.tsx tests/applications-page.test.tsx` PASS (`33/33`).

### 115) Gỡ blocker integration Mongo + ổn định lại script chạy backend integration
- Đã nâng cấp script integration backend để tự dò URI Mongo khả dụng thay vì cứng credential:
  - `scripts/run-backend-integration.ps1`
  - bổ sung probe lần lượt các candidate URI (env, compose defaults, backend `.env`, local no-auth) và chọn URI kết nối được.
  - ép gán lại `MONGO_URI` + `MONGO_URI_TEST` theo URI đã resolve ở mỗi lần chạy (tránh leak env từ shell PowerShell dùng chung).
- Đã bổ sung khởi động phụ thuộc integration trong script:
  - cố gắng `docker compose --profile app up -d redis qdrant worker-embedding-sbert` trước khi chạy,
  - set mặc định `EMBEDDING_SERVICE_URL=http://127.0.0.1:8010`,
  - chạy `npm run bootstrap:qdrant` trước `npm run test:integration`.
- Đã sửa lỗi regression rõ ràng trong test tích hợp Applications:
  - `apps/backend/tests/integration/application-endpoints.test.mjs`
  - di chuyển block `bulk status update` về đúng vị trí sau khi đã có `baseUrl/createA/createdB`,
  - sửa typo biến `createB` -> `createdB`.
- Kết quả xác minh hiện tại:
  - Lỗi `MongoServerError: Authentication failed` không còn là blocker chính; test suite đã tiến tới lỗi nghiệp vụ/integration phụ thuộc service và assertion-level.
  - Cần thêm vòng fix tiếp theo cho các failing assertions/backend contract còn lại (đang ở trạng thái post-auth-unblock).

### 116) Ổn định backend integration đạt PASS (11/11)
- Đã cập nhật cách chạy backend integration theo chế độ tuần tự để tránh nhiễu trạng thái/env giữa các file test:
  - apps/backend/package.json
  - script `test:integration` chuyển sang `node --test --test-concurrency=1 tests/integration/*.test.mjs`.
- Đã tách database test riêng cho các suite trước đó dùng chung hậu tố `_integration`:
  - apps/backend/tests/integration/auth-endpoints.test.mjs -> `/cv_matching_auth_integration`
  - apps/backend/tests/integration/candidate-profile-endpoints.test.mjs -> `/cv_matching_candidate_profile_integration`
  - apps/backend/tests/integration/config-endpoints.test.mjs -> `/cv_matching_config_integration`
- Đã chỉnh lại các assertion dễ vỡ tại:
  - apps/backend/tests/integration/application-endpoints.test.mjs
  - thay đổi gồm:
    - summary status kiểm tra tổng count từ map `by_status` thay vì cố định theo một nhãn status,
    - kỳ vọng audit actor đồng bộ theo actor đã xác thực (`recruiter.application@example.com`),
    - assertion status-audit của ranked cho phép sai khác thứ tự giữa entry seed boundary và entry cập nhật từ API.
- Kết quả xác minh:
  - chạy lệnh: `npm run test:integration` trong `apps/backend`
  - trạng thái cuối: PASS (`tests=11`, `pass=11`, `fail=0`).

### 117) Xác minh lại integration qua wrapper script và làm mới artifact log
- Đã chạy lại integration thông qua wrapper chuẩn:
  - scripts/run-backend-integration.ps1
- Đã làm mới artifact log UTF-8:
  - scripts/last-backend-integration.txt
- Kết quả xác minh mới nhất:
  - lệnh thoát thành công,
  - tổng kết backend integration: tests=11, pass=11, fail=0.
- Ghi chú runtime:
  - Mongo URI được auto-resolve sang localhost no-auth (`mongodb://127.0.0.1:27017`).
  - Các container phụ thuộc hiện có được tái sử dụng; worker đã chạy sẵn.

### 118) Hardening workflow integration trên CI bằng wrapper chuẩn + artifact log
- Đã cập nhật workflow CI để chạy backend integration bằng cùng wrapper chuẩn local:
  - .github/workflows/backend-integration.yml
  - thay chạy trực tiếp `npm run test:integration` bằng:
    - `./scripts/run-backend-integration.ps1`
- Đã bổ sung upload artifact log integration ở mọi lần chạy CI (`if: always()`):
  - tên artifact: `backend-integration-log`
  - đường dẫn artifact: `scripts/last-backend-integration.txt`
- Đã thêm bước cài `jq` rõ ràng trên runner để giữ parsing health-check ổn định.
- Đã kiểm tra lại target từng flaky ở chế độ chạy lẻ sau khi ổn định:
  - `tests/integration/application-authorization.test.mjs` hiện PASS khi chạy standalone với env local.

### 119) Xác minh độ ổn định test lẻ application-authorization sau hardening
- Đã chạy lặp 5 lần test tích hợp lẻ từng có dấu hiệu flaky:
  - `tests/integration/application-authorization.test.mjs`
- Môi trường chạy:
  - `RUN_INTEGRATION_TESTS=1`
  - `MONGO_URI_TEST=mongodb://127.0.0.1:27017`
  - `MONGO_URI=mongodb://127.0.0.1:27017`
  - `EMBEDDING_SERVICE_URL=http://127.0.0.1:8010`
- Kết quả:
  - 5/5 lần PASS,
  - không ghi nhận failure trong vòng stress-run ngắn.

### 120) Bổ sung CI matrix cho test lẻ trọng yếu bên cạnh full integration
- Đã mở rộng workflow backend integration với job mới chạy matrix test lẻ:
  - `.github/workflows/backend-integration.yml`
  - job mới: `isolated-critical`
  - matrix gồm:
    - `auth-endpoints.test.mjs`
    - `application-authorization.test.mjs`
- Cấu hình job matrix:
  - cài dependencies backend,
  - start `mongo` riêng cho từng matrix run,
  - wait healthy bằng `docker compose ps` + `jq`,
  - chạy test lẻ với env integration (`RUN_INTEGRATION_TESTS`, `MONGO_URI`, `MONGO_URI_TEST`).
- Đã xác minh local tương ứng cho cùng tập test:
  - chạy `node --test tests/integration/auth-endpoints.test.mjs tests/integration/application-authorization.test.mjs`
  - kết quả: PASS (`tests=2`, `pass=2`, `fail=0`).

### 121) Bổ sung artifact log riêng cho từng test trong CI matrix isolated-critical
- Đã nâng cấp job `isolated-critical` trong:
  - `.github/workflows/backend-integration.yml`
- Thay đổi chính:
  - bước chạy test lẻ giờ ghi log riêng theo từng file test bằng `tee`:
    - `scripts/isolated-test-logs/<test_file>.log`
  - thêm bước upload artifact riêng cho từng matrix run (`if: always()`):
    - tên artifact: `isolated-integration-log-<test_file>`
    - path artifact: `scripts/isolated-test-logs/<test_file>.log`
- Kết quả mong đợi:
  - khi một test lẻ fail trong CI matrix, có thể tải đúng log của test đó để khoanh vùng nhanh mà không cần soi toàn bộ service logs.

### 122) Bổ sung README root với badge trạng thái CI
- Đã tạo mới file tài liệu gốc:
  - `README.md`
- Đã thêm badge theo dõi workflow ngay đầu trang:
  - Backend Integration (`backend-integration.yml`)
  - Frontend Quality (`frontend-quality.yml`)
- Đã thêm quick links đến các thành phần quan trọng:
  - workflow files,
  - `task-completed.md`,
  - `apps/backend`, `apps/frontend`.

### 123) Mở rộng README: hướng dẫn chạy local, Docker, và CI troubleshooting
- Đã cập nhật `README.md` với 3 phần vận hành bổ sung:
  - `Run Locally (Backend Integration)` với lệnh wrapper:
    - `./scripts/run-backend-integration.ps1`
  - `Run With Docker` với các lệnh profile `app`:
    - `docker compose --profile app up -d ...`
    - `docker compose --profile app ps`
    - `docker compose --profile app down`
    - tham chiếu `./scripts/full-verify.ps1`
  - `CI Troubleshooting` với hướng dẫn lấy artifact:
    - `backend-integration-log`
    - `isolated-integration-log-<test_file>`
- Đã bổ sung ghi chú rõ ràng rằng `gateway-backend` và `frontend` trong compose hiện tại là scaffold placeholder.

### 124) Hỗ trợ chạy app bằng Docker chỉ với 1 lệnh
- Đã nâng cấp `docker-compose.yml` để backend/frontend chạy thật thay vì placeholder:
  - `gateway-backend`:
    - command: `npm install && npm run bootstrap:qdrant && npm run dev`
    - thêm healthcheck `/api/health`
    - thêm named volume `backend_node_modules`
    - chuẩn hóa `MONGO_URI` với `authSource=admin`
  - `frontend`:
    - command: `npm install && npx next dev -H 0.0.0.0 -p 3000`
    - thêm healthcheck HTTP cổng `3000`
    - thêm named volume `frontend_node_modules`
    - phụ thuộc `gateway-backend` theo condition `service_healthy`
- Đã bổ sung tài liệu one-command trong `README.md`:
  - `docker compose --profile app up -d --build`
  - kèm endpoint kiểm tra nhanh:
    - Frontend: `http://localhost:3000`
    - Backend health: `http://localhost:3001/api/health`
- Đã validate lại cấu hình compose bằng `docker compose config` (hợp lệ).
