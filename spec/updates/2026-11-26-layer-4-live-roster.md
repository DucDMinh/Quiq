# Spec Update — 2026-11-26 layer-4-live-roster

**spec_version:** 1.0.0 → 1.0.0 (không bump)
**Trigger:** feature-update (Layer 4, `layer-4-task-01`: phòng thi giáo viên cập nhật trực tiếp bằng SSE, kèm sửa G-12; commit `d840832`, close-out `95ae75f`)
**Requirements:** không đổi. Layer 4 hiện thực FR-035 và C-12 (phần SSE) đã có sẵn trong spec v1.0.0. Sửa G-12 đưa code về đúng FR-041/FR-034 (lý do kết thúc `timeout`), không đổi requirement.
**Ảnh hưởng:** api.realtime (mới), api.class-control (stream mới, roster có ghi, thu bài), api.attempts/student (phát tín hiệu sau commit), http.guards (kiểm phiên không gia hạn), shared.exams (`interrupted`), web.class-control. Test: 3 luồng mới (flow-10, 11, 12), flow-5 đổi, flow-1..9 còn lại chạy regression.
**Scope sinh:** `spec/test-scope/current.json` (scopeVersion 2, risk medium)

## Lý do không bump version

- FR-035 ("theo dõi realtime trạng thái từng học sinh") và C-12 ("SSE từ Koa cho giáo viên theo dõi trực tiếp") đã nằm trong spec từ v1.0.0. Scope v1 chỉ ghi FR-035 ở mức partial và dời SSE sang Layer 4 theo kế hoạch.
- G-12 là chỗ code lệch spec (FR-041 yêu cầu `timeout`), nay sửa code cho khớp. Không hạ hay đổi intent.
- Không có quyết định mới nào của chủ dự án làm đổi ngữ nghĩa requirement.

## Mới / đổi cần test

**Endpoint mới** `GET /api/teacher/exams/:examId/classes/:classId/stream` (SSE):
- Ảnh chụp đầu: `: open` rồi `event: roster` = `RosterView` hiện tại, khớp `GET .../roster`.
- Lớp đổi (học sinh vào phòng chờ, Bắt đầu, nộp, hết giờ; giáo viên phát đề, thu bài) → `roster` mới, gộp ~250 ms. Đo trên staging: ~0,8-0,9 giây.
- Mỗi ~10 giây tính lại (để "Đang chờ" hết hạn sau 15 giây) và gửi comment `: keepalive`.
- Kiểm lại phiên giáo viên trước mỗi lần đẩy, **không gia hạn** phiên. Đăng xuất, phiên thu hồi, hết hạn 8 giờ, tài khoản tắt, trường khóa, mất quyền với lớp → server đóng luồng (smoke: logout đóng sau ~4,5 giây).
- Đệm chưa gửi > 1 MB → cắt kết nối.
- 401/404 trả JSON (kiểm quyền và ảnh chụp đầu chạy trước khi mở luồng).

**Đổi:**
- `RosterStudent.interrupted` (boolean, hiện luôn false tới Layer 7).
- `GET .../roster` nay **có ghi**: tự nộp attempt `in_progress` đã quá `ends_at + 3s` với `endReason=timeout` trước khi tính trạng thái (sửa G-12).
- Thu bài: bài đã quá hạn → `timeout`, bài còn giờ → `closed`. Điểm không đổi.

**Web `/giao-vien/phong-thi`:** huy hiệu "Trực tiếp" / "Đang kết nối lại". Watchdog 5 giây (chưa có ảnh chụp đầu) và 25 giây (im lặng); lỗi thì về polling 3 giây, thử lại SSE sau 10 giây. Chỉ một nguồn dữ liệu tại một thời điểm; đổi lớp hoặc rời trang thì đóng EventSource.

## Risk: medium

Phạm vi hẹp và verify kỹ: 439/439 test, typecheck, lint, build PASS trên staging; review STRICT PASS round 2; smoke SSE trên Supabase thật. Không hạ `low` vì kết nối dài hạn có kiểm phiên (auth), GET roster nay có ghi, đổi lý do kết thúc attempt, và vài nhánh SSE chưa có test (G-17). Chưa có phase review spec-validator cho Layer 4.

## Known issues

- **Bỏ:** G-12 (resolved ở `d840832`; test lại qua flow-11).
- **Thêm:** G-15 (hub một tiến trình, nhiều instance mất tính trực tiếp), G-16 (chưa giới hạn số kết nối SSE), G-17 (thiếu test: tài khoản tắt khi đang stream, "không gia hạn phiên", vượt đệm với socket nghẽn thật).
- Giữ nguyên: G-01, G-02, G-03, G-04, G-05, G-07, G-08, G-09, G-10, G-11, G-13, G-14, RESIDUAL-RLS.

## Vẫn chưa build (không phải bug)

SSE cho học sinh (học sinh vẫn polling 3 giây); heartbeat 5 giây và đo gián đoạn (Layer 6/7); dữ liệu thật cho cờ `interrupted` (Layer 7); pub/sub nhiều instance (G-15). Các layer 5-17 như scope v1.
