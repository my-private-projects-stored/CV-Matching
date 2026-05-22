# Prompt: Build Full UI/UX — Smart CV Matching Platform

## Context
You are building the complete frontend for "Smart CV Matching & Recruitment Platform"
using **Next.js 16, React 19, TypeScript, Tailwind CSS 4**.

Before writing any code, read these files in order:
1. `.docs/instructions.md` — project overview, schema, rules
2. `docs/conventions.md` — API conventions, field names, TypeScript patterns
3. `docs/use-cases.md` — all use cases by actor
4. `docs/skill-ui-design.md` — complete design system and component specs

---

## Design Identity

This platform has a distinctive visual language. Never deviate from it.

### Fonts (load via Google Fonts)
```html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```
- **Instrument Serif** → page titles, hero text, large numbers, italic accent in `--gold`
- **DM Sans** → all UI labels, body, buttons, nav
- **JetBrains Mono** → scores, IDs, numeric values

### CSS Variables (declare in `globals.css`, use everywhere)
```css
:root {
  --blue-900: #0f1f5c;
  --blue-700: #1d4ed8;
  --blue-600: #2563eb;
  --blue-100: #dbeafe;
  --blue-50:  #eff6ff;
  --gold:     #c9a84c;
  --gold-dim: rgba(201,168,76,0.15);
  --gold-border: rgba(201,168,76,0.28);
  --bg:       #f8f7f4;
  --surface:  #ffffff;
  --border:   #e2e8f0;
  --text-1:   #0f172a;
  --text-2:   #475569;
  --text-3:   #94a3b8;
  --success:  #16a34a;
  --warning:  #d97706;
  --danger:   #dc2626;
  --info:     #0891b2;
}
```

### Score color logic (reuse in every component showing hybridScore)
```typescript
export function scoreColor(score: number) {
  if (score >= 0.75) return 'var(--success)'
  if (score >= 0.50) return 'var(--warning)'
  return 'var(--danger)'
}
export function scoreLabel(score: number) {
  if (score >= 0.75) return 'Strong match'
  if (score >= 0.50) return 'Potential'
  return 'Weak match'
}
```

---

## Page List — Build in This Order

### PHASE 1: Auth (no sidebar)
Build with the **two-column brand layout**: left 52% dark navy brand panel + right 48% form.

#### Left panel (shared across all auth pages)
```
- Logo: gold square mark (CV) + "CV Matching" DM Sans 600 + "Recruitment Platform" uppercase muted
- Background: --blue-900 + layered radial gradients + 48px grid overlay + 3 blurred orbs (animated float)
- Floating AI score card (top-right of panel, animated bob):
    backdrop-blur glass card showing:
    Semantic  ████░░ 0.82  (blue fill)
    Keyword   ███░░░ 0.65  (green fill)
    Hybrid    ████░░ 0.76  (gold fill)
    gold dot blink animation on label
- Hero text (bottom of panel):
    pill badge: "AI-Powered Recruitment" (gold border, gold text)
    h1 Instrument Serif 52px: "Connect talent / with [opportunity] / intelligently."
      [opportunity] = italic, color --gold
    p 14px rgba(255,255,255,0.50): engine description
    stats row: 98% Accuracy | 3× Faster | SBERT+BM25  (separated by 1px rgba dividers)
```

#### Page: /login
```
Right panel:
- Top right: [VI/EN lang toggle btn] + "No account? Sign Up" link
- Eyebrow: "SMART CV MATCHING" uppercase blue-600 11px
- Title: "Welcome back" Instrument Serif 38px
- Subtitle: 13px text-2
- Role toggle: [👤 Candidate] [🏢 Recruiter] — pill switcher, active=white bg blue text
- Email input (icon ✉)
- Password input (icon 🔒) + "Forgot password?" right-aligned link
- Primary CTA: "Sign In →" full-width
- Divider: "or continue with"
- Google SSO button (secondary style)
- Footer: Terms + Privacy links
```

#### Page: /register
```
Right panel:
- Role toggle FIRST (determines which fields appear below)
- Candidate fields: fullName · email · password · confirmPassword
- Recruiter fields: fullName · companyName · email · password · confirmPassword
- Terms checkbox
- Primary CTA: "Create Account →"
- "Already have an account? Sign In" link
```

