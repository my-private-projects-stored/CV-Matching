# Báo cáo Tổng hợp lỗi So khớp & Tính năng AI (CV Matching)

Tài liệu này tổng hợp toàn bộ các phát hiện lỗi kỹ thuật liên quan đến chức năng AI, thuật toán so khớp CV-JD (Semantic + Keyword), và các API sinh văn bản tự động trong dự án.

---

## 📋 Bảng tóm tắt các vấn đề phát hiện

| STT | Vấn đề phát hiện | Mức độ | Phạm vi ảnh hưởng | Trạng thái xác minh |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Điểm ngữ nghĩa (`semanticScore`) bị khóa cứng bằng `0` | **High** | Xếp hạng ứng tuyển của Recruiter | Đã xác minh (Lỗi logic backend) |
| **2** | Điểm từ khóa (`keywordScore`) bằng `0` do Parser rỗng | **High** | Trích xuất kỹ năng CV & Keyword matching | Đã xác minh (Lỗi parser mock) |
| **3** | Sai lệch trọng số Hybrid (`0.7` so với quy định `0.65`) | **Medium** | Công thức xếp hạng ứng viên | Đã xác minh (Không khớp thiết kế) |
| **4** | Lỗi bóc tách (unwrap) response ở API Frontend | **High** | Giao diện đề xuất CV/Job hiển thị rỗng | Đã xác minh (Lỗi cú pháp gọi API) |
| **5** | Trình sinh tài liệu AI & Câu hỏi phỏng vấn dùng template tĩnh | **Medium** | Tính năng Cover Letter, Outreach, Interview Gen | Đã xác minh (Chưa tích hợp LLM) |
| **6** | Dữ liệu mẫu (Seed Data) dùng chung một vector giả lập | **Medium** | Kết quả đề xuất local luôn giống hệt nhau | Đã xác minh (Kịch bản seed giả lập) |
| **7** | Hệ thống kiểm thử tự động không bắt được lỗi thực tế | **Medium** | Tự động hóa kiểm thử tích hợp (CI/CD) | Đã xác minh (Test bị mock/skip) |

---

## 🔍 Chi tiết từng phát hiện & Phân tích nguyên nhân

