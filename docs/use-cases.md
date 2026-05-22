# Use Cases — Smart CV Matching & Recruitment Platform

## UC-CORE: AI Pipeline (core differentiator)

| ID | Name | Actor | Summary |
|---|---|---|---|
| UC-CORE-01 | Create Job Description | Recruiter | Fill JD form → validate → save MongoDB → trigger SBERT embedding → upsert Qdrant |
| UC-CORE-02 | Upload Resume + Parsing | Candidate | Upload PDF → extract text → save rawText → trigger SBERT embedding → upsert Qdrant |
| UC-CORE-03 | Compute Hybrid Score | System | Cosine similarity (Qdrant) + BM25 keyword match → hybridScore → save Application.aiScores |
| UC-CORE-04 | Ranked Candidate Dashboard | Recruiter | GET applications for a JD, sorted by hybridScore DESC, with filter/sort UI |
| UC-CORE-05 | AI Feedback for Candidate | Candidate | View hybridScore + matchedKeywords + missingKeywords → improvement suggestions |

## UC-BASIC: Foundation

| ID | Name | Actor |
|---|---|---|
| UC-BASIC-01 | Register account | Candidate, Recruiter |
| UC-BASIC-02 | Login (JWT) | Candidate, Recruiter |
| UC-BASIC-03 | Forgot password (reset token + expiry) | Candidate, Recruiter |
| UC-BASIC-04 | Change password | Candidate, Recruiter |
| UC-BASIC-05 | Manage personal profile | Candidate |
| UC-BASIC-06 | Browse & search job listings | Candidate |
| UC-BASIC-07 | View application history | Candidate |
| UC-BASIC-08 | Manage company profile | Recruiter |
| UC-BASIC-09 | View posted job listings | Recruiter |
| UC-BASIC-10 | Update job posting | Recruiter |
| UC-BASIC-11 | Close / soft-delete job posting | Recruiter |
| UC-BASIC-12 | Download original resume file | Recruiter |
| UC-BASIC-13 | Update candidate pipeline status | Recruiter |

## UC-RM: Product Extended (inherited from Resume Matcher upstream)

| ID | Name | Summary |
|---|---|---|
| UC-RM-01 | Master Resume management | Create/manage base resume, versioning via parentResumeId |
| UC-RM-02 | AI tailor resume to JD | AI suggests edits and keywords based on target JD |
| UC-RM-03 | Resume Builder with live preview | Edit sections with real-time preview |
| UC-RM-04 | Advanced section management | Rename, drag-and-drop reorder, show/hide, add/remove sections |
| UC-RM-05 | Choose resume template | 4 templates: Classic/Modern × Single/Two column |
| UC-RM-06 | Formatting controls | Page size, margin, font, spacing, compact mode |
| UC-RM-07 | JD Match View | Side-by-side JD vs Resume, keyword highlighting, match percentage |
| UC-RM-08 | Resume Enrichment | AI generates bullet points from guided questions |
| UC-RM-09 | Cover Letter + Outreach Email | AI generates application documents from resume + JD |
| UC-RM-10 | WYSIWYG PDF Export | Playwright renders PDF matching live preview |
| UC-RM-11 | Multi-language UI + AI content | EN / ES / ZH / JA / PT |
| UC-RM-12 | Privacy mode + AI provider config | Local (Ollama) or Cloud, API key configuration |
