# Layer plan: build-quiq (bản 2, chia theo "demo chạy được trước, thêm từng tính năng sau")

Nguồn: `SPECIFICATIONS.md` v1.0.0 (Clarifications C-01..C-13 ghi đè BRD), `docs/specs/2026-11-25-quiq-design.md`, `.context/design-spec.md`, `skills/react-nodejs/design-tokens.md`, `.context/project-config.md`.
Slug: `build-quiq`. Bản nháp cũ (9 layer, 30 task, schema toàn bộ ngay từ đầu) đã chuyển sang `.context/archive/tasks-draft-v1/` để tham khảo.
Layer-plan diagram: **skipped (archify chưa cài, cần tải gói ngoài)**.

## 1. Nguyên tắc

- **Demo trước:** Layer 0 đến 3 cho một luồng thi chạy trọn trên `localhost` (giáo viên ra đề, phát đề, học sinh thi, thu bài, xem điểm). Mỗi layer kết thúc bằng một lần bạn thử trên web rồi mới duyệt layer sau.
- **Sau demo mỗi tính năng một layer**, thường một task; layer một task thì loop bỏ qua worktree song song.
- **Schema tăng dần:** migration đầu (L1-01) chỉ có bảng demo cần; tính năng nào cần cột/bảng thì viết migration riêng trong chính layer đó (làm tuần tự nên không xung đột). Migration phá hoại gắn `HIGH_RISK_MIGRATION`.
- **Nền làm thật ngay:** đăng nhập thật, phiên học sinh bằng cookie, mọi truy vấn lọc theo `schoolId`, engine chấm/trộn/rút đề. Chỉ **đơn giản hóa** ở: polling thay SSE, hết giờ kiểm khi có request thay vì sweeper, dữ liệu trường/lớp/học sinh đến từ seed.
- Dispatcher chia wave chỉ theo **file trùng**, không theo phụ thuộc, nên mọi phụ thuộc phải đi qua layer nhỏ hơn.

## 2. Demo (Layer 0 đến 3, 8 task)

| Layer | Task | Chạy song song? | Bạn thử được gì |
|---|---|---|---|
| 0 | 01 Khung monorepo + `pnpm dev` + dependency + lệnh verify | không | Mở `localhost:3000`, `/api/health` trả ok |
| 1 | 01 DB nền + migration + seed (Supabase) · 02 Exam engine · 03 Web nền (tokens teal, UI chung) · **04 Điểm nối API (deps db/clock, `createTestApp`, `/api/health/db`)** | 01 đến 03 song song; 04 bổ sung sau checkpoint, chạy một mình trước Layer 2 | Có dữ liệu mẫu trong Supabase; xem `/_ui`; `/api/health/db` kiểm kết nối |
| 2 | 01 Đăng nhập cán bộ + khung giao diện giáo viên · 02 Luồng học sinh trọn vẹn (vào thi, phòng chờ, làm, nộp, điểm) | song song | Học sinh thi bài `DEMO01` bằng `HS001`; giáo viên đăng nhập `gv.toan` |
| 3 | 01 Ngân hàng câu hỏi · 02 Tạo bài thi + Phát đề + Thu bài + roster | song song | **Luồng demo trọn vẹn** |

Dữ liệu seed dùng chung: trường "Trường THPT Demo", `gv.toan`, lớp `10A1`, học sinh `HS001..HS005`, 30 câu hỏi, bài `DEMO01` đã phát đề. `db:seed:demo --reset-attempts` để thử lại.

### Phụ thuộc
```
L0-01
 ├─► L1-01 (DB) ─┐
 ├─► L1-02 (engine) ──┤
 └─► L1-03 (web nền) ─┤
        L2-01 ◄─ L1-01, L1-03
        L2-02 ◄─ L1-01, L1-02, L1-03
           L3-01 ◄─ L2-01, L1-01, L1-03
           L3-02 ◄─ L2-01, L2-02, L1-01, L1-02, L1-03
```

### Ghi chú chống trùng file
- `package.json`, `pnpm-lock.yaml`: chỉ L0-01 (cài sẵn mọi dependency của demo).
- `packages/db/migrations/0000`: chỉ L1-01. Layer sau thêm migration mới.
- `apps/api/src/server.ts`, `app.ts`, `modules/loader.ts`: L0-01; module loader tự nạp `modules/*/routes.ts` nên task sau chỉ thêm thư mục.
- `apps/web/src/features/shell/nav-config.ts`: L2-01 liệt kê mục demo; layer tính năng sau sửa tuần tự.
- `packages/shared/src/<domain>/`: mỗi task một domain (`auth`, `student`, `questions`, `exams`).

## 3. Tính năng thêm sau demo (mỗi dòng một layer, thứ tự đề xuất, chưa viết task chi tiết)

