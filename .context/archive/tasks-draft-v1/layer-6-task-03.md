# Task 03: API làm bài (bắt đầu, tải đề, lưu đáp án, heartbeat, vi phạm, nộp, kết quả, xem đáp án, ảnh)

## Layer
6

## Type
build

## Description
Các route HTTP của học sinh trong lúc thi, mỏng, gọi xuống `student-core` (L5-01): **bắt đầu**, **tải đề** (không có đáp án đúng), **lưu từng câu**, **heartbeat 5 giây**, **ghi vi phạm**, **nộp**, **trang kết quả** (điểm lần vừa làm), **"Xem đáp án"** (chỉ khi đã công bố) và **proxy ảnh** cho học sinh (FR-036, 041, 042, 044, 045, 046, 047, 021). Gồm DTO `@quiq/shared/student-exam`, module api `student-exam`.

## Dependencies
- layer-5-task-01 (toàn bộ hàm runtime: `startAttempt`, `getAttemptPayload`, `saveAnswer`, `heartbeat`, `recordViolation`, `submit`, `reconcileAttempt`, `studentAuth`)
- layer-4-task-01 (bản sao đề, ảnh đề)
- layer-3-task-06 (`streamMedia`)
- layer-1-task-05 (`visibleScoreForStudent`)
- layer-1-task-03 (mã lỗi, hằng số, enum)
- layer-2-task-01 (`createTestApp`, `loginStudent`)

## Acceptance Criteria
- [ ] Mọi route yêu cầu phiên học sinh (`scope: 'student'`); phiên bị đẩy máy -> 401 `SESSION_KICKED`; attempt không thuộc học sinh/phiên này -> 404 (chéo học sinh, chéo lớp, chéo trường).
- [ ] `POST /api/student/attempts` (bắt đầu): kết quả của `startAttempt`; lỗi nghiệp vụ trả mã tiếng Việt rõ ràng (`NOT_DISPATCHED`, `CLASS_CLOSED`, `NO_ATTEMPTS_LEFT`, `ALREADY_COMPLETED`, `ATTEMPT_IN_PROGRESS` trả luôn attempt đang chạy); response gồm `attemptId`, `attemptNo`, `maxAttempts`, `warnLimit`, `endsAt`, `serverNow` (client chỉ đếm lùi từ `endsAt`, FR-041).
- [ ] `GET /api/student/attempts/current` và `GET /api/student/attempts/:id`: đề theo thứ tự câu/đáp án riêng, đáp án đã chọn, `endsAt`, `serverNow`, số vi phạm; **không có `is_correct` hoặc bất kỳ chỉ dấu đáp án đúng nào** (test duyệt toàn bộ JSON, kể cả khi câu nhiều đáp án); attempt đã kết thúc trả `{ status }` kèm cách điều hướng (kết quả/gián đoạn).
- [ ] `PUT /api/student/attempts/:id/answers/:examQuestionId { selectedOptionIds }` (FR-042): lưu ngay, cho đổi đến lúc nộp; quá `ends_at` + 3 giây hoặc đã kết thúc -> `{ status: 'finished' }` không ghi; lựa chọn không thuộc câu -> 400.
- [ ] `POST /api/student/attempts/:id/heartbeat { pending? }` (FR-045): cập nhật heartbeat, lưu các đáp án chờ gửi (hàng đợi sau khi mất mạng), trả `{ status: 'ok' | 'finished', endsAt, serverNow, violationCount }`; hết giờ -> tự nộp và trả `finished`.
- [ ] `POST /api/student/attempts/:id/violations { kind }` (FR-044, BR-009): `kind` thuộc `tab_hidden|fullscreen_exit|window_blur`; trả `{ count, limit, autoSubmitted }`; vượt ngưỡng snapshot -> tự nộp và `finished`; bộ đếm do **máy chủ** giữ (client không gửi số đếm).
- [ ] `POST /api/student/attempts/:id/submit`: nộp bài (idempotent: nộp lại trả cùng kết quả); sau hạn trả `finished`.
- [ ] `GET /api/student/attempts/:id/result` (FR-046, C-07): attempt `completed` (mọi lý do gồm `submitted|timeout|violation|collected`) trả `{ score (2 chữ số), correctCount, totalCount, endReason, attemptNo, hasMoreAttempts: false }` ngay; attempt `interrupted` **không trả điểm** mà trả `{ status: 'interrupted', attemptsLeft, canRetry }` (FR-045); `in_progress` -> 409.
- [ ] `GET /api/student/attempts/:id/solution` (FR-047): luôn gọi được, nhưng chưa có `answers_published_at` của lớp -> 403 `ANSWERS_NOT_PUBLISHED` "Giáo viên chưa công bố đáp án" và **không lộ dữ liệu**; đã công bố và attempt `completed` -> trả đề theo thứ tự gốc kèm đáp án đúng, **không trả câu đã chọn**; attempt `interrupted`/`in_progress` -> 403. Đây là đường duy nhất xem đáp án (test quét `listRoutes`: không route học sinh nào khác trả `is_correct`).
- [ ] `GET /api/student/media/:id`: chỉ phát ảnh thuộc đề của lớp/bài thi mà phiên đang tham gia (attempt `in_progress` hoặc `completed` của đúng học sinh), `nosniff`, `Cache-Control: private`; ảnh khác -> 404.
- [ ] Mọi route khai metadata (`scope: 'student'`, `roles: 'student'`, `params` entity `attempt`/`media`); test PASS (PGlite + đồng hồ giả): luồng đầy đủ bắt đầu -> lưu -> heartbeat -> vi phạm -> nộp -> kết quả -> xem đáp án; vi phạm vượt ngưỡng; hết giờ; gián đoạn rồi làm lại giữ bộ câu, đảo thứ tự; học sinh khác không đọc được attempt; chưa công bố không lộ đáp án.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/student-exam/index.ts`
- `packages/shared/src/student-exam/schemas.ts`
- `packages/shared/src/student-exam/errors.ts`
- `apps/api/src/modules/student-exam/routes.ts`
- `apps/api/src/modules/student-exam/service.ts`
- `apps/api/src/modules/student-exam/result.ts`
- `apps/api/src/modules/student-exam/solution.ts`
- `apps/api/src/modules/student-exam/media.ts`
- `apps/api/src/modules/student-exam/student-exam.test.ts`
- `apps/api/src/modules/student-exam/solution-gating.test.ts`
- `apps/api/src/modules/student-exam/no-answer-leak.test.ts`

## Notes
- **Risk:** đỏ (không lộ đáp án trong lúc thi, chống gian lận, quyền theo attempt; reviewer STRICT, checklist `skills/security`). Không migration.
- Route mỏng: mọi quy tắc nằm ở `student-core`; nếu thiếu hàm ở core thì ghi "cần change" cho L5-01, không viết logic song song ở đây.
- Giờ máy chủ là nguồn sự thật; client chỉ hiển thị. `serverNow` cho client hiệu chỉnh lệch đồng hồ.
- Lỗi tiếng Việt nhất quán với design-spec §5 và §6.
