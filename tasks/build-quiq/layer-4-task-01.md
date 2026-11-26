# Task 01: Phòng thi cập nhật trực tiếp bằng SSE (kèm sửa G-12 hết giờ trên roster/thu bài)

## Layer
4

## Type
build (feature sau demo, user chốt trong chat 2026-11-26)

## Description
Giáo viên ở `/giao-vien/phong-thi` thấy trạng thái học sinh đổi **ngay** (không chờ 3 giây) khi học sinh vào phòng chờ, bắt đầu, nộp bài, hết giờ, hoặc khi giáo viên phát đề/thu bài. Theo FR-035, C-12 và design doc ("Giáo viên theo dõi").

**Bước 0: spike SSE qua rewrite của Next (làm TRƯỚC, báo kết quả trong report).** Dựng endpoint SSE tối thiểu, đo sự kiện tới client qua `localhost:3000/api/...` (rewrite) so với `localhost:4000`. Đặt header `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`, tắt nén cho route này. Nếu qua rewrite sự kiện bị gom/chậm > 1 giây mà không khắc phục được trong phạm vi task → **DỪNG, báo BLOCKED** kèm số đo; không tự đổi kiến trúc (vd không tự chuyển WebSocket hay gọi thẳng cổng 4000 từ trình duyệt).

API:
- **SSE hub trong tiến trình** (`apps/api/src/realtime/`): đăng ký/huỷ người nghe theo `examClassId`, `publish(examClassId)` báo "lớp đổi". Gắn vào `AppDeps` dạng **tuỳ chọn** (`deps.realtime?`), `createTestApp()` và `server.ts` tạo hub mặc định; thiếu hub thì các chỗ phát tín hiệu bỏ qua (không lỗi).
- **Phát tín hiệu** sau khi commit ở: vào thi/ghi presence phòng chờ, Bắt đầu, lưu kết thúc attempt (sau `finalizeAttempt`: nộp, hết giờ, thu bài), phát đề, thu bài.
- `GET /api/teacher/exams/:examId/classes/:classId/stream`: quyền như roster (`staffGuard(["teacher"])`, chủ bài + trường, chéo → 404). Khi kết nối: gửi `event: roster` với dữ liệu = `RosterView` hiện tại (dùng lại `getRoster`, một nguồn sự thật). Khi hub báo lớp đổi: tính lại và gửi `roster` (gộp nhiều tín hiệu trong ~250ms thành một lần gửi). Định kỳ ~10 giây tính lại để "Đang chờ" tự hết hạn sau 15 giây, và gửi comment keepalive. Dọn người nghe khi client đóng kết nối (không rò bộ nhớ, không giữ interval).
- `RosterView` thêm cờ `interrupted` cho từng học sinh (true khi có attempt `interrupted`; Layer 7 mới sinh trạng thái này, hiện luôn false).

**Sửa G-12 (`docs/changes/TECHNICAL_REQUIREMENT_GAPS.md`):**
- `getRoster` kiểm hết giờ lười cho attempt `in_progress` của lớp đã quá `ends_at + 3s` (kết thúc bằng `finalizeAttempt(..., "timeout")`) trước khi tính trạng thái, để không hiện "Đang làm" với bài đã quá giờ.
- Thu bài: attempt `in_progress` đã quá `ends_at` (+ dung sai 3 giây như lưu đáp án) kết thúc với lý do `timeout`, chưa quá thì `closed`.

Web (`features/class-control/`):
- `use-roster` dùng `EventSource` tới stream; nhận `roster` thì cập nhật bảng + KPI. Huy hiệu trạng thái kết nối "Trực tiếp" / "Đang kết nối lại". Lỗi SSE (hoặc trình duyệt không hỗ trợ) → **tự quay về polling 3 giây** như hiện tại và thử lại SSE sau; đổi lớp/rời trang thì đóng kết nối.
- Không đổi bố cục bảng ngoài cột/huy hiệu cần thiết; cờ gián đoạn hiển thị khi `interrupted` (chưa có dữ liệu thật).

## Dependencies
- layer-3-task-02 (`getRoster`, class-control, finalize theo lớp)
- layer-2-task-02 (`finalizeAttempt`, `expireDueAttempts`, presence phòng chờ)
- layer-2-task-01 (guard giáo viên)

