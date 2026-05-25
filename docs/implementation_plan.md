# Implementation Plan — Smart CV Matching Platform
## Kiểm tra & Triển khai End-to-End Use Cases

> Dựa trên audit toàn bộ: 5 backend controllers (60+ handlers), 12 frontend pages, 4 workers.

---

## 📊 Bảng trạng thái tổng hợp

### UC-CORE: AI Pipeline

| ID | Use Case | Backend | Frontend | Trạng thái |
|---|---|---|---|---|
| UC-CORE-01 | Create Job Description | ✅ | ✅ `/recruiter/jobs/new` | ✅ Hoàn thiện |
| UC-CORE-02 | Upload Resume + Parsing | ✅ | ✅ `/candidate/resumes` | ✅ Hoàn thiện |
| UC-CORE-03 | Compute Hybrid Score | ✅ worker-scoring + internal API | N/A | ✅ Hoàn thiện |
| UC-CORE-04 | Ranked Candidate Dashboard | ✅ `GET /applications/ranked` | ⚠️ `CandidateRow` hiển thị sai field (name=_id, role=jobId), filter không hoạt động | ⚠️ Cần sửa |
| UC-CORE-05 | AI Feedback for Candidate | ✅ `GET /applications/:id/feedback` | ⚠️ Score widget ✅, action buttons dead, thiếu improvement suggestions | ⚠️ Cần sửa |

### UC-BASIC: Foundation

| ID | Use Case | Backend | Frontend | Trạng thái |
|---|---|---|---|---|
| UC-BASIC-01 | Register account | ✅ | ✅ (company name workaround) | ✅ Hoàn thiện |
| UC-BASIC-02 | Login (JWT) | ✅ | ✅ | ✅ Hoàn thiện |
| UC-BASIC-03 | Forgot password | ✅ cả 2 bước | ⚠️ Chỉ có bước 1 (request reset), thiếu trang `/reset-password` | ⚠️ Cần sửa |
| UC-BASIC-04 | Change password | ✅ `POST /auth/change-password` | ❌ Không có trang/UI nào | ❌ Thiếu hoàn toàn |
| UC-BASIC-05 | Manage personal profile | ✅ | ✅ (thiếu avatar upload, fullName readonly) | ✅ Cơ bản đủ |
| UC-BASIC-06 | Browse & search job listings | ✅ `GET /jobs` | ❌ Không có trang browse jobs cho candidate | ❌ Thiếu hoàn toàn |
| UC-BASIC-07 | View application history | ✅ | ⚠️ Hiển thị `jobId` raw, filter không hoạt động | ⚠️ Cần sửa |
| UC-BASIC-08 | Manage company profile | ✅ `GET/PUT /config/company-profile` | ⚠️ Frontend gọi sai endpoint `companies/me` (không tồn tại) | ⚠️ Cần fix bug |
| UC-BASIC-09 | View posted job listings | ✅ | ⚠️ Filter/search UI là placeholder, không hoạt động | ⚠️ Cần sửa |
| UC-BASIC-10 | Update job posting | ✅ `PATCH /jobs/:id` | ✅ `/recruiter/jobs/[id]/edit` | ✅ Hoàn thiện |
| UC-BASIC-11 | Close / soft-delete job | ✅ | ✅ | ✅ Hoàn thiện |
| UC-BASIC-12 | Download original resume file | ✅ (recruiter được phép nếu candidate đã apply) | ✅ Có trong recruiter application detail | ✅ Hoàn thiện |
| UC-BASIC-13 | Update candidate pipeline status | ✅ | ✅ Buttons Move/Reject/Hire trong recruiter detail | ✅ Hoàn thiện |

### UC-RM: Product Extended

