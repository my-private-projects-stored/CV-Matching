# Frontend / Backend API Coverage

Updated: 2026-05-26

## Connected UI Endpoints

- Auth: `/auth/login`, `/auth/me`, `/auth/register`, password reset/change flows.
- Candidate resumes: `/resumes`, `/resumes/list`, `/resumes/master`, `/resumes/:id/*`, cover letter, outreach, JD match, improve preview/confirm, enrichment.
- Candidate jobs and applications: `/jobs`, `/jobs/:id`, `/applications`, `/applications/history`, `/applications/:id/feedback`, `/applications/:id/status-history`.
- Recommendations: `/recommendations/jobs`, `/recommendations/resumes`.
- Candidate profile: `/candidate-profile/me`.
- Recruiter jobs: `/jobs`, `/jobs/:id`, close/reopen via `PATCH /jobs/:id`, delete via `DELETE /jobs/:id`.
- Recruiter candidates: `/applications/ranked`, `/applications/status/bulk`, `/applications/:id/status`, `/applications/summary`, `/applications/status-changes`.
- Recruiter candidate profile: `/candidate-profile/:id`, `/applications/history?candidate_id=...`.
- Recruiter company: `/company/me`.
- Interview generator: `/interviews/questions`.
- Notifications: `/notifications`, `/notifications/unread-count`, read and mark-all-read endpoints.
- Admin config: `/config/llm-api-key`, `/config/llm-test`, `/config/features`, `/config/prompts`, `/config/language`, `/config/privacy`, `/config/api-keys`, `/config/llm-events`, `/status`.
- Admin users: `/users`, `/users/:id/status`.
- Admin vectors: `/vectors/jobs/:id/index`, `/vectors/resumes/:id/index`, `/vectors/search/resumes`, `/vectors/search/jobs`, `/vectors/score/pair`.

## Internal / Excluded

- `/api/internal/**` remains excluded from UI wiring because these endpoints are worker/internal orchestration surfaces.

## Notes

- Paginated candidate/application filters are sent to backend query parameters when supported.
- Re-apply is shown only when the related job is active.
- Dangerous actions and bulk updates use `ConfirmDialog`.
