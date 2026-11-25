# Task 02: Exam engine (chấm điểm, trộn, rút đề, tính trạng thái) thuần hàm

## Layer
1

## Type
build (initial)

## Description
`packages/engine`: các hàm thuần (không DB, không HTTP, không `Date.now()` trực tiếp) mà cả giáo viên và học sinh dùng. Đây là lõi nghiệp vụ nên làm đúng và test kỹ ngay từ demo.

Hàm cần có:
- **Chấm điểm** (FR-050, FR-051, BR-008): `isQuestionCorrect(correctIds, selectedIds)` đúng khi hai tập **bằng nhau** (đúng một phần = sai, bỏ trống = sai); `scoreAttempt(questions, answers)` trả `{correct, total, score}` với `score = round(correct/total*10, 2)`; `officialScore(scores[])` = cao nhất.
- **Trộn** (FR-036): `shuffleAttempt(questions, rng)` trả `{questionOrder, optionOrders}`; `rng` tiêm được để test xác định; có hàm ánh xạ lại về đáp án gốc.
- **Rút đề** (FR-030): `drawQuestions(bank, {total, easy, medium, hard}, rng)` rút ngẫu nhiên đúng số câu theo mức; thiếu câu ở **bất kỳ** mức nào thì trả lỗi có dữ liệu `{difficulty, have, need}` (không ném chuỗi trần); kiểm `easy+medium+hard === total`.
- **Thời gian/trạng thái** (FR-041): `computeEndsAt(startedAt, minutes)`, `remainingSeconds(endsAt, now)`, `isExpired(endsAt, now, graceSeconds=3)`, `canStartAttempt({classStatus, usedAttempts, maxAttempts, hasCompleted, hasInProgress})` trả `{ok:true}` hoặc `{ok:false, reason}` với `reason` thuộc: `not_dispatched | closed | max_attempts | already_completed | in_progress_elsewhere`.

## Dependencies
- layer-0-task-01 (package và cấu hình test)

## Acceptance Criteria
- [ ] Chấm: câu 1 đáp án đúng; câu nhiều đáp án chọn đủ, thiếu, thừa, rỗng, chọn id không thuộc câu; điểm làm tròn 2 chữ số (ví dụ 7/9 → 7.78); tổng 0 câu không chia cho 0 (ném lỗi rõ).
- [ ] Trộn: hoán vị hợp lệ (đủ phần tử, không trùng), cùng `rng` cùng kết quả, hai lần gọi với rng khác cho thứ tự khác; ánh xạ về đáp án gốc cho điểm giống nhau sau khi trộn.
- [ ] Rút đề: đúng tổng và đúng từng mức; không trùng câu; thiếu câu Khó trả lỗi `{difficulty:'hard', have:8, need:10}`; ngân hàng nhiều hơn cần thì chọn ngẫu nhiên thật (test thống kê nhẹ hoặc rng giả).
- [ ] `canStartAttempt`: đủ 5 lý do trên; demo dùng `maxAttempts=1` nhưng hàm đúng cho giá trị bất kỳ.
- [ ] Đồng hồ: `isExpired` đúng quanh biên (`ends_at`, `ends_at+3s`); thời gian luôn là tham số, không đọc đồng hồ hệ thống.
- [ ] Không phụ thuộc runtime nào (chạy được trong Node thuần); xuất kiểu TypeScript đầy đủ; coverage hàm quan trọng ≥ 90% theo test.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/engine/src/index.ts`, `packages/engine/src/grade.ts`, `packages/engine/src/grade.test.ts`
- `packages/engine/src/shuffle.ts`, `packages/engine/src/shuffle.test.ts`
- `packages/engine/src/draw.ts`, `packages/engine/src/draw.test.ts`
- `packages/engine/src/attempt-state.ts`, `packages/engine/src/attempt-state.test.ts`
- `packages/engine/src/types.ts`

## Notes
- Engine tự khai kiểu cục bộ (cấu trúc tương thích với kiểu của db/shared) để không phụ thuộc chéo gói; adapter ở tầng api.
- Dùng `crypto.randomInt`/`webcrypto` làm rng mặc định, không `Math.random`.
- Các tính năng sau (heartbeat, gián đoạn, vi phạm) sẽ thêm hàm vào cùng package ở layer của chúng.
- Risk: trung bình (logic điểm). Reviewer NORMAL, mở rộng STRICT cho phần chấm điểm.
