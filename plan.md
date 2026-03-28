## Plan: Hoan Thanh Du An Theo 2 Giai Doan

Muc tieu la chot du an theo pham vi da thong nhat: Giai doan 1 hoan thanh toan bo UC trong tai lieu (UC-CORE + UC-BASIC + UC-RM), sau do Giai doan 2 dong parity nang cao voi upstream. Cac buoc duoi day uu tien critical-path backend contracts va pipeline AI truoc, frontend + test + tai lieu sau, de dam bao moi moc deu co bang chung nghiem thu.

**Steps**
1. Phase A - Scope Lock va Acceptance Matrix (0.5 ngay)
2. Tong hop UC master matrix tu use-cases-complete, use-cases-core, use-cases-basic, use-cases-product-extended, feature-gap-analysis, task-completed.
3. Chuan hoa tieu chi Done cho tung UC: implementation + API/UI contract + test pass + evidence.
4. Chot baseline trang thai hien tai theo 3 muc Done/Partial/Missing de khoa pham vi Giai doan 1.
5. *Blocks all following phases.*

6. Phase B - Dong critical blockers cho UC docs (3-6 ngay) (*depends on Phase A*)
7. Hoan thien luong UC-CORE-02/03: upload CV -> parsing co cau truc -> embedding generation -> vector index -> hybrid scoring -> persisted feedback metadata.
8. Hoan thien UC-RM-02/08/09/12 backend depth: LLM provider integration that su, privacy-mode enforcement runtime, generation flow cho tailor/enrichment/cover-letter/outreach.
9. Hoan thien UC-RM-10 backend depth: PDF export on dinh theo WYSIWYG contract hien tai; bo sung fallback khi provider/pipeline loi.
10. Hoan thien cac contract schema/error_code con le de frontend map thong diep nhat quan.
11. *Parallelizable*: parsing/vector work co the chay song song voi LLM/provider enforcement sau khi contract interfaces duoc chot.

12. Phase C - Dong UX va logic con Partial trong docs scope (3-5 ngay) (*depends on Phase B*)
13. Frontend candidate flow: dashboard upload status chi tiet, tailor preview/confirm on dinh, enrichment wizard completion states, JD match actions/coherence.
14. Frontend recruiter flow: jobs create/edit/close completeness, ranked applications filtering, status update reliability, feedback readability.
15. Settings/config flow: language, feature flags, llm keys, privacy, company profile UX thong nhat voi backend contracts.
16. Resume builder consistency: section controls, formatting persistence, template selection, PDF download flow theo role.
17. *Parallelizable*: candidate/recruiter/settings tracks co the phan tach, nhung builder va settings phu thuoc API contracts cua Phase B.

18. Phase D - Test Completion Matrix cho Giai doan 1 (2-4 ngay) (*depends on Phase C*)
19. Backend: bo sung integration tests cho parsing/vector/scoring, generation flows, privacy-mode behavior, authz cho recruiter/candidate.
20. Frontend: bo sung tests cho builder interactions, enrichment end-to-end mocked flow, recruiter ranking/status workflows, error recovery states.
21. Tao UC-to-test traceability matrix: moi UC co it nhat 1 test case pass lien ket truc tiep.
22. Chay quality gates: backend/frontend lint, typecheck, unit, integration, build, smoke runtime.

23. Phase E - Docs Closure va Sign-off Giai doan 1 (1 ngay) (*depends on Phase D*)
24. Cap nhat feature-gap-analysis theo trang thai moi va dong cac muc UC docs da hoan thanh.
25. Cap nhat use-cases-index voi bang nghiem thu va duong dan evidence.
26. Cap nhat task-completed theo milestone closure.
27. Xuat bien ban ket luan Giai doan 1: UC docs completion report + residual risks (neu co).

28. Phase F - Upstream Advanced Parity (sau Giai doan 1, 4-8 ngay) (*depends on Phase E*)
29. Port cac tinh nang parity uu tien cao chua bat buoc trong docs: multi-pass refinement, date restoration parsing robustness, richer PDF rendering/template fidelity.
30. Mo rong enrichment/regeneration sophistication theo upstream patterns (item-level regeneration, confirmation loops).
31. Mo rong language coverage va prompt/profile options parity neu chua du.
32. Bo sung regression tests cho nhom parity moi va update feature-gap-analysis lan cuoi den state nearly-full parity.

