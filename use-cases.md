# Use Case Specification
## Smart CV Matching & Recruitment System

## 1. Mục tiêu tài liệu
Tài liệu này đặc tả các Use Case cốt lõi của hệ thống Smart CV Matching & Recruitment System cho đề tài nghiên cứu khoa học tại trường đại học. Trọng tâm là luồng tích hợp AI Hybrid Matching giữa SBERT (semantic matching) và TF-IDF/BM25 (keyword precision), được đóng gói qua Backend API Node.js (Express) và giao diện Next.js, sử dụng AI core từ Resume-Matcher.

## 2. Phạm vi hệ thống
Hệ thống hỗ trợ quy trình tuyển dụng thông minh gồm: tạo Job Description (JD), nộp CV, phân tích CV bằng Parsing, tính điểm phù hợp Hybrid Matching Score, xếp hạng ứng viên theo Cosine Similarity và cung cấp AI Feedback có khả năng giải thích (Explainable AI).

## 3. Danh sách Actor chính

| Actor | Mô tả vai trò | Mục tiêu chính |
|-------|---------------|----------------|
| Candidate (Ứng viên) | Người tìm việc tương tác qua giao diện web để nộp CV và xem phản hồi AI. | Tối ưu CV theo yêu cầu JD và tăng xác suất được shortlist. |
| Recruiter/HR (Nhà tuyển dụng) | Người tạo JD, theo dõi danh sách ứng viên và ra quyết định tuyển chọn. | Tìm ứng viên phù hợp nhanh, có căn cứ dữ liệu và AI explainability. |
| System/AI Engine (Hệ thống AI xử lý ngầm) | Tập hợp backend services và AI pipeline: Parsing, SBERT, TF-IDF/BM25, Vector DB, ranking, feedback generation. | Tự động hóa phân tích, chấm điểm, xếp hạng và giải thích kết quả matching. |

---

### UC-01: HR tạo Job Description (JD)
- **Brief Description:** HR khởi tạo một JD mới trên hệ thống, nhập các tiêu chí tuyển dụng và lưu vào cơ sở dữ liệu để làm đầu vào cho AI matching pipeline.
- **Primary Actor:** Recruiter/HR (Nhà tuyển dụng)
- **Pre-conditions:**
  1. HR đã đăng nhập và có quyền tạo JD.
  2. Hệ thống API Node.js (Express) và AI core đang hoạt động bình thường.
  3. Mẫu form JD đã được cấu hình các trường bắt buộc (job title, skills, requirements, responsibilities).
- **Main Success Scenario (Main Flow):**
  1. HR truy cập màn hình tạo JD trên giao diện Next.js.
  2. HR nhập thông tin JD: vị trí, mô tả công việc, kỹ năng bắt buộc, kỹ năng ưu tiên, kinh nghiệm tối thiểu, địa điểm làm việc.
  3. HR nhấn nút lưu JD.
  4. Frontend gửi request đến Backend Node.js (Express) để validate dữ liệu.
  5. Backend chuẩn hóa dữ liệu văn bản (text normalization) và lưu JD vào kho dữ liệu.
  6. Hệ thống AI Engine tạo representation ban đầu (chuẩn bị input cho SBERT embedding và TF-IDF/BM25 indexing).
  7. Hệ thống trả về thông báo tạo JD thành công kèm mã JD (JD ID).
- **Alternative/Exception Flow:**
  1. Nếu thiếu trường bắt buộc, hệ thống trả lỗi validation và highlight trường cần bổ sung.
  2. Nếu nội dung JD quá ngắn hoặc không đủ ngữ nghĩa, hệ thống cảnh báo chất lượng JD thấp và đề xuất bổ sung.
  3. Nếu backend hoặc database tạm thời không khả dụng, hệ thống hiển thị lỗi hệ thống và cho phép thử lại.
- **Post-conditions:**
  1. JD được lưu thành công với JD ID duy nhất.
  2. JD sẵn sàng làm đầu vào cho quy trình matching ứng viên.
  3. Trạng thái JD là Active (hoặc Draft nếu HR chưa publish).

### UC-02: Candidate tải lên CV (Kích hoạt Resume-Matcher PDF Parsing)
- **Brief Description:** Ứng viên tải CV lên hệ thống, hệ thống thực hiện kiểm tra định dạng/kích thước và kích hoạt pipeline PDF Parsing của Resume-Matcher để trích xuất dữ liệu có cấu trúc.
- **Primary Actor:** Candidate (Ứng viên)
- **Pre-conditions:**
  1. Candidate truy cập được trang nộp hồ sơ.
  2. Có ít nhất một JD đang mở để ứng tuyển.
  3. Tệp CV ở định dạng được hỗ trợ (ưu tiên PDF).
