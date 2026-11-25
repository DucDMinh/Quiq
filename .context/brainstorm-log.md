# Brainstorm log — Quiq (2026-11-25)

Nguồn đã có: docs/BRD.md (đã duyệt), SPECIFICATIONS.md dựng từ BRD. Doc khác là template.

## Làm rõ BRD (sau spec-validator vòng 1 FAIL)
| Câu hỏi | Trả lời |
|---|---|
| Firebase Storage cần Blaze vs free-only | Chuyển sang Supabase (C-01) |
| Đẩy máy / gián đoạn đốt lượt, hết lượt ở lần cuối | Giữ nguyên BRD (C-02) |
| Sau đổi máy vào thế nào | Phòng chờ rồi bấm Bắt đầu (C-03) |
| Snapshot thiết lập khi nào | Chốt riêng từng lớp lúc phát đề (C-04) |
| Điểm năm cũ có họ tên + mã | Có (C-05) |
| Ai chỉnh ngưỡng 60 giây | Admin trường, theo trường (C-06) |
| Thu bài có thấy điểm + Xem đáp án | Có (C-07) |
| 4 tình huống biên (xóa môn, mã vô hiệu, chuyển trường, trường khóa) | Chấp nhận 4 mặc định (C-08, C-09) |

## Kiến trúc
| Câu hỏi | Trả lời |
|---|---|
| Lưu ảnh | Supabase Storage (C-10) |
| Xác thực/truy cập dữ liệu | Koa tự xác thực, trình duyệt không chạm Supabase (C-11) |
| Realtime | SSE từ Koa + heartbeat HTTP (C-12) |
| Reload vs đổi máy | Token phiên trong trình duyệt (C-13) |

## Config
| Câu hỏi | Trả lời |
|---|---|
| Repo + package manager | Monorepo pnpm apps/web + apps/api |
| UI library | "Kết hợp nhiều thư viện khác nhau" — chốt cụ thể ở /design |
| Git | git init, branch staging (target), forbidden main, không auto-push |
| Models | builder sonnet, reviewer opus, spec_validator sonnet, builder_strong opus |
| DB tool | Drizzle + drizzle-kit, migration_required true |
| Môi trường DB | staging ngay (DATABASE_URL_STAGING), prod tạo sau (DATABASE_URL_PROD) |
| Deploy / CI-CD / monitoring | skip / skip / false |

## Chưa hỏi (mặc định ghi trong design doc, Open Questions #4, #5)
- Nhập file học sinh all-or-nothing; heartbeat 5s, sweeper 10s.