33. Phase G - Final Project Completion Gate (0.5-1 ngay) (*depends on Phase F*)
34. Full verify tren moi truong du an: lint + typecheck + test + build + smoke scenario key.
35. Chot bang tong ket cuoi cung: UC docs = 100% Done, parity backlog = resolved/accepted defer co ly do.
36. Dong goi handover: roadmap van hanh, known limitations, khuyen nghi V2.

**Relevant files**
- d:/Project/CV Matching/CV-Matching/use-cases-complete.md — Bo UC tong hop can dat trong Giai doan 1.
- d:/Project/CV Matching/CV-Matching/use-cases-core.md — Uu tien UC-CORE cho critical path AI.
- d:/Project/CV Matching/CV-Matching/use-cases-basic.md — Pham vi UC-BASIC can dat nghiem thu.
- d:/Project/CV Matching/CV-Matching/use-cases-product-extended.md — Dinh nghia UC-RM docs scope.
- d:/Project/CV Matching/CV-Matching/feature-gap-analysis.md — Bang gap closure theo moi phase.
- d:/Project/CV Matching/CV-Matching/task-completed.md — Nhat ky milestone va evidence closure.
- d:/Project/CV Matching/CV-Matching/apps/backend/src/services/resume.service.js — Upload/tailor/generation/pdf flow.
- d:/Project/CV Matching/CV-Matching/apps/backend/src/services/application.service.js — Ranking/history/feedback/status logic.
- d:/Project/CV Matching/CV-Matching/apps/backend/src/services/enrichment.service.js — Enrichment analyze/enhance/apply.
- d:/Project/CV Matching/CV-Matching/apps/backend/src/services/embedding.service.js — Embedding generation dependency.
- d:/Project/CV Matching/CV-Matching/apps/backend/src/services/semantic-search.service.js — Hybrid scoring and explainability artifacts.
- d:/Project/CV Matching/CV-Matching/apps/backend/src/routes/ — Contract layer cho auth/jobs/resumes/applications/config.
- d:/Project/CV Matching/CV-Matching/apps/backend/tests/integration/ — Backend verification gates.
- d:/Project/CV Matching/CV-Matching/apps/frontend/app/ — Main user flows (candidate/recruiter/settings).
- d:/Project/CV Matching/CV-Matching/apps/frontend/components/builder/ — Builder/tailor/jd-match/formatting/template UX.
- d:/Project/CV Matching/CV-Matching/apps/frontend/lib/api/ — API contracts va error mapping.
- d:/Project/CV Matching/CV-Matching/apps/frontend/tests/ — Frontend unit/integration evidence.
- d:/Project/CV Matching/CV-Matching/upstream/resume-matcher/ — Nguon parity nang cao cho Giai doan 2.

**Verification**
1. Duy tri UC Acceptance Matrix voi cac cot: UC ID, status, backend evidence, frontend evidence, test evidence, owner, target milestone.
2. Cho tung phase, bat buoc pass gate toi thieu: implementation completeness + regression tests + no critical contract break.
3. Chay bo kiem thu backend/frontend sau moi batch thay doi lon va sau moi phase closure.
4. Chay full verify cuoi Giai doan 1 va Giai doan 2 tren moi truong local stack/CI stack.
5. Chi ket luan completed khi UC docs dat 100% Done va parity phase da duoc resolve hoac defer co phe duyet ro rang.

**Decisions**
- Scope strategy: C (hybrid) — Giai doan 1 hoan thanh docs scope, Giai doan 2 parity nang cao upstream.
- Priority strategy: critical-path backend contracts/pipeline first, frontend flow completion second, full test/docs closure third.
- Done rule: implementation + test + evidence; khong danh dau Done neu chi co route hoac chi co UI.
- Excluded from auto-scope: tinh nang moi khong co trong docs va khong nam trong upstream parity backlog da xac dinh.

**Further Considerations**
1. Muc defer cho parity Giai doan 2: cho phep toi da 1-2 muc medium priority defer neu khong anh huong UC docs completion, can co owner va deadline.
2. Uu tien test: neu nguon luc han che, uu tien integration tests cho pipeline parsing/scoring/generation truoc snapshot/component tests.
3. Bao cao tien do: cap nhat task-completed theo tung phase closure de de doi chieu voi feature-gap-analysis.