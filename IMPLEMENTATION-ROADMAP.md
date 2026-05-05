# Project Completion Roadmap
**Current Status:** 63% Complete (19/30 UCs Done)  
**Date:** 2026-05-02  
**Target Completion:** 2026-05-12 (10 days)

---

## Executive Summary

The CV Matching system is 63% feature-complete with all core AI pipeline infrastructure operational. Remaining work focuses on resume management features (UC-RM group at 33%) and authentication quality assurance.

### Current Breakdown
- **UC-CORE (5/5 - 100%):** AI pipeline, parsing, vector search, scoring ✅
- **UC-BASIC (10/13 - 77%):** Auth, profile validation, guardrails  
- **UC-RM (4/12 - 33%):** Resume builder, templates, formatting, version history

---

## Phase 1: Foundation Fixes (Days 1-2, ~8 hours)
### Priority: CRITICAL - Unblock remaining work

#### 1.1 Complete Soft Delete Implementation (UC-BASIC-11)
**Status:** Schema + Service updated, needs contract tests  
**Effort:** 2 hours

**Remaining Tasks:**
- [ ] Fix soft delete service `before` value capture for audit trail
- [ ] Add integration test for soft delete with audit trail verification
- [ ] Update frontend delete button UX (confirmation + optional reason)
- [ ] Test soft delete doesn't break existing job listing/filtering

**Files to Update:**
- `apps/backend/src/services/job.service.js` - fix status before capture
- `apps/backend/tests/integration/job-update-endpoints.test.mjs` - new soft delete test
- `apps/frontend/components/jobs/job-delete-button.tsx` - add confirmation
- `apps/frontend/app/(default)/jobs/page.tsx` - ensure deleted jobs hidden

**Definition of Done:**
- Integration test passes: soft delete marks status='deleted', includes audit trail, excluded from list queries
- Frontend shows confirmation before delete
- No deleted jobs appear in recruiter job list

---

#### 1.2 Verify Forgot/Reset Password Flow (UC-BASIC-03)
**Status:** Frontend pages created, needs E2E verification  
**Effort:** 2 hours

**Remaining Tasks:**
- [ ] End-to-end test: forgot password request → email delivery → reset link → password change
- [ ] Verify reset token single-use constraint (second use fails)
- [ ] Test expired reset token handling
- [ ] Verify reset clears any other active sessions

**Files to Create/Update:**
- `apps/backend/tests/integration/forgot-password-e2e.test.mjs` - new E2E test
- `apps/frontend/tests/auth-flow.integration.test.tsx` - frontend E2E
- `apps/backend/src/services/auth.service.js` - verify token expiry logic

**Definition of Done:**
- E2E test passes complete forgot→reset→login flow
- Token validation properly enforces single-use
- Email delivery verified with mock SMTP

---

#### 1.3 Fix Resume Builder Tests (UC-RM-03/04)
**Status:** Test file created with import errors  
**Effort:** 3 hours

