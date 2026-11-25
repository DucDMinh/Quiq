# Task 01: Giáo viên: bài thi (rút đề ngẫu nhiên, sao chép, mã + link, gán lớp)

## Layer
4

## Type
build

## Description
Lát cắt dọc cho **bài thi** (FR-030, FR-031, FR-032, BR-002, BR-003): cấu hình rút ngẫu nhiên (tổng + dễ/TB/khó) và thời gian làm bài; **rút một bộ câu một lần**, **sao chép nội dung câu, đáp án và file ảnh** vào đề; tạo **mã bài thi duy nhất toàn hệ thống** + link `/thi/<mã>`; gán lớp trong phạm vi phân công; xem đề; không xóa đề đã có người thi. Gồm DTO `@quiq/shared/exams`, module api `exams`, trang `/giao-vien/bai-thi` và `/giao-vien/bai-thi/[id]`.

## Dependencies
- layer-3-task-06 (ngân hàng câu hỏi, `GET /api/teacher/questions/stats`, media proxy, ảnh ngân hàng)
- layer-3-task-05 (`teacherAssignments` để giới hạn lớp được gán)
- layer-3-task-03 (năm học, lớp)
- layer-3-task-02 (môn của giáo viên)
- layer-1-task-05 (`drawQuestions`, `InsufficientQuestionsError`, `cryptoRng`)
- layer-1-task-06 (`ObjectStorage.copy`, `examMediaPath`)
- layer-1-task-04 (bảng `exams`, `exam_questions`, `exam_options`, `exam_classes`, `media`)
- layer-2-task-01 / layer-2-task-02 (guard, AppShell)

