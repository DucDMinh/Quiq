# Task 03: packages/shared nền (zod, envelope, mã lỗi tiếng Việt, enum, hằng số, sự kiện realtime)

## Layer
1

## Type
build

## Description
Dựng phần nền của `@quiq/shared`: schema zod nền và thông báo lỗi zod bằng tiếng Việt, kiểu envelope phản hồi, **danh mục mã lỗi + thông báo tiếng Việt** có cơ chế `defineErrors()` để mỗi domain tự đăng ký lỗi riêng (không sửa file chung), enum trạng thái, hằng số kỹ thuật (heartbeat 5 giây, sweeper 10 giây, dung sai 3 giây, presence 15 giây), giới hạn upload, và định nghĩa sự kiện realtime cho SSE. Package dùng **subpath exports** (`@quiq/shared`, `@quiq/shared/<domain>`) đã khai ở L0-01, nên các task sau chỉ thêm thư mục domain của mình, không sửa barrel.

## Dependencies
- layer-0-task-01 (manifest `@quiq/shared`, `exports` subpath, stub `src/common/index.ts`)

## Acceptance Criteria
- [ ] `src/common/enums.ts` xuất kiểu + mảng hằng + schema zod cho: `Role` (`super_admin|school_admin|teacher`), `SchoolStatus` (`active|locked`), `Difficulty` (`easy|medium|hard`), `ExamClassStatus` (`assigned|dispatched|closed`), `AttemptStatus` (`in_progress|completed|interrupted`), `AttemptEndReason` (`submitted|timeout|violation|collected|takeover|heartbeat_lost`), `ViolationKind` (`tab_hidden|fullscreen_exit|window_blur`), `StudentRosterState` (`not_started|waiting|in_progress|submitted`) kèm cờ gián đoạn; giá trị literal khớp enum ở `@quiq/engine`/`@quiq/db`.
- [ ] `src/common/labels.ts` có nhãn tiếng Việt cho mọi enum (vd Difficulty: Dễ / Trung bình / Khó; ExamClassStatus: Chưa phát đề / Đã phát đề / Đã thu bài; AttemptEndReason: Đã nộp bài / Hết giờ / Vi phạm quy chế / Giáo viên thu bài / ...). Không em-dash trong mọi chuỗi.
- [ ] `src/common/errors.ts`: `ErrorSpec = { status, code, message }`, `defineErrors(prefix?, map)` trả về đối tượng `{ KEY: ErrorSpec }` và **ném lỗi khi trùng `code`** trên toàn bộ registry (có test). Danh mục chung: `INVALID_JSON` 400, `VALIDATION_FAILED` 400 (kèm `details` theo trường), `UNAUTHENTICATED` 401, `SESSION_EXPIRED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `UNPROCESSABLE` 422, `RATE_LIMITED` 429, `INTERNAL_ERROR` 500, `SCHOOL_LOCKED` 403; thông báo tiếng Việt thân thiện (vd "Phiên đăng nhập đã hết hạn", "Bạn thử quá nhiều lần, thử lại sau {n} giây" qua hàm định dạng).
- [ ] `src/common/envelope.ts`: kiểu `ApiSuccess<T>`, `ApiFailure`, `ApiResponse<T>` và schema zod `apiEnvelope(dataSchema)`; khớp `ok()/fail()` của L1-01 (`{ success, data | error:{code,message}, details }`).
- [ ] `src/common/zod.ts`: `setVietnameseZodErrorMap()` (áp dụng toàn cục khi import) cho các lỗi phổ biến (bắt buộc, quá ngắn/dài, sai định dạng, số không hợp lệ); helper `trimmedString(min,max)`, `uuidSchema`, `usernameSchema` (3-50 ký tự, chữ thường/số/`._-`), `passwordSchema` (>= 8 ký tự), `studentCodeSchema`, `examCodeSchema`, `paginationSchema` (`page`, `pageSize` mặc định 25, tối đa 100) và kiểu `Paginated<T>`.
- [ ] `src/common/constants.ts`: `HEARTBEAT_INTERVAL_MS = 5000`, `SWEEPER_INTERVAL_MS = 10000`, `SUBMIT_GRACE_MS = 3000`, `WAITING_PRESENCE_MS = 15000`, `SESSION_TTL_MS` (8 giờ, trượt), `STUDENT_SESSION_TTL_MS` (hợp lý, ghi lý do), `DEFAULT_SCHOOL_SETTINGS = { maxAttempts: 3, warnLimit: 2, interruptSecs: 60 }`, `MIN_INTERRUPT_SECS` (vd 15) và giới hạn trên/dưới cho 3 thiết lập, `MEDIA_MAX_BYTES = 2 * 1024 * 1024`, `MEDIA_ALLOWED_MIME`, `QUESTION_OPTIONS_MIN/MAX = 2/4`, `EXAM_CODE_ALPHABET` (bỏ ký tự dễ nhầm 0/O/1/I/L), `EXAM_CODE_LENGTH`.
- [ ] `src/realtime/index.ts` (+ `events.ts`): hàm `examChannel(examId, classId)` trả `exam:<examId>:class:<classId>`; kiểu + schema zod cho các sự kiện `roster.snapshot`, `student.waiting`, `student.started`, `student.submitted`, `student.interrupted`, `student.violation`, `class.status` (payload nêu rõ `studentId`, `attemptId?`, `state`, `interrupted?`, `at`); `isRealtimeEvent()` type guard.
- [ ] Domain `auth` (hợp đồng dùng chung của L2-01 và L2-02, nên đặt ở layer này để hai task L2 độc lập): `src/auth/schemas.ts` (`loginRequestSchema { username, password }`, `meResponseSchema { id, username, fullName, role, school: { id, name, status } | null, subject: { id, name } | null }`), `src/auth/errors.ts` (`INVALID_CREDENTIALS` 401 "Tên đăng nhập hoặc mật khẩu không đúng" không tiết lộ ô nào sai, `ACCOUNT_DISABLED` 403, `SCHOOL_LOCKED_LOGIN` 403 "Trường của bạn đang bị khóa. Liên hệ quản trị hệ thống.", `LOGIN_RATE_LIMITED` 429), `src/auth/index.ts` kèm `landingPathForRole(role)` (`super_admin` -> `/admin-tong/thong-ke`, `school_admin` -> `/quan-tri/mon-hoc`, `teacher` -> `/giao-vien/ngan-hang`).
- [ ] Cấu trúc thư mục sẵn cho domain khác: có `README.md` ngắn trong package nêu quy tắc subpath (mỗi domain `src/<domain>/{index,schemas,errors}.ts`, không sửa `common`), kèm test chứng minh import `@quiq/shared/realtime` hoạt động.
- [ ] Test PASS: trùng mã lỗi bị chặn, thông báo zod tiếng Việt, `paginationSchema`, `examChannel`, envelope round-trip, không chuỗi nào chứa em-dash (quét các file trong `src`).

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/common/index.ts` (thay stub)
- `packages/shared/src/common/enums.ts`
- `packages/shared/src/common/labels.ts`
- `packages/shared/src/common/errors.ts`
- `packages/shared/src/common/envelope.ts`
- `packages/shared/src/common/zod.ts`
- `packages/shared/src/common/constants.ts`
- `packages/shared/src/auth/index.ts`
- `packages/shared/src/auth/schemas.ts`
- `packages/shared/src/auth/errors.ts`
- `packages/shared/src/realtime/index.ts`
- `packages/shared/src/realtime/events.ts`
- `packages/shared/README.md`
- `packages/shared/src/common/common.test.ts`
- `packages/shared/src/realtime/realtime.test.ts`
- `packages/shared/src/auth/auth.test.ts`

## Notes
- **Risk:** vàng (hợp đồng dùng chung cho cả web và api). Không có migration.
- Sau task này **không task nào được sửa `src/common/*`**; nếu cần thêm hằng/lỗi chung phải thêm vào domain của mình. Đây là điều kiện để L3/L7 chạy song song không trùng file.
- `defineErrors` dùng prefix để tránh trùng mã giữa domain (vd `SUBJECT_IN_USE`). Mã lỗi viết hoa, ổn định (client có thể rẽ nhánh theo mã).
- Mã lỗi phục vụ UI: client chỉ hiển thị `message` từ server, không tự dịch.
- Mọi thông báo cho học sinh nên trung tính, không lộ tồn tại dữ liệu (vd mã sai và mã vô hiệu dùng cùng một thông điệp, xem design-spec §4.1).
- Hằng `DEFAULT_SCHOOL_SETTINGS` phải khớp default trong schema DB (L1-04): 3, 2, 60.