- **Main Success Scenario (Main Flow):**
  1. Candidate chọn JD cần ứng tuyển.
  2. Candidate chọn tệp CV từ thiết bị và nhấn Upload.
  3. Frontend gửi file đến Backend Node.js (Express) qua API upload.
  4. Backend kiểm tra loại file, kích thước file, và quét điều kiện bảo mật cơ bản.
  5. Backend chuyển file vào AI core Resume-Matcher để thực hiện PDF Parsing.
  6. AI Engine trích xuất các thực thể chính: thông tin cá nhân, học vấn, kinh nghiệm, kỹ năng, chứng chỉ, dự án.
  7. Dữ liệu đã parse được chuẩn hóa và lưu lại dưới hồ sơ Candidate Profile.
  8. Hệ thống trả về trạng thái 'Đang xử lý' (Processing) cho ứng viên và đưa task Parsing vào hàng đợi (Queue) xử lý ngầm.
- **Alternative/Exception Flow:**
  1. Nếu file vượt quá giới hạn dung lượng, hệ thống từ chối upload và thông báo kích thước tối đa cho phép.
  2. Nếu định dạng file không hợp lệ (ví dụ .zip, .exe), hệ thống từ chối xử lý và yêu cầu dùng PDF.
  3. Nếu PDF Parsing thất bại do file scan chất lượng thấp hoặc lỗi font mã hóa, hệ thống thông báo parse failed, gợi ý tải lại bản PDF text-based hoặc phiên bản rõ nét hơn.
  4. Nếu Parsing chỉ thành công một phần, hệ thống đánh dấu các trường thiếu và cho phép candidate bổ sung thủ công.
- **Post-conditions:**
  1. CV gốc được lưu an toàn theo chính sách lưu trữ.
  2. Candidate Profile dạng có cấu trúc được tạo hoặc cập nhật.
  3. Dữ liệu sẵn sàng cho bước tính Hybrid Matching Score.

### UC-03: Hệ thống phân tích và tính Hybrid Matching Score (SBERT + TF-IDF/BM25)
- **Brief Description:** Sau khi có JD và CV đã parse, System/AI Engine chạy pipeline hybrid để tính mức độ phù hợp giữa ứng viên và JD, kết hợp semantic relevance và keyword precision.
- **Primary Actor:** System/AI Engine (Hệ thống AI xử lý ngầm)
- **Pre-conditions:**
  1. JD đã tồn tại và ở trạng thái có thể matching.
  2. Candidate Profile đã được parse thành công (toàn phần hoặc một phần đủ điều kiện).
  3. Các mô hình và dịch vụ AI (SBERT model, TF-IDF/BM25 index, vector store như Qdrant) sẵn sàng.
  4. Điều kiện kích hoạt: Được kích hoạt (trigger) tự động ngay sau khi luồng xử lý ngầm ở UC-02 hoàn tất việc Parsing dữ liệu CV.
- **Main Success Scenario (Main Flow):**
  1. Hệ thống lấy nội dung JD và Candidate Profile từ kho dữ liệu.
  2. Hệ thống chuẩn hóa văn bản (tokenization/cleaning) để đồng bộ đầu vào.
  3. Pipeline SBERT sinh embedding vector cho JD và CV. Các Vector này được lưu trữ và truy vấn thông qua Vector Database (Qdrant), trong khi dữ liệu Text thô được lưu tại MongoDB.
  4. Hệ thống tính Cosine Similarity giữa vector JD và CV để tạo semantic score.
  5. Song song, pipeline TF-IDF/BM25 tính keyword relevance score dựa trên các từ khóa trọng yếu của JD.
  6. Hệ thống thực hiện weighted fusion theo công thức cấu hình để tạo Hybrid Matching Score cuối cùng.
  7. Kết quả được lưu gồm: semantic score, keyword score, hybrid score, matched skills, missing keywords, confidence metadata.
  8. Hệ thống phát sự kiện cập nhật để dashboard HR và màn hình feedback candidate đồng bộ dữ liệu mới.
- **Alternative/Exception Flow:**
  1. Nếu SBERT service timeout, hệ thống kích hoạt cơ chế retry; nếu vẫn thất bại thì dùng chế độ degraded scoring với TF-IDF/BM25 và gắn cờ kết quả tạm thời.
  2. Nếu TF-IDF/BM25 index chưa sẵn sàng, hệ thống ghi nhận lỗi indexing và chỉ trả semantic score kèm cảnh báo độ tin cậy.
  3. Nếu dữ liệu parse quá thiếu, hệ thống trả trạng thái insufficient data và yêu cầu candidate cập nhật CV.
- **Post-conditions:**
  1. Bản ghi scoring hoàn chỉnh được lưu cho từng cặp Candidate-JD.
  2. Hệ thống có dữ liệu để xếp hạng ứng viên theo thứ tự phù hợp.
  3. Explainable artifacts (matched/missing keywords) sẵn sàng cho UC-05.

### UC-04: HR xem Ranked Candidate Dashboard (Sắp xếp theo Cosine Similarity)
- **Brief Description:** HR truy cập dashboard để xem danh sách ứng viên đã được AI chấm điểm và xếp hạng, ưu tiên theo Cosine Similarity (và có thể hiển thị hybrid score).
- **Primary Actor:** Recruiter/HR (Nhà tuyển dụng)
- **Pre-conditions:**
  1. JD đã có ứng viên nộp CV.
  2. Quy trình scoring đã chạy xong cho ít nhất một ứng viên.
  3. HR có quyền truy cập dashboard tuyển dụng.
- **Main Success Scenario (Main Flow):**
  1. HR mở trang Ranked Candidate Dashboard cho một JD cụ thể.
  2. Frontend yêu cầu danh sách ứng viên từ Backend API.
  3. Backend trả dữ liệu đã sắp xếp giảm dần theo Cosine Similarity score (kèm hybrid score và metadata).
  4. Dashboard hiển thị bảng xếp hạng gồm: Candidate ID/tên, semantic score, keyword score, hybrid score, top matched skills, trạng thái hồ sơ.
  5. HR lọc/sort thêm theo ngưỡng điểm, kỹ năng, hoặc kinh nghiệm.
  6. HR chọn hồ sơ để xem chi tiết phân tích và quyết định shortlist.
- **Alternative/Exception Flow:**
  1. Nếu chưa có kết quả scoring, dashboard hiển thị trạng thái Processing và thời gian dự kiến hoàn tất.
  2. Nếu truy vấn dữ liệu thất bại do lỗi mạng/API, hệ thống hiển thị thông báo lỗi và nút retry.
  3. Nếu số lượng ứng viên lớn, hệ thống bật pagination/lazy loading để đảm bảo hiệu năng.
- **Post-conditions:**
  1. HR có danh sách ứng viên theo thứ tự ưu tiên khách quan dựa trên AI score.
  2. Quyết định shortlist/interview được hỗ trợ bởi dữ liệu định lượng và giải thích được.
  3. Hệ thống lưu audit log cho hành động xem/lọc/chọn ứng viên.

### UC-05: Candidate xem AI Feedback & Missing Keywords (Explainable AI)
- **Brief Description:** Candidate xem phản hồi từ AI về mức độ phù hợp với JD, bao gồm điểm số, kỹ năng phù hợp, và Missing Keywords để cải thiện CV.
- **Primary Actor:** Candidate (Ứng viên)
- **Pre-conditions:**
  1. Candidate đã nộp CV và có kết quả scoring.
  2. Hệ thống đã tạo explainable data (matched skills, missing keywords, gap analysis).
  3. Candidate có quyền truy cập vào kết quả của chính mình.
- **Main Success Scenario (Main Flow):**
  1. Candidate truy cập trang kết quả ứng tuyển.
  2. Frontend gọi API lấy AI feedback theo cặp Candidate-JD.
  3. Hệ thống hiển thị tổng quan: hybrid score, semantic score, keyword score.
  4. Hệ thống hiển thị danh sách điểm mạnh: matched skills/experience tương thích JD.
  5. Hệ thống hiển thị Missing Keywords và phần khuyến nghị hành động (ví dụ bổ sung project, công nghệ, metrics).
  6. Candidate cập nhật CV theo gợi ý và có thể gửi lại bản mới để re-evaluate.
- **Alternative/Exception Flow:**
  1. Nếu explainable data chưa sẵn sàng, hệ thống hiển thị trạng thái đang phân tích và cho phép tải lại.
  2. Nếu candidate truy cập sai phiên hoặc không đúng quyền, hệ thống từ chối truy cập và yêu cầu xác thực lại.
  3. Nếu feedback generation lỗi, hệ thống hiển thị bản fallback gồm điểm số cơ bản và thông báo sẽ cập nhật phân tích chi tiết sau.
- **Post-conditions:**
  1. Candidate hiểu rõ khoảng cách giữa CV hiện tại và yêu cầu JD.
  2. Candidate có danh sách cải tiến cụ thể, đo lường được.
  3. Hệ thống tăng tính minh bạch AI và nâng cao trải nghiệm ứng tuyển.

---

## 4. Ma trận liên kết Use Case và AI Pipeline

| Use Case | Thành phần kỹ thuật chính | Kết quả đầu ra |
|---|---|---|
| UC-01 | Next.js Form, Node.js (Express) API, JD Storage | JD chuẩn hóa và sẵn sàng indexing |
| UC-02 | File Upload API, Resume-Matcher PDF Parsing | Candidate Profile đã parse |
| UC-03 | SBERT Embedding, Cosine Similarity, TF-IDF/BM25, Hybrid Scoring, Qdrant | Hybrid Matching Score + explainable metadata |
| UC-04 | Ranking API, Dashboard UI, Filtering/Pagination | Danh sách ứng viên xếp hạng theo mức độ phù hợp |
| UC-05 | Explainable AI API, Feedback UI | Gợi ý cải thiện CV dựa trên Missing Keywords |

## 5. Ghi chú triển khai cho luận văn
1. Cần mô tả rõ công thức weighted fusion (tỷ trọng SBERT và TF-IDF/BM25) trong chương phương pháp nghiên cứu.
2. Cần bổ sung tiêu chí đánh giá hệ thống: Precision@K, Recall@K, NDCG hoặc thời gian phản hồi trung bình.
3. Cần làm rõ cơ chế fairness và giới hạn của mô hình AI để đảm bảo tính học thuật và đạo đức nghiên cứu.
