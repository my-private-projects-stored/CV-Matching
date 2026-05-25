# CV Matching Platform — Full UI/UX Overhaul + API Integration

## Summary

Dự án đã có đầy đủ skeleton code cho tất cả các trang (auth, candidate, recruiter, admin), API client đã được tích hợp sẵn. Tuy nhiên toàn bộ giao diện đang ở dạng tối giản (raw Tailwind + CSS vars), thiếu visual polish, thiếu micro-animations, thiếu responsive design chất lượng cao và một số tính năng còn chưa hoàn chỉnh.

**Mục tiêu**: Nâng cấp toàn bộ UI/UX lên chuẩn premium, đảm bảo mọi API đều được kết nối đúng theo conventions.

---

## Phân tích hiện trạng

| Area | Hiện trạng | Vấn đề |
|---|---|---|
| `globals.css` | Design tokens đầy đủ | Thiếu animations, glassmorphism, dark-mode ready |
| `AuthLayout.tsx` | Có layout split | Chưa có background visual ấn tượng |
| `Sidebar.tsx` | Functional, dùng `<a>` thô | Không dùng `<Link>`, không có icons, không highlight active |
| `Topbar.tsx` | Placeholder | Không hiện tên user, không có avatar, không có logout |
| Tất cả các page | Functional nhưng plain | Không có micro-animation, không có empty states đẹp, thiếu responsive |
| Dashboard pages | Có StatCard, ScoreBar | ScoreBar không animated, CandidateRow thiếu thông tin |
| `recruiter/jobs/new` | Basic form | Không redirect sau submit, không có deadline picker |
| `recruiter/jobs/[id]/candidates` | Có bulk update | CandidateRow dùng sai field (jobId thay vì tên candidate) |
| `candidate/resumes` | Functional | Không có preview, không có builder link đúng |

---

## Proposed Changes

### 1. Design System Enhancement

#### [MODIFY] [globals.css](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/styles/globals.css)
- Bổ sung shimmer animation hoàn chỉnh
- Thêm `--sidebar-width`, `--topbar-h` variables
- Thêm `card-hover`, `glass-surface` utility classes
- Cải thiện các keyframes (slideIn, scaleIn, pulse-dot)

---

### 2. Layout Components

#### [MODIFY] [Sidebar.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/components/layout/Sidebar.tsx)
- Thay `<a>` → `<Link>` từ next/link
- Bổ sung icon cho mỗi nav item (lucide-react hoặc SVG inline)
- Logo đẹp hơn với gradient
- Active state với left-border highlight + background
- User info panel ở dưới hiển thị tên thật + email + avatar placeholder
- Logout button

#### [MODIFY] [Topbar.tsx](file:///d:/Project/CV Matching/CV-Matching/apps/frontend/components/layout/Topbar.tsx)
- Hiển thị tên user từ auth context
- Avatar circle với initials
- Breadcrumb/page title
- Notification bell placeholder

#### [MODIFY] [AuthLayout.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/components/layout/AuthLayout.tsx)
- Split screen: form bên trái, hero visual bên phải
- Hero panel với animated gradient background + platform stats

---

### 3. UI Components Nâng cấp

#### [MODIFY] [StatCard.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/components/ui/StatCard.tsx)
- Bổ sung icon, trend indicator, border gradient khi hover
- Micro-animation khi mount (fadeUp)

#### [MODIFY] [ScoreBar.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/components/ui/ScoreBar.tsx)
- CSS animation `barGrow` khi render
- Hiển thị % value bên phải
- Màu sắc theo threshold (xanh/vàng/đỏ)

#### [MODIFY] [CandidateRow.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/components/ui/CandidateRow.tsx)
- Hiển thị đúng: tên ứng viên, email, hybrid score bar, status badges
- Avatar với initials
- Hover state + download resume button cho recruiter

#### [MODIFY] [StatusBadge.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/components/ui/StatusBadge.tsx)
- Màu sắc semantic phong phú hơn theo từng status
- Dot pulse animation cho trạng thái active

#### [MODIFY] [AiStatusBadge.tsx / AiStatusIndicator.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/components/ui/AiStatusBadge.tsx)
- Spinner animation khi pending/parsing/scoring
- Progress style khi scoring

#### [MODIFY] [EmptyState.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/components/ui/EmptyState.tsx)
- Icon SVG minh họa + action button optional

#### [MODIFY] [AiScoreWidget.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/components/ui/AiScoreWidget.tsx)
- Circular progress ring cho hybridScore
- Keyword badges có màu xanh (matched) / đỏ (missing)

---

### 4. Auth Pages

#### [MODIFY] [login/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(auth)/login/page.tsx)
- Glass-morphism form card
- Smooth focus transitions trên inputs
- Animated error/success banners

#### [MODIFY] [register/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(auth)/register/page.tsx)
- Đọc hiện trạng + cải thiện tương tự login

---

### 5. Candidate Pages

#### [MODIFY] [candidate/dashboard/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/dashboard/page.tsx)
- StatCards với icons và trend
- Applications table với ScoreBar animated
- "Browse Jobs" CTA section khi chưa có application

#### [MODIFY] [candidate/jobs/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/jobs/page.tsx)
- Job cards đẹp hơn: company logo placeholder, gradient category badge
- Apply modal được refactor thành component riêng với animation

#### [MODIFY] [candidate/applications/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/applications/page.tsx)
- Timeline view cho status history
- Score bar animated + keyword preview inline

#### [MODIFY] [candidate/applications/[id]/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/applications/[id]/page.tsx)
- Circular score ring
- Keyword chips phân loại matched/missing rõ ràng
- Improvement section với actionable bullet points

#### [MODIFY] [candidate/resumes/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/resumes/page.tsx)
- Drag & drop zone cho upload (visual improvement)
- Resume card với processing status badge animated
- Action buttons cleaner

#### [MODIFY] [candidate/optimize/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/optimize/page.tsx)
- Side-by-side JD Match View được cải thiện với color highlighting
- Match percentage dạng ring chart
- Enrichment flow step-by-step UI

#### [MODIFY] [candidate/profile/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/profile/page.tsx)
- Avatar upload placeholder
- Completeness progress bar
- Section headers rõ ràng

---

### 6. Recruiter Pages

#### [MODIFY] [recruiter/dashboard/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/recruiter/dashboard/page.tsx)
- StatCards với icons
- Top candidates table với hybrid scores
- Recent jobs list

#### [MODIFY] [recruiter/jobs/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/recruiter/jobs/page.tsx)
- Table với status pill, deadline warning
- Hover row highlight

#### [MODIFY] [recruiter/jobs/new/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/recruiter/jobs/new/page.tsx)
- Redirect sang `/recruiter/jobs` sau submit thành công
- Thêm `applicationDeadline` date picker + `experienceLevel` field
- Live character count cho description/requirements

#### [MODIFY] [recruiter/jobs/[id]/edit/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/recruiter/jobs/[id]/edit/page.tsx)
- Load job data và populate form
- API `PATCH /api/jobs/:id`

#### [MODIFY] [recruiter/jobs/[id]/candidates/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/recruiter/jobs/[id]/candidates/page.tsx)
- Fix CandidateRow để hiển thị đúng: tên, email, scores
- Candidate card với hybrid score ring
- Download resume button → `GET /api/resumes/:id/download`
- Pipeline status update per-candidate (dropdown inline)

#### [MODIFY] [recruiter/company/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/recruiter/company/page.tsx)
- Thêm logo upload placeholder
- Section headers và better field layout

---

### 7. Admin Pages

#### [MODIFY] [admin/config/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/admin/config/page.tsx)
- Tab navigation đẹp hơn với icons
- LLM config với provider logo badges
- Feature flags dùng toggle switch component (đã có)
- API key status với colored indicators

#### [MODIFY] [admin/users/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/admin/users/page.tsx)
- Table với avatar, role badge, status indicator
- Enable/Disable với confirm dialog (đã có component)
- Search/filter bar

---

### 8. Missing Routes cần tạo mới

#### [NEW] [recruiter/jobs/[id]/edit/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/recruiter/jobs/[id]/edit/page.tsx)
- Form giống trang New Job nhưng pre-populate từ API `GET /api/jobs/:id`
- Submit → `PATCH /api/jobs/:id`

#### [NEW] [recruiter/jobs/[id]/candidates/[appId]/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/recruiter/jobs/[id]/candidates/[appId]/page.tsx)
- Chi tiết ứng viên: thông tin cá nhân + scores + keywords
- Update pipeline status inline
- Download resume button

#### [NEW] [candidate/jobs/[id]/page.tsx](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/app/(app)/candidate/jobs/[id]/page.tsx)
- Job detail view: title, description, requirements, deadline
- Apply button với resume picker

---

## Verification Plan

### Build check
```bash
cd apps/frontend && npm run build
```

### Manual Verification (theo role)
1. **Auth**: Login → redirect đúng role → Logout → trở về login
2. **Candidate**: Upload resume → Browse jobs → Apply → xem Applications → xem Feedback → Optimize CV
3. **Recruiter**: Post job → xem candidates ranked by hybridScore → update status → download resume
4. **Admin**: Config LLM provider → toggle feature flags → manage users

### API Connections cần verify
- `POST /api/auth/login` → JWT stored, user role returned
- `GET /api/jobs` → job list với pagination
- `POST /api/applications` → apply success → duplicate check
- `GET /api/applications/ranked?job_id=:id` → sorted by hybridScore
- `GET /api/applications/:id/feedback` → matchedKeywords + missingKeywords
- `PATCH /api/applications/:id/status` → pipeline update
- `GET /api/config/llm-api-key` → admin config panel
