# Use Case Specification (Product Extended)
## Feature Set Mo Rong theo Resume Matcher Goc

## 1. Muc tieu tai lieu
Tai lieu nay dac ta nhom Use Case mo rong theo huong san pham, doi chieu theo README va trang Features cua Resume Matcher goc.

Pham vi UC-RM nham bao phu cac nhom tinh nang:
- Master resume workflow.
- AI-powered tailoring, builder UX, templates, formatting controls.
- JD Match View, enrichment, cover letter/email generation.
- PDF export WYSIWYG, da ngon ngu, privacy va AI provider options.

## 2. Danh sach actor

| Actor | Vai tro |
|---|---|
| Candidate | Nguoi su dung chinh cua cac tinh nang builder, tailoring, export, generation |
| Recruiter/HR | Co the cau hinh provider hoac su dung mot phan output de danh gia ung vien |
| System/AI Engine | Xu ly AI tailoring, enrichment, generation, render PDF, i18n content |

---

## 3. NHOM USE CASE MO RONG (UC-RM)

### UC-RM-01: Candidate quan ly Master Resume
- **Brief Description:** Candidate tao mot ho so resume goc (master resume) de tai su dung khi toi uu theo nhieu JD khac nhau.
- **Primary Actor:** Candidate
- **Pre-conditions:** Candidate da dang nhap va co quyen truy cap trinh quan ly resume.
- **Main Flow:**
  1. Candidate tao hoac import resume goc tu du lieu hien co.
  2. He thong luu phien ban master resume kem metadata chinh sua.
  3. Candidate cap nhat cac section co ban (summary, experience, skills, projects).
  4. He thong luu lich su phien ban de phuc vu tai su dung.
- **Post-conditions:** Master resume kha dung de tailor theo tung JD.

### UC-RM-02: Candidate tailor resume theo Job Description bang AI
- **Brief Description:** Candidate nhap JD muc tieu va yeu cau he thong AI de xuat noi dung resume phu hop.
- **Primary Actor:** Candidate
- **Pre-conditions:** Da co master resume hop le.
- **Main Flow:**
  1. Candidate dan JD vao giao dien tailoring.
  2. He thong trich xuat yeu cau chinh tu JD.
  3. AI doi chieu voi master resume va sinh de xuat noi dung toi uu.
  4. Candidate duyet/chinh sua de xuat truoc khi luu.
- **Post-conditions:** Tao tailored resume cho JD cu the.

### UC-RM-03: Candidate chinh sua resume bang Resume Builder (live preview)
- **Brief Description:** Candidate chinh sua noi dung resume trong trinh builder va xem preview theo thoi gian thuc.
- **Primary Actor:** Candidate
- **Pre-conditions:** Tailored resume hoac master resume da ton tai.
- **Main Flow:**
  1. Candidate mo Resume Builder.
  2. Candidate chinh sua noi dung tung section.
  3. He thong cap nhat preview ngay khi thay doi.
  4. Candidate luu phien ban chinh sua.
- **Post-conditions:** Resume duoc cap nhat voi trai nghiem WYSIWYG.

### UC-RM-04: Candidate quan ly section nang cao
- **Brief Description:** Candidate thuc hien cac thao tac nang cao voi section nhu doi ten, sap xep, an/hien va them section tuy bien.
- **Primary Actor:** Candidate
- **Pre-conditions:** Resume dang mo trong builder.
- **Main Flow:**
  1. Candidate doi ten section.
  2. Candidate keo-tha de doi thu tu section.
  3. Candidate an section khoi PDF nhung van giu du lieu chinh sua.
  4. Candidate them hoac xoa section tuy bien.
- **Post-conditions:** Cau truc resume linh hoat theo muc tieu ung tuyen.

### UC-RM-05: Candidate chon template resume
- **Brief Description:** Candidate chon mau trinh bay resume phu hop voi ngu canh ung tuyen.
- **Primary Actor:** Candidate
- **Pre-conditions:** Resume co du lieu toi thieu de render.
- **Main Flow:**
  1. Candidate xem danh sach template.
  2. Candidate chon template mong muon.
  3. He thong render preview theo template da chon.
- **Post-conditions:** Resume su dung template phu hop va nhat quan.

### UC-RM-06: Candidate tinh chinh formatting controls
- **Brief Description:** Candidate tuy chinh cac thong so dinh dang nhu kho giay, margin, spacing, typography, compact mode.
- **Primary Actor:** Candidate
- **Pre-conditions:** Resume dang mo trong builder.
- **Main Flow:**
  1. Candidate chon kho giay (A4/US Letter).
  2. Candidate dieu chinh margin va spacing.
  3. Candidate dieu chinh typography va bat/tat compact mode.
  4. He thong cap nhat preview ngay lap tuc.
- **Post-conditions:** Resume dat chat luong trinh bay theo mong muon.

### UC-RM-07: Candidate xem JD Match View
- **Brief Description:** Candidate xem doi chieu side-by-side giua JD va resume kem keyword highlight va match percentage.
- **Primary Actor:** Candidate
- **Pre-conditions:** Da co tailored resume hoac ket qua matching tuong ung.
- **Main Flow:**
  1. Candidate mo man hinh JD Match View.
  2. He thong hien thi JD o mot ben va resume o ben con lai.
  3. He thong to sang keyword match va hien thi match percentage.
