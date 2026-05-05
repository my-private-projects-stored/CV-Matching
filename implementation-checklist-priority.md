# Implementation Checklist by Priority

Date: 2026-05-01

Checklist này sắp theo mức ưu tiên cao nhất để đóng các hạng mục Partial còn lại. Mỗi mục là một công việc triển khai có thể giao việc và nghiệm thu độc lập.

## Priority 1: User-facing blockers

- [ ] 1. UC-BASIC-03 - Hoan thien forgot/reset password end-to-end
  - Muc tieu: gui reset link/OTP, validate token het han, invalidation sau reset.
  - Evidence mong doi: backend auth flow + frontend flow + integration test.
  - File lien quan: `apps/backend/src/routes/auth.routes.js`, `apps/backend/src/controllers/auth.controller.js`, `apps/frontend/app/(default)/login/page.tsx`, `apps/frontend/app/(default)/signup/page.tsx`.

- [ ] 2. UC-RM-03 - Tang test coverage cho Builder live preview core flow
  - Muc tieu: bao phu render, state sync, preview update khi edit resume.
  - Evidence mong doi: unit/component tests cho builder core interactions.
  - File lien quan: `apps/frontend/components/builder/resume-builder.tsx`, `apps/frontend/components/builder/resume-form.tsx`, `apps/frontend/tests/`.

- [ ] 3. UC-RM-04 - Bo sung regression cho section controls nang cao
  - Muc tieu: rename, reorder, hide/show, custom section, delete confirmation.
  - Evidence mong doi: component tests cho section-header + drag/drop + custom section.
  - File lien quan: `apps/frontend/components/builder/section-header.tsx`, `apps/frontend/components/builder/dynamic-section-form.tsx`, `apps/frontend/components/builder/add-section-dialog.tsx`.

- [ ] 4. UC-RM-05 - Kiem tra template selection contract
  - Muc tieu: template switch, visual state, persist setting, preview reflect template.
  - Evidence mong doi: tests cho template selector / formatting controls.
  - File lien quan: `apps/frontend/components/builder/formatting-controls.tsx`, `apps/frontend/components/builder/template-selector.tsx`, `apps/frontend/app/print/resumes/[id]/page.tsx`.

- [ ] 5. UC-RM-06 - Kiem tra formatting controls contract
  - Muc tieu: A4/Letter, margins, spacing, font family, compact mode.
  - Evidence mong doi: tests cho margin/spacing/font toggles va print settings.
  - File lien quan: `apps/frontend/components/builder/formatting-controls.tsx`, `apps/frontend/app/print/resumes/[id]/page.tsx`.

## Priority 2: Product completeness gaps

- [ ] 6. UC-BASIC-08 - Dong hop company profile len UI nghiep vu
  - Muc tieu: bien config cong ty thanh mot phan hien thi ro rang cho recruiter flow/public job flow.
  - Evidence mong doi: frontend job/company-profile UI + backend contract test.
  - File lien quan: `apps/backend/src/routes/config.routes.js`, `apps/backend/src/controllers/config.controller.js`, `apps/frontend/app/(default)/settings/page.tsx`, `apps/frontend/app/(default)/jobs/page.tsx`.

- [ ] 7. UC-BASIC-11 - Chot contract xoa/dong tin va audit trail
  - Muc tieu: lam ro soft delete/close behavior, audit logs, reopen policy neu co.
  - Evidence mong doi: integration test bao ve contract xoa/dong tin va trang thai.
  - File lien quan: `apps/backend/src/routes/job.routes.js`, `apps/backend/src/controllers/job.controller.js`, `apps/backend/tests/integration/job-update-endpoints.test.mjs`.

- [ ] 8. UC-RM-09 - Bo sung test cho cover letter generation
  - Muc tieu: xac nhan API sinh cover letter van hanh dung contract va co noi dung hop le.
  - Evidence mong doi: integration test rieng cho generate/update cover letter.
  - File lien quan: `apps/backend/src/routes/resume.routes.js`, `apps/backend/src/controllers/resume.controller.js`, `apps/frontend/components/builder/cover-letter-editor.tsx`.

- [ ] 9. UC-RM-09 - Bo sung test cho outreach/email generation
  - Muc tieu: xac nhan generate outreach message + edit/save flow.
  - Evidence mong doi: integration/component test cho outreach text contract.
  - File lien quan: `apps/backend/src/routes/resume.routes.js`, `apps/backend/src/controllers/resume.controller.js`, `apps/frontend/components/builder/outreach-editor.tsx`.

## Priority 3: Locale and output parity

- [ ] 10. UC-RM-11 - Mo rong test cho UI language switching
  - Muc tieu: doi ngon ngu UI va kiem tra lan truyen qua builder/settings/resume pages.
  - Evidence mong doi: UI test cho switching locale va persistence.
  - File lien quan: `apps/frontend/app/(default)/settings/page.tsx`, `apps/frontend/app/(default)/builder/page.tsx`, `apps/frontend/messages/en.json`, `apps/frontend/messages/vi.json`, `apps/frontend/messages/zh.json`.

- [ ] 11. UC-RM-11 - Mo rong test cho AI output language consistency
  - Muc tieu: output language cua resume/tailor/generation khop voi config content language.
  - Evidence mong doi: integration test cho output language va generator contract.
  - File lien quan: `apps/backend/src/controllers/resume.controller.js`, `apps/backend/src/routes/config.routes.js`, `apps/frontend/tests/generate-prompt.test.tsx`.

## Suggested execution order

1. Bat dau tu UC-BASIC-03 vi no la flow account recovery co tac dong toi tat ca role.
2. Lam xong UC-RM-03/04/05/06 de dong luong builder core before mo rong sang generator/localization.
3. Chot UC-BASIC-08 va UC-BASIC-11 de hoan thien recruiter admin operations.
4. Ket thuc voi UC-RM-09 va UC-RM-11 de dong cac gap san pham va da ngon ngu.