#### Page: /forgot-password
```
Right panel (simplified):
- Title: "Reset your password"
- Email input
- CTA: "Send reset link"
- "← Back to Sign In" ghost link
```

---

### PHASE 2: Shared App Shell

Build a layout component `AppShell` used by ALL authenticated pages.

```
┌──────────────────────────────────────────────────────┐
│  TOPBAR h-14 bg-surface border-b border-border       │
│  [Logo mark] [CV Matching] / [Breadcrumb]            │
│  [Search input flex-1 max-w-80]  [🔔] [Avatar]       │
├──────────┬───────────────────────────────────────────┤
│ SIDEBAR  │  MAIN  flex-1 overflow-y-auto p-6 md:p-8  │
│ w-56     │                                           │
│ bg-white │  <slot />                                 │
│ border-r │                                           │
└──────────┴───────────────────────────────────────────┘
```

Sidebar renders different nav items based on `user.role`:

**Candidate nav:**
```
[GROUP] Workspace
  ◻  Overview          /candidate/dashboard
  ✦  AI Applications   /candidate/applications
  📄  My Resumes        /candidate/resumes
  ✨  Optimize CV       /candidate/optimize
[GROUP] Account
  👤  Profile           /candidate/profile
[BOTTOM] role badge: blue-50 bg, "Candidate" blue-700, email text-3
```

**Recruiter nav:**
```
[GROUP] Workspace
  ◻  Overview          /recruiter/dashboard
  📋  Job Postings      /recruiter/jobs
  👥  Candidates        /recruiter/candidates
[GROUP] Account
  🏢  Company Profile   /recruiter/company
[BOTTOM] role badge: gold-dim bg, "Recruiter" amber, email text-3
```

**Admin nav:**
```
[GROUP] System
  ⚙  Config            /admin/config
  👥  Users             /admin/users
```

Nav item active state: `bg-blue-50 text-blue-700 border-r-2 border-blue-700 font-semibold`

---

### PHASE 3: Candidate Pages

#### /candidate/dashboard
```
Page header: "Overview" Serif 28px + greeting subtitle
Stat cards row (4 cards, grid-cols-4):
  📄 Applications Sent   → total count
  🎯 Avg Match Score     → avg hybridScore as %
  💬 Interviews          → count where status=interview
  ⏳ Pending AI          → count where aiStatus=pending|parsing|scoring
Recent applications table (last 5):
  cols: Job Title | Company | Applied | hybridScore bar | aiStatus badge | status badge
"View all" link to /candidate/applications
Tips card: "Improve your profile" with 2–3 actionable suggestions
```

#### /candidate/applications
```
Filter bar: [Search] [status dropdown] [aiStatus dropdown] [date range]
List of ApplicationRow components sorted by createdAt DESC:
  Each row: job title + company | location | applied date
            hybridScore progress bar + % | aiStatus badge | status badge
            [View Feedback] button → /candidate/applications/:id
Empty state: illustration + "No applications yet" + [Browse Jobs] CTA
```

#### /candidate/applications/:id  (AI Feedback — UC-CORE-05)
```
Two-column layout (no sidebar override, use full main area):
Left col (w-72):
  Job info card: title · company · location · deadline · category badge
  [← Back to Applications] link

Right col (flex-1):
  AI Score Widget (full component):
    Score ring SVG (stroke color = scoreColor(hybridScore))
    Center: hybridScore×100 JetBrains Mono large + "/100"
    Label: scoreLabel(hybridScore) badge (strong/potential/weak)
    Three bars: Semantic (blue) · Keyword (green) · Hybrid (gold)
    Matched Keywords section: green badges
    Missing Keywords section: red badges + tip text
  aiStatus indicator (if not completed, show progress state)
  Action row: [✎ Edit Resume] [🔄 Re-apply with updated CV]
```

#### /candidate/resumes  (UC-RM-01)
```
Page header: "My Resumes" + [+ New Resume] primary btn
Master resume pinned at top: gold border card, "MASTER" gold pill badge
Resume card grid (3 cols):
  Each card: title · created date · isMaster badge
  Actions: [Edit] [Download] [Delete] [Set as Master]
Empty state: upload illustration + [Upload Resume] CTA
```