## Acceptance Criteria
- [ ] FR-030, FR-031: `POST /api/teacher/exams { title, durationMinutes (1..300), config { total, easy, medium, hard }, classIds[] }` với `easy + medium + hard = total` (>= 1); rút từ ngân hàng **của chính giáo viên và đúng môn của mình** bằng `drawQuestions` (RNG `crypto`), trong **một transaction**; thiếu câu ở bất kỳ mức nào -> 422 `NOT_ENOUGH_QUESTIONS` kèm `details` từng mức `{ difficulty, need, have }` ("Ngân hàng chỉ có 8 câu Khó, cần 10") và **không tạo bất cứ gì** (không dòng DB, không file).
- [ ] **Sao chép**: nội dung câu, mức khó, đáp án (`is_correct`), thứ tự vị trí được chép sang `exam_questions`/`exam_options` (có `source_question_id` không ràng buộc); **file ảnh được sao chép** bằng `storage.copy` sang `examMediaPath` với dòng `media` mới (`kind = 'exam'`, cùng chủ sở hữu). Test: sửa và xóa câu gốc (và ảnh gốc) sau khi ra đề không làm đổi hay hỏng đề; lỗi giữa chừng khi sao chép ảnh -> rollback DB và xóa các file đã chép dở.
- [ ] FR-032, BR-003: mã bài thi ngẫu nhiên 8 ký tự từ `EXAM_CODE_ALPHABET` (bỏ ký tự dễ nhầm), duy nhất toàn hệ thống (thử lại khi đụng độ, test đụng độ giả); response gồm `code` và `link` (`/thi/<code>`). Mỗi bài thi tạo `exam_classes` (`assigned`) cho các lớp được gán; **chỉ gán được lớp nằm trong phân công của giáo viên** (`teacherAssignments`, đúng một năm học; lớp khác -> 422 `CLASS_NOT_ASSIGNED`; lớp trường khác -> 404). `exam.year_id` = năm của các lớp.
- [ ] `POST /api/teacher/exams/:id/classes { classIds }` thêm lớp và `DELETE /api/teacher/exams/:id/classes/:classId` gỡ lớp (chỉ khi lớp đó còn `assigned`, chưa phát đề, không có attempt/presence); cùng quy tắc phân công.
- [ ] `GET /api/teacher/exams?yearId=` (mặc định năm hiện tại): tên bài, mã + link, cấu hình đề, lớp được gán + trạng thái từng lớp, số lượt thi, ngày tạo; `GET /api/teacher/exams/classes` trả các lớp giáo viên được phân công ở năm hiện tại (dùng cho dialog); `GET /api/teacher/exams/:id` trả đề (câu, ảnh qua `/api/media/:id`, đáp án đúng cho giáo viên chủ đề). Bài thi của giáo viên khác -> 404.
- [ ] BR-002: `DELETE /api/teacher/exams/:id` -> 409 `EXAM_HAS_ATTEMPTS` khi **đã có attempt** ở bất kỳ lớp nào; ngược lại xóa đề + bản sao câu/đáp án/ảnh (file Storage cũng bị xóa); không sửa nội dung đề sau khi tạo (không có endpoint sửa câu của đề ở task này, chấm lại ở L7-04).
- [ ] Mọi route khai metadata (`scope: 'school'`, `roles: ['teacher']`, `params` entity `exam`/`class`); test cô lập chéo trường và chéo giáo viên.
- [ ] Web `/giao-vien/bai-thi`: bảng (Tên bài, **Mã bài thi** + link có nút sao chép, Cấu hình đề tổng/dễ/TB/khó, Lớp được gán, Lượt thi, Thao tác Xem đề / Phòng thi (link `/giao-vien/phong-thi?exam=<id>`) / Xóa), lọc theo năm học, nút Xóa khóa kèm tooltip khi đã có người thi; dialog "Tạo bài thi": tên, thời gian (phút), tổng số câu + số câu dễ/TB/khó với **số câu hiện có theo mức** cạnh ô (từ `/api/teacher/questions/stats`) và lỗi tại chỗ ("Ngân hàng chỉ có 8 câu Khó, cần 10"), chọn lớp bằng checkbox (chỉ lớp được phân công); `/giao-vien/bai-thi/[id]` "Xem đề" hiển thị bản sao câu hỏi (ảnh, đáp án đúng đánh dấu).
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §9.2 và §3; không em-dash; chỉ desktop; đủ loading/empty/error.
- [ ] Test PASS (PGlite + storage memory + web): từng AC, gồm đủ/thiếu từng mức, đảm bảo đúng số câu mỗi mức, mã đụng độ, rollback sao chép ảnh, sửa/xóa gốc không đổi đề.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/exams/index.ts`
- `packages/shared/src/exams/schemas.ts`
- `packages/shared/src/exams/errors.ts`
- `apps/api/src/modules/exams/routes.ts`
- `apps/api/src/modules/exams/service.ts`
- `apps/api/src/modules/exams/create-exam.ts`
- `apps/api/src/modules/exams/exam-code.ts`
- `apps/api/src/modules/exams/exams.test.ts`
- `apps/api/src/modules/exams/copy-on-create.test.ts`
- `apps/web/src/app/giao-vien/bai-thi/page.tsx`
- `apps/web/src/app/giao-vien/bai-thi/[id]/page.tsx`
- `apps/web/src/features/exams/exams-table.tsx`
- `apps/web/src/features/exams/create-exam-dialog.tsx`
- `apps/web/src/features/exams/exam-view.tsx`
- `apps/web/src/features/exams/copy-code-button.tsx`
- `apps/web/src/features/exams/exams-api.ts`
- `apps/web/src/features/exams/exams.test.tsx`

## Notes
- **Risk:** đỏ (tính đúng đắn của đề thi, sao chép dữ liệu + file, quyền giáo viên; reviewer STRICT). Không migration.
- Bộ câu rút **một lần cho mỗi bài thi**, mọi lớp dùng chung; việc đảo thứ tự theo học sinh thuộc L5-01.
- "Phòng thi" ở menu trỏ trang của L6-01/L7-03; link `?exam=` chỉ là tham số, trang đó tự đọc.
- Hàm `copyExamMedia` giữ trong `create-exam.ts` để L8-01 test không lộ file ngoài thư mục `exam`.
- Hết hạn mức file 1 GB (Supabase free) được chú ý: ảnh đề nhân bản theo mỗi bài thi (quyết định đã duyệt ở BR-002).
