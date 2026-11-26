# Spec Update — 2026-11-26 initial-build-demo

**spec_version:** 1.0.0 → 1.0.0 (không bump)
**Trigger:** initial-build (demo Layer 0-3, 8 task PASS review; phase review spec-validator PASS)
**Requirements:** không đổi. Không thêm, sửa hay xoá FR/BR nào. Các phần chưa làm được dời sang Layer 4-17 đúng theo `tasks/build-quiq/_layer-plan.md` §3. Đây không phải thay đổi requirement.
**Ảnh hưởng:** toàn bộ module demo (api: health, auth, student, attempts, questions, exams, class-control; engine; db schema + seed; web: luồng học sinh `/thi/*`, đăng nhập, `/giao-vien/*`). Test: 9 nhóm luồng, 26 endpoint, 9 route UI smoke.
**Scope sinh:** `spec/test-scope/current.json` (scopeVersion 1, risk high)

## Lý do không bump version

- Build demo chỉ hiện thực một phần spec v1.0.0. Không có quyết định mới nào của chủ dự án làm đổi ngữ nghĩa requirement.
- Các chỗ lệch tìm được ở phase review (M-1, L-1..L-4) đều đã vào gap register (G-12, G-13, G-14) hoặc là lệch với design doc (L-2), không phải với spec.
- **Đề xuất PATCH sau (qua `/change`, không làm ở đây):** hai mục `## API Endpoints` và `## Database Schema` trong `SPECIFICATIONS.md` vẫn ghi "[cần xác nhận] — chưa có code". Nay đã có code, nên đổi sang trỏ về `docs/API_SPEC.md` và `docs/ERD.md` (as-built). Chỉ đổi cách diễn đạt, không đổi behavior, nên là PATCH 1.0.1. Spec ghi rõ không sửa tay, nên spec-publisher không tự sửa.

## Phạm vi đã build (theo phase review)

- **Covered (22):** FR-020, 022, 023, 024, 030, 031, 032, 033, 036, 040, 042, 046, 050, 051; BR-001, 002, 003, 006, 007, 008, 012, 014.
- **Partial (6), phần còn lại đã dời có chủ đích:**
  - FR-034: thu bài tay đã có; nhánh "gián đoạn → điểm cao nhất" để Layer 7
  - FR-035: polling 3 giây đã có; SSE để Layer 4
  - FR-041: hết giờ kiểm lười đã có; sweeper nền để Layer 6
  - FR-047: mới có thông báo "chưa công bố" ở client; bản đầy đủ để Layer 5
  - FR-014: snapshot lúc phát đề đã có; màn chỉnh thiết lập để Layer 11
  - FR-002: đăng nhập đã có; tạo tài khoản và đặt lại mật khẩu để Layer 8 và 12
- **Có chạm tới nhưng chưa đủ:** FR-001 (trường khóa chặn đăng nhập và vào thi), FR-043/BR-004 (vào từ máy khác trả 409, G-04), BR-005, BR-015 (cô lập ở mức code, quét tự động để Layer 17), BR-017.

## Nhóm luồng cần test (chi tiết trong `current.json` → `flows`)

1. Học sinh trọn vẹn: enter → state → start → save → submit → result (high)
2. Hết giờ lười: sau `ends_at + 3s` trả 409 `ATTEMPT_ENDED`, `endReason=timeout` (high)
3. Từ chối vào thi: `STUDENT_NOT_ALLOWED`, `SCHOOL_LOCKED`, `EXAM_NOT_DISPATCHED`, `EXAM_CLOSED`, `ATTEMPT_IN_PROGRESS` (high)
4. Giáo viên ra đề: classes, bank-counts, create (422/403), list, detail, delete (409) (high)
5. Điều khiển lớp: dispatch (snapshot, phát lặp 409), close (idempotent), roster 4 trạng thái (high)
6. Ngân hàng câu hỏi: CRUD, lọc, phân trang 25, validate 422 (medium)
7. Cô lập và quyền: khác giáo viên hoặc khác trường trả 404; `super_admin` gọi route giáo viên trả 403; học sinh A ↔ B trả 404 (high)
8. Đăng nhập cán bộ: 401 chung, 429 ở lần thứ 6, 403 trường khóa, me, logout (high)
9. Health: `/api/health`, `/api/health/db` (low)

UI smoke (chỉ desktop): `/thi`, `/thi/[code]`, `/thi/[code]/phong-cho`, `/thi/[code]/lam-bai`, `/thi/[code]/ket-qua`, `/dang-nhap`, `/giao-vien/ngan-hang`, `/giao-vien/bai-thi`, `/giao-vien/phong-thi`.

## Risk: high

Verify đều PASS: 417/417 test, typecheck, lint, build; E2E API trên Supabase thật 30/30; smoke Layer 2. Dù vậy vẫn để `high`, vì:
- đây là scope đầu tiên, template TEST chưa có test nào;
- scope chạm mọi vùng rủi ro đỏ: auth, phiên cookie, cô lập trường, chấm điểm, khóa đồng thời;
- còn 13 gap mở, trong đó G-01 mức MAJOR cho prod;
- RLS và quyền `anon` trên Supabase chưa kiểm.

## Known issues: KHÔNG coi là bug mới

Gap đang mở trong `docs/changes/TECHNICAL_REQUIREMENT_GAPS.md`:
- G-01, G-02, G-03, G-04, G-05, G-07, G-08, G-09, G-10, G-11, G-12, G-13, G-14
- G-06 đã resolved; phần TTL còn lại chuyển thành G-14.

Ngoài ra còn residual RLS/anon. Hành vi cụ thể test cần chấp nhận nằm trong `current.json` → `knownIssues`. Các tính năng Layer 4-17 nằm ở `outOfScope`.

## Dữ liệu test

- Seed: `pnpm --filter @quiq/db db:seed:demo`. Nội dung: `gv.toan` với mật khẩu là hằng `DEMO_PASSWORD` trong `packages/db/src/seed/demo.ts`, lớp 10A1, học sinh HS001..HS005, 30 câu hỏi, bài `DEMO01` (10 câu, 15 phút, đã phát đề).
- `--reset-attempts` xoá mọi attempt, phiên và phòng chờ của trường demo, kể cả của bài YAH2B8. Lệnh này chỉ mở lại `DEMO01`.
- Trên staging còn bài `[Thử tự động] E2E Layer 3`, mã `YAH2B8`, đã thu bài, có attempt của HS002 và HS003. Đây là dữ liệu E2E để lại, không phải lỗi; đừng nhầm với DEMO01.
- Giới hạn của seed: chỉ có 1 trường, 1 giáo viên, 1 lớp. Các test giáo viên A ↔ B, khác trường, lớp khác và trường khóa cần fixture DB riêng.
- Test hết giờ: tạo bài 1 phút.
- Test throttle đăng nhập: tránh khoá `gv.toan`, hoặc chạy test này cuối cùng.
