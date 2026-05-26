# Plan Hoàn Tất Phase 3 Gaps

## Summary
Mục tiêu là đóng toàn bộ gap còn lại của Phase 3 để hệ thống không chỉ “gọi được Ollama”, mà đạt trạng thái production-ready hơn: output LLM ổn định theo schema, frontend giữ/hiển thị metadata, prompt runtime đủ mạnh, health/observability rõ ràng, và contract tests bao phủ cả Ollama lẫn cloud providers khi có API key.

## Implementation Changes

### 1. Stabilize LLM Structured Output
- Harden interview prompt để bắt buộc top-level `{ question_groups: [...] }`, mỗi group có `group`, `label`, `description`, `questions`.
- Mở rộng normalizer cho interview để chấp nhận các biến thể an toàn:
  - `groups`
  - flat `questions` có `category`
  - object theo category như `technical`, `behavioral`, `experience`
- Nếu normalizer vẫn không tạo được group hợp lệ, chạy một JSON repair prompt trước khi fallback template.
- Làm tương tự cho enrichment analyze/regenerate để output LLM thiếu field phụ vẫn được chuẩn hóa nếu đủ dữ liệu cốt lõi.
- Acceptance: interview integration với Ollama phải có test pass `generation_mode: "llm"`.

### 2. Prompt Runtime + Admin Editing
- Port prompt upstream chất lượng cao vào `DEFAULT_PROMPT_CONFIG.templates` cho:
  - tailor resume
  - cover letter
  - outreach
  - interview
  - enrichment analyze/enhance/regenerate
- Giữ truthfulness rules trong `promptConfig.truthfulness_rules`, dùng chung khi render prompt.
- Admin Config > Prompts thêm editor tối thiểu:
  - dropdown chọn default tailor prompt
  - textareas cho từng template
  - textarea newline-list cho truthfulness rules
- Existing `/api/config/prompts` giữ route cũ, nhưng request/response type mở rộng để chứa `templates` và `truthfulness_rules`.
- Add tests chứng minh custom template trong `systemconfigs.promptConfig` thật sự được generation service sử dụng.

### 3. Frontend Metadata + UX
- Thêm shared frontend types:
  - `GenerationMode = "llm" | "template_fallback"`
  - `LlmMetadata`
  - `GenerationTextResult`
- `generateCoverLetter` và `generateOutreachMessage` trả object `{ content, generation_mode, llm_metadata }` thay vì chỉ `string`.
- Cover/outreach page dùng `result.content`, đồng thời hiển thị badge nhỏ:
  - `AI-generated`
  - `Template fallback`
- `ImprovedResult` và `ImproveResumeConfirmRequest` thêm `generation_mode` + `llm_metadata`.
- Candidate optimize page truyền metadata từ preview sang confirm.
- Interview page hiển thị badge generation mode nếu backend trả field này.

### 4. Health + Observability
- Không gọi LLM thật trong mọi `getSystemStatus` request.
- Thêm cached health record trong `systemconfigs`, key `llmHealthStatus`:
  - `provider`
  - `model`
  - `healthy`
  - `checked_at`
  - `error_code`
  - `response_model`
- `/config/llm-test` cập nhật cache này sau mỗi lần test.
- `getSystemStatus` đọc cache và trả thêm optional fields:
  - `llm_health_checked_at`
  - `llm_health_stale`
- Thêm `AiGenerationEvent` collection với TTL 30 ngày để query fallback/success events:
  - `feature`
  - `generation_mode`
  - `provider`
  - `model`
  - `reason`
  - `request_id`
  - `createdAt`
- Thêm admin-only endpoint `GET /api/config/llm-events?feature=&generation_mode=&limit=50`.

### 5. Provider Contract Tests + Typecheck Fix
- Thêm `llm-cloud-contract.test.mjs`, skip theo env nếu thiếu key.
- Env convention:
  - `LLM_CONTRACT_PROVIDERS=openai,anthropic,gemini,deepseek,openrouter`
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `GOOGLE_API_KEY`
  - `DEEPSEEK_API_KEY`
  - `OPENROUTER_API_KEY`
- Mỗi provider test:
  - `checkLlmHealth`
  - `completeText`
  - `completeJson`
  - metadata extraction
  - auth error path khi key sai
- Fix frontend typecheck bằng cách loại `.next/dev/**` khỏi `tsconfig.include` hoặc `exclude`, giữ `.next/types/**/*.ts`.
- Re-run frontend `npm run typecheck`.

## Public API / Type Changes
- Existing generation endpoints giữ route path.
- Cover/outreach response chính thức là:
  ```ts
  {
    content: string;
    message: string;
    generation_mode?: "llm" | "template_fallback";
    llm_metadata?: {
      provider?: string;
      model?: string;
      response_model?: string;
      prompt_tokens?: number | null;
      completion_tokens?: number | null;
    } | null;
  }
  ```
- Tailor improve response `data` thêm optional `generation_mode` và `llm_metadata`.
- Interview result thêm optional `generation_mode` và `llm_metadata`.
- System status thêm optional cached health fields, không breaking existing `llm_healthy`.

## Test Plan
- Backend unit:
  - prompt rendering uses custom `promptConfig`
  - interview normalizer handles common LLM shapes
  - JSON repair path before fallback
  - fallback event is persisted
  - cached health status read/write
- Backend integration:
  - Ollama interview returns `generation_mode: "llm"`
  - cover/outreach/tailor/enrichment keep existing LLM/fallback tests
  - `GET /config/llm-events` returns fallback event for forced invalid JSON
  - cloud provider contract tests skip unless env configured
- Frontend:
  - API helpers return metadata object
  - cover/outreach page renders content and badge
  - optimize confirm sends preview metadata
  - admin prompt editor saves templates/rules
  - `npm run typecheck` pass

## Assumptions
- Ollama remains the default real local contract provider.
- `gemma3:4b` remains default local model; `qwen3:8b` is optional manual validation.
- Cloud provider tests are optional and env-gated, not required for local CI without keys.
- We will persist LLM generation events for 30 days only.
- System status uses cached health, not live LLM calls per dashboard request.
