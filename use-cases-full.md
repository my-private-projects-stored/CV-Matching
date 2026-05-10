# Use Case Tong Hop - Smart CV Matching & Recruitment System
**Ngay:** 2026-05-06

Tai lieu nay tong hop day du tat ca Use Case theo nhom UC-CORE, UC-BASIC, UC-RM. Moi use case gom:
- Cong dung (muc tieu su dung)
- Dung cho ai (actor chinh)
- Flow (cac buoc chinh)

---

## NHOM UC-CORE (AI Pipeline)

### UC-CORE-01: HR tao Job Description (JD)
- **Cong dung:** Tao JD lam dau vao cho pipeline matching.
- **Dung cho ai:** Recruiter/HR.
- **Flow:**
  1. HR mo form tao JD tren web.
  2. Nhap thong tin (tieu de, mo ta, yeu cau, ky nang, kinh nghiem, dia diem).
  3. He thong validate va luu JD.
  4. AI engine chuan bi input cho embedding va index.
  5. Tra ve thong bao tao JD thanh cong va JD ID.

### UC-CORE-02: Candidate tai CV + Parsing
- **Cong dung:** Thu thap CV va trich xuat du lieu co cau truc de phuc vu matching.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Candidate chon JD va upload file CV (uu tien PDF).
  2. Backend kiem tra dinh dang, dung luong, bao mat co ban.
  3. He thong gui CV den service parsing va cho xu ly.
  4. Du lieu parse duoc luu vao profile/ho so ung vien.
  5. Tra ve trang thai xu ly va thong tin co ban.

### UC-CORE-03: Tinh Hybrid Matching Score
- **Cong dung:** Cham diem phu hop CV-JD bang SBERT + TF-IDF/BM25.
- **Dung cho ai:** System/AI Engine.
- **Flow:**
  1. He thong lay JD va CV da parse.
  2. Tao embedding SBERT va tinh cosine similarity.
  3. Tinh keyword relevance bang TF-IDF/BM25.
  4. Hop nhat diem thanh hybrid score va luu ket qua.
  5. Phat tin hieu cap nhat cho dashboard/feedback.

### UC-CORE-04: HR xem Ranked Candidate Dashboard
- **Cong dung:** Xem danh sach ung vien duoc xep hang theo diem AI.
- **Dung cho ai:** Recruiter/HR.
- **Flow:**
  1. HR mo trang ranked dashboard cua mot JD.
  2. Backend tra ve danh sach ung vien sap xep theo diem.
  3. UI hien diem va thong tin ung vien, cho phep loc/sort.
  4. HR chon ung vien de xem chi tiet ho so.

### UC-CORE-05: Candidate xem AI Feedback & Missing Keywords
- **Cong dung:** Cung cap phan hoi ro rang ve diem manh/diem thieu de cai thien CV.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Candidate mo trang ket qua ung tuyen.
  2. He thong tra ve diem, matched skills, missing keywords.
  3. UI hien goi y cai thien noi dung.
  4. Candidate chinh sua CV va co the nop lai.

---

## NHOM UC-BASIC (Nen tang)

### UC-BASIC-01: Dang ky tai khoan
- **Cong dung:** Tao tai khoan theo vai tro de su dung he thong.
- **Dung cho ai:** Candidate, Recruiter/HR.
- **Flow:**
  1. Nguoi dung nhap thong tin dang ky.
  2. Backend validate va tao tai khoan.
  3. He thong cap token truy cap va dang nhap.

### UC-BASIC-02: Dang nhap he thong
- **Cong dung:** Xac thuc nguoi dung va cap quyen truy cap.
- **Dung cho ai:** Candidate, Recruiter/HR.
- **Flow:**
  1. Nguoi dung nhap email/mat khau.
  2. Backend kiem tra thong tin.
  3. He thong cap JWT va chuyen vao ung dung.

### UC-BASIC-03: Quen mat khau
- **Cong dung:** Phuc hoi tai khoan khi quen mat khau.
- **Dung cho ai:** Candidate, Recruiter/HR.
- **Flow:**
  1. Nguoi dung gui yeu cau reset.
  2. He thong tao token va gui link reset.
  3. Nguoi dung nhap mat khau moi.
  4. He thong cap nhat mat khau va vo hieu token cu.

### UC-BASIC-04: Doi mat khau
- **Cong dung:** Cho phep doi mat khau khi dang dang nhap.
- **Dung cho ai:** Candidate, Recruiter/HR.
- **Flow:**
  1. Nguoi dung nhap mat khau cu va moi.
  2. Backend xac thuc va cap nhat mat khau.
  3. He thong thong bao cap nhat thanh cong.

### UC-BASIC-05: Quan ly Profile ca nhan
- **Cong dung:** Luu ho so ung vien de tai su dung trong nhieu lan ung tuyen.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Candidate mo trang profile.
  2. Cap nhat hoc van/kinh nghiem/ky nang/portfolio.
  3. Luu thong tin va cap nhat ho so.

### UC-BASIC-06: Xem danh sach viec lam
- **Cong dung:** Duyet va loc cac tin tuyen dung phu hop.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Candidate mo job board.
  2. Tim kiem va loc theo tu khoa/dia diem/danh muc.
  3. Mo chi tiet tin va tien hanh ung tuyen.

### UC-BASIC-07: Xem lich su ung tuyen
- **Cong dung:** Theo doi trang thai ung tuyen theo tung job.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Candidate mo trang lich su ung tuyen.
  2. He thong hien danh sach don ung tuyen.
  3. Hien trang thai va thoi diem cap nhat.

