# Use Case Specification
## Smart CV Matching & Recruitment System

## 1. Mục tiêu tài liệu
Tài liệu này đặc tả đầy đủ Use Case của hệ thống Smart CV Matching & Recruitment System cho đề tài nghiên cứu khoa học tại trường đại học, bao gồm:
- Nhóm Use Case AI lõi (UC-CORE-01 đến UC-CORE-05) phục vụ năng lực matching thông minh.
- Nhóm Use Case quản trị hệ thống và nghiệp vụ cơ bản (UC-BASIC-01 đến UC-BASIC-13) phục vụ vận hành nền tảng tuyển dụng.

## 2. Phạm vi hệ thống
Hệ thống hỗ trợ quy trình tuyển dụng thông minh gồm:
- Tạo Job Description (JD), nộp CV, Parsing CV.
- Tính Hybrid Matching Score bằng SBERT + TF-IDF/BM25.
- Xếp hạng ứng viên theo Cosine Similarity.
- Cung cấp Explainable AI feedback.
- Các tính năng web nền tảng: tài khoản, profile, quản lý tin tuyển dụng, cập nhật status ứng viên.

## 3. Danh sách Actor chính

| Actor | Mô tả vai trò | Mục tiêu chính |
|---|---|---|
| Candidate (Ứng viên) | Người tìm việc tương tác qua giao diện web để nộp CV, xem kết quả matching, và quản lý hồ sơ cá nhân. | Tối ưu CV theo yêu cầu JD và tăng xác suất được shortlist. |
| Recruiter/HR (Nhà tuyển dụng) | Người tạo JD, quản lý tin tuyển dụng, theo dõi và cập nhật trạng thái ứng viên. | Tìm ứng viên phù hợp nhanh, có căn cứ dữ liệu và AI explainability. |
| System/AI Engine (Hệ thống AI xử lý ngầm) | Tập hợp backend services và AI pipeline: Parsing, SBERT, TF-IDF/BM25, Vector DB, ranking, feedback generation. | Tự động hóa phân tích, chấm điểm, xếp hạng và giải thích kết quả matching. |

---

## 4. NHÓM USE CASE AI LÕI

### UC-CORE-01: HR tạo Job Description (JD)
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

### UC-CORE-02: Candidate tải lên CV (Kích hoạt Resume-Matcher PDF Parsing)
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

### UC-CORE-03: Hệ thống phân tích và tính Hybrid Matching Score (SBERT + TF-IDF/BM25)
- **Brief Description:** Sau khi có JD và CV đã parse, System/AI Engine chạy pipeline hybrid để tính mức độ phù hợp giữa ứng viên và JD, kết hợp semantic relevance và keyword precision.
- **Primary Actor:** System/AI Engine (Hệ thống AI xử lý ngầm)
- **Pre-conditions:**
  1. JD đã tồn tại và ở trạng thái có thể matching.
  2. Candidate Profile đã được parse thành công (toàn phần hoặc một phần đủ điều kiện).
  3. Các mô hình và dịch vụ AI (SBERT model, TF-IDF/BM25 index, vector store như Qdrant) sẵn sàng.
  4. Điều kiện kích hoạt: Được kích hoạt (trigger) tự động ngay sau khi luồng xử lý ngầm ở UC-CORE-02 hoàn tất việc Parsing dữ liệu CV.
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
  3. Explainable artifacts (matched/missing keywords) sẵn sàng cho UC-CORE-05.

### UC-CORE-04: HR xem Ranked Candidate Dashboard (Sắp xếp theo Cosine Similarity)
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

### UC-CORE-05: Candidate xem AI Feedback & Missing Keywords (Explainable AI)
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

## 5. NHÓM USE CASE QUẢN TRỊ HỆ THỐNG & NGHIỆP VỤ CƠ BẢN

Phần này bổ sung các Use Case nền tảng (Common Web Features) để hoàn thiện hệ thống quản lý tuyển dụng, bên cạnh các Use Case AI lõi.

### Nhóm A: Quản lý tài khoản