## Acceptance Criteria
- [ ] Spike: report ghi rõ độ trễ sự kiện qua rewrite Next (dev) và cách cấu hình để không bị gom; đạt ≤ 1 giây.
- [ ] Kết nối stream nhận ngay ảnh chụp roster đúng như `GET .../roster`; giáo viên khác/trường khác → 404; chưa đăng nhập → 401.
- [ ] Học sinh vào phòng chờ / Bắt đầu / nộp / hết giờ, giáo viên phát đề / thu bài → client stream nhận `roster` mới trong ≤ 1 giây (test tích hợp với đồng hồ giả, đọc luồng thật).
- [ ] Presence quá 15 giây → học sinh rời "Đang chờ" ở lần tính lại định kỳ.
- [ ] Đóng kết nối → hub gỡ người nghe, không còn timer (test).
- [ ] G-12: roster không còn "Đang làm" với bài quá `ends_at + 3s` (bài được nộp với `endReason=timeout`); thu bài gán `timeout` cho bài đã quá hạn, `closed` cho bài còn giờ (test cả hai).
- [ ] Web: SSE cập nhật bảng không cần polling; ngắt SSE → quay về polling, huy hiệu "Đang kết nối lại"; đổi lớp/unmount đóng EventSource (test với EventSource giả); không em-dash; chỉ desktop.
- [ ] Toàn bộ test cũ xanh (đặc biệt luồng học sinh L2 và class-control L3).

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS (STRICT: phân quyền stream, rò tài nguyên, đổi lý do kết thúc attempt)
- [ ] committed

## Files to Create/Modify
- `apps/api/src/realtime/hub.ts`, `apps/api/src/realtime/hub.test.ts`, `apps/api/src/realtime/sse.ts` (ghi header/sự kiện/keepalive)
- `apps/api/src/modules/class-control/routes.ts`, `service.ts`, `stream.ts`, `class-control.test.ts`, `stream.test.ts`
- `apps/api/src/http/deps.ts`, `apps/api/src/testing/test-app.ts`, `apps/api/src/server.ts` (gắn hub, chỉ thêm)
- `apps/api/src/modules/student/service.ts`, `apps/api/src/modules/attempts/service.ts`, `apps/api/src/modules/attempts/start.ts` (chỉ thêm lời gọi phát tín hiệu sau commit); `apps/api/src/modules/attempts/finalize.ts` chỉ khi cần phát tín hiệu ở điểm kết thúc duy nhất (không đổi logic chấm)
- `packages/shared/src/exams/schemas.ts` (cờ `interrupted`, kiểu sự kiện)
- `apps/web/src/features/class-control/use-roster.ts`, `control-panel.tsx`, `roster-table.tsx`, test web mới `class-control.test.tsx`
- `next.config.ts` chỉ nếu spike chứng minh cần (vd tắt nén) và ghi lý do

## Notes
- Đọc trước: `SPECIFICATIONS.md` FR-035, C-12; `docs/specs/2026-11-25-quiq-design.md` (Giáo viên theo dõi, Vòng đời một lần làm); `docs/API_SPEC.md`, `docs/DESIGN.md` (as-built); `.context/design-spec.md` §9.3.
- **Chưa làm:** heartbeat 5 giây, sweeper nền, gián đoạn/đổi máy (Layer 6, 7); SSE cho học sinh (học sinh vẫn polling `state` 3 giây); pub/sub nhiều instance (ghi gap mới).
- Hub một tiến trình: chạy nhiều instance API thì giáo viên chỉ nhận sự kiện của instance mình; polling dự phòng vẫn đúng. Ghi gap ở close-out.
- Tránh rò: mỗi kết nối 1 listener + 1 interval, dọn ở `close`/`error` của request; không giữ tham chiếu ctx sau khi đóng.
- Risk: trung bình đến cao (realtime, tài nguyên lâu dài, đổi lý do kết thúc). Reviewer STRICT.
- Endpoint mới vào `docs/API_SPEC.md` ở close-out (`Doc-Impact` không được `none`); G-12 chuyển resolved.
