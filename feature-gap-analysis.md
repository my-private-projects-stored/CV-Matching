# Feature Gap Analysis
## Smart CV Matching vs Resume Matcher Original Features

Nguon doi chieu:
- use-cases-complete.md
- upstream/resume-matcher/README.md
- https://resumematcher.fyi/docs/features
- https://github.com/srbhr/Resume-Matcher?tab=readme-ov-file

## 1) Bang mapping tong hop

| # | Feature tu du an goc | Co trong use-cases-complete.md | Muc do bao phu | Ghi chu |
|---|---|---|---|---|
| 1 | JD creation va AI scoring pipeline | Co (UC-CORE-01..UC-CORE-05) | Day du | Dat muc tieu NCKH matching |
| 2 | Upload CV + parsing | Co (UC-02) | Day du | Da co flow loi/ngoai le |
| 3 | Ranked dashboard | Co (UC-04) | Day du | Co filter/pagination |
| 4 | Explainable feedback (matched/missing) | Co (UC-05) | Day du | Co de xuat cai thien CV |
| 5 | Master Resume workflow | Chua ro/tach rieng | Thieu | Can UC rieng cho tao, luu, tai su dung resume goc |
| 6 | AI-powered resume tailoring theo tung JD | Chua | Thieu lon | Feature cot loi cua Resume Matcher goc |
| 7 | Resume Builder live preview | Chua | Thieu lon | Chua mo ta trinh sua section theo thoi gian thuc |
| 8 | Section controls (rename/reorder/hide/custom) | Chua | Thieu | Chua co use case UX cho builder |
| 9 | Resume templates (chon template) | Chua | Thieu | README + Features page de cap ro |
| 10 | Formatting controls (page size/margins/spacing/typography/compact) | Chua | Thieu | Chua co UC ve dieu khien dinh dang |
| 11 | PDF export WYSIWYG | Co mot phan (UC-BASIC-12 la tai CV goc) | Thieu | Chua co UC xuat PDF resume da tailor |
| 12 | JD Match view side-by-side + keyword highlight + match % | Chua | Thieu | Can UC giao dien so sanh |
| 13 | Resume enrichment (hoi dap va bo sung bullet) | Chua | Thieu | Chua co luong hoi dap nang cao profile |
| 14 | Cover Letter generator | Chua | Thieu | README de cap ro |
| 15 | Email generator | Chua | Thieu | README de cap ro |
| 16 | Multi-language UI/content | Chua ro o muc use case | Thieu | Chua co UC ngon ngu cho UI/AI content |
| 17 | Privacy options (cloud/local Ollama) | Chua | Thieu | Nen co UC cau hinh nha cung cap AI |

## 2) Ket luan

- Bo UC hien tai bao phu rat tot nhom matching thong minh cho bai toan tuyen dung.
- So voi feature set day du cua Resume Matcher goc, tai lieu con thieu nhieu nhom feature san pham huong nguoi dung (builder/tailoring/templates/formatting/generator).
- Can bo sung nhom UC-RM de dam bao tai lieu vua phuc vu NCKH, vua phan anh du day chuc nang cua san pham goc.

## 3) De xuat bo UC-RM can bo sung

- UC-RM-01: Quan ly Master Resume.
- UC-RM-02: Tailor Resume theo Job Description bang AI.
- UC-RM-03: Resume Builder live preview va chinh sua section.
- UC-RM-04: Quan ly section nang cao (rename/reorder/hide/custom sections).
- UC-RM-05: Chon template va cau hinh bo cuc.
- UC-RM-06: Formatting controls (A4/Letter, margin, spacing, typography, compact).
- UC-RM-07: JD Match View (side-by-side, keyword highlight, match percentage).
- UC-RM-08: Resume Enrichment bang hoi dap muc tieu.
- UC-RM-09: Cover Letter va Email Generator.
- UC-RM-10: Xuat PDF WYSIWYG cho resume/cover letter.
- UC-RM-11: Da ngon ngu cho UI va AI content.
- UC-RM-12: Cau hinh privacy va AI provider (local Ollama/cloud APIs).

## 4) Thu tu uu tien trien khai tai lieu

1. UC-RM-02, UC-RM-03, UC-RM-07, UC-RM-10 (nhom tao gia tri truc tiep).
2. UC-RM-01, UC-RM-04, UC-RM-05, UC-RM-06 (nhom nang cao chat luong builder).
3. UC-RM-08, UC-RM-09 (nhom gia tang noi dung AI).
4. UC-RM-11, UC-RM-12 (nhom van hanh quoc te va bao mat).

