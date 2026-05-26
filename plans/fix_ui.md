# Kế Hoạch Hoàn Thiện UI Kết Nối Toàn Bộ Backend API

## Summary
Mục tiêu là chuyển frontend từ trạng thái còn placeholder/set cứng sang UI vận hành thật theo toàn bộ backend API hiện có. Không đổi route backend. Tất cả page sẽ dùng typed API clients thay vì gọi generic `getList/getPath/putOne` khi contract đã có helper rõ ràng. `/api/internal/**` không nối trực tiếp vào UI vì là internal worker endpoint.

## Implementation Changes

### 1. Chuẩn Hóa Frontend API Layer
- Chuẩn hóa `lib/api/**` thành source of truth:
  - Thêm `createJob`, `uploadJobDescriptionsForJob`, `fetchSystemStatus` extended fields, `fetchLlmEvents` filters.
  - Bổ sung mapper typed cho `ApplicationHistory`, `RankedCandidate`, `Feedback`, `StatusHistory`, `CompanyProfile`, `CandidateProfile`.
  - Giữ `getList/getPath/getOne/postOne/putOne` chỉ cho backward compatibility; các page mới/sửa phải dùng helper typed.
- Cập nhật frontend `SystemStatus` type để nhận:
  - `llm_health_checked_at?: string | null`
  - `llm_health_stale?: boolean`
  - `llm_provider?: string`
- Tạo `docs/frontend-backend-api-coverage.md` ghi rõ endpoint nào đã nối UI, endpoint nào internal/excluded.

### 2. App Shell, Auth, Navigation
- `AppShell` dùng `usePathname()` để active sidebar đúng route; không dùng `breadcrumb="candidate"` làm active path.
- `Sidebar` lấy email/role từ `useAuth()`, bỏ `demo@cvmatching.io`.
- Thêm sidebar link Admin `Vectors` vì page `/admin/vectors` đã tồn tại và backend vector API đã có.
- `Topbar`:
  - Bỏ search global rỗng hoặc biến thành search theo context qua callback optional.
  - Thêm user menu thật: email, role, sign out.
  - Thêm notification panel/unread count cho candidate/recruiter.
- Login:
  - Role toggle chỉ còn là UI hint hoặc bỏ khỏi login vì backend xác định role từ account.
  - Google login bị ẩn/disabled với nhãn “Not configured” vì backend chưa có OAuth endpoint.

### 3. Candidate UI
- Dashboard và Applications:
  - Dùng `fetchMyApplicationHistory`.
  - Search/status/AI status/date filter phải có state thật và không được lọc local trên tập dữ liệu đã phân trang.
  - Đẩy các filter chính lên backend query params; nếu endpoint `/applications/history` còn thiếu filter cần dùng cho UI thì bổ sung optional query params không breaking như `search`, `ai_status`, `submitted_after`, `submitted_before`.
  - Hiển thị job title/location từ response thay vì chỉ `jobId`.
- Application detail:
  - Dùng `fetchApplicationFeedback` và `fetchApplicationStatusHistory`.
  - Nút `Edit Resume` link tới `/candidate/resumes/{resume_id}/builder`.
  - Nút `Re-apply` chỉ hiện khi có `job_id` và status phù hợp; mở modal chọn resume và gọi `createApplication`.
  - Nút `Re-apply` phải fetch/kiểm tra job detail và chỉ hiển thị hoặc enable khi job còn `status === "active"`; nếu job đã đóng/xóa thì không cho nộp lại.
- Jobs và Recommendations:
  - Browse jobs giữ `fetchJobs` + `createApplication`, thêm retry/error state rõ ràng.
  - Recommendations “Apply” mở cùng modal chọn resume và gọi `createApplication`; không để button rỗng.
- Profile:
  - Dùng `fetchMyCandidateProfile/updateMyCandidateProfile`.
  - Form hỗ trợ đủ dữ liệu backend hiện có: headline, summary, phone, location, website, skills, experience, education, portfolio.
- Resumes/Builder/Cover/Optimize:
  - Giữ các API hiện đã nối.
  - Cover/outreach đọc `fetchFeatureConfig`; nếu feature disabled thì disable generate button và giải thích ngắn.
  - Optimize hiển thị `GenerationModeBadge` cho tailor preview/enrichment khi backend trả metadata.

### 4. Recruiter UI
- Recruiter dashboard:
  - Dùng `fetchJobs`, `fetchApplicationStatusSummary`, `fetchRecentStatusChanges`.
  - Thêm job selector để xem summary theo job.
  - Recent applications hiển thị list thật, không chỉ `applications[0]`.
  - Recent applications/status changes trên dashboard phải giới hạn `limit: 5` hoặc tối đa `limit: 10` để không làm vỡ layout khi dữ liệu thật lớn.
- Job list/new/edit:
  - Job list dùng `fetchJobs({ search, status, category })`; filter phải bind state thật.
  - Close job dùng `closeJob` (`PATCH /jobs/:id status=closed`), không dùng `DELETE` cho hành động Close.
  - Thêm actions: reopen, delete với confirm.
  - Mọi action phá hủy hoặc có tác động lớn như close/reopen/delete phải đi qua `ConfirmDialog`, dùng tone danger khi xóa, và disable nút bằng `busy` để tránh double submit.
  - New/edit form đủ fields backend: title, category, location, experienceLevel, deadline, description, requirements, benefits, status.
  - Bỏ `Save Draft` vì backend không có draft status.
  - Bỏ “AI readiness score will appear here” hoặc thay bằng preview keyword/readiness local có dữ liệu thật.
- Job candidates:
  - Dùng `fetchRankedApplications`.
  - Search/status/AI status/score filters phải hoạt động qua backend query params, cụ thể `search`, `status`, `ai_status`, `min_score`, `max_score`; không filter local trên danh sách đã phân trang.
  - Khi filter thay đổi phải reset `page` về 1 và refetch từ backend để kết quả không bị thiếu dữ liệu ở các trang khác.
  - Hiển thị candidate full name/email, resume title, scores, matched/missing keywords.
  - Thêm checkbox bulk select + `bulkUpdateApplicationStatus`.
  - Bulk update trạng thái phải mở `ConfirmDialog` trước khi gọi API, hiển thị số ứng viên được chọn và trạng thái đích để tránh bấm nhầm.
  - Row action `Review` link tới `/recruiter/jobs/{jobId}/candidates/{applicationId}`.
- Candidate detail:
  - Dùng `fetchApplicationFeedback`, `fetchApplicationStatusHistory`, `fetchJobById`, `fetchCandidateProfileById` khi có candidate id.
  - Status buttons gọi `updateApplicationStatus`.
  - “Toggle job description” hiển thị JD thật từ `fetchJobById`, không text placeholder.
  - Download CV dùng `/resumes/:id/download`.
- Find candidates:
  - `View CV` link tới route mới `/recruiter/candidates/{candidateIdOrResumeId}`.
  - Tạo route read-only recruiter candidate profile dùng `fetchCandidateProfileById` và `fetchCandidateApplicationHistory`.
  - Route read-only candidate profile phải có permission guard phía backend: recruiter chỉ xem được ứng viên có application/resume liên quan tới job thuộc recruiter đó; frontend không được là lớp bảo vệ duy nhất.
  - Không gọi Interview Generator cho passive recommendation nếu chưa có application; thay bằng CTA “Review ranked applicants” hoặc disabled tooltip.
- Interview page:
  - Giữ `generateInterviewQuestions`.
  - Khi thiếu `resume_id` hoặc backend trả 403, hiển thị hướng dẫn quay về ranked applications thay vì empty generic.

### 5. Admin UI
- Config:
  - Giữ LLM, prompt editor, API keys, privacy, language.
  - LLM Events thêm filters `feature`, `generation_mode`, `limit` và refresh.
  - System health badge hiển thị stale health: checked time + stale warning từ `/status`.
- Users:
  - Role filter giữ backend query.
  - Thêm search local email/full name, confirm trước disable/enable.
- Vectors:
  - Thêm sidebar entry.
  - Giữ index/search/score pair, thêm validation rõ cho vector JSON và kết quả payload preview.
- Reset/API keys dangerous actions giữ confirm hiện có.
- Các dangerous actions của Admin như reset database, clear API keys, delete API key phải dùng `ConfirmDialog` với cảnh báo rõ ràng, tone danger, và `disabled={saving || busy}` để tránh double submit.

### 6. Notifications, Status, Cross-Cutting UX
- Notification pages giữ `fetchNotifications`, `markNotificationRead`, `markAllNotificationsRead`; topbar panel dùng cùng API.
- Mọi page có API mutation phải có loading/disabled/error/success state.
- Không lọc local trên dữ liệu đã phân trang trừ khi dữ liệu đã được fetch đầy đủ có giới hạn nhỏ và plan chỉ rõ giới hạn đó; ưu tiên thêm optional query params vào endpoint hiện có thay vì làm mất dữ liệu ở trang khác.
- Mọi text mới hoặc text thay thế trong UI phải dùng i18n qua `t(...)`; cập nhật đồng bộ `apps/frontend/messages/en.json` và `apps/frontend/messages/vi.json`.
- Các nhãn filter, dialog, lỗi và success message mới không được hardcode trực tiếp trong component, bao gồm `Status`, `AI Status`, `Category`, `Score range`, `Save`, `Close`.
- Không còn nút/action visible mà không có handler hoặc link hợp lệ.
- Không còn text hardcoded demo/placeholder kiểu “Job description details”, “AI readiness score will appear here”.
- Các route không có backend support sẽ không hiển thị action giả.

## Public API / Interface Changes
- Không đổi backend route path hoặc response contract.
- Có thể bổ sung optional query params không breaking cho endpoint hiện có để hỗ trợ UI filter đúng với pagination, ví dụ `/applications/history?search=&status=&ai_status=&submitted_after=&submitted_before=`.
- Bổ sung backend permission guard cho candidate profile read path của recruiter mà không đổi route path.
- Thêm/sửa frontend-only types:
  - `SystemStatus` nhận cached LLM health fields.
  - Typed DTOs cho candidate profile, company profile, ranked candidates, application status history.
  - `CreateJobPayload` và `UpdateJobPayload` dùng chung cho new/edit job.
- Route frontend mới:
  - `/recruiter/candidates/[id]` read-only profile/application history page.
- `/api/internal/applications/:id/process-ai` không nối UI trực tiếp; đây là endpoint internal.

## Test Plan
- Frontend unit/API tests:
  - Typed API helpers gọi đúng endpoint và map đúng response cho jobs, applications, company, candidate profile, status, LLM events.
  - API helpers gửi filter qua query params thay vì filter local trên dữ liệu phân trang.
  - `SystemHealthBadge` render healthy/stale/error states.
  - Feature flags disable cover/outreach generation buttons.
- Frontend page tests with mocked fetch:
  - Candidate applications filters, detail status/history, recommendation apply modal.
  - Candidate `Re-apply` chỉ hiện/enable khi job còn `active`; job `closed/deleted` không cho nộp lại.
  - Recruiter job filters, close/reopen/delete, ranked candidates filters, bulk status update.
  - Recruiter ranked candidate filters gửi `search/status/ai_status/min_score/max_score` lên backend và reset page về 1 khi đổi filter.
  - Bulk status update mở confirm dialog; cancel không gọi API, confirm mới gọi đúng payload.
  - Dangerous actions disable button khi `busy/saving`, cancel không gọi API, double click không tạo request lặp.
  - Recruiter dashboard chỉ render recent applications/status changes trong giới hạn đã cấu hình.
  - `/recruiter/candidates/[id]` xử lý 403 từ backend bằng error state rõ ràng và không hiển thị dữ liệu nhạy cảm.
  - Recruiter company profile loads/saves via `/company/me`.
  - Admin LLM events filters and vectors page actions.
- Regression checks:
  - `npm.cmd run typecheck`
  - `npm.cmd test`
  - Kiểm tra `messages.test.ts` pass sau khi thêm/sửa i18n keys trong `en.json` và `vi.json`.
  - Manual smoke with real backend: login candidate/recruiter/admin, apply job, view ranked candidates, update status, generate interview questions, cover/outreach, admin config, vectors.

## Assumptions
- Chỉ frontend/UI và frontend API client cần sửa; backend route hiện có là contract chính.
- Không thêm OAuth vì backend chưa có endpoint Google login.
- Không thêm draft job vì backend chỉ có `active | closed | deleted`.
- Search/AI/score filters sẽ filter local nếu backend chưa có query tương ứng.
- Interview generation chỉ được mở cho resume/application mà recruiter có quyền theo backend guard.