| Layer | Tính năng | FR/BR chính |
|---|---|---|
| 4 | Theo dõi trực tiếp: SSE, phòng chờ có presence, 4 trạng thái + cờ gián đoạn (kèm spike SSE qua Next rewrite). **Đã ghi task:** `layer-4-task-01.md` (kèm sửa G-12), user chốt 2026-11-26 | FR-035 |
| 5 | Công bố đáp án / công bố bảng điểm (hai nút riêng), học sinh "Xem đáp án", tra cứu điểm công khai. **Đã ghi task:** `layer-5-task-01.md` (công bố + xem đáp án), `layer-5-task-02.md` (tra cứu), song song; user chốt 2026-11-27 (chỉ sau thu bài, một chiều, không làm bài = 0 điểm) | FR-037, 038, 047, 064, BR-010, 013 |
| 6 | Chống gian lận: rời tab/toàn màn hình, cảnh báo, tự nộp quá ngưỡng; sweeper nền (hết giờ, thu bài); heartbeat | FR-044, 041, 034, BR-009 |
| 7 | Gián đoạn, làm lại, giới hạn số lần, đẩy máy + nhật ký | FR-043, 045, BR-004, 005 |
| 8 | Admin trường 1: môn học + tài khoản giáo viên | FR-010, 018, BR-017 |
| 9 | Admin trường 2: năm học, lớp, lên lớp, lịch sử | FR-012, BR-018 |
| 10 | Admin trường 3: học sinh, nhập `.xlsx/.csv`, xem thông tin học sinh | FR-011, 017, BR-003 |
| 11 | Admin trường 4: phân công giáo viên-lớp, quy chế 3 ô (số lần, cảnh báo, ngưỡng gián đoạn) | FR-013, 014 |
| 12 | Admin tổng: trường, tài khoản admin trường, thống kê tổng hợp | FR-001..005, BR-012, 015 |
| 13 | Kết quả giáo viên: bảng điểm lớp, câu sai nhiều, chi tiết bài làm + nhật ký, xuất `.xlsx`, lọc theo lớp/môn/năm | FR-060, 061, 062, 065, BR-011 |
| 14 | Sửa đáp án trên bản sao đề + chấm lại tự động | FR-039, BR-001 |
| 15 | Ảnh trong câu hỏi (Supabase Storage riêng tư qua proxy Koa, copy vào đề) | FR-021 |
| 16 | Quyền riêng tư: xóa dữ liệu cá nhân học sinh, giáo viên xem học sinh lớp phụ trách, kho chỉ đọc admin trường | FR-016, 063, 015, BR-016 |
| 17 | Cứng hóa: quét cô lập trường tự động, rate-limit, kiểm payload không lộ đáp án, Playwright e2e, tài liệu as-built | BR-015, mọi route |

Mỗi layer tính năng khi tới lượt: tôi trình bày task trong chat, bạn chốt, rồi mới ghi file task.

## 4. Độ phủ FR/BR (ở mức layer)

| FR/BR | Layer | Ghi chú |
|---|---|---|
| FR-020, 022, 023, 024 | 3 (L3-01) | ngân hàng câu hỏi, không ảnh |
| FR-030, 031, 032, 033, 034 (thu bài tay), 035 (polling) | 3 (L3-02) | |
| FR-036, 040, 041, 042, 046, 050, 051 | 2 (L2-02) | FR-041 hết giờ kiểm khi có request (sweeper ở L6) |
| FR-047 | 2 (L2-02: thông báo chưa công bố), 5 (đầy đủ) | |
| FR-014 (snapshot) | 3 (L3-02 chụp), 11 (màn chỉnh) | |
| FR-002 (tài khoản cán bộ), BR-012 | 2 (đăng nhập), 8 và 12 (tạo tài khoản) | |
| BR-001, 002, 003, 006, 007, 008, 014 | 1 đến 3 | |
| Phần còn lại | 4 đến 17 theo bảng trên | |

Bản đối chiếu chi tiết từng tiêu chí do reviewer kiểm ở mỗi layer.

## 5. Tiền đề người dùng (làm TRƯỚC khi chạy Layer 1)

1. **Commit các file đầu vào đang untracked/modified**, vì worktree tạo từ HEAD không thấy chúng: `.context/design-spec.md`, `skills/react-nodejs/design-tokens.md`, `docs/DESIGN.md`, `index.html`, `tools/`, `tasks/`, `.context/runs/*`. Graph không tự commit. (Chỉ cần bạn bảo tôi commit.)
2. **Project Supabase staging:** tạo project (gói free), lấy chuỗi kết nối Postgres. Mạng nhà chỉ có IPv4 thì dùng **Session pooler** (host direct có thể chỉ IPv6). Điền `.env.local`: `DATABASE_URL_STAGING`, `SESSION_SECRET` (chuỗi ngẫu nhiên ≥ 32 byte). Chưa cần `SUPABASE_URL`/khóa service-role (chỉ dùng khi làm ảnh ở Layer 15). Thiếu biến: L1-01 vẫn xong bằng PGlite, phần kiểm kết nối Supabase ghi **Blocked**.
3. Node 22 + pnpm (corepack); `pnpm install` cần mạng.

## 6. Rủi ro / Blocked tiềm ẩn

| Rủi ro | Task | Giảm thiểu |
|---|---|---|
| Chuỗi kết nối Supabase (IPv6, pooler, prepared statements) | L1-01 | `prepare:false` cho pooler transaction-mode; hướng dẫn `docs/SUPABASE_SETUP.md`; thử sớm ở Layer 1 |
| Supabase free tự tạm dừng sau khoảng 1 tuần ít hoạt động | mọi layer | Ghi trong `docs/RUN_LOCAL.md`; bạn "Resume" project khi quay lại |
| Task L1-03 và L2-02 khá lớn | L1-03, L2-02 | Tách task nếu reviewer báo quá tải; kế hoạch cho phép |
| Polling tạo tải/độ trễ 3 giây | L2-02, L3-02 | Chấp nhận ở demo; thay bằng SSE ở Layer 4 |
| Hết giờ chỉ kiểm khi có request | L2-02 | Đủ cho demo vì client gọi lưu đáp án/state liên tục; sweeper nền ở Layer 6 |
| Layer 3 cần L2-02 đã merge để thử trọn luồng | L3-02 | Phụ thuộc đã khai; thử bằng tay ghi vào AC |