### UC-BASIC-08: Quan ly thong tin cong ty
- **Cong dung:** Cap nhat profile cong ty va branding hien thi tren tin tuyen dung.
- **Dung cho ai:** Recruiter/HR.
- **Flow:**
  1. Recruiter cap nhat thong tin cong ty (overview, industry, logo, mau chu dao).
  2. He thong luu cau hinh company profile.
  3. Job board/chi tiet job hien banner cong ty da cau hinh.

### UC-BASIC-09: Xem danh sach tin tuyen dung
- **Cong dung:** Quan ly cac tin da tao va so ung vien.
- **Dung cho ai:** Recruiter/HR.
- **Flow:**
  1. Recruiter mo danh sach tin tuyen dung.
  2. Loc theo trang thai, danh muc.
  3. Xem nhanh so ung vien va thao tac tiep.

### UC-BASIC-10: Cap nhat tin tuyen dung co ban
- **Cong dung:** Chinh sua noi dung tin tuyen dung.
- **Dung cho ai:** Recruiter/HR.
- **Flow:**
  1. Recruiter mo form chinh sua tin.
  2. Cap nhat mo ta/yeu cau/benefits/deadline.
  3. He thong luu thay doi va ghi history.

### UC-BASIC-11: Xoa/dong tin tuyen dung
- **Cong dung:** Dung nhan ho so moi hoac xoa mem tin.
- **Dung cho ai:** Recruiter/HR.
- **Flow:**
  1. Recruiter chon dong hoac xoa mem tin.
  2. He thong cap nhat trang thai va ghi audit.
  3. Tin khong con nhan ho so moi.

### UC-BASIC-12: Tai xuong CV goc
- **Cong dung:** Cho phep tai ve file CV goc de xem chi tiet.
- **Dung cho ai:** Recruiter/HR.
- **Flow:**
  1. Recruiter chon tai CV goc tu ho so ung vien.
  2. He thong kiem tra quyen va tra file ve.

### UC-BASIC-13: Cap nhat trang thai ung vien
- **Cong dung:** Quan ly pipeline trang thai ung vien.
- **Dung cho ai:** Recruiter/HR.
- **Flow:**
  1. Recruiter chon ung vien va trang thai moi.
  2. He thong cap nhat va luu lich su trang thai.
  3. UI cap nhat hien thi trang thai moi.

---

## NHOM UC-RM (Product Extended)

### UC-RM-01: Candidate quan ly Master Resume
- **Cong dung:** Tao va quan ly resume goc de tai su dung.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Candidate tao hoac import master resume.
  2. Chinh sua noi dung va luu phien ban.
  3. He thong luu lich su phien ban.

### UC-RM-02: Candidate tailor resume theo JD
- **Cong dung:** Toi uu resume theo JD bang AI.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Candidate nhap JD.
  2. AI de xuat thay doi/keyword.
  3. Candidate preview va confirm.
  4. Tao tailored resume moi.

### UC-RM-03: Resume Builder live preview
- **Cong dung:** Chinh sua resume voi preview theo thoi gian thuc.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Mo builder.
  2. Chinh sua tung section.
  3. Preview cap nhat ngay.
  4. Luu phien ban.

### UC-RM-04: Quan ly section nang cao
- **Cong dung:** Doi ten/sap xep/an hien/them section.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Doi ten section.
  2. Keo-tha doi thu tu.
  3. An/hien section tren PDF.
  4. Them/xoa section tuy bien.

### UC-RM-05: Chon template resume
- **Cong dung:** Chon mau trinh bay resume.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Mo danh sach template.
  2. Chon template mong muon.
  3. Preview cap nhat theo template.

### UC-RM-06: Formatting controls
- **Cong dung:** Tinh chinh dinh dang hien thi resume.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Chon kho giay, margin, spacing.
  2. Chon font va compact mode.
  3. Preview cap nhat tuc thi.

### UC-RM-07: JD Match View
- **Cong dung:** So sanh JD va resume, highlight keyword.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Mo man hinh JD Match View.
  2. Hien thi JD va resume side-by-side.
  3. Highlight keyword va hien match percentage.

### UC-RM-08: Resume Enrichment
- **Cong dung:** Giau noi dung resume bang cau hoi/goi y AI.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Mo enrichment.
  2. Tra loi cau hoi.
  3. AI sinh bullet points bo sung.
  4. Apply vao resume.

### UC-RM-09: Cover Letter + Outreach Email
- **Cong dung:** Tao bo tai lieu ung tuyen tu resume + JD.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Chon tao cover letter hoac outreach.
  2. AI sinh noi dung.
  3. Candidate chinh sua va luu.

### UC-RM-10: Xuat PDF WYSIWYG
- **Cong dung:** Tai PDF theo preview.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Nhap Export PDF.
  2. He thong render PDF.
  3. Tai file ve thiet bi.

### UC-RM-11: Ngon ngu UI + AI content
- **Cong dung:** Cau hinh ngon ngu giao dien va AI output.
- **Dung cho ai:** Candidate.
- **Flow:**
  1. Chon UI language.
  2. Chon AI content language.
  3. He thong ap dung cho toan bo workflow.

### UC-RM-12: Privacy mode + AI provider
- **Cong dung:** Chon che do local/cloud cho AI va cau hinh API key.
- **Dung cho ai:** Candidate, Recruiter/HR.
- **Flow:**
  1. Mo cai dat provider.
  2. Chon local hoac cloud.
  3. Cau hinh endpoint/API key.
  4. Test ket noi va luu.

---

## Ghi chu
- Tai lieu nay tong hop toan bo use case da hoan thien theo current implementation.
- Tham khao them: use-cases-complete.md, use-cases-core.md, use-cases-product-extended.md.