**Remaining Tasks:**
- [ ] Remove `@testing-library/user-event` dependency (use `fireEvent` instead)
- [ ] Fix ResumeBuilder import (it's named export, not default)
- [ ] Simplify component mocks to match actual interface
- [ ] Run tests and fix failures (expect ~18-20 tests to pass)

**Files to Update:**
- `apps/frontend/tests/resume-builder.test.tsx` - fix all import/mock issues
- Mock dependencies to match actual builder component interface

**Definition of Done:**
- All 20 tests pass (>80% coverage on live preview, template switching, formatting, section editing)
- Resume builder can handle rapid state changes without crashes
- Preview stays in sync with form edits

---

## Phase 2: Resume Management Features (Days 3-5, ~14 hours)
### Priority: HIGH - Complete UC-RM features

#### 2.1 Version History UI (UC-RM-01)
**Status:** Backend tracking exists, no UI  
**Effort:** 4 hours

**Implementation:**
- Create `apps/frontend/components/builder/version-history-panel.tsx`
  - Show timeline of changes (created, last edited, last exported)
  - Each entry shows: timestamp, change type, changed fields
  - Click to preview version state (read-only)
- Add button in resume builder to show/hide version panel
- Add tests for version display and timeline interaction

**Files to Create:**
- `apps/frontend/components/builder/version-history-panel.tsx` (component)
- `apps/frontend/tests/version-history-panel.test.tsx` (tests)
- Update `apps/frontend/components/builder/resume-builder.tsx` to include panel

**Backend:** Already tracking `importantChangeHistory` in Resume model

**Definition of Done:**
- Version panel shows complete edit history
- User can see timestamp and changed fields for each version
- UI is responsive and integrates cleanly into builder

---

#### 2.2 Template Expansion + Tests (UC-RM-05/06)
**Status:** 2-3 templates exist, tests shallow  
**Effort:** 5 hours

**Implementation:**
- Add 3 new resume templates:
  - Modern minimal (clean lines, minimal colors)
  - Corporate (formal structure, colored headers)
  - Creative (non-standard layout with accent colors)
- For each template: component + CSS module + preview
- Comprehensive test coverage:
  - Template selector shows all templates with preview
  - Switching template updates layout
  - Resume data preserved when switching
  - Each template renders all section types correctly

**Files to Create:**
- `apps/frontend/components/builder/templates/template-{modern-minimal,corporate,creative}.tsx` (3 files)
- `apps/frontend/components/builder/templates/template-{modern-minimal,corporate,creative}.module.css` (3 files)
- `apps/frontend/tests/template-switching.test.tsx` (comprehensive)

**Files to Update:**
- `apps/frontend/components/builder/template-selector.tsx` - add new templates

**Definition of Done:**
- 5+ templates available with visual distinction
- Template-switching test covers all template combinations
- PDF output matches preview for each template

---

#### 2.3 Formatting Controls Enhancement (UC-RM-06)
**Status:** Controls exist, limited test coverage  
**Effort:** 3 hours

**Implementation:**
- Expand formatting controls:
  - Font selection (sans-serif variants: Inter, Roboto, Open Sans)
  - Line height (1.0 → 1.8)
  - Margins (0.25" → 1.0")
  - Font size (10pt → 14pt)
- Add presets: Compact, Normal, Spacious
- Test formatting changes:
  - Each control updates preview in real-time
  - Presets apply correct values
  - Formatting persists when switching templates
  - PDF output reflects formatting

**Files to Create:**
- `apps/frontend/tests/formatting-controls.test.tsx` (comprehensive)

**Files to Update:**
- `apps/frontend/components/builder/formatting-controls.tsx` - add new controls
- `apps/frontend/lib/types/template-settings.ts` - extend settings schema

**Definition of Done:**
- All formatting controls functional and tested
- Real-time preview sync with each adjustment
- PDF output shows correct spacing/font sizes

---

## Phase 3: Configuration & Internationalization (Days 6-7, ~10 hours)
### Priority: MEDIUM - Complete UC-RM-11/12

#### 3.1 Provider Selection UI (UC-RM-12)
**Status:** Config API exists, UI minimal  
**Effort:** 3 hours

**Implementation:**
- Enhanced settings page provider section:
  - Radio buttons for each provider (OpenAI, Anthropic, OpenRouter, Gemini, DeepSeek, Ollama)
  - Show provider details: name, website, features, pricing model
  - API key input field (masked) with "Test Connection" button
  - Test result feedback: success or specific error
- Add help text for each provider
- Persist selection to backend

**Files to Create/Update:**
- `apps/frontend/components/settings/provider-selector.tsx` (new component)
- `apps/frontend/tests/provider-selector.test.tsx` (new tests)
- `apps/frontend/app/(default)/settings/page.tsx` - integrate provider selector

**Backend Already Has:**
- Config API: `PUT /api/config/llm-api-key`
- Test endpoint: `POST /api/config/llm-test`

**Definition of Done:**
- Provider selector shows all 6 providers with clear descriptions
- User can switch providers and save API key
- Test connection verifies key validity
- Settings persist across sessions

---

#### 3.2 Language Content Enforcement (UC-RM-11)
**Status:** i18n framework exists, AI output language not enforced in prompts  
**Effort:** 4 hours

**Implementation:**
- Modify all prompt generation services to include language directive:
  - `apps/backend/src/services/enrichment.service.js`
  - `apps/backend/src/services/tailor-match.service.js`
  - `apps/backend/src/services/cover-letter.service.js`
  - Add language parameter to prompt engineering
- Add tests verifying AI output matches requested language
- Update frontend to show language in generation dialogs

**Backend Changes:**
- All LLM calls now include: "Generate output in [LANGUAGE]" in system prompt
- Language sourced from user config or request parameter

**Frontend Changes:**
- Show selected content language in generate dialog
- Add language warning if different from UI language

**Definition of Done:**
- AI-generated content respects configured language
- Integration test validates language switching
- Frontend shows language context during generation

---

#### 3.3 Privacy Mode + Provider Validation (UC-RM-12 Enhancement)
**Status:** Config exists, enforcement incomplete  
**Effort:** 3 hours

**Implementation:**
- Enhanced privacy mode enforcement:
  - `privacy_mode: hybrid | local_only | cloud_only`
  - UI blocks cloud providers when `privacy_mode=local_only`
  - UI blocks local providers when `privacy_mode=cloud_only`
  - Show privacy mode impact on tailor/generation flow
- Test all mode combinations with provider selections

**Files to Update:**
- `apps/frontend/components/settings/privacy-mode-selector.tsx` - enhanced validation
- `apps/frontend/lib/api/config.ts` - add mode enforcement rules
- `apps/backend/src/services/tailor-match.service.js` - validate privacy constraint

**Definition of Done:**
- Privacy mode restrictions enforced on provider selection
- User sees clear warnings when conflicting settings
- Tailor/generation fails gracefully if provider blocked by privacy mode

---

## Phase 4: Testing & E2E Coverage (Days 8-9, ~8 hours)
### Priority: MEDIUM - Quality assurance

#### 4.1 Resume Generator E2E Tests (UC-RM-09)
**Status:** Basic tests exist, E2E coverage incomplete  
**Effort:** 3 hours

**Implementation:**
- Add `apps/backend/tests/integration/resume-generator-e2e.test.mjs`
  - Full flow: upload resume → select JD → generate tailored → verify output quality
  - Template rendering: upload → select template → export PDF → verify layout
  - Multi-language: upload → select language → generate → verify language in output
- Add frontend E2E: `apps/frontend/tests/resume-generator-e2e.test.tsx`

**Files to Create:**
- `apps/backend/tests/integration/resume-generator-e2e.test.mjs`
- `apps/frontend/tests/resume-generator-e2e.test.tsx`

**Definition of Done:**
- Full resume generation pipeline tested end-to-end
- All template types tested with real data
- Language switching verified in output

---

#### 4.2 Company Branding Display (UC-BASIC-08)
**Status:** Recruiter profile exists, no branding on job postings  
**Effort:** 2 hours

**Implementation:**
- Display recruiter company info on job listings:
  - `apps/frontend/components/jobs/job-card.tsx` - show company logo + name
  - `apps/frontend/app/(default)/jobs/[id]/page.tsx` - recruiter branding section
- Backend: Fetch recruiter profile with company data
  - `apps/backend/src/controllers/job.controller.js` - include recruiter profile in job detail

**Files to Update:**
- `apps/frontend/components/jobs/job-card.tsx`
- `apps/frontend/app/(default)/jobs/[id]/page.tsx`
- `apps/backend/src/services/job.service.js` - join recruiter profile

**Definition of Done:**
- Company logo/branding visible on job cards and detail page
- Responsive layout maintains visibility on mobile

---

#### 4.3 End-to-End Product Flow Validation
**Status:** Basic product flow exists, gaps in coverage  
**Effort:** 3 hours

**Implementation:**
- Enhanced `product-e2e-candidate-flow.test.mjs`:
  - Candidate journey: signup → profile → apply → tailor → check application status
  - Recruiter journey: create job → review applications → match scores
  - Admin journey: configure LLM → monitor queue
- Verify all error paths and edge cases

**Files to Update:**
- `apps/backend/tests/integration/product-e2e-candidate-flow.test.mjs` - expand coverage

**Definition of Done:**
- Full product flow tested from signup to application
- Both candidate and recruiter happy paths covered
- Error handling validated

---

## Phase 5: Polish & Documentation (Days 10, ~4 hours)
### Priority: LOW - Final touches

#### 5.1 Update Matrix & Documentation
**Effort:** 2 hours

**Tasks:**
- Update `uc-completion-matrix.md` with final status (30/30 done)
- Update `plan-implementation.md` with latest entries (soft delete, builder tests, etc.)
- Verify README has all operational runbooks
- Document all remaining configuration options

---

#### 5.2 Final Testing & Bug Fixes
**Effort:** 2 hours

**Tasks:**
- Run full test suite: `npm run test:all` across frontend and backend
- Run integration tests: `npm run test:integration`
- Smoke test all major user flows
- Document any remaining known issues

---

## Implementation Priority Matrix

| Phase | Feature | Days | Hours | Impact | Complexity |
|-------|---------|------|-------|--------|-----------|
| **1** | Soft Delete + E2E | 1-2 | 4 | Critical | Medium |
| **1** | Forgot/Reset E2E | 1-2 | 2 | Critical | Low |
| **1** | Builder Tests Fix | 1-2 | 3 | High | Medium |
| **2** | Version History | 3-4 | 4 | High | Low |
| **2** | Templates Expansion | 3-4 | 5 | High | Medium |
| **2** | Formatting Tests | 4-5 | 3 | High | Low |
| **3** | Provider UI | 6-7 | 3 | Medium | Low |
| **3** | Language Enforcement | 6-7 | 4 | Medium | Medium |
| **3** | Privacy Mode | 6-7 | 3 | Medium | Low |
| **4** | Generator E2E | 8-9 | 3 | Medium | Medium |
| **4** | Branding Display | 8-9 | 2 | Low | Low |
| **4** | Product E2E | 8-9 | 3 | High | Medium |
| **5** | Documentation | 10 | 2 | Low | Low |
| **5** | Testing & Fixes | 10 | 2 | High | Low |

---

## Dependencies & Critical Path

```
Phase 1 (MUST COMPLETE FIRST)
├─ Soft Delete Implementation
├─ Forgot/Reset E2E Verification
└─ Builder Tests Fix

Phase 2 (Unblocked by Phase 1)
├─ Version History
├─ Templates + Tests
└─ Formatting Tests

Phase 3 (Can run parallel to Phase 2)
├─ Provider UI
├─ Language Enforcement
└─ Privacy Mode

Phase 4 (Depends on Phases 2-3)
├─ Generator E2E
├─ Branding Display
└─ Product E2E

Phase 5 (Final)
├─ Documentation Update
└─ Final Testing
```

---

## Success Criteria for 100% Completion

- [x] All 30 UCs marked ✅ DONE
- [x] No UC-RM features in PARTIAL status
- [x] All 6 provider configurations working
- [x] Multi-language content generation functional
- [x] Version history visible and queryable
- [x] 5+ resume templates with full test coverage
- [x] Soft delete + audit trail working for all entities
- [x] E2E product flow tests passing
- [x] PDF export WYSIWYG across all templates
- [x] Privacy mode properly enforced

---

## Resource Requirements

- **Backend Development:** 20-25 hours
- **Frontend Development:** 18-22 hours  
- **Testing & QA:** 10-12 hours
- **Documentation:** 4-6 hours
- **Total Estimated:** 52-65 hours (~7-10 days at 8 hours/day)

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Builder test framework issues | Medium | High | Keep tests focused on core functionality |
| E2E test flakiness | Medium | Medium | Add retry logic, mock external services |
| Template CSS conflicts | Low | Medium | Test each template in isolation |
| Language API rate limits | Low | Low | Add retry + fallback to default language |
| Soft delete migration | Low | High | Add schema validation, run tests against real data |

---

## Quality Gates

Before marking phase complete:
1. All tests passing (unit + integration)
2. Code review completed
3. Manual smoke test of affected features
4. No new issues in related components

---

**Next Action:** Start Phase 1 - Complete Soft Delete + E2E tests
