# Task 05: Exam engine thuần hàm (chấm điểm, trộn, rút đề, máy trạng thái attempt)

## Layer
1

## Type
build

## Description
Package `@quiq/engine`: toàn bộ logic nghiệp vụ thi viết **thuần hàm, không I/O, không DB, không thời gian hệ thống** (nguồn ngẫu nhiên và thời gian được tiêm vào) để test ngặt nghèo và để api (L5-01, L4-01) chỉ việc gọi. Gồm chấm điểm tập-bằng-nhau, làm tròn 2 chữ số, trộn câu và đáp án, rút đề theo mức khó, máy trạng thái attempt, điều kiện bắt đầu làm bài, điểm chính thức.

Engine tự khai kiểu cục bộ (không import `@quiq/shared`/`@quiq/db`); giá trị literal của enum phải khớp `@quiq/shared` (L1-03) để dùng được theo cấu trúc.

## Dependencies
- layer-0-task-01 (package `@quiq/engine` rỗng, vitest)

## Acceptance Criteria
- [ ] `gradeQuestion(correctOptionIds, selectedOptionIds): boolean` đúng khi **tập chọn == tập đáp án đúng** (FR-051): chọn đúng một phần = sai, chọn thừa = sai, bỏ trống = sai, trùng lặp trong lựa chọn không làm đổi kết quả, id lạ = sai. Test các trường hợp: 1 đáp án; nhiều đáp án đủ/thiếu/thừa; rỗng; trùng.
- [ ] `roundScore(correct, total): number` = (correct / total) x 10 làm tròn **half-up** 2 chữ số bằng số nguyên (không dùng `toFixed`), `total = 0` trả 0. Test: 1/3 -> 3.33, 2/3 -> 6.67, 1/6 -> 1.67, 5/16 -> 3.13, 10/10 -> 10, 0/7 -> 0, các biên 1/8 -> 1.25 (FR-050, BR-008).
- [ ] `gradeAttempt({ questions: [{ id, correctOptionIds }], answers: Record<questionId, optionId[]> })` trả `{ correctCount, totalCount, score, perQuestion: { id, correct }[] }`; câu không có trong `answers` tính sai.
- [ ] `shuffle(items, rng)` Fisher-Yates không đổi mảng gốc, hoán vị đúng (cùng tập phần tử); `buildAttemptOrder({ questionIds, optionIdsByQuestion, rng, keepQuestionSet })` trả `{ questionOrder, optionOrder }` (mỗi câu có thứ tự đáp án riêng); có hàm `mapOrderedToOriginal` chứng minh chấm theo id gốc nên đúng dù thứ tự bị trộn (FR-036). Test với RNG giả cố định và test thống kê nhẹ (nhiều lần chạy, mọi vị trí đều xuất hiện).
- [ ] `Rng` interface (`nextInt(maxExclusive)`), `cryptoRng` (dùng `node:crypto.randomInt`), `seededRng(seed)` cho test.
- [ ] `drawQuestions({ pool: [{ id, difficulty }], config: { total, easy, medium, hard }, rng })`: kiểm `easy + medium + hard === total` (nếu không ném `InvalidDrawConfigError`), rút đúng số lượng mỗi mức không trùng, thiếu ở **bất kỳ** mức nào ném `InsufficientQuestionsError` mang danh sách `{ difficulty, need, have }` (FR-030) để tầng trên báo "Ngân hàng chỉ có 8 câu Khó, cần 10"; không rút gì nếu có lỗi.
- [ ] Máy trạng thái `transitionAttempt(status, event)` với `event` thuộc `submit | timeout | violation_exceeded | collect | takeover | heartbeat_lost`: từ `in_progress` -> `completed` (end_reason `submitted|timeout|violation|collected`) hoặc -> `interrupted` (`takeover|heartbeat_lost`); từ trạng thái kết thúc mọi event ném `InvalidTransitionError`; bảng chuyển trạng thái có test đầy đủ (BR-001: bài đã kết thúc không đổi).
- [ ] `canStartAttempt({ classStatus, attempts: [{ status }], maxAttempts, hasInProgressElsewhere })` trả `{ ok: true }` hoặc `{ ok: false, reason }` với `reason` thuộc `NOT_DISPATCHED | CLASS_CLOSED | ALREADY_COMPLETED | NO_ATTEMPTS_LEFT | HAS_IN_PROGRESS`; số lượt đã dùng **tính cả attempt `interrupted`**; đã có `completed` thì không làm lại (BR-005, C-02).
- [ ] `isExpired(now, endsAt)`, `isWithinSubmitGrace(now, endsAt, graceMs)` (dung sai 3000 ms), `isHeartbeatLost(lastHeartbeatAt, now, interruptSecs)` (so sánh thời gian theo mili giây, biên đúng bằng ngưỡng chưa tính mất), `violationOutcome(newCount, warnLimit)` trả `warn` khi `newCount <= warnLimit` và `auto_submit` khi vượt (warnLimit = 2: lần 1,2 cảnh báo, lần 3 tự nộp; FR-044, BR-009).
- [ ] `officialScore(attempts: [{ status, score | null }])` = max điểm của các attempt đã chấm (completed hoặc interrupted có điểm), `null` nếu chưa có; `visibleScoreForStudent(attempt)` trả `null` cho attempt `interrupted` (học sinh không thấy điểm lần gián đoạn, FR-045).
- [ ] `computeAttemptEndsAt(startedAt, durationMinutes)` và `collectDecision(attempts)` (thu bài: `in_progress` -> nộp; `interrupted` giữ điểm cao nhất, FR-034).
- [ ] Mọi hàm có kiểu chặt, không phụ thuộc `Date.now()`/`Math.random()` (có test lint đơn giản quét mã nguồn không chứa hai lời gọi này); độ phủ dòng của package >= 95%.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/engine/src/index.ts` (thay stub)
- `packages/engine/src/types.ts`
- `packages/engine/src/rng.ts`
- `packages/engine/src/scoring.ts`
- `packages/engine/src/shuffle.ts`
- `packages/engine/src/draw.ts`
- `packages/engine/src/attempt-machine.ts`
- `packages/engine/src/timing.ts`
- `packages/engine/src/official-score.ts`
- `packages/engine/src/scoring.test.ts`
- `packages/engine/src/shuffle.test.ts`
- `packages/engine/src/draw.test.ts`
- `packages/engine/src/attempt-machine.test.ts`
- `packages/engine/src/timing.test.ts`
- `packages/engine/src/official-score.test.ts`

## Notes
- **Risk:** đỏ (chấm sai điểm hoặc cho làm lại sai là lỗi nghiệp vụ nặng; reviewer STRICT, đối chiếu từng case với FR-050/051, BR-005/008/009).
- Không phụ thuộc dependency runtime nào ngoài `node:crypto`; không import package nội bộ khác.
- Kết quả rút đề là danh sách id; việc sao chép nội dung vào `exam_questions/options` thuộc L4-01 (transaction).
- Lý do tính cả `interrupted` vào số lượt: C-02/BR-005 (đẩy máy hay gián đoạn đều mất 1 lượt, kể cả lượt cuối).
- Ví dụ làm tròn để reviewer kiểm: 2/3 x 10 = 6.666... -> 6.67; 1/16 x 10 = 0.625 -> 0.63 (half-up).
