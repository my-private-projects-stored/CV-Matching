
## PHẦN 1: TẤT CẢ CÁC PROMPT AI TRONG DỰ ÁN

Hệ thống tích hợp AI qua 5 nhóm chức năng chính (Tailor Resume, Cover Letter & Outreach, Interview Prep, Resume Enrichment, và JD Keyword Extraction). Dưới đây là các prompt tương ứng:

### 1. Tailor Resume (Tối ưu hóa CV theo JD)
*   **Chức năng:** Tự động chỉnh sửa, cải thiện câu từ của CV để khớp với mô tả công việc (JD) của nhà tuyển dụng.
*   **Các cấp độ Prompt:**
    *   **Cấp độ "Nudge" (Điều chỉnh nhỏ):**
        > "You are a professional resume editor. Make targeted, minimal wording improvements to this resume to better match the job description. Do NOT add skills, tools, certifications, company names, metrics, or timelines that are not in the original resume. Return ONLY a JSON object with exactly two keys: 'resume_preview' and 'improvements'."
    *   **Cấp độ "Keywords" (Tập trung từ khóa):**
        > "You are a professional resume editor. Improve this resume's keyword alignment with the job description by rephrasing or emphasizing existing content. Only include skills, tools, and experience that are already present in the resume. Do NOT fabricate or embellish. Return ONLY a JSON object with exactly two keys: 'resume_preview' and 'improvements'."
    *   **Cấp độ "Full rewrite" (Viết lại toàn bộ):**
        > "You are a professional resume writer. Rewrite and strengthen this resume to be highly relevant to the job description. Improve clarity, impact, and alignment. Preserve all factual information. Do NOT invent skills, certifications, companies, dates, or metrics. Return ONLY a JSON object with exactly two keys: 'resume_preview' and 'improvements'."

### 2. Cover Letter & Outreach (Tạo thư xin việc & Tin nhắn kết nối)
*   **Tạo Cover Letter:**
    *   **Chức năng:** Tạo thư xin việc súc tích, cá nhân hóa dựa trên CV của ứng viên và bối cảnh công việc (JD).
    *   **Prompt:**
        > "You are a professional cover letter writer. Write a concise, compelling cover letter tailored to the job description below. Use only information from the resume — do not invent experience, skills, or metrics. Return plain text only. No JSON. 3–4 paragraphs maximum."
*   **Tạo Outreach Message (Email/LinkedIn):**
    *   **Chức năng:** Viết mẫu tin nhắn ngắn dưới 150 từ gửi đến đội ngũ tuyển dụng hoặc người đăng tuyển để tạo ấn tượng đầu tiên.
    *   **Prompt:**
        > "You are a professional recruiter assistant. Write a concise LinkedIn outreach or email message from the candidate to the hiring team for this role. Keep it under 150 words. Use only facts from the resume — do not invent accomplishments or skills. Return plain text only. No JSON."

### 3. Interview Preparation (Chuẩn bị phỏng vấn)
*   **Chức năng:** Tạo bộ câu hỏi phỏng vấn phân loại theo kỹ năng chuyên môn (Technical) và hành vi (Behavioral) bám sát CV ứng viên và JD.
*   **Prompt:**
    > "You are an expert technical interviewer. Generate a comprehensive set of interview questions based on the candidate's resume and the job context below. Return ONLY a valid JSON object. Required JSON schema: { 'question_groups': [ { 'group': 'technical', 'questions': [...] }, { 'group': 'behavioral', 'questions': [...] } ] }"

### 4. Resume Enrichment (Làm giàu & Cải thiện CV)
*   **Phân tích khoảng trống (Analyze Gaps):**
    *   **Prompt:**
        > "You are a professional resume coach. Analyze this resume and identify gaps or areas where the candidate could add more detail to strengthen their profile. Return ONLY a JSON object with keys: 'items_to_enrich', 'questions', and 'analysis_summary'."
*   **Cải thiện theo câu trả lời (Enhance Bullets):**
    *   **Prompt:**
        > "You are a professional resume writer. Using the candidate's answers to your questions, add truthful, specific bullets or improve existing resume content. Only use information from the resume and answers — do not invent anything. Return ONLY a JSON object with key: 'enhancements'."
*   **Tạo lại từng phần (Regenerate Item):**
    *   **Prompt:**
        > "You are a professional resume writer. Rewrite the specified resume items according to the instruction. Use only existing factual content. Return ONLY a JSON object with keys: 'regenerated_items' and 'errors'."

### 5. JD Keyword Extraction (AI lọc từ khóa JD)
*   **Chức năng:** Phân tích văn bản JD để trích xuất sạch các kỹ năng cứng và công nghệ cốt lõi, phục vụ cho việc tính điểm BM25.
*   **Prompt:**
    > "You are an expert technical recruiter. Analyze the job description and extract up to 80 core technical skills, hard skills, programming languages, databases, cloud providers, concepts, tools, or methodologies. Do NOT extract generic adjectives or common action verbs (like 'experienced', 'skilled', 'utilize', 'contribute'). Return ONLY a JSON object with a single key 'keywords' containing an array of strings. Example format: { 'keywords': ['React', 'TypeScript', 'Docker', 'AWS'] }"

---

## PHẦN 2: CHI TIẾT THUẬT TOÁN MATCHING (JD MATCH)

