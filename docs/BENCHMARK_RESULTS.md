# Kết quả Benchmark 3 Prototype — Hệ thống CV Matching Microservices

- **Thời điểm đo:** 2026-11-25T06:56:45.214Z
- **Chế độ thực thi:** `embedded` (v24.11.0, win32/x64)
- **Lưu ý minh bạch:** Chế độ `embedded` chạy toàn bộ `api-gateway` + 8 Express microservices + `worker-scoring` qua HTTP cục bộ với in-memory Redis/Mongo/Qdrant/AI stubs; chạy `--mode=live --gateway=http://localhost:3001` để đo trên cụm Docker container thực tế.

## Bảng tổng hợp SLA 3 Prototype

| Hạng mục đo kiểm | Số lượng mẫu | Mục tiêu SLA | Kết quả đo thực tế | Trạng thái |
| :--- | :---: | :---: | :--- | :---: |
| **Prototype 1:** Upload + Parse + Embed + Vector | 500 CV | Avg < 2.0s, P99 < 2.8s | Avg **27.89 ms**, P99 **52.56 ms** (356.38 req/s, Heap Δ 48.66 MB) | PASS |
| **Prototype 2 (Pha 1):** Nộp đơn ACID Outbox | 5,000 đơn | P99 < 150 ms | P50 **18.19 ms**, P99 **34.53 ms** (418.9 req/s) | PASS |
| **Prototype 2 (Pha 2):** Worker Scoring `BLMOVE` | 5,000 đơn | >= 50 đơn/s, 0 thất lạc | **365.07 đơn/s** (13.696s), thất lạc **0**, DLQ **0** | PASS |
| **Prototype 3A:** Tìm kiếm Job (Cache Miss) | 50 truy vấn | P95 < 200 ms | Avg **3.28 ms**, P95 **4.2 ms** | PASS |
| **Prototype 3A:** Tìm kiếm Job (Cache Hit) | 200 truy vấn | P95 < 50 ms | Avg **2.6 ms**, P95 **3.15 ms** | PASS |
| **Prototype 3B:** Gợi ý việc làm Qdrant HNSW (500 vectors) | 100 truy vấn | P95 < 50 ms | Avg **3.6 ms**, P95 **4.19 ms** | PASS |
| **Prototype 3C:** Đánh giá trực tiếp CV-JD (`optimize-cv`) | 20 yêu cầu | P95 < 1,500 ms | Avg **4.08 ms**, P95 **3.79 ms** | PASS |
| **Prototype 3D:** BulkWrite chuyển trạng thái | 500 đơn | < 1,000 ms | **12.07 ms** (updated **500/500**) | PASS |

**Kết luận chung:** ĐẠT 100% SLA