| ID | Use Case | Backend | Frontend | Trạng thái |
|---|---|---|---|---|
| UC-RM-01 | Master Resume management | ✅ versioning, parentResumeId | ✅ Set master, history | ✅ Hoàn thiện |
| UC-RM-02 | AI tailor resume to JD | ✅ improve/preview/confirm | ✅ `/candidate/optimize` | ✅ Hoàn thiện |
| UC-RM-03 | Resume Builder + live preview | ✅ builderData persisted | ⚠️ Preview text-only, không phân biệt template | ⚠️ Cần hoàn thiện |
| UC-RM-04 | Advanced section management | ✅ API sections CRUD | ✅ rename/show-hide/add/delete, thiếu drag-drop thật | ⚠️ Cần cải thiện |
| UC-RM-05 | Choose resume template | ✅ 4 templates stored | ⚠️ Dropdown có nhưng preview không đổi visually | ⚠️ Cần hoàn thiện |
| UC-RM-06 | Formatting controls | ✅ formatSettings persisted | ⚠️ Thiếu margin controls | ⚠️ Nhỏ, cần thêm |
| UC-RM-07 | JD Match View | ✅ `POST /resumes/:id/jd-match` | ✅ Tab JD Match trong optimize | ✅ Hoàn thiện |
| UC-RM-08 | Resume Enrichment | ✅ analyze/enhance/apply | ✅ Tab AI Enrichment | ✅ Hoàn thiện |
| UC-RM-09 | Cover Letter + Outreach Email | ✅ generate/update/download PDF routes | ❌ Không có trang/UI nào | ❌ Thiếu hoàn toàn |
| UC-RM-10 | WYSIWYG PDF Export | ✅ Playwright render | ⚠️ API call ✅ nhưng preview không WYSIWYG (template không render thật) | ⚠️ Phụ thuộc UC-RM-03 |
| UC-RM-11 | Multi-language UI + AI content | ✅ systemconfigs languageConfig | ⚠️ i18n setup có, hardcoded `'en'` trong optimize, language toggle trong login là placeholder | ⚠️ Cần mở rộng |
| UC-RM-12 | Privacy mode + AI provider config | ✅ | ✅ Admin config page | ✅ Hoàn thiện |

---

## 🐛 Bugs quan trọng cần fix ngay

> [!CAUTION]
> **BUG BẢO MẬT**: `(auth)/forgot-password/page.tsx` đang hiển thị `reset_token` trực tiếp trên UI: `` `${result.message}. Token: ${result.reset_token}` `` — cần xóa token khỏi UI ngay, chỉ hiển thị "check your email".

> [!WARNING]
> **BUG LOGIC**: `builder/page.tsx` hàm `toggleSection()` có bug: `isVisible: meta.isVisible === false` → logic sai, nên là `isVisible: !meta.isVisible`. Kết quả: toggle không hoạt động đúng.

> [!WARNING]
> **BUG ENDPOINT**: `recruiter/company/page.tsx` gọi `companies/me` (không tồn tại) thay vì đúng là `config/company-profile`.

---

## 📋 Proposed Changes — Chi tiết theo Phase

---

### 🔴 Phase 1: Critical Bugs & Missing Pages (Tuần 1)

#### 1.1 Fix Bug Bảo Mật — Forgot Password Page
**[MODIFY]** [forgot-password/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(auth)/forgot-password/page.tsx)
- Xóa `result.reset_token` khỏi success message
- Thêm trang `/reset-password` (nhận `?token=` từ URL, form nhập new password, gọi `POST /auth/reset-password`)

#### 1.2 Fix Bug Logic — Builder Toggle Section
**[MODIFY]** [builder/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/resumes/[id]/builder/page.tsx)
- Sửa `toggleSection()`: `isVisible: meta.isVisible === false` → `isVisible: !meta.isVisible`

#### 1.3 Fix Bug Endpoint — Company Profile
**[MODIFY]** [recruiter/company/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/recruiter/company/page.tsx)
- `getPath('companies/me')` → `getPath('config/company-profile')`
- `putOne('companies', id, profile)` → `putOne('config', 'company-profile', profile)`

#### 1.4 [NEW] Trang Browse Jobs cho Candidate — UC-BASIC-06
**[NEW]** `apps/frontend/app/(app)/candidate/jobs/page.tsx`
- List active jobs với filter hoạt động: category (IT/Accounting/Marketing), location (text), search
- Pagination (infinite scroll hoặc page-based)
- Job card: title, company name, location, deadline, category badge, experience level
- Button "Apply" → modal chọn resume → `POST /api/applications`
- Button "View Details" → `/candidate/jobs/[id]`