- **Post-conditions:** Candidate danh gia nhanh muc do phu hop truoc khi nop.

### UC-RM-08: Candidate su dung Resume Enrichment
- **Brief Description:** He thong hoi cac cau hoi muc tieu de lam giau noi dung resume va bo sung bullet points moi.
- **Primary Actor:** Candidate
- **Pre-conditions:** Resume co noi dung co ban de AI phan tich.
- **Main Flow:**
  1. Candidate kich hoat tinh nang Enhance/Enrichment.
  2. He thong dat bo cau hoi ngan theo ngu canh kinh nghiem.
  3. Candidate tra loi.
  4. AI sinh bullet points bo sung ma khong ghi de noi dung cu.
- **Post-conditions:** Resume giau thong tin hon va tang kha nang khop JD.

### UC-RM-09: Candidate tao Cover Letter va Email theo JD
- **Brief Description:** Candidate tao thu xin viec va email ung tuyen dua tren resume + JD muc tieu.
- **Primary Actor:** Candidate
- **Pre-conditions:** Co JD va resume du du lieu dau vao.
- **Main Flow:**
  1. Candidate chon tao Cover Letter hoac Email.
  2. He thong sinh noi dung bang AI.
  3. Candidate chinh sua va luu.
- **Post-conditions:** Co bo tai lieu ung tuyen day du.

### UC-RM-10: Candidate xuat PDF (WYSIWYG)
- **Brief Description:** Candidate xuat resume (va tai lieu lien quan) ra PDF theo dung preview.
- **Primary Actor:** Candidate
- **Pre-conditions:** Resume da hoan tat chinh sua.
- **Main Flow:**
  1. Candidate nhan Export PDF.
  2. He thong render PDF tu phien ban hien tai.
  3. Candidate tai file PDF ve thiet bi.
- **Post-conditions:** Candidate nhan duoc PDF on dinh dinh dang de nop ho so.

### UC-RM-11: Candidate cau hinh ngon ngu UI va ngon ngu noi dung AI
- **Brief Description:** Candidate cau hinh ngon ngu giao dien va ngon ngu noi dung AI doc lap.
- **Primary Actor:** Candidate
- **Pre-conditions:** He thong da bat i18n va ho tro nhieu ngon ngu.
- **Main Flow:**
  1. Candidate chon ngon ngu UI.
  2. Candidate chon ngon ngu sinh noi dung AI.
  3. He thong ap dung cau hinh cho toan bo workflow.
- **Post-conditions:** Trai nghiem da ngon ngu dung muc tieu su dung.

### UC-RM-12: User cau hinh che do privacy va AI provider
- **Brief Description:** User chon chay local provider (vi du Ollama) hoac cloud provider theo nhu cau bao mat/chi phi.
- **Primary Actor:** Candidate, Recruiter/HR
- **Pre-conditions:** He thong ho tro nhieu AI provider.
- **Main Flow:**
  1. User mo trang cai dat AI provider.
  2. User chon local hoac cloud provider.
  3. User cau hinh endpoint/API key theo provider da chon.
  4. He thong kiem tra ket noi va luu cau hinh.
- **Post-conditions:** Workflow AI hoat dong theo chinh sach rieng tu mong muon.

---

## 4. Ma tran lien ket UC-RM voi thanh phan ky thuat

| Use Case | Thanh phan ky thuat chinh | Ket qua dau ra |
|---|---|---|
| UC-RM-01 | Resume storage, versioning service, profile APIs | Master resume co phien ban |
| UC-RM-02 | LLM tailoring engine, JD parser, content rewrite APIs | Tailored resume theo JD |
| UC-RM-03 | Next.js builder UI, state management, preview renderer | Trinh sua resume realtime |
| UC-RM-04 | Section schema + drag/drop UI + visibility flags | Cau truc section linh hoat |
| UC-RM-05 | Template registry, template renderer | Resume theo template da chon |
| UC-RM-06 | Print/layout config service + preview sync | Kiem soat dinh dang dau ra |
| UC-RM-07 | Matching explain API + keyword highlight renderer | Man hinh doi chieu JD-Resume |
| UC-RM-08 | Enrichment question flow + content expansion engine | Bullet points bo sung co kiem soat |
| UC-RM-09 | LLM generation APIs cho cover letter/email | Bo tai lieu ung tuyen bo sung |
| UC-RM-10 | PDF generation pipeline (WYSIWYG) | File PDF san sang nop |
| UC-RM-11 | i18n framework + language preference storage | UI/content da ngon ngu |
| UC-RM-12 | Provider config, secret management, connectivity check | Che do AI local/cloud co kiem soat |

## 5. Goi y uu tien trien khai
1. UC-RM-02, UC-RM-03, UC-RM-07, UC-RM-10.
2. UC-RM-01, UC-RM-04, UC-RM-05, UC-RM-06.
3. UC-RM-08, UC-RM-09.
4. UC-RM-11, UC-RM-12.