#### /candidate/resumes/:id/builder  (UC-RM-03,04,06)
```
Full-width layout (hide normal page padding):
Toolbar top:
  [← Back] | Template selector dropdown | [Format ▾] | [Export PDF] primary btn
Split view:
  Left panel w-60 bg-surface border-r:
    Tabs: [Sections] [Format] [Template]
    Sections tab:
      Draggable list of resume sections
      Each item: drag handle ⠿ | section name | visibility toggle (on/off)
      [+ Add Section] ghost btn at bottom
    Format tab:
      Page size (A4/Letter) · Margin · Font size · Line spacing · Compact toggle
    Template tab:
      4 template cards: Classic Single · Modern Single · Classic Two-col · Modern Two-col
  Right panel flex-1 bg-[#f1f0ec] flex items-center justify-center:
    White paper shadow (A4 ratio) with live preview
    Watermark "PREVIEW" if not saved
```

#### /candidate/optimize  (UC-RM-07,08)
```
Tabs: [JD Match View] [AI Enrichment]
JD Match View tab:
  Top bar: match % pill + [Optimize with AI] btn
  Textarea for JD input (if not yet provided)
  Side-by-side columns:
    Left: JD text — matched keywords highlighted green, missing highlighted red
    Right: Resume text — same highlighting
AI Enrichment tab:
  Guided questions list
  Each question: text + textarea answer
  [Generate Bullet Points] → shows AI output below
  [Apply to Resume] btn
```

#### /candidate/profile  (UC-BASIC-05)
```
Left: avatar upload circle + name + role badge + member since
Right: form sections
  Personal: fullName · email (readonly) · phone · location
  candidateProfile: headline · summary · portfolio URL
[Save Changes] primary btn
[Change Password] section (current + new + confirm)
```

---

### PHASE 4: Recruiter Pages

#### /recruiter/dashboard
```
Stat cards (4): Active Jobs · Total Applicants · Avg Match Score · Hired This Month
Top jobs section: bar chart or ranked list by applicant count
Recent activity: 5 most recent applications needing review
```

#### /recruiter/jobs  (UC-BASIC-09,11)
```
Filter: [Search] [status: active/closed] [category dropdown]
Table:
  cols: Title | Category | Location | Applicants | Status | Deadline | Actions
  Actions: [View Candidates] [Edit] [Close/Delete]
[+ Post New Job] primary btn top-right
Empty state + CTA
```

#### /recruiter/jobs/new  and  /recruiter/jobs/:id/edit  (UC-CORE-01, UC-BASIC-10)
```
Single column form max-w-3xl:
  title (required)
  category (required) — IT / Accounting / Marketing
  location
  experienceLevel
  applicationDeadline (date picker)
  description (rich textarea, required)
  requirements (rich textarea, required)
  benefits (textarea)
Right sidebar (sticky, w-72):
  Preview card: how posting looks to candidates
  AI readiness score: how well the JD will embed
  Estimated matches: based on current resumes in system
Footer: [Save Draft] secondary | [Publish Job] primary
```

#### /recruiter/jobs/:id/candidates  (UC-CORE-04)
```
Job info header: title · status badge · applicant count · avg hybridScore
Filter bar: [Search name] [status] [aiStatus] [Score range slider min–max]
Bulk action bar (appears when rows selected): [Move to Screening] [Reject Selected]
Ranked candidate list (sorted by hybridScore DESC):
  Each CandidateRow:
    [checkbox] [avatar] name + role + location
    hybridScore progress bar (color = scoreColor) + %
    aiStatus badge + status badge
    [Review →] btn
Pagination
```

#### /recruiter/jobs/:id/candidates/:applicationId  (detail)
```
Two-column layout:
Left (w-80):
  Candidate info card: avatar · name · role · location
  Resume info: filename · upload date · [Download Original CV] btn
  Status pipeline stepper:
    New → Screening → Interview → Hired (or Rejected)
    Current step highlighted blue, completed = green check
  Status history timeline (statusHistory[]):
    Each entry: fromStatus → toStatus · changedAt · changedBy
  Action buttons: [Move to Interview] [Reject] [Hire]

Right (flex-1):
  AI Score Widget (same as candidate feedback view)
  aiDetails: matchedKeywords + missingKeywords badges
  Job description section (collapsed by default, expandable)
```