### 1. Điểm ngữ nghĩa (Semantic Score) bị khóa cứng bằng 0
* **Tệp tin ảnh hưởng:** [application-ai.service.js](file:///d:/Project/CV%20Matching/CV-Matching/apps/backend/src/services/application-ai.service.js#L45-L54)
* **Nguyên nhân:** Trong luồng chạy chấm điểm mặc định khi ứng viên ứng tuyển:
  ```javascript
  const resolvedScoringStep =
    scoringStep ||
    (async () => {
      return buildHybridScoreForPair({
        jobId: app.jobId,
        resumeId: app.resumeId,
        semanticScore: 0, // <-- BỊ KHÓA CỨNG BẰNG 0
        semanticWeight,
      });
    });
  ```
* **Hậu quả:** Điểm ngữ nghĩa của ứng viên luôn là `0%`, khiến tổng điểm `hybridScore` chỉ phụ thuộc vào trùng khớp từ khóa. Khiến hệ thống không sử dụng mô hình SBERT và cơ sở dữ liệu vector Qdrant khi nộp hồ sơ.

### 2. Điểm từ khóa (Keyword Score) bị đồng loạt đưa về 0 do Parser rỗng
* **Tệp tin ảnh hưởng:** [workers/parsing/app.py](file:///d:/Project/CV%20Matching/CV-Matching/workers/parsing/app.py#L33-L41) & [job.service.js](file:///d:/Project/CV%20Matching/CV-Matching/apps/backend/src/services/job.service.js)
* **Nguyên nhân:**
  - FastAPI parser worker chỉ lấy phần text thô của PDF chứ chưa phân tích kỹ năng thực tế, trả về danh sách trống: `"skills": [], "technicalSkills": []`.
  - Phía backend tạo Job Description cũng không tự động bóc tách từ khóa (extract keywords) từ mô tả nếu phía giao diện không gửi lên.
* **Hậu quả:** Cả CV và JD đều thiếu hụt từ khóa kỹ năng, khiến `keywordScore` tính toán bằng `0`. Kết hợp với lỗi số 1, tổng điểm `hybridScore` của ứng viên khi nộp đơn hầu hết sẽ bằng `0`.

### 3. Trọng số Hybrid dùng sai quy định (0.7 thay vì 0.65)
* **Tệp tin ảnh hưởng:** `application-ai.service.js`, `semantic-search.service.js`, `recommendation.service.js`
* **Nguyên nhân:** Tài liệu chuẩn thiết kế [conventions.md](file:///d:/Project/CV%20Matching/CV-Matching/docs/conventions.md#L193) yêu cầu công thức là:
  ```python
  hybridScore = 0.65 * semanticScore + 0.35 * keywordScore
  ```
  Nhưng các tệp tin backend hiện tại đều khai báo mặc định `semanticWeight = 0.7`.
* **Hậu quả:** Kết quả xếp hạng không đúng chuẩn thiết kế chung của hệ thống.

### 4. Lỗi bóc tách (unwrap) response ở API Frontend khiến UI hiển thị rỗng
* **Tệp tin ảnh hưởng:** [apps/frontend/lib/api.ts](file:///d:/Project/CV%20Matching/CV-Matching/apps/frontend/lib/api.ts#L514-L542) (`getJobRecommendations` & `getResumeRecommendations`)
* **Nguyên nhân:** Hàm tiện ích `request()` đã tự động bóc tách và trả về mảng dữ liệu (`payload.data`). Tuy nhiên, hàm xử lý đề xuất lại tiếp tục bọc và tìm thuộc tính `.data` lần hai từ kết quả đã bóc tách:
  ```typescript
  const payload = getObject(result.data); // result.data đã là mảng JobRecommendation[]
  return {
    data: Array.isArray(payload.data) ? payload.data : [], // payload.data bị undefined -> trả về []
    meta: ...
  };
  ```
* **Hậu quả:** Giao diện đề xuất công việc cho ứng viên và đề xuất CV cho nhà tuyển dụng luôn hiển thị trạng thái trống (Empty State) dù backend có tính toán ra kết quả.

### 5. Trình sinh tài liệu AI & Câu hỏi phỏng vấn dựa trên template tĩnh
* **Tệp tin ảnh hưởng:** [resume.service.js](file:///d:/Project/CV%20Matching/CV-Matching/apps/backend/src/services/resume.service.js) & [interview.service.js](file:///d:/Project/CV%20Matching/CV-Matching/apps/backend/src/services/interview.service.js)
* **Nguyên nhân:** Chưa kết nối với mô hình ngôn ngữ lớn (LLM). Thư xin việc, Outreach message và câu hỏi phỏng vấn đều dùng các câu mẫu cố định dạng điền từ khóa kỹ năng của CV vào khoảng trống.
* **Hậu quả:** Kết quả sinh ra bị trùng lặp, rập khuôn và kém tự nhiên, không thể hiện được tính năng AI sinh nội dung (Generative AI).

### 6. Dữ liệu mẫu (Demo Seed Data) sử dụng Vector giống hệt nhau
* **Tệp tin ảnh hưởng:** [seed-demo-data.mjs](file:///d:/Project/CV%20Matching/CV-Matching/apps/backend/scripts/seed-demo-data.mjs#L39-L60)
* **Nguyên nhân:** Kịch bản tạo dữ liệu demo local tự tạo ra mảng vector giả lập giống nhau tuần hoàn để chèn vào MongoDB/Qdrant mà không gọi qua SBERT API.
* **Hậu quả:** Điểm so khớp ngữ nghĩa trên môi trường thử nghiệm cục bộ đối với dữ liệu seed này luôn đạt kết quả khớp tuyệt đối hoặc không thay đổi.

### 7. Hệ thống kiểm thử tự động không phát hiện được lỗi thực tế
* **Tệp tin ảnh hưởng:** `application-worker-processing.test.mjs`, `async-pipeline.test.mjs`
* **Nguyên nhân:** Cấu hình chạy test mặc định tắt kiểm thử tích hợp thực tế (`RUN_INTEGRATION_TESTS=0`), đồng thời các kịch bản test sử dụng cơ chế mock kết quả chấm điểm (`mock_scoring_result`) nên không phát hiện được lỗi khóa cứng điểm bằng `0` của hệ thống thật.
* **Hậu quả:** Test pass nhưng code chạy thực tế bị lỗi.

---

## 🛠️ Hướng khắc phục đề xuất sau này

1. **Khắc phục chấm điểm AI thực tế:**
   - Trong luồng xử lý ứng tuyển, lấy văn bản mô tả của JD và CV, sinh embedding thông qua `generateEmbedding`.
   - Tính toán độ tương đồng cosine (dot product) giữa hai vector trên để làm `semanticScore` thực tế thay vì dùng số `0`.
2. **Nâng cấp thuật toán trích xuất từ khóa:**
   - Bổ sung logic trích xuất từ khóa tự động trong backend từ JD và CV bằng kỹ thuật phân tách từ cơ bản khi trường `keywords` hoặc `skills` bị rỗng.
3. **Cập nhật trọng số:**
   - Đưa hệ số `ALPHA` mặc định về đúng `0.65` đồng bộ trên cả frontend và backend.
4. **Sửa lỗi API Frontend:**
   - Cập nhật hàm `getJobRecommendations` và `getResumeRecommendations` trong `lib/api.ts` để sử dụng trực tiếp mảng trả về từ `result.data` thay vì gọi thuộc tính con `.data` bị lặp.
5. **Tích hợp LLM thực tế:**
   - Kết nối cấu hình từ `systemconfigs` (`llmConfig`) để gửi yêu cầu sinh Thư giới thiệu, Outreach message và câu hỏi phỏng vấn thông minh thông qua các LLM provider thực tế (Ollama cục bộ hoặc OpenAI/Gemini Cloud).