Thuật toán của tính năng JD Match sử dụng phương pháp **Hybrid Scoring (Điểm số lai)** để đo lường độ tương đồng của ứng viên đối với yêu cầu tuyển dụng. Công thức tính điểm tổng hợp:

```text
Hybrid Score = w_semantic * Semantic Score + w_keyword * Keyword Score
```

Trong đó:
*   Trọng số ngữ nghĩa: `w_semantic = 0.65` (Recruiter config)
*   Trọng số từ khóa: `w_keyword = 0.35`

---

### A. Thuật toán Từ khóa (Keyword Score - BM25)
Hệ thống sử dụng thuật toán **Okapi BM25** kết hợp với trọng số **IDF (Inverse Document Frequency)** thay vì chỉ đếm tần suất xuất hiện từ khóa đơn thuần.

#### 1. Công thức toán học BM25
Với một từ khóa truy vấn `q` trong tập các từ khóa của JD (`Q`), điểm số của văn bản CV (`D`) được tính như sau:

```text
                             f(q, D) * (k1 + 1)
Score(D, Q) = Σ [ IDF(q) * ----------------------------------------- ]
  q ∈ Q                     f(q, D) + k1 * (1 - b + b * (|D|/avgdl))
```

Trong đó:
*   `f(q, D)`: Tần suất từ khóa `q` xuất hiện trong văn bản CV (`D`).
*   `|D|`: Độ dài của văn bản CV (tổng số từ).
*   `avgdl`: Độ dài trung bình của các CV trong cơ sở dữ liệu hệ thống (corpus).
*   `k1`: Tham số điều chỉnh tần suất từ (mặc định trong code là `1.2`). `k1` kiểm soát mức độ bão hòa của tần suất từ.
*   `b`: Tham số điều chỉnh độ dài văn bản (mặc định trong code là `0.75`). `b` phạt các CV quá dài nhưng không cô đọng.

#### 2. Công thức tính IDF (Inverse Document Frequency)
Để đánh giá tầm quan trọng của một từ khóa `q` trong toàn bộ tập dữ liệu (Corpus), hệ thống sử dụng công thức **BM25 IDF**:

```text
IDF(q) = ln( 1 + (N - n(q) + 0.5) / (n(q) + 0.5) )
```

Trong đó:
*   `N`: Tổng số lượng CV có trong cơ sở dữ liệu của hệ thống.
*   `n(q)`: Số lượng CV chứa từ khóa `q`.
*   *Ý nghĩa:* Từ khóa càng phổ biến (xuất hiện ở nhiều CV như `word`, `excel`) thì IDF càng thấp. Từ khóa chuyên môn đặc thù (như `kubernetes`, `terraform`) sẽ có IDF rất cao, tạo điểm nhấn cho ứng viên sở hữu chúng.

---

### B. Thuật toán Ngữ nghĩa (Semantic Score - Cosine Similarity)
Điểm ngữ nghĩa khắc phục nhược điểm của từ khóa tĩnh (giải quyết các từ đồng nghĩa như "API developer" vs "backend developer").

#### 1. Cơ chế hoạt động
1. Văn bản JD (`jobText`) và văn bản CV (`resumeText`) được đi qua mô hình AI (SBERT - Sentence-BERT) chuyển đổi thành các vector mật độ cao (Dense Vector) trong không gian đa chiều:
   ```text
   V_JD = Embedding(JD)
   V_CV = Embedding(CV)
   ```
2. Điểm tương đồng ngữ nghĩa chính là góc giữa hai vector này, được tính bằng công thức **Cosine Similarity (Độ tương đồng Cosine)**:

```text
Cosine Similarity(V_JD, V_CV) = (V_JD • V_CV) / (||V_JD|| * ||V_CV||)

                                Σ (V_JD[i] * V_CV[i])
                              = ---------------------------------
                                √[Σ (V_JD[i])²] * √[Σ (V_CV[i])²]
```

*   *Phạm vi:* Giá trị trả về từ `[-1, 1]`, sau đó được chuẩn hóa về `[0, 1]` (hoặc `0% - 100%`).
*   *Ý nghĩa:* Đo lường độ tương quan về mặt ý nghĩa ngữ cảnh. Dù ứng viên dùng từ đồng nghĩa khác biệt, góc vector vẫn hẹp, cho ra điểm số cao.

---

### C. Quy trình xử lý Tiền xử lý (Preprocessing) & Stopwords
Để thuật toán BM25 và Cosine Similarity hoạt động chính xác, dữ liệu đầu vào phải trải qua tiền xử lý nghiêm ngặt:

1. **Chuẩn hóa chữ viết:** Đưa toàn bộ về chữ thường, loại bỏ các ký tự đặc biệt thừa ở đầu/cuối của từ.
2. **Hỗ trợ từ chuyên môn đặc thù:** Tokenizer sử dụng Regex tùy chỉnh để không tách rời các ký hiệu kỹ thuật như `C++`, `C#`, `.NET`, `Node.js`.
3. **Bộ lọc Từ dừng (Stopwords Filter):**
   * Loại bỏ các từ chức năng ngữ pháp (`a`, `an`, `the`, `with`...).
   * Loại bỏ các từ noise đặc trưng tuyển dụng (`recruiter`, `interview`, `salary`, `company`...) để tránh làm nhiễu dữ liệu.