| Mã UC | Tên Use Case | Tác nhân (Actor) | Mô tả tóm tắt tính năng |
|---|---|---|---|
| UC-BASIC-01 | Đăng ký tài khoản | Candidate, Recruiter/HR | Người dùng tạo tài khoản mới theo vai trò, xác thực thông tin cơ bản, lưu hồ sơ tài khoản ban đầu và cấp quyền truy cập theo role. |
| UC-BASIC-02 | Đăng nhập hệ thống | Candidate, Recruiter/HR | Người dùng đăng nhập bằng email/số điện thoại và mật khẩu; hệ thống cấp JWT để duy trì phiên làm việc và phân quyền truy cập API. |
| UC-BASIC-03 | Quên mật khẩu | Candidate, Recruiter/HR | Người dùng yêu cầu reset mật khẩu; hệ thống gửi liên kết hoặc OTP xác minh, cho phép thiết lập lại mật khẩu an toàn trong thời hạn hiệu lực. |
| UC-BASIC-04 | Đổi mật khẩu | Candidate, Recruiter/HR | Người dùng đã đăng nhập chủ động cập nhật mật khẩu; hệ thống kiểm tra mật khẩu cũ, chính sách độ mạnh và vô hiệu hóa phiên cũ khi cần. |

### Nhóm B: Nghiệp vụ cho Ứng viên

| Mã UC | Tên Use Case | Tác nhân (Actor) | Mô tả tóm tắt tính năng |
|---|---|---|---|
| UC-BASIC-05 | Quản lý Profile cá nhân | Candidate | Ứng viên tạo/cập nhật Profile gồm thông tin liên hệ, học vấn, kỹ năng, kinh nghiệm, portfolio để tái sử dụng cho nhiều lần ứng tuyển. |
| UC-BASIC-06 | Xem danh sách việc làm | Candidate | Ứng viên duyệt danh sách tin tuyển dụng, tìm kiếm theo từ khóa, lọc theo vị trí/kỹ năng/địa điểm và xem chi tiết JD trước khi nộp hồ sơ. |
| UC-BASIC-07 | Xem lịch sử ứng tuyển | Candidate | Ứng viên theo dõi toàn bộ lịch sử nộp hồ sơ, trạng thái xử lý từng đơn (submitted, processing, shortlisted, rejected) và thời điểm cập nhật gần nhất. |

### Nhóm C: Nghiệp vụ cho Nhà tuyển dụng

| Mã UC | Tên Use Case | Tác nhân (Actor) | Mô tả tóm tắt tính năng |
|---|---|---|---|
| UC-BASIC-08 | Quản lý thông tin công ty | Recruiter/HR | Nhà tuyển dụng cập nhật hồ sơ công ty (giới thiệu, lĩnh vực, quy mô, địa chỉ, website, branding) để hiển thị thống nhất trên các tin tuyển dụng. |
| UC-BASIC-09 | Xem chi tiết danh sách tin tuyển dụng | Recruiter/HR | Nhà tuyển dụng xem toàn bộ tin đã tạo, tra cứu theo trạng thái và truy cập nhanh số lượng ứng viên theo từng vị trí. |
| UC-BASIC-10 | Cập nhật tin tuyển dụng cơ bản | Recruiter/HR | Nhà tuyển dụng chỉnh sửa nội dung tin tuyển dụng đang hoạt động (yêu cầu, quyền lợi, deadline, status hiển thị) và lưu lịch sử thay đổi quan trọng. |
| UC-BASIC-11 | Xóa/đóng tin tuyển dụng | Recruiter/HR | Nhà tuyển dụng thực hiện soft delete hoặc đóng tin tuyển dụng; hệ thống ngừng nhận hồ sơ mới nhưng vẫn lưu dữ liệu phục vụ đối soát và báo cáo. |
| UC-BASIC-12 | Xem và tải xuống CV gốc | Recruiter/HR | Nhà tuyển dụng có quyền tải xuống tệp CV định dạng gốc (PDF/Word) của ứng viên để xem bố cục chi tiết hoặc lưu trữ nội bộ theo quy định. |
| UC-BASIC-13 | Cập nhật trạng thái ứng viên | Recruiter/HR | Nhà tuyển dụng cập nhật status ứng viên theo pipeline tuyển dụng (new, screening, interview, offer, hired, rejected), đồng thời ghi log phục vụ audit. |