#### /recruiter/company  (UC-BASIC-08)
```
Form: company name · industry · website · description · logo upload
Brand color picker (used on job postings)
[Save] primary btn
```

---

### PHASE 5: Admin Pages

#### /admin/config  (systemconfigs)
```
Tabs: [LLM Provider] [Prompts] [Features] [API Keys] [Language]

LLM Provider tab:
  Provider selector: Ollama / OpenAI / Anthropic / Gemini / OpenRouter / DeepSeek
  Model name input
  Base URL input
  API Key input (masked, show/hide toggle)
  [Test Connection] secondary btn → shows success/error inline
  [Save] primary btn → confirm dialog before submit

Features tab:
  Toggle switches for feature flags from featureConfig

All tabs: utilitarian form style, no decorative elements
Confirm dialog required before any save
```

#### /admin/users
```
Table: email · fullName · role badge · createdAt · actions
Filter: role dropdown
[Disable/Enable] toggle per user
```

---

## Shared Components to Build

Build these as reusable components in `components/`:

```
AiScoreWidget       — score ring + 3 bars + matched/missing keywords
CandidateRow        — ranked list row with hybridScore bar
StatusBadge         — application status (new/screening/interview/hired/rejected)
AiStatusBadge       — AI pipeline status (pending/parsing/scoring/completed/failed)
AiStatusIndicator   — animated progress state when aiStatus ≠ completed
KeywordBadge        — matched (green) or missing (red)
StatCard            — dashboard metric card with icon + number + label + delta
ScoreBar            — labeled progress bar (semantic/keyword/hybrid)
SkeletonRow         — shimmer skeleton for list loading state
SkeletonCard        — shimmer skeleton for card loading state
EmptyState          — illustration + title + optional CTA button
ErrorBanner         — error message + retry button
ConfirmDialog       — modal confirmation (used before destructive actions)
PageHeader          — Serif title + subtitle + optional action button
RoleToggle          — Candidate / Recruiter switcher (auth pages)
```

---

## Animation Specs

```css
/* Page load stagger */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Apply with delays: 0ms, 80ms, 160ms, 240ms per group */
/* duration: 500ms, ease */

/* Floating brand panel elements */
@keyframes float {
  0%, 100% { transform: translateY(0) scale(1); }
  50%       { transform: translateY(-18px) scale(1.04); }
}
@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-9px); }
}

/* Score bars grow on mount */
@keyframes barGrow {
  from { width: 0 !important; }
}
/* duration: 1.5s, ease, delay: 0.8s */

/* Score ring draw on mount */
/* animate stroke-dashoffset from full circumference to final value */
/* duration: 1.2s, ease-out */

/* AI status indeterminate bar */
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
/* background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%) */
/* background-size: 200% auto; animation: shimmer 1.4s linear infinite */

/* Skeleton loader */
/* Same shimmer, background-size: 400% auto, duration: 1.5s */

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; }
}
```

---

## File Structure to Generate

```
apps/frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx                  ← AppShell
│   │   ├── candidate/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── applications/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── resumes/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/builder/page.tsx
│   │   │   ├── optimize/page.tsx
│   │   │   └── profile/page.tsx
│   │   ├── recruiter/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── edit/page.tsx
│   │   │   │       └── candidates/
│   │   │   │           ├── page.tsx
│   │   │   │           └── [applicationId]/page.tsx
│   │   │   └── company/page.tsx
│   │   └── admin/
│   │       ├── config/page.tsx
│   │       └── users/page.tsx
├── components/
│   ├── ui/
│   │   ├── AiScoreWidget.tsx
│   │   ├── CandidateRow.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── AiStatusBadge.tsx
│   │   ├── AiStatusIndicator.tsx
│   │   ├── KeywordBadge.tsx
│   │   ├── StatCard.tsx
│   │   ├── ScoreBar.tsx
│   │   ├── SkeletonRow.tsx
│   │   ├── SkeletonCard.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorBanner.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── PageHeader.tsx
│   │   └── RoleToggle.tsx
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Topbar.tsx
│   │   └── AuthLayout.tsx
│   └── features/
│       ├── auth/
│       ├── resume-builder/
│       └── jd-match/
├── lib/
│   ├── utils.ts          ← scoreColor(), scoreLabel(), cn()
│   └── api.ts            ← typed fetch helpers
├── types/
│   └── index.ts          ← all TypeScript interfaces from schema
└── styles/
    └── globals.css       ← CSS variables + font import + base reset
```