**[NEW]** `apps/frontend/app/(app)/candidate/jobs/[id]/page.tsx`
- Chi tiết JD: title, description, requirements, benefits
- Sidebar: company info, deadline, category, location
- Button "Apply" → chọn resume → `POST /api/applications`
- Check nếu đã apply → hiển thị trạng thái

#### 1.5 [NEW] Change Password UI — UC-BASIC-04
**[NEW]** `apps/frontend/app/(app)/candidate/settings/page.tsx`
- Form: current password, new password, confirm new password
- Gọi `POST /api/auth/change-password`
- Success/error message
- Thêm link "Settings" vào sidebar candidate

**[MODIFY]** Recruiter cũng cần:
**[NEW]** `apps/frontend/app/(app)/recruiter/settings/page.tsx` (hoặc reuse component)
- Cùng form change password

#### 1.6 [NEW] Cover Letter & Outreach Email UI — UC-RM-09
**[NEW]** `apps/frontend/app/(app)/candidate/resumes/[id]/cover-letter/page.tsx`
- **Tab "Cover Letter"**:
  - Textarea nhập job title/JD context
  - Button "Generate with AI" → `POST /api/resumes/:id/generate-cover-letter`
  - Editor textarea hiển thị kết quả, có thể edit
  - Button "Save" → `PATCH /api/resumes/:id/cover-letter`
  - Button "Download PDF" → `GET /api/resumes/:id/cover-letter/pdf`
- **Tab "Outreach Email"**:
  - Tương tự, dùng `generate-outreach` và `outreach-message` endpoints
- Link từ builder page sidebar để navigate đến trang này

---

### 🟡 Phase 2: Partial Features & UX Improvements (Tuần 2)

#### 2.1 Fix Ranked Candidates Dashboard — UC-CORE-04
**[MODIFY]** [recruiter/jobs/[id]/candidates/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/recruiter/jobs/[id]/candidates/page.tsx)
- Fix API call: `jobs/${jobId}/applications` → `applications/ranked?job_id=${jobId}`
- Enrich data: join với candidate info để hiển thị candidate name thật (từ `application.candidateId`)
- Fix `CandidateRow`: truyền đúng `name`, `hybridScore`, `aiStatus`, `status`
- Implement working filters:
  - Search by name: client-side filter
  - Status dropdown: filter applications theo `status` enum
  - AI Status dropdown: filter theo `aiStatus`
  - Score range: min/max hybridScore filter
- Thêm "Bulk Actions": checkbox chọn nhiều, dropdown action → gọi `PATCH /api/applications/status/bulk`

#### 2.2 Fix AI Feedback Page — UC-CORE-05
**[MODIFY]** [candidate/applications/[id]/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/applications/[id]/page.tsx)
- Hiển thị job title thực (link → `/candidate/jobs/:jobId`)
- Thêm section "Improvement Suggestions" từ `aiDetails.missingKeywords`
- Fix "Edit Resume" button → navigate `/candidate/resumes/:resumeId/builder`
- Fix "Re-apply" → navigate `/candidate/jobs/:jobId`
- Thêm score breakdown giải thích semantic vs keyword vs hybrid

#### 2.3 Fix Application History — UC-BASIC-07
**[MODIFY]** [candidate/applications/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/applications/page.tsx)
- Enrich với job data: hiển thị `job.title` thay vì raw `jobId`
- Implement working filters (client-side): status, aiStatus
- Format date `createdAt` đẹp hơn (vd: "3 days ago", "May 20, 2026")
- Thêm link "Apply Again" / "View Job"

#### 2.4 Fix Job Listings Recruiter — UC-BASIC-09
**[MODIFY]** [recruiter/jobs/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/recruiter/jobs/page.tsx)
- Implement filter hoạt động: search theo title, filter status (active/closed), filter category
- Hiển thị số lượng ứng viên per job
- Format deadline date

#### 2.5 Fix Reset Password Page — UC-BASIC-03
**[NEW]** `apps/frontend/app/(auth)/reset-password/page.tsx`
- Đọc `?token=` từ URL params
- Form: new password + confirm
- Gọi `POST /api/auth/reset-password` với token + new password
- Redirect → `/login` sau khi thành công

---

### 🟢 Phase 3: Template Rendering & Multi-Language (Tuần 3)

#### 3.1 Resume Builder Template Rendering — UC-RM-03, UC-RM-05
**[MODIFY]** [builder/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/resumes/[id]/builder/page.tsx)
- Implement 4 visual templates trong preview panel:
  - **classic-single**: serif-like heading, single column, dividers giữa sections
  - **modern-single**: sans-serif, color accent, single column
  - **classic-two-column**: sidebar bên trái (contact, skills), main bên phải
  - **modern-two-column**: sidebar màu với đảo layout
- Thêm margin controls vào format settings
- Fix inline editing cho default sections: click to edit experience items, education items
- Drag-and-drop sections (dùng HTML5 native drag hoặc `@dnd-kit/core`)

#### 3.2 Multi-language — UC-RM-11
**[MODIFY]** [optimize/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/optimize/page.tsx)
- Thay `output_language: 'en'` hardcoded bằng `languageConfig.content_language` từ API

**[MODIFY]** [login/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(auth)/login/page.tsx)
- Kết nối VI/EN toggle button với `next-intl` hoặc language context

---

## 🔌 Navigation Updates

**[MODIFY]** Candidate Layout Sidebar — thêm menu items:
- "Browse Jobs" → `/candidate/jobs`
- "Settings" → `/candidate/settings`

**[MODIFY]** Recruiter Layout Sidebar — thêm:
- "Settings" → `/recruiter/settings`

**[MODIFY]** Resume Builder — thêm link "Cover Letter" → `/candidate/resumes/:id/cover-letter`

---

## ✅ Verification Plan

### Sau Phase 1:
- [ ] Test register → login → browse jobs → apply thành công
- [ ] Test forgot password → nhận token → reset password → login lại
- [ ] Test candidate change password → login với password mới
- [ ] Test generate + download cover letter

### Sau Phase 2:
- [ ] Test recruiter: view ranked candidates đúng tên, filter hoạt động, bulk update status
- [ ] Test candidate: view feedback có job title đúng, edit resume link hoạt động
- [ ] Test company profile recruiter lưu được đúng

### Sau Phase 3:
- [ ] Chọn template "modern-two-column" → preview thay đổi visually
- [ ] Export PDF → PDF khớp với preview
- [ ] AI content generate theo ngôn ngữ được chọn

---

## ❓ Open Questions

> [!IMPORTANT]
> **Q1 (UC-BASIC-06)**: Candidate có thể apply mà chưa có resume không? Hay bắt buộc upload/create resume trước? Nếu chưa có resume thì flow UI sẽ như thế nào?

> [!IMPORTANT]
> **Q2 (UC-RM-03)**: Template rendering — cần implement thật 4 layout CSS khác nhau trong preview, hay chỉ cần thay đổi typography/color scheme đơn giản là đủ?

> [!NOTE]
> **Q3**: Recruiter "Change Password" — Dùng riêng trang `/recruiter/settings` hay share component chung?

> [!NOTE]
> **Q4 (UC-BASIC-12)**: Backend `downloadOriginalResumeHandler` đã cho phép recruiter download nếu candidate đã apply vào job của họ. Cần xác nhận điều này đã hoạt động đúng ở môi trường thực tế chưa.

> [!WARNING]
> **Q5 (UC-RM-11)**: Multi-language scope — Chỉ AI content (output_language) hay cả toàn bộ UI text? Nếu cả UI, cần estimate effort dịch strings cho 6 ngôn ngữ (EN/ES/ZH/JA/PT/VI).

---

## 📊 Tóm tắt Gap Summary

| Priority | Số lượng | Mô tả |
|---|---|---|
| 🔴 Bug critical | 3 | Security bug (token expose), logic bug (toggle), wrong endpoint |
| 🔴 Thiếu hoàn toàn | 4 | Change Password UI, Browse Jobs (candidate), Cover Letter UI, Reset Password page |
| 🟡 Cần sửa/hoàn thiện | 8 | Ranked Dashboard, AI Feedback, App History, Company Profile, Job Listings filter, Template rendering, Builder margin |
| 🟢 Cải thiện UX | 3 | Navigation, Multi-language, Drag-drop sections |