---

## 6. Ma trận liên kết Use Case và AI Pipeline

| Use Case | Thành phần kỹ thuật chính | Kết quả đầu ra |
|---|---|---|
| UC-CORE-01 | Next.js Form, Node.js (Express) API, JD Storage | JD chuẩn hóa và sẵn sàng indexing |
| UC-CORE-02 | File Upload API, Resume-Matcher PDF Parsing | Candidate Profile đã parse |
| UC-CORE-03 | SBERT Embedding, Cosine Similarity, TF-IDF/BM25, Hybrid Scoring, Qdrant, MongoDB | Hybrid Matching Score + explainable metadata |
| UC-CORE-04 | Ranking API, Dashboard UI, Filtering/Pagination | Danh sách ứng viên xếp hạng theo mức độ phù hợp |
| UC-CORE-05 | Explainable AI API, Feedback UI | Gợi ý cải thiện CV dựa trên Missing Keywords |

## 7. Ghi chú chuẩn hóa thuật ngữ
- Các thuật ngữ kỹ thuật như JWT, CRUD, Profile, status, Parsing, Queue được giữ nguyên tiếng Anh để đồng nhất với tài liệu kỹ thuật hệ thống.
- Các Use Case cơ bản được trình bày ở mức tóm tắt để tránh làm loãng trọng tâm NCKH về AI matching.

## 8. Ghi chú triển khai cho luận văn
1. Cần mô tả rõ công thức weighted fusion (tỷ trọng SBERT và TF-IDF/BM25) trong chương phương pháp nghiên cứu.
2. Cần bổ sung tiêu chí đánh giá hệ thống: Precision@K, Recall@K, NDCG hoặc thời gian phản hồi trung bình.
3. Cần làm rõ cơ chế fairness và giới hạn của mô hình AI để đảm bảo tính học thuật và đạo đức nghiên cứu.

---

## 9. Bổ sung Use Case theo feature set Resume Matcher gốc (UC-RM)

Mục tiêu phần này là lấp khoảng trống giữa bộ Use Case NCKH hiện tại và các chức năng sản phẩm đã mô tả trong README và trang Features của dự án gốc.

### UC-RM-01: Candidate quản lý Master Resume
- **Brief Description:** Candidate tạo một hồ sơ resume gốc (master resume) để tái sử dụng khi tối ưu theo nhiều JD khác nhau.
- **Primary Actor:** Candidate
- **Pre-conditions:** Candidate đã đăng nhập và có quyền truy cập trình quản lý resume.
- **Main Flow:**
  1. Candidate tạo hoặc import resume gốc từ dữ liệu hiện có.
  2. Hệ thống lưu phiên bản master resume kèm metadata chỉnh sửa.
  3. Candidate cập nhật các section cơ bản (summary, experience, skills, projects).
  4. Hệ thống lưu lịch sử phiên bản để phục vụ tái sử dụng.
- **Post-conditions:** Master resume khả dụng để tailor theo từng JD.

### UC-RM-02: Candidate tailor resume theo Job Description bằng AI
- **Brief Description:** Candidate nhập JD mục tiêu và yêu cầu hệ thống AI đề xuất nội dung resume phù hợp.
- **Primary Actor:** Candidate
- **Pre-conditions:** Đã có master resume hợp lệ.
- **Main Flow:**
  1. Candidate dán JD vào giao diện tailoring.
  2. Hệ thống trích xuất yêu cầu chính từ JD.
  3. AI đối chiếu với master resume và sinh đề xuất nội dung tối ưu.
  4. Candidate duyệt/chỉnh sửa đề xuất trước khi lưu.
- **Post-conditions:** Tạo tailored resume cho JD cụ thể.

