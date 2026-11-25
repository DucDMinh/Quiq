# Task 02: Giáo viên: tạo bài thi, phát đề, thu bài, xem trạng thái và điểm lớp

## Layer
3

## Type
build (initial)

## Description
Lát cắt dọc cho phía giáo viên điều khiển kỳ thi. Sau task này (cùng L3-01), toàn bộ luồng demo chạy trọn: giáo viên ra đề → Phát đề → học sinh thi → Thu bài → xem điểm.

API (`apps/api/src/modules/exams/`, `apps/api/src/modules/class-control/`), vai trò `teacher`, lọc theo `schoolId` và chủ sở hữu:
- `POST /api/teacher/exams`: tên, số phút, cấu hình rút (tổng, dễ, TB, khó), danh sách lớp. Dùng `drawQuestions` của engine; thiếu câu ở mức nào thì **422** tiếng Việt kèm `{difficulty, have, need}` và **không tạo đề** (FR-030). **Sao chép nội dung** câu và đáp án vào `exam_questions/exam_options` trong **một transaction**. Sinh `exam_code` duy nhất toàn hệ thống (ký tự dễ đọc, bỏ ký tự dễ nhầm) và link `/thi/<mã>`. Chỉ gán lớp có trong `assignments` của giáo viên (FR-032).
- `GET /api/teacher/exams`, `GET /api/teacher/exams/:id` (xem đề: bản sao, kèm đáp án đúng vì là giáo viên), `DELETE` bị chặn khi đã có người thi (BR-002).
- `GET /api/teacher/exams/classes`: lớp được phép gán.
- Điều khiển lớp: `POST /api/teacher/exams/:examId/classes/:classId/dispatch` (**Phát đề**: chụp snapshot `max_attempts/warn_limit/interrupt_secs` từ `schools` vào `exam_classes`, `status=dispatched`), `.../close` (**Thu bài**: mọi attempt `in_progress` của lớp gọi `finalizeAttempt(..., 'closed')`; lớp `closed` không cho bắt đầu), `GET .../roster` (polling 3 giây): từng học sinh với trạng thái **Chưa làm / Đang chờ / Đang làm / Đã nộp**, số lượt, điểm (FR-035 ở mức polling).

Web đúng design-spec §9.2 và §9.3 (phần demo):
- `/giao-vien/bai-thi`: bảng bài thi (tên, mã bài thi + nút sao chép link, cấu hình đề, lớp, lượt thi, Xem đề/Phòng thi/Xóa), dialog tạo bài thi (hiện số câu hiện có theo mức ngay cạnh ô nhập, báo thiếu tại chỗ).
- `/giao-vien/phong-thi`: chọn bài + lớp, nút "Phát đề cho lớp X", "Đóng / Thu bài lớp X" (dialog xác nhận nêu số học sinh đang làm sẽ bị nộp), 4 thẻ KPI + bảng trạng thái học sinh cập nhật bằng polling.

## Dependencies
- layer-2-task-01 (đăng nhập, guard, khung giao diện, menu)
- layer-2-task-02 (`finalizeAttempt`, bảng attempts đã dùng, luồng học sinh để thử trọn vẹn)
- layer-1-task-01 (bảng exam), layer-1-task-02 (`drawQuestions`), layer-1-task-03 (UI)

## Acceptance Criteria
- [ ] Tạo bài thi đúng tổng và đúng số câu từng mức; thiếu câu → 422 và không có hàng nào được tạo (kiểm transaction); mã bài thi duy nhất (test va chạm); link đúng.
- [ ] Sửa/xóa câu trong ngân hàng sau khi ra đề **không đổi** bản sao trong đề; xóa đề đã có attempt bị chặn.
- [ ] Phát đề chụp snapshot đúng từ `schools`; đổi cấu hình trường sau đó không đổi lớp đã phát (test); phát đề lớp A không mở lớp B.
- [ ] Thu bài: mọi attempt đang làm của lớp được nộp ngay và chấm; học sinh chưa bắt đầu không bắt đầu được nữa; học sinh trong phòng chờ thấy trạng thái đã thu bài.
- [ ] Roster đúng bốn trạng thái; điểm hiển thị cho attempt đã nộp; lớp chỉ hiện học sinh của chính lớp đó.
- [ ] Giáo viên chỉ thao tác bài thi/lớp của mình; truy cập bài của người khác hoặc trường khác → **404**; gán lớp ngoài phân công → 403/422 có thông điệp.
- [ ] Web: dialog tạo đề, bảng, nút điều khiển có dialog xác nhận, đủ loading/empty/error; không em-dash; chỉ desktop.
- [ ] **Kiểm thử trọn vẹn bằng tay trên web** (ghi lại kết quả trong báo cáo review): tạo bài mới → Phát đề → 2 học sinh vào thi và nộp → Thu bài → thấy điểm 2 học sinh.
- [ ] Test API (PGlite) cho tạo/rút/sao chép/phát/thu/roster/cô lập; test web cho dialog tạo bài và nút điều khiển.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS (STRICT: quyền sở hữu, transaction, snapshot)
- [ ] committed

## Files to Create/Modify
- `apps/api/src/modules/exams/routes.ts`, `apps/api/src/modules/exams/service.ts`, `apps/api/src/modules/exams/exam-code.ts`, `apps/api/src/modules/exams/exams.test.ts`
- `apps/api/src/modules/class-control/routes.ts`, `apps/api/src/modules/class-control/service.ts`, `apps/api/src/modules/class-control/class-control.test.ts`
- `packages/shared/src/exams/index.ts`, `packages/shared/src/exams/schemas.ts`, `packages/shared/src/exams/errors.ts`
- `apps/web/src/app/giao-vien/bai-thi/page.tsx`, `apps/web/src/app/giao-vien/phong-thi/page.tsx`
- `apps/web/src/features/exams/exam-table.tsx`, `create-exam-dialog.tsx`, `use-exams.ts`, `apps/web/src/features/class-control/control-panel.tsx`, `roster-table.tsx`, `use-roster.ts`, `apps/web/src/features/exams/exams.test.tsx`

## Notes
- Đọc trước: `.context/design-spec.md` §9.2, §9.3; `docs/specs/2026-11-25-quiq-design.md` (Ra đề, Vòng đời một lớp); `SPECIFICATIONS.md` FR-030 đến 035, BR-002, BR-006, C-04.
- **Chưa làm (tính năng sau):** SSE realtime, nút "Công bố đáp án/bảng điểm", ảnh trong đề, lọc theo năm học nhiều năm, phân quyền chi tiết theo năm học.
- Không sửa `finalize.ts` của L2-02; chỉ gọi. Cần hành vi mới thì ghi vào task đó là "cần change".
- Phòng chờ hiển thị "Đang chờ" dựa `waiting_presence.last_seen` trong 15 giây gần nhất (hằng số dùng chung với student).
- Risk: trung bình đến cao (transaction, quyền, snapshot). Reviewer STRICT.
