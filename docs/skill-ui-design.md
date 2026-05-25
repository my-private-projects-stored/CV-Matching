# SKILL: UI Design — Smart CV Matching & Recruitment Platform

## Purpose
This skill guides the AI Agent when designing and implementing UI for the Smart CV Matching platform. Apply whenever a request involves creating a new component, page, or layout for the frontend (Next.js 16, React 19, TypeScript, Tailwind CSS 4).

---

## Step 1 — Read Context Before Designing

Before writing any code, identify:

1. **Which actor does this component serve?** (Candidate / Recruiter / Admin)
2. **Which use case?** (UC-CORE / UC-BASIC / UC-RM)
3. **Where does the data come from?** (which collection, which fields in the schema)
4. **Which states need to be handled?** (loading / empty / error / success)

---

## Step 2 — Design System (mandatory)

### Colors
```css
/* Primary */
--color-primary: #1d4ed8;        /* Blue — CTA, active state, link */
--color-primary-hover: #1e40af;
--color-primary-light: #dbeafe;  /* Badge background, highlight */

/* Neutral */
--color-bg: #fafaf7;             /* Page background — warm off-white */
--color-surface: #ffffff;        /* Card, modal, panel */
--color-border: #e5e7eb;
--color-text-primary: #111827;
--color-text-secondary: #6b7280;
--color-text-muted: #9ca3af;

/* Semantic */
--color-success: #16a34a;        /* hired, completed, matched keyword */
--color-warning: #d97706;        /* screening, pending, low score */
--color-danger: #dc2626;         /* rejected, failed, missing keyword */
--color-info: #0891b2;           /* interview, parsing */
```

### Typography
```
Heading : DM Sans or Outfit — never use Inter, Roboto, Arial
Body    : Geist or IBM Plex Sans
Mono    : JetBrains Mono (for code, IDs, scores)

Size scale  : 12 / 14 / 16 / 18 / 24 / 32 / 40px
Font weight : 400 (body) / 500 (label) / 600 (heading) / 700 (display)
```

### Spacing & Layout
```
Base unit    : 4px
Common steps : 8 / 12 / 16 / 24 / 32 / 48 / 64px
Border radius: 6px (input/button) / 10px (card) / 16px (modal)
Card shadow  : 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)
```

### Tailwind CSS 4 Notes
- Use `@layer components` for reusable component classes
- Prefer utility classes; avoid custom CSS unless animation is needed
- Dark mode: use `dark:` prefix, never hardcode dark colors

---

## Step 3 — Component Rules by Actor

### Candidate UI
- Tone: **Supportive & Clear** — users are job seekers who need encouragement
- Score displayed prominently (large number, semantic color by threshold)
- `matchedKeywords` → green badge `--color-success`
- `missingKeywords` → light red badge `--color-danger` with improvement hint icon
- `aiStatus` mapping:
  ```
  pending   → spinner + "Waiting to process"
  parsing   → progress bar + "Analyzing resume"
  scoring   → progress bar + "Computing score"
  completed → show score
  failed    → error state + retry button
  ```

### Recruiter UI
- Tone: **Efficient & Data-dense** — HR needs to scan many candidates quickly
- Ranked list: avatar + name + hybridScore (progress bar) + status badge + action button
- `hybridScore` color scale:
  ```
  >= 0.75 → --color-success  (Strong match)
  >= 0.50 → --color-warning  (Potential)
  <  0.50 → --color-danger   (Weak match)
  ```
- Quick filters by `status`, `aiStatus`, score range
- Bulk action support (update pipeline status for multiple candidates)

### Admin UI
- Tone: **Utilitarian & Precise** — system configuration, minimal decoration
- Form-heavy: `systemconfigs` key/value editor
- Always show a confirmation dialog before saving config changes

---

## Step 4 — Standard Layout Patterns

### List / Dashboard Page
```
┌─────────────────────────────────────────┐
│  Page title                  [+ Action] │
│  Filter bar (search + dropdown filters) │
├─────────────────────────────────────────┤
│  Table or Card grid                     │
│  - Skeleton loader (not spinner)        │
│  - Empty state: illustration + CTA      │
│  - Error state: message + retry button  │
├─────────────────────────────────────────┤
│  Pagination                             │
└─────────────────────────────────────────┘
```

### Detail / Profile Page
```
┌──────────────┬──────────────────────────┐
│  Sidebar     │  Main content            │
│  - Avatar    │  - Tabs (Overview /      │
│  - Meta info │    Details / History)    │
│  - Actions   │  - Section cards         │
└──────────────┴──────────────────────────┘
```

### Score / Feedback Component (UC-CORE-05)
```
┌─────────────────────────────────────────┐
│  [Score circle: 78%]   hybridScore      │
│  ████████░░  Semantic : 0.82            │
│  ██████░░░░  Keyword  : 0.65            │
├─────────────────────────────────────────┤
│  ✅ Matched Keywords                    │
│  [Python] [FastAPI] [REST API] ...      │
├─────────────────────────────────────────┤
│  ❌ Missing Keywords                    │
│  [Docker] [CI/CD] [PostgreSQL] ...      │
│  → Tip: Add Docker experience to resume │
└─────────────────────────────────────────┘
```

---

## Step 5 — Accessibility & Performance

- Every interactive element must have `aria-label` or a visible label
- Color alone must never be the only way to convey information — always pair with icon or text
- Use skeleton loaders instead of spinners for lists and tables
- Images: use `next/image` with `priority` for above-the-fold content
- Scores and numbers: use `font-variant-numeric: tabular-nums` to prevent layout shift

---

## Step 6 — Pre-output Checklist

- [ ] Correct actor and use case?
- [ ] Field names match schema (`hybridScore` not `hybrid_score`)?
- [ ] All 4 states covered: loading / empty / error / data?
- [ ] `aiStatus` and `status` handled separately?
- [ ] TypeScript interfaces defined?
- [ ] No hardcoded strings — using constants or i18n keys?
- [ ] Responsive: mobile (375px) → tablet (768px) → desktop (1280px)?

---

## Trigger Examples

Apply this skill when requests include:
- "Design the ranked candidate dashboard for HR"
- "Create the AI feedback component for candidates"
- "Build the JD creation form"
- "Build the resume builder screen with live preview"
- "Create a card component to display hybridScore"