### UC-RM-03: Candidate chỉnh sửa resume bằng Resume Builder (live preview)
- **Brief Description:** Candidate chỉnh sửa nội dung resume trong trình builder và xem preview theo thời gian thực.
- **Primary Actor:** Candidate
- **Pre-conditions:** Tailored resume hoặc master resume đã tồn tại.
- **Main Flow:**
  1. Candidate mở Resume Builder.
  2. Candidate chỉnh sửa nội dung từng section.
  3. Hệ thống cập nhật preview ngay khi thay đổi.
  4. Candidate lưu phiên bản chỉnh sửa.
- **Post-conditions:** Resume được cập nhật với trải nghiệm WYSIWYG.

### UC-RM-04: Candidate quản lý section nâng cao
- **Brief Description:** Candidate thực hiện các thao tác nâng cao với section như đổi tên, sắp xếp, ẩn/hiện và thêm section tùy biến.
- **Primary Actor:** Candidate
- **Pre-conditions:** Resume đang mở trong builder.
- **Main Flow:**
  1. Candidate đổi tên section.
  2. Candidate kéo-thả để đổi thứ tự section.
  3. Candidate ẩn section khỏi PDF nhưng vẫn giữ dữ liệu chỉnh sửa.
  4. Candidate thêm hoặc xóa section tùy biến.
- **Post-conditions:** Cấu trúc resume linh hoạt theo mục tiêu ứng tuyển.

### UC-RM-05: Candidate chọn template resume
- **Brief Description:** Candidate chọn mẫu trình bày resume phù hợp với ngữ cảnh ứng tuyển.
- **Primary Actor:** Candidate
- **Pre-conditions:** Resume có dữ liệu tối thiểu để render.
- **Main Flow:**
  1. Candidate xem danh sách template.
  2. Candidate chọn template mong muốn.
  3. Hệ thống render preview theo template đã chọn.
- **Post-conditions:** Resume sử dụng template phù hợp và nhất quán.

### UC-RM-06: Candidate tinh chỉnh formatting controls
- **Brief Description:** Candidate tùy chỉnh các thông số định dạng như khổ giấy, margin, spacing, typography, compact mode.
- **Primary Actor:** Candidate
- **Pre-conditions:** Resume đang mở trong builder.
- **Main Flow:**
  1. Candidate chọn khổ giấy (A4/US Letter).
  2. Candidate điều chỉnh margin và spacing.
  3. Candidate điều chỉnh typography và bật/tắt compact mode.
  4. Hệ thống cập nhật preview ngay lập tức.
- **Post-conditions:** Resume đạt chất lượng trình bày theo mong muốn.

### UC-RM-07: Candidate xem JD Match View
- **Brief Description:** Candidate xem đối chiếu side-by-side giữa JD và resume kèm keyword highlight và match percentage.
- **Primary Actor:** Candidate
- **Pre-conditions:** Đã có tailored resume hoặc kết quả matching tương ứng.
- **Main Flow:**
  1. Candidate mở màn hình JD Match View.
  2. Hệ thống hiển thị JD ở một bên và resume ở bên còn lại.
  3. Hệ thống tô sáng keyword match và hiển thị match percentage.
- **Post-conditions:** Candidate đánh giá nhanh mức độ phù hợp trước khi nộp.

### UC-RM-08: Candidate sử dụng Resume Enrichment
- **Brief Description:** Hệ thống hỏi các câu hỏi mục tiêu để làm giàu nội dung resume và bổ sung bullet points mới.
- **Primary Actor:** Candidate
- **Pre-conditions:** Resume có nội dung cơ bản để AI phân tích.
- **Main Flow:**
  1. Candidate kích hoạt tính năng Enhance/Enrichment.
  2. Hệ thống đặt bộ câu hỏi ngắn theo ngữ cảnh kinh nghiệm.
  3. Candidate trả lời.
  4. AI sinh bullet points bổ sung mà không ghi đè nội dung cũ.
- **Post-conditions:** Resume giàu thông tin hơn và tăng khả năng khớp JD.