---

## TypeScript Interfaces (define in types/index.ts first)

```typescript
export type UserRole = 'candidate' | 'recruiter' | 'admin'
export type ApplicationStatus = 'new' | 'screening' | 'interview' | 'hired' | 'rejected'
export type AiStatus = 'pending' | 'parsing' | 'scoring' | 'completed' | 'failed'
export type JobCategory = 'IT' | 'Accounting' | 'Marketing'
export type JobStatus = 'active' | 'closed'

export interface AiScores {
  semanticScore: number   // [0,1]
  keywordScore:  number   // [0,1]
  hybridScore:   number   // [0,1] — ONLY field used for ranking
}
export interface AiDetails {
  matchedKeywords: string[]
  missingKeywords: string[]
}
export interface Application {
  _id: string
  jobId: string
  resumeId: string
  status: ApplicationStatus
  aiStatus: AiStatus
  aiScores: AiScores
  aiDetails: AiDetails
  statusHistory: StatusHistoryEntry[]
  createdAt: string
  updatedAt: string
}
export interface StatusHistoryEntry {
  fromStatus: ApplicationStatus
  toStatus: ApplicationStatus
  changedAt: string
  changedBy: string
}
export interface Job {
  _id: string
  recruiterId: string
  title: string
  description: string
  requirements: string
  benefits?: string
  applicationDeadline?: string
  category: JobCategory
  location?: string
  experienceLevel?: string
  status: JobStatus
  isAnalyzed: boolean
  keywords: string[]
  createdAt: string
  updatedAt: string
}
export interface Resume {
  _id: string
  candidateId: string
  fileUrl: string
  title?: string
  isMaster: boolean
  isAnalyzed: boolean
  processingStatus: string
  parsedData: Record<string, unknown>
  coverLetter?: string
  outreachMessage?: string
  createdAt: string
  updatedAt: string
}
export interface User {
  _id: string
  email: string
  fullName: string
  role: UserRole
  avatar?: string
  candidateProfile?: Record<string, unknown>
}
```

---

## Build Sequence

Build in this exact order to avoid dependency issues:

```
1.  styles/globals.css            ← CSS vars, font import, base reset
2.  types/index.ts                ← all interfaces
3.  lib/utils.ts                  ← scoreColor, scoreLabel, cn()
4.  components/ui/* (all shared)  ← bottom-up, no page deps
5.  components/layout/AuthLayout  ← left brand panel + right slot
6.  (auth) pages                  ← login, register, forgot-password
7.  components/layout/Sidebar     ← role-aware nav
8.  components/layout/Topbar
9.  components/layout/AppShell    ← composes Sidebar + Topbar
10. candidate/dashboard           ← stat cards + recent table
11. candidate/applications        ← list + filter
12. candidate/applications/[id]   ← AI feedback (AiScoreWidget)
13. candidate/resumes             ← card grid
14. candidate/resumes/[id]/builder← split editor + preview
15. candidate/optimize            ← JD match + enrichment
16. candidate/profile
17. recruiter/dashboard
18. recruiter/jobs                ← list
19. recruiter/jobs/new            ← form
20. recruiter/jobs/[id]/edit
21. recruiter/jobs/[id]/candidates← ranked list
22. recruiter/jobs/[id]/candidates/[applicationId]
23. recruiter/company
24. admin/config
25. admin/users
```

---

## Quality Gates (verify each component before moving on)

- [ ] Uses only CSS variables from globals.css (no hardcoded hex)
- [ ] Instrument Serif for titles, DM Sans for UI, JetBrains Mono for numbers
- [ ] All 4 states: skeleton loading / empty / error / success
- [ ] `aiStatus` and `status` are independent — never conflate them
- [ ] `hybridScore` is the only ranking signal — never use semantic/keyword alone
- [ ] TypeScript: no `any`, all interfaces from types/index.ts
- [ ] Responsive: 375px / 768px / 1280px breakpoints
- [ ] `prefers-reduced-motion` respected in all animations
- [ ] No hardcoded strings — use constants file or i18n keys
- [ ] Confirm dialog before any destructive action (delete, reject, close job)