# Task 03: Giáo viên: phòng thi theo dõi trực tiếp (SSE)

## Layer
7

## Type
build

## Description
Theo dõi **realtime** trạng thái từng học sinh của lớp (FR-035): endpoint ảnh chụp danh sách + **SSE stream** từ Koa, và bảng theo dõi gắn vào trang `/giao-vien/phong-thi` (do L6-01 tạo) qua điểm mở rộng `live-roster-slot.tsx`. Bốn trạng thái dẫn xuất: chưa làm / đang chờ / đang làm / đã nộp, kèm cờ gián đoạn. Gồm DTO `@quiq/shared/monitor`, module api `monitor`.

## Dependencies
- layer-6-task-01 (trang phòng thi, `live-roster-slot.tsx`, API trạng thái lớp)
- layer-5-task-01 (`rosterState`, presence, sự kiện SSE)
- layer-4-task-01 (bài thi, lớp)
- layer-1-task-01 (SSE hub), layer-1-task-02 (kết quả spike SSE: `docs/specs/2026-11-25-sse-spike.md`, cấu hình proxy)
- layer-1-task-03 (`examChannel`, sự kiện realtime)
- layer-2-task-01 / layer-2-task-02 (guard, api-client)

## Acceptance Criteria
- [ ] `GET /api/teacher/exams/:examId/classes/:classId/roster`: mọi học sinh ghi danh của lớp: `studentId`, `studentCode`, `fullName`, `state` (`not_started|waiting|in_progress|submitted`), `interrupted` (cờ gián đoạn), `attemptsUsed`, `violationCount` (lần làm hiện tại), `bestScore`, `lastAttemptId`; `waiting` chỉ khi presence <= 15 giây và chưa có attempt đang chạy; học sinh có attempt `completed` -> `submitted`. Chỉ chủ bài thi; chéo giáo viên/trường -> 404. Không có đáp án hay PII ngoài họ tên + mã (đúng quyền FR-063).
- [ ] `GET /api/teacher/exams/:examId/classes/:classId/stream` (SSE): kiểm quyền **trước** khi mở stream; gửi ngay `roster.snapshot`, sau đó chuyển tiếp sự kiện của kênh `examChannel(examId, classId)` (`student.waiting|started|submitted|interrupted|violation`, `class.status`); gửi lại `roster.snapshot` mỗi 15 giây (vì hết hạn presence không phát sự kiện) và dòng keep-alive; dọn subscriber khi ngắt; header đúng cho SSE (không nén, không đệm) và theo **quyết định của spike** (rewrite hay route handler); không rò dữ liệu giữa các lớp/bài thi (test hai kênh).
- [ ] Test (PGlite + hub thật + đồng hồ giả): snapshot đúng bốn trạng thái; học sinh vào phòng chờ -> sự kiện `student.waiting`; bắt đầu -> `student.started`; nộp -> `student.submitted`; gián đoạn -> `student.interrupted` + cờ; presence hết hạn thì snapshot định kỳ chuyển về `not_started`; giáo viên khác không mở được stream; ngắt kết nối giải phóng subscriber.
- [ ] Mọi route khai metadata (`scope: 'school'`, `roles: ['teacher']`, `params` entity `exam`/`class`).
- [ ] Web: `live-roster-slot.tsx` hiển thị bảng theo dõi cho lớp đang chọn: 4 thẻ KPI (Đang chờ vàng, Đang làm xanh dương, Đã nộp xanh lá, Chưa vào thi xám, kèm chữ không chỉ màu), bảng (Mã, Họ tên, Trạng thái badge, Lượt làm, Cảnh báo, Điểm cao nhất, Chi tiết), badge đỏ "Gián đoạn", nhấp nháy nền hàng 1 lần khi đổi trạng thái (tắt khi `prefers-reduced-motion`), nút "Chi tiết" liên kết `/giao-vien/ket-qua/bai-lam/<lastAttemptId>`.
- [ ] `use-roster-stream.ts` dùng `EventSource` với tự kết nối lại (backoff), khi mất kết nối hiện badge "Đang kết nối lại…" cạnh tiêu đề và làm mờ dữ liệu cũ tới khi có snapshot mới (design-spec §6.5); dọn kết nối khi đổi lớp/rời trang; cập nhật cục bộ theo sự kiện, đối chiếu lại bằng snapshot.
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §9.3 và §6.5; không em-dash; chỉ desktop; đủ loading (skeleton), empty ("Lớp chưa có học sinh"), error.
- [ ] Test web: reducer sự kiện, hiển thị 4 trạng thái, kết nối lại, dọn dẹp (EventSource giả).

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/monitor/index.ts`
- `packages/shared/src/monitor/schemas.ts`
- `packages/shared/src/monitor/errors.ts`
- `apps/api/src/modules/monitor/routes.ts`
- `apps/api/src/modules/monitor/roster.ts`
- `apps/api/src/modules/monitor/stream.ts`
- `apps/api/src/modules/monitor/monitor.test.ts`
- `apps/api/src/modules/monitor/stream.test.ts`
- `apps/web/src/features/class-control/live-roster-slot.tsx` (thay nội dung)
- `apps/web/src/features/monitor/live-roster.tsx`
- `apps/web/src/features/monitor/kpi-strip.tsx`
- `apps/web/src/features/monitor/roster-table.tsx`
- `apps/web/src/features/monitor/roster-reducer.ts`
- `apps/web/src/features/monitor/use-roster-stream.ts`
- `apps/web/src/features/monitor/monitor-api.ts`
- `apps/web/src/features/monitor/monitor.test.tsx`
- `apps/web/src/features/monitor/roster-reducer.test.ts`

## Notes
- **Risk:** đỏ (realtime, giữ kết nối dài, quyền theo bài thi/lớp; reviewer STRICT, kiểm rò dữ liệu giữa kênh và dọn tài nguyên).
- Sửa `live-roster-slot.tsx` (file của L6-01) là điểm mở rộng đã định trước; **không** sửa `giao-vien/phong-thi/page.tsx`.
- Nếu spike L1-02 kết luận phải dùng route handler stream hay kết nối trực tiếp Koa, tuân theo `docs/specs/2026-11-25-sse-spike.md`; nếu spike bị `Blocked`, xác minh thủ công ở task này và ghi kết quả.
- Một tiến trình Koa: hub in-process (đã chấp nhận ở Scalability: off).
- Lượng học sinh thử nghiệm ~3-4 người; không cần phân trang bảng theo dõi, nhưng bảng phải dùng được với 50+ dòng.