### UC-RM-09: Candidate tạo Cover Letter và Email theo JD
- **Brief Description:** Candidate tạo thư xin việc và email ứng tuyển dựa trên resume + JD mục tiêu.
- **Primary Actor:** Candidate
- **Pre-conditions:** Có JD và resume đủ dữ liệu đầu vào.
- **Main Flow:**
  1. Candidate chọn tạo Cover Letter hoặc Email.
  2. Hệ thống sinh nội dung bằng AI.
  3. Candidate chỉnh sửa và lưu.
- **Post-conditions:** Có bộ tài liệu ứng tuyển đầy đủ.

### UC-RM-10: Candidate xuất PDF (WYSIWYG)
- **Brief Description:** Candidate xuất resume (và tài liệu liên quan) ra PDF theo đúng preview.
- **Primary Actor:** Candidate
- **Pre-conditions:** Resume đã hoàn tất chỉnh sửa.
- **Main Flow:**
  1. Candidate nhấn Export PDF.
  2. Hệ thống render PDF từ phiên bản hiện tại.
  3. Candidate tải file PDF về thiết bị.
- **Post-conditions:** Candidate nhận được PDF ổn định định dạng để nộp hồ sơ.

### UC-RM-11: Candidate cấu hình ngôn ngữ UI và ngôn ngữ nội dung AI
- **Brief Description:** Candidate cấu hình ngôn ngữ giao diện và ngôn ngữ nội dung AI độc lập.
- **Primary Actor:** Candidate
- **Pre-conditions:** Hệ thống đã bật i18n và hỗ trợ nhiều ngôn ngữ.
- **Main Flow:**
  1. Candidate chọn ngôn ngữ UI.
  2. Candidate chọn ngôn ngữ sinh nội dung AI.
  3. Hệ thống áp dụng cấu hình cho toàn bộ workflow.
- **Post-conditions:** Trải nghiệm đa ngôn ngữ đúng mục tiêu sử dụng.

### UC-RM-12: User cấu hình chế độ privacy và AI provider
- **Brief Description:** User chọn chạy local provider (ví dụ Ollama) hoặc cloud provider theo nhu cầu bảo mật/chi phí.
- **Primary Actor:** Candidate, Recruiter/HR
- **Pre-conditions:** Hệ thống hỗ trợ nhiều AI provider.
- **Main Flow:**
  1. User mở trang cài đặt AI provider.
  2. User chọn local hoặc cloud provider.
  3. User cấu hình endpoint/API key theo provider đã chọn.
  4. Hệ thống kiểm tra kết nối và lưu cấu hình.
- **Post-conditions:** Workflow AI hoạt động theo chính sách riêng tư mong muốn.

## 10. Ma trận gợi ý liên kết UC-RM với thành phần kỹ thuật

| Use Case | Thành phần kỹ thuật chính | Kết quả đầu ra |
|---|---|---|
| UC-RM-01 | Resume storage, versioning service, profile APIs | Master resume có phiên bản |
| UC-RM-02 | LLM tailoring engine, JD parser, content rewrite APIs | Tailored resume theo JD |
| UC-RM-03 | Next.js builder UI, state management, preview renderer | Trình sửa resume realtime |
| UC-RM-04 | Section schema + drag/drop UI + visibility flags | Cấu trúc section linh hoạt |
| UC-RM-05 | Template registry, template renderer | Resume theo template đã chọn |
| UC-RM-06 | Print/layout config service + preview sync | Kiểm soát định dạng đầu ra |
| UC-RM-07 | Matching explain API + keyword highlight renderer | Màn hình đối chiếu JD-Resume |
| UC-RM-08 | Enrichment question flow + content expansion engine | Bullet points bổ sung có kiểm soát |
| UC-RM-09 | LLM generation APIs cho cover letter/email | Bộ tài liệu ứng tuyển bổ sung |
| UC-RM-10 | PDF generation pipeline (WYSIWYG) | File PDF sẵn sàng nộp |
| UC-RM-11 | i18n framework + language preference storage | UI/content đa ngôn ngữ |
| UC-RM-12 | Provider config, secret management, connectivity check | Chế độ AI local/cloud có kiểm soát |

