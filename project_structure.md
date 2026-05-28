# Cấu trúc Thư mục và Công dụng Các Tệp tin trong Dự án CV Matching

Tài liệu này mô tả chi tiết sơ đồ thư mục của dự án **CV Matching** và công dụng của các tệp tin quan trọng nhất trong hệ thống.

---

## 🗺️ Tổng quan cấu trúc thư mục gốc (Root)

```text
CV-Matching/
├── apps/                         # Chứa mã nguồn của 2 ứng dụng chính (Frontend & Backend)
│   ├── backend/                  # REST API Gateway (Node.js/Express)
│   └── frontend/                 # Giao diện người dùng (Next.js/React/TypeScript)
├── workers/                      # Các dịch vụ xử lý nền (Background Workers)
│   ├── embedding-sbert/          # Worker Python tạo Vector nhúng bằng SBERT & lưu vào Qdrant
│   ├── parsing/                  # Worker Python trích xuất văn bản thô từ file PDF/Word
│   ├── scoring/                  # Worker chấm điểm và so khớp tự động qua BullMQ
│   └── notification/             # Worker gửi thông báo tới người dùng
├── scripts/                      # Các PowerShell scripts hỗ trợ quản trị và phát triển
├── infra/                        # Lưu trữ cấu hình hạ tầng
├── plans/                        # Các kế hoạch thiết kế và sửa đổi hệ thống
├── docs/                         # Tài liệu đặc tả hệ thống
├── docker-compose.yml            # Cấu hình Docker chạy môi trường Development (cục bộ)
├── docker-compose.prod.yml       # Cấu hình Docker chạy môi trường Production
└── README.md                     # Hướng dẫn khởi chạy và vận hành hệ thống
```

---

## 💻 Chi tiết thư mục `apps/`

### 1. Backend (`apps/backend/`)
Dịch vụ Gateway chính viết bằng Node.js & Express, quản lý luồng dữ liệu, phân quyền và kết nối các database (MongoDB, Redis, Qdrant).

*   **`src/app.js` & `src/server.js`**: Điểm khởi tạo và cấu hình ứng dụng Express, thiết lập các middleware chung (CORS, Error handlers, rate limit) và cổng chạy server.
*   **`src/bootstrap/`**: Thiết lập kết nối ban đầu tới MongoDB và khởi tạo hàng đợi BullMQ (Redis).
*   **`src/controllers/`**: Tiếp nhận request từ API client, gọi dịch vụ xử lý và trả về phản hồi JSON.
    *   `resume.controller.js`: Quản lý tải lên, chỉnh sửa và tải PDF của CV.
    *   `enrichment.controller.js`: Xử lý phân tích và tối ưu hóa CV bằng AI.
    *   `config.controller.js`: Quản lý cấu hình LLM, ngôn ngữ và tính năng của hệ thống.
*   **`src/models/`**: Các Schema Mongoose định nghĩa cấu trúc bảng trong MongoDB.
    *   `User.js`: Thông tin tài khoản (Candidate, Recruiter, Admin).
    *   `Resume.js`: Dữ liệu CV (bản thô, bản cải thiện AI, trạng thái xử lý).
    *   `Job.js`: Tin tuyển dụng (Tiêu đề, JD, yêu cầu, từ khóa).
    *   `Application.js`: Bản ghi ứng tuyển liên kết giữa Job và Resume.
*   **`src/routes/`**: Định nghĩa danh sách các tuyến đường (endpoints) API và phân quyền truy cập.
*   **`src/services/`**: Chứa toàn bộ logic nghiệp vụ quan trọng.
    *   `keyword-analysis.service.js`: Phân tích từ khóa CV-JD bằng thuật toán **BM25**, tính toán tần suất từ (TF) và trọng số nghịch thế (IDF) từ MongoDB.
    *   `semantic-search.service.js`: Kết nối tìm kiếm tương đồng trên Qdrant và tính toán điểm lai **Hybrid Score**.
    *   `recommendation.service.js`: Tạo gợi ý công việc cho ứng viên và gợi ý CV phù hợp nhất cho nhà tuyển dụng.
    *   `pdf-renderer.service.js`: Sử dụng Playwright (Chromium) để xuất CV dạng PDF chất lượng cao.
    *   `llm.service.js`: Giao tiếp với các mô hình LLM (Ollama cục bộ hoặc Cloud APIs như OpenAI, Anthropic, Gemini).
