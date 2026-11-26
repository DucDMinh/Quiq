# Task 01: Student runtime core (phiên học sinh, vòng đời attempt, chấm điểm, sweeper, thu bài, chấm lại)

## Layer
5

## Type
build

## Description
Lõi nghiệp vụ lúc thi, **không có route công khai** (các route nằm ở L6). Gom MỌI logic kết thúc/biến đổi attempt vào một chỗ để các task sau chỉ gọi xuống: phiên học sinh `quiq_stu` + **đẩy máy** (takeover), bắt đầu attempt (có xáo câu/đáp án), lưu đáp án, heartbeat, ghi vi phạm + tự nộp, nộp bài, **`finalizeAttempt`/`interruptAttempt`** (chấm và lưu điểm), kiểm tra lười khi quay lại, **sweeper 10 giây** (hết giờ + gián đoạn theo ngưỡng snapshot), **thu bài** theo lớp, **chấm lại** theo đề, presence phòng chờ, và middleware `studentAuth`. Phát sự kiện SSE qua hub.

## Dependencies
- layer-1-task-05 (engine: chấm, trộn, state machine, `canStartAttempt`, thời gian)
- layer-1-task-04 (bảng `student_sessions`, `waiting_presence`, `attempts`, `attempt_answers`, `violation_logs`, `takeover_logs`, ràng buộc một in_progress, fixtures)
- layer-1-task-01 (SSE hub, Clock, rate-limit, `AppDeps`)
- layer-1-task-03 (hằng số, enum, `examChannel`, sự kiện realtime)
- layer-2-task-01 (`deps.studentAuth` hook, `createTestApp`, `SESSION_SECRET`)
- layer-4-task-01 (bài thi + `exam_classes` để dựng fixture đầy đủ)

