# Translation Style Note

This note defines a lightweight translation standard for all new locale files in frontend.

## 1) Non-Negotiables
- Keep all i18n keys unchanged.
- Do not add/remove/restructure keys in translation files.
- Preserve placeholders exactly: `{count}`, `{date}`, `{provider}`, `{error}`, `__COLOR__`, etc.
- Keep JSON valid UTF-8 and parseable.

## 2) Vietnamese Canonical Glossary (Reference)
Use these terms consistently when creating or reviewing Vietnamese locale strings:

- Resume -> CV
- Master Resume -> CV gốc
- Tailored Resume -> CV đã tùy chỉnh
- Resume Builder -> Trình tạo CV
- Tailor Resume -> Tùy chỉnh CV
- Dashboard -> Bảng điều khiển
- Settings -> Cài đặt
- Job Description -> Mô tả công việc
- Job Board -> Bảng việc làm
- Application -> Đơn ứng tuyển
- Candidate -> Ứng viên
- Recruiter -> Nhà tuyển dụng
- Match Score -> Điểm khớp
- Feedback -> Phản hồi
- Suggestions -> Gợi ý
- Keywords -> Từ khóa
- Generate -> Tạo
- Regenerate -> Tạo lại
- Preview -> Xem trước
- Retry -> Thử lại

## 3) Tone and Wording
- Buttons: short and action-first (example: "Lưu", "Xóa", "Tải xuống").
- Status/progress: prefer "Đang ..." form.
- Errors: concise, clear, user-actionable.
- Avoid mixed-language text unless technical terms are intentionally kept.

## 4) Review Checklist Before Merge
- Key set is identical to source locale.
- Placeholders are preserved exactly.
- Terminology is consistent with glossary.
- No accidental English leftovers in user-facing text.
- File parses as valid JSON.