*   **`src/utils/language-detector.js`**: Nhận diện ngôn ngữ tự động (tiếng Việt/tiếng Anh) từ văn bản CV của ứng viên.
*   **`tests/`**: Chứa bộ unit tests (`tests/unit/`) và integration tests (`tests/integration/`).

---

### 2. Frontend (`apps/frontend/`)
Giao diện người dùng viết bằng Next.js (App Router), React, TypeScript và được tối ưu hóa giao diện đa ngôn ngữ (tiếng Anh & tiếng Việt).

*   **`app/`**: Định nghĩa cấu trúc định tuyến (routes) của Next.js.
    *   `(app)/candidate/`: Giao diện dành cho Ứng viên (Upload CV, Dashboard, So khớp JD, Tối ưu CV bằng AI).
    *   `(app)/recruiter/`: Giao diện dành cho Nhà tuyển dụng (Xem ứng viên ứng tuyển, Tìm kiếm ứng viên tiềm năng thụ động, Tạo câu hỏi phỏng vấn tự động).
    *   `(app)/admin/`: Giao diện dành cho Quản trị viên (Cấu hình hệ thống, Vector Ops để gỡ lỗi vector Qdrant, Quản lý tài khoản).
*   **`components/`**: Các React components dùng chung.
    *   `builder/`: Các component cho trình Resume Builder (form nhập thông tin, Live Preview PDF, các tab Cover Letter, Outreach và JD Match).
    *   `ui/`: Thư viện component cơ bản thiết kế cao cấp (Dialog, Badge, Button, Input...).
*   **`lib/`**:
    *   `api/`: Định nghĩa API client gọi các dịch vụ backend.
    *   `context/`: Quản lý các trạng thái toàn cục của ứng dụng (AuthContext cho tài khoản đăng nhập, LanguageContext cho dịch vụ đa ngôn ngữ).
*   **`messages/`**: Tệp tin định nghĩa từ khóa bản dịch i18n cho tiếng Anh (`en.json`) và tiếng Việt (`vi.json`).
*   **`styles/globals.css`**: Nơi cấu hình hệ màu sắc hiện đại (Tailwind & CSS Variables) và phông chữ hiển thị hỗ trợ diacritics tiếng Việt chuẩn.
*   **`types/`**: Định nghĩa các kiểu dữ liệu TypeScript.
*   **`tests/`**: Bộ test suite cho frontend sử dụng thư viện Vitest.

---

## ⚙️ Chi tiết thư mục `workers/`

Các container worker xử lý ngầm (background processes) tách biệt để tránh nghẽn luồng API chính:

*   **`embedding-sbert/`**:
    *   Viết bằng Python (FastAPI/Uvicorn).
    *   Sử dụng mô hình Transformer SBERT để chuyển hóa văn bản CV/JD thành dense vector (mặc định kích thước 384 chiều).
    *   Lưu trữ trực tiếp và thực hiện tìm kiếm KNN/Cosine Similarity trên cơ sở dữ liệu **Qdrant**.
*   **`parsing/`**:
    *   Viết bằng Python.
    *   Nhận file tài liệu ứng viên upload lên, sử dụng các thư viện Python chuyên dụng để trích xuất văn bản thô cực kỳ chính xác.
*   **`scoring/`**:
    *   Viết bằng Node.js.
    *   Lắng nghe hàng đợi từ Redis (BullMQ), tự động gọi dịch vụ chấm điểm lai (Hybrid) khi có CV mới được cập nhật hoặc có JD mới được đăng.
*   **`notification/`**:
    *   Worker Node.js chịu trách nhiệm gửi email hoặc đẩy thông báo thời gian thực khi trạng thái hồ sơ ứng tuyển thay đổi.

---

## 🛠️ Chi tiết thư mục `scripts/`

Chứa các PowerShell scripts dùng để phát triển cục bộ và kiểm định chất lượng:

*   **`dev-up.ps1` & `dev-down.ps1`**: Khởi chạy nhanh và tắt toàn bộ hệ thống container thông qua Docker Compose.
*   **`dev-smoke.ps1`**: Thực hiện test nhanh các endpoint cốt lõi sau khi deploy.
*   **`run-backend-integration.ps1`**: Chạy bộ kiểm thử tích hợp (integration tests) cho backend tự động.
*   **`queue-replay-dlq.ps1`**: Quản lý hàng đợi bị lỗi (Dead Letter Queue - DLQ), hỗ trợ đẩy lại các tác vụ chấm điểm lỗi để chạy lại.
*   **`release-readiness-product-e2e.ps1`**: Chạy quy trình test kiểm định tổng thể toàn hệ thống trước khi đóng gói sản phẩm.