## Acceptance Criteria
- [ ] **Phiên học sinh** (FR-040, FR-043, BR-004): `createOrResumeSession` sinh token 32 byte, lưu HMAC với `SESSION_SECRET`, cookie `quiq_stu` (HttpOnly, SameSite=Lax); còn token hợp lệ cùng học sinh -> **dùng lại** (làm tiếp, không mất lượt, C-13). Không có token mà học sinh đang có phiên hoạt động -> **đổi máy**: trong **một transaction** thu hồi phiên cũ (`revoked_reason = takeover`), nếu phiên cũ có attempt `in_progress` thì **`interruptAttempt`** (chấm theo câu đã chọn, `end_reason = takeover`, **mất 1 lượt kể cả lượt cuối**, C-02), ghi `takeover_logs` (thời điểm, **mã học sinh**, id phiên cũ/mới, attempt bị ngắt); nếu mới ở phòng chờ (không có attempt) thì **không tốn lượt**, chỉ ghi `takeover_logs`. Hai lần đổi máy đồng thời: chỉ một phiên thắng nhờ ràng buộc DB (test song song).
- [ ] `studentAuth` (gán vào `deps.studentAuth` trong `server.ts` và `createTestApp`): đọc cookie `quiq_stu`, kiểm hết hạn/thu hồi; phiên bị thu hồi do takeover trả 401 `SESSION_KICKED` ("Mã của bạn vừa được dùng ở thiết bị khác"), thu hồi vì lý do khác trả 401 `SESSION_ENDED`; đặt `ctx.state.student = { sessionId, studentId, schoolId, examId, examClassId }`; phiên được giữ trong DB (đã thu hồi) đủ lâu để phân biệt kicked.
- [ ] **`startAttempt`** (FR-033, FR-036, FR-041, FR-045, BR-005..007): dùng `canStartAttempt` với **snapshot** của `exam_classes` (`max_attempts` đếm cả `interrupted`); từ chối: chưa phát đề, lớp đã thu bài, đã có `completed`, hết lượt, trường bị khóa; tạo attempt với `ends_at = now + duration` (giờ máy chủ), `question_order`/`option_order` riêng (lần 1: xáo bộ câu của đề; lần làm lại: **giữ nguyên bộ câu, đảo lại thứ tự câu và đáp án**), `total_count`; xóa presence phòng chờ; double-click/hai request đồng thời chỉ tạo **một** attempt (ràng buộc DB).
- [ ] `getAttemptPayload`: câu hỏi theo `question_order`, đáp án theo `option_order`, ảnh dạng đường dẫn proxy, các câu đã chọn; **không có `is_correct`/đáp án đúng ở bất kỳ khóa nào** (kiểu trả về không chứa trường đó và test duyệt toàn bộ JSON; NFR Security).
- [ ] `saveAnswer` (FR-042): chấp nhận khi attempt `in_progress` và `now <= ends_at + 3 giây`; lựa chọn phải thuộc đáp án của câu đó (nếu không 400); ghi đè lần sau thắng; sau hạn trả trạng thái `finished` (không ghi). Cho phép đổi đáp án đến lúc nộp.
- [ ] `heartbeat` (FR-045, FR-043): cập nhật `last_heartbeat_at`; trả `{ status: 'ok' | 'finished', endsAt, violationCount, warnLimit }`; hết giờ thì finalize `timeout` ngay; nhận kèm đáp án chưa lưu (hàng đợi) và lưu theo quy tắc `saveAnswer`.
- [ ] `recordViolation` (FR-044, BR-009): máy chủ **tăng bộ đếm** trong transaction, ghi `violation_logs` (loại, thời điểm, `count_after`), dùng `violationOutcome` với `warn_limit` snapshot: `warn` hoặc **tự nộp** (`end_reason = violation`, `caused_auto_submit`); bộ đếm tính riêng từng attempt (làm lại đếm từ 0); gọi sau khi đã kết thúc không đổi gì.
- [ ] `submit` và `finalizeAttempt(attemptId, reason)` (FR-050, FR-051, BR-001): chấm bằng `gradeAttempt` với đáp án đúng đọc từ `exam_options` **bản sao của đề**; lưu `correct_count`, `score` (2 chữ số), `graded_at`, `finished_at`, `status`, `end_reason`; chỉ chuyển từ `in_progress` (`UPDATE ... WHERE status = 'in_progress' RETURNING`), nên **idempotent** và an toàn khi sweeper/nộp/thu bài chạy đồng thời (test cạnh tranh); bài đã kết thúc không bao giờ đổi lựa chọn. Attempt `interrupted` **được chấm ngay** nhưng `visibleScoreForStudent` trả `null`.
- [ ] **Kiểm tra lười** `reconcileAttempt(attempt, now)` khi học sinh quay lại: quá `ends_at` -> timeout; mất heartbeat quá `interrupt_secs` snapshot -> `interrupted` (`heartbeat_lost`, mất lượt); trong ngưỡng thì làm tiếp, đồng hồ không dừng (C-13).
- [ ] **Sweeper** (`sweepOnce(deps)`, `startSweeper(deps)` mỗi `SWEEPER_INTERVAL_MS`): xử lý attempt `in_progress` quá `ends_at` (timeout) và mất heartbeat quá ngưỡng snapshot (`interrupted`), mỗi attempt một transaction, lỗi một attempt hoặc một lượt **không dừng tiến trình** (log + lượt sau chạy lại, idempotent); `server.ts` khởi động sweeper và dừng khi tắt máy. Test bằng đồng hồ giả: đúng/sát ngưỡng, nhiều attempt, lỗi giữa chừng.
- [ ] **Thu bài** `collectAttempts(db, examClassId)` (FR-034): mọi attempt `in_progress` của lớp -> `completed` (`collected`), chấm ngay; attempt `interrupted` giữ nguyên điểm; trả số lượng từng loại. **Điểm chính thức** `getOfficialScore(studentId, examId)` = max các attempt đã chấm.
- [ ] **Chấm lại** `rescoreExam(db, examId)` (FR-039): chấm lại mọi attempt đã chấm của đề trong **một transaction** bằng `exam_options.is_correct` hiện tại; **không đổi** `attempt_answers` (BR-001); trả số bài được chấm lại; điểm chính thức đọc lại tự cập nhật.
- [ ] `touchWaitingPresence(examClassId, studentId, sessionId)` cập nhật `waiting_presence`; hàm `rosterState` suy ra `not_started | waiting (<= 15 giây) | in_progress | submitted` + cờ gián đoạn (dùng cho L6-02, L7-03).
- [ ] **SSE**: các thao tác trên gọi `deps.sse.publish(examChannel(examId, classId), event)` với `student.waiting`, `student.started`, `student.submitted`, `student.interrupted`, `student.violation` (payload theo `@quiq/shared/realtime`, không chứa PII ngoài `studentId`).
- [ ] Mọi test PASS bằng PGlite + đồng hồ giả: đổi máy khi ở phòng chờ/đang làm/lượt cuối, làm tiếp trong ngưỡng, quá ngưỡng, hết lượt, vi phạm vượt ngưỡng, thu bài, chấm lại, nộp hai lần, nộp sau hạn, hai request đồng thời.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/api/src/server.ts` (khởi động sweeper, gắn `studentAuth`)
- `apps/api/src/testing/app.ts` (thêm `loginStudent`, gắn `studentAuth`)
- `apps/api/src/modules/student-core/index.ts`
- `apps/api/src/modules/student-core/types.ts`
- `apps/api/src/modules/student-core/session-service.ts`
- `apps/api/src/modules/student-core/student-auth.ts`
- `apps/api/src/modules/student-core/attempt-start.ts`
- `apps/api/src/modules/student-core/attempt-runtime.ts`
- `apps/api/src/modules/student-core/attempt-payload.ts`
- `apps/api/src/modules/student-core/finalize.ts`
- `apps/api/src/modules/student-core/reconcile.ts`
- `apps/api/src/modules/student-core/sweeper.ts`
- `apps/api/src/modules/student-core/collect.ts`
- `apps/api/src/modules/student-core/rescore.ts`
- `apps/api/src/modules/student-core/presence.ts`
- `apps/api/src/modules/student-core/events.ts`
- `apps/api/src/modules/student-core/session.test.ts`
- `apps/api/src/modules/student-core/attempt.test.ts`
- `apps/api/src/modules/student-core/finalize.test.ts`
- `apps/api/src/modules/student-core/sweeper.test.ts`
- `apps/api/src/modules/student-core/collect-rescore.test.ts`
- `apps/api/src/modules/student-core/concurrency.test.ts`
- `apps/api/src/modules/student-core/payload-no-answers.test.ts`

## Notes
- **Risk:** đỏ (lõi chống gian lận, chấm điểm, khóa một mã một máy, đồng thời; reviewer STRICT, đối chiếu từng case với FR-033..FR-051, BR-001/004/005/007/009; checklist `skills/security`). Không migration; cần cột mới thì ghi "cần change", không sửa schema.
- Module này **không có `routes.ts`** nên loader không đăng ký route; L6-02/L6-03 import các hàm ở `student-core/index.ts`.
- Mọi so sánh thời gian dùng `deps.clock`, không `Date.now()`.
- Học sinh không bao giờ nhận `is_correct` khi đang thi; đáp án chỉ trả sau công bố ở L6-03 (`answers_published_at` có giá trị và attempt đã `completed`).
- Hai tab cùng trình duyệt dùng chung cookie = cùng một phiên (không phải đổi máy); lần ghi sau thắng. Ghi lại trong test.
- Học sinh bị xóa dữ liệu (anonymized) hoặc trường bị khóa: `startAttempt` từ chối; attempt đang chạy được sweeper kết thúc bình thường.
