# Task 02: API học sinh vào thi và phòng chờ

## Layer
6

## Type
build

## Description
Các route công khai/học sinh để **vào thi** (FR-040, FR-032, BR-014, BR-004, FR-043): kiểm mã bài thi + mã học sinh, tạo/dùng lại phiên `quiq_stu` (đổi máy được xử lý bởi core), **phòng chờ** có presence và trạng thái lớp, rời phòng chờ. Gồm DTO `@quiq/shared/student-entry`, module api `student-entry`. (UI ở L7-01.)

## Dependencies
- layer-5-task-01 (`createOrResumeSession`, `studentAuth`, `touchWaitingPresence`, `reconcileAttempt`, takeover)
- layer-4-task-01 (bài thi, mã, `exam_classes`)
- layer-3-task-04 (học sinh, mã vô hiệu, ghi danh)
- layer-3-task-05 (quy chế hiện hành để hiển thị trước khi phát đề)
- layer-1-task-01 (rate-limit)
- layer-1-task-03 (mã lỗi, hằng số)
- layer-2-task-01 (`createTestApp`, `loginStudent`)

## Acceptance Criteria
- [ ] `GET /api/student/exams/:code` (công khai, có rate-limit): chuẩn hóa mã (bỏ khoảng trắng, không phân biệt hoa thường, nhận cả đường dẫn/link dán vào); trả `{ title, subject, durationMinutes, ready }` **không PII**; mã sai -> 404 "Không tìm thấy bài thi".
- [ ] `POST /api/student/enter { examCode, studentCode }` (công khai): kiểm tuần tự **mã bài thi -> trường bị khóa -> mã học sinh thuộc trường của bài thi và đang ghi danh ở một lớp được gán bài thi (BR-014, FR-040)**. Mã học sinh sai, mã đã bị vô hiệu/đã xóa dữ liệu, hoặc học sinh không thuộc lớp được gán đều trả **cùng một thông điệp** "Mã học sinh không đúng hoặc không thuộc lớp được gán" (không lộ tồn tại); trường khóa -> "Trường đã bị khóa"; đề chưa gán lớp nào -> "Bài thi chưa sẵn sàng". Thành công đặt cookie `quiq_stu` và trả `{ resumeAttemptId | null, classStatus }`; có token hợp lệ cùng học sinh thì **dùng lại** phiên (không đổi máy); không token mà đang có phiên khác -> **đổi máy** do core xử lý (máy cũ bị đẩy, ghi `takeover_logs`).
- [ ] Rate-limit chống dò: theo IP và theo (IP, mã bài thi): vượt ngưỡng -> 429 `RATE_LIMITED` kèm số giây ("Bạn thử quá nhiều lần, thử lại sau X giây"); đăng nhập đúng không tính. Học sinh lớp **khác** nhập mã bài thi bị chặn ở mọi nhánh (test chéo lớp, chéo trường).
- [ ] `GET /api/student/waiting-room` (cần phiên học sinh): trả `{ exam { title, subject, code, durationMinutes, totalQuestions }, student { fullName, studentCode, className }, classStatus (assigned|dispatched|closed), attemptsUsed, maxAttempts (snapshot nếu đã phát, quy chế hiện hành nếu chưa), warnLimit, hasCompleted, inProgressAttemptId, lastCompletedAttemptId, lastAttemptId, canStart, blockReason? }` với `blockReason` thuộc `NOT_DISPATCHED | CLASS_CLOSED | NO_ATTEMPTS_LEFT | ALREADY_COMPLETED | SCHOOL_LOCKED`; mỗi lần gọi cập nhật presence (hợp lệ 15 giây) và kiểm tra lười attempt đang chạy (`reconcileAttempt`, gián đoạn quá ngưỡng thì chuyển `interrupted` rồi cho phép quay lại phòng chờ). Là điểm được gọi mỗi 5 giây (`HEARTBEAT_INTERVAL_MS`).
- [ ] Phiên bị thu hồi do đổi máy trả 401 `SESSION_KICKED`; phòng chờ **không khóa mã** (ghi test: học sinh ở phòng chờ bị đẩy không mất lượt, `takeover_logs` có 1 dòng).
- [ ] `POST /api/student/leave`: thu hồi phiên (`left`), xóa presence; idempotent.
- [ ] Mọi route khai metadata (`scope: 'public'` cho `exams/:code` và `enter`, `scope: 'student'` cho `waiting-room`/`leave`, `params` đúng); phản hồi **không bao giờ** có đáp án đúng hay PII của học sinh khác.
- [ ] Test PASS (PGlite): từng AC trên, gồm mã vô hiệu cùng thông điệp, rate-limit bằng đồng hồ giả, lớp chưa phát/đã thu bài, đổi máy từ phòng chờ.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/student-entry/index.ts`
- `packages/shared/src/student-entry/schemas.ts`
- `packages/shared/src/student-entry/errors.ts`
- `apps/api/src/modules/student-entry/routes.ts`
- `apps/api/src/modules/student-entry/service.ts`
- `apps/api/src/modules/student-entry/waiting-room.ts`
- `apps/api/src/modules/student-entry/code-normalize.ts`
- `apps/api/src/modules/student-entry/student-entry.test.ts`
- `apps/api/src/modules/student-entry/waiting-room.test.ts`

## Notes
- **Risk:** đỏ (endpoint công khai, chống dò mã, ranh giới lớp/trường, đẩy máy; reviewer STRICT, checklist `skills/security`). Không migration.
- Rủi ro đã được chủ dự án chấp nhận: lộ mã bài thi cho phép đẩy học sinh ra; thiết kế giảm nhẹ bằng rate-limit, ghi `takeover_logs` và yêu cầu mã bài thi trước mã học sinh (FR-043).
- Mã học sinh trong cookie/phiên không bao giờ nằm trong URL; link `/thi/<code>` chỉ chứa mã bài thi.
- Cookie khác học sinh: đăng nhập học sinh B trên trình duyệt đang giữ cookie của A tạo phiên mới cho B và không thu hồi phiên A (A vẫn có thể đang thi ở máy này tab khác; xem Notes L5-01).
