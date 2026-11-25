# Task 01: Giáo viên: điều khiển lớp (phát đề, thu bài, công bố đáp án, công bố bảng điểm)

## Layer
6

## Type
build

## Description
API và nút điều khiển theo từng lớp của một bài thi (FR-033, FR-034, FR-037, FR-038, BR-006, BR-010, C-04, C-06): **phát đề** (chụp snapshot 3 thiết lập vào `exam_classes`), **đóng/thu bài** (tự nộp + chấm các bài đang làm), **công bố đáp án** và **công bố bảng điểm** (hai thao tác riêng). Gồm DTO `@quiq/shared/class-control`, module api `class-control`, và trang `/giao-vien/phong-thi` với thanh điều khiển lớp (L7-03 sẽ gắn thêm bảng theo dõi trực tiếp vào cùng trang).

## Dependencies
- layer-5-task-01 (`collectAttempts`, sự kiện SSE, đếm attempt đang làm)
- layer-4-task-01 (bài thi, `exam_classes`)
- layer-3-task-05 (quy chế trường, `teacherAssignments`)
- layer-3-task-03 (lớp)
- layer-2-task-01 / layer-2-task-02 (guard, AppShell, api-client)
- layer-1-task-03 (enum, `examChannel`, sự kiện `class.status`)
- layer-1-task-02 (primitive UI)

## Acceptance Criteria
- [ ] `GET /api/teacher/exams/:examId/classes`: mỗi lớp của bài thi gồm trạng thái (`assigned|dispatched|closed`), `dispatchedAt`, `closedAt`, `answersPublishedAt`, `scoresPublishedAt`, snapshot (nếu đã phát), số học sinh `inProgressCount`, `waitingCount`. Bài thi/lớp của giáo viên khác hoặc trường khác -> 404.
- [ ] FR-033, C-04, C-06, FR-014: `POST .../classes/:classId/dispatch` chuyển `assigned -> dispatched`, ghi `dispatched_at` và **chụp snapshot** `max_attempts`, `warn_limit`, `interrupt_secs` từ quy chế trường **tại thời điểm đó** (test: đổi quy chế trước/sau khi phát: lớp A phát trước giữ giá trị cũ, lớp B phát sau lấy giá trị mới); chỉ phát một lần (trạng thái khác `assigned` -> 409 `INVALID_CLASS_STATE`); trường bị khóa -> 403; phát `class.status` qua SSE.
- [ ] FR-034, BR-006: `POST .../close` chỉ từ `dispatched`: đặt `closed`, `closed_at`, rồi gọi `collectAttempts` (attempt `in_progress` tự nộp + chấm, `interrupted` giữ điểm); trả `{ collected, interruptedKept }`; sau thu bài **không học sinh nào bắt đầu lượt mới** (đã được `startAttempt` chặn; test tích hợp).
- [ ] FR-037, FR-038, BR-010: `POST .../publish-answers` và `POST .../publish-scores` là **hai thao tác độc lập** (mỗi cái chỉ đặt cột thời gian của mình, lần đầu mới ghi, gọi lại là idempotent không đổi mốc); chỉ khi lớp đã phát đề (chưa phát -> 409 `INVALID_CLASS_STATE`); công bố bảng điểm không làm lộ đáp án và ngược lại (test).
- [ ] Mọi thao tác ghi `audit_log` (ai, lớp, thao tác) và chỉ chủ bài thi (giáo viên) thực hiện; mọi route khai metadata (`scope: 'school'`, `roles: ['teacher']`, `params` entity `exam`/`examClass`/`class`); chéo trường/chéo giáo viên -> 404.
- [ ] Web `/giao-vien/phong-thi?exam=<id>`: hàng chọn (Bài thi, Lớp, nút "Sao chép mã bài thi"), thanh điều khiển của lớp đang chọn: "Phát đề cho lớp X" (primary), "Đóng / Thu bài lớp X" (danger), "Công bố đáp án", "Công bố bảng điểm" (sau khi bấm đổi thành badge "Đã công bố"); nút khóa đúng theo trạng thái; **mỗi thao tác qua dialog xác nhận** (thu bài nêu rõ "N học sinh đang làm sẽ bị nộp ngay", phát đề nêu quy chế sẽ áp dụng: số lần, cảnh báo, ngưỡng); empty "Chưa có bài thi nào" dẫn tới `/giao-vien/bai-thi`; vùng `children` dành cho bảng theo dõi trực tiếp của L7-03 (file `page.tsx` import một component `LiveRosterSlot` rỗng để L7-03 thay).
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §9.3 và §3 (Dialog, Badge, Alert); không em-dash; chỉ desktop; đủ loading/empty/error; toast thành công/lỗi.
- [ ] Test PASS (PGlite + web): từng AC, gồm snapshot theo lớp, thu bài với attempt đang làm/gián đoạn, hai nút công bố độc lập.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/class-control/index.ts`
- `packages/shared/src/class-control/schemas.ts`
- `packages/shared/src/class-control/errors.ts`
- `apps/api/src/modules/class-control/routes.ts`
- `apps/api/src/modules/class-control/service.ts`
- `apps/api/src/modules/class-control/class-control.test.ts`
- `apps/web/src/app/giao-vien/phong-thi/page.tsx`
- `apps/web/src/features/class-control/class-control-bar.tsx`
- `apps/web/src/features/class-control/control-confirm-dialog.tsx`
- `apps/web/src/features/class-control/exam-class-picker.tsx`
- `apps/web/src/features/class-control/live-roster-slot.tsx`
- `apps/web/src/features/class-control/class-control-api.ts`
- `apps/web/src/features/class-control/class-control.test.tsx`

## Notes
- **Risk:** đỏ (thao tác vòng đời thi, snapshot quy chế, tự nộp hàng loạt; reviewer STRICT).
- `live-roster-slot.tsx` là điểm mở rộng: L7-03 thay nội dung file này (và có thể sửa `page.tsx`); không task L6/L7 nào khác đụng `page.tsx`.
- Học sinh lớp đã `dispatched` có thể ở phòng chờ; sau phát đề họ tự bấm "Bắt đầu làm bài" (L6-03).
- Điều kiện phân công: giáo viên mất phân công sau khi phát đề vẫn đóng/công bố được (chủ bài thi), nhưng không gán lớp mới (L4-01).
