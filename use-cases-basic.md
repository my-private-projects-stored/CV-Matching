# NHÓM USE CASE QUẢN TRỊ HỆ THỐNG & NGHIỆP VỤ CƠ BẢN

Phần này bổ sung các Use Case nền tảng (Common Web Features) để hoàn thiện hệ thống quản lý tuyển dụng, bên cạnh các Use Case AI lõi (UC-CORE-01 đến UC-CORE-05).

## Nhóm A: Quản lý tài khoản

| Mã UC | Tên Use Case | Tác nhân (Actor) | Mô tả tóm tắt tính năng |
|---|---|---|---|
| UC-BASIC-01 | Đăng ký tài khoản | Candidate, Recruiter/HR | Người dùng tạo tài khoản mới theo vai trò, xác thực thông tin cơ bản, lưu hồ sơ tài khoản ban đầu và cấp quyền truy cập theo role. |
| UC-BASIC-02 | Đăng nhập hệ thống | Candidate, Recruiter/HR | Người dùng đăng nhập bằng email/số điện thoại và mật khẩu; hệ thống cấp JWT để duy trì phiên làm việc và phân quyền truy cập API. |
| UC-BASIC-03 | Quên mật khẩu | Candidate, Recruiter/HR | Người dùng yêu cầu reset mật khẩu; hệ thống gửi liên kết hoặc OTP xác minh, cho phép thiết lập lại mật khẩu an toàn trong thời hạn hiệu lực. |
| UC-BASIC-04 | Đổi mật khẩu | Candidate, Recruiter/HR | Người dùng đã đăng nhập chủ động cập nhật mật khẩu; hệ thống kiểm tra mật khẩu cũ, chính sách độ mạnh và vô hiệu hóa phiên cũ khi cần. |

## Nhóm B: Nghiệp vụ cho Ứng viên

| Mã UC | Tên Use Case | Tác nhân (Actor) | Mô tả tóm tắt tính năng |
|---|---|---|---|
| UC-BASIC-05 | Quản lý Profile cá nhân | Candidate | Ứng viên tạo/cập nhật Profile gồm thông tin liên hệ, học vấn, kỹ năng, kinh nghiệm, portfolio để tái sử dụng cho nhiều lần ứng tuyển. |
| UC-BASIC-06 | Xem danh sách việc làm | Candidate | Ứng viên duyệt danh sách tin tuyển dụng, tìm kiếm theo từ khóa, lọc theo vị trí/kỹ năng/địa điểm và xem chi tiết JD trước khi nộp hồ sơ. |
| UC-BASIC-07 | Xem lịch sử ứng tuyển | Candidate | Ứng viên theo dõi toàn bộ lịch sử nộp hồ sơ, trạng thái xử lý từng đơn (submitted, processing, shortlisted, rejected) và thời điểm cập nhật gần nhất. |

## Nhóm C: Nghiệp vụ cho Nhà tuyển dụng

| Mã UC | Tên Use Case | Tác nhân (Actor) | Mô tả tóm tắt tính năng |
|---|---|---|---|
| UC-BASIC-08 | Quản lý thông tin công ty | Recruiter/HR | Nhà tuyển dụng cập nhật hồ sơ công ty (giới thiệu, lĩnh vực, quy mô, địa chỉ, website, branding) để hiển thị thống nhất trên các tin tuyển dụng. |
| UC-BASIC-09 | Xem chi tiết danh sách tin tuyển dụng | Recruiter/HR | Nhà tuyển dụng xem toàn bộ tin đã tạo, tra cứu theo trạng thái và truy cập nhanh số lượng ứng viên theo từng vị trí. |
| UC-BASIC-10 | Cập nhật tin tuyển dụng cơ bản | Recruiter/HR | Nhà tuyển dụng chỉnh sửa nội dung tin tuyển dụng đang hoạt động (yêu cầu, quyền lợi, deadline, status hiển thị) và lưu lịch sử thay đổi quan trọng. |
| UC-BASIC-11 | Xóa/đóng tin tuyển dụng | Recruiter/HR | Nhà tuyển dụng thực hiện soft delete hoặc đóng tin tuyển dụng; hệ thống ngừng nhận hồ sơ mới nhưng vẫn lưu dữ liệu phục vụ đối soát và báo cáo. |
| UC-BASIC-12 | Xem và tải xuống CV gốc | Recruiter/HR | Nhà tuyển dụng có quyền tải xuống tệp CV định dạng gốc (PDF/Word) của ứng viên để xem bố cục chi tiết hoặc lưu trữ nội bộ theo quy định. |
| UC-BASIC-13 | Cập nhật trạng thái ứng viên | Recruiter/HR | Nhà tuyển dụng cập nhật status ứng viên theo pipeline tuyển dụng (new, screening, interview, offer, hired, rejected), đồng thời ghi log phục vụ audit. |

## Ghi chú chuẩn hóa thuật ngữ
- Các thuật ngữ kỹ thuật như JWT, CRUD, Profile, status được giữ nguyên tiếng Anh để đồng nhất với tài liệu kỹ thuật hệ thống.
- Các Use Case trên được trình bày ở mức tóm tắt phục vụ báo cáo NCKH, tránh trùng lặp chi tiết với nhóm Use Case AI lõi.

