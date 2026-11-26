# API Specification (as-built): Quiq

> Overview + pointer tới source of truth. **Không chép schema tay vào đây**: chi tiết request/response lấy từ code.
> Overview này khác code → **code thắng**, sửa lại overview.
> Cập nhật lần cuối: close-out Layer 3 (2026-11-26).

## Source of truth

1. **Route thật**: `apps/api/src/modules/<module>/routes.ts` (module loader tự nạp mọi `modules/*/routes.ts`, xem `apps/api/src/modules/loader.ts`).
2. **Hợp đồng dùng chung client/server**: `packages/shared/src/<domain>/` (`schemas.ts` zod + kiểu view, `errors.ts` danh mục mã lỗi). Import bằng `@quiq/shared/<domain>`.
3. **Envelope + mã lỗi chung**: `packages/shared/src/common/envelope.ts`, `packages/shared/src/common/errors.ts`.

## Base URL

Trình duyệt chỉ gọi **same-origin** `/api/*`; Next (`apps/web/next.config.ts`) rewrite sang Koa để cookie HttpOnly đi theo.

```
Web (dev):     http://localhost:3000/api/...   → rewrite → http://localhost:4000/api/...
API trực tiếp: http://localhost:4000/api/...   (API_PORT, mặc định 4000)
```

## Envelope (bất biến)

Mọi response đi qua `ok()` / `fail()` (`apps/api/src/http/response.ts`) và `errorMiddleware`.

```jsonc
{ "success": true,  "data": <payload> }
{ "success": false, "code": "<MÃ_LỖI>", "error": "<thông điệp tiếng Việt>", "details": <tùy chọn> }
```

Lỗi validate zod → 422 `VALIDATION`, `details` chỉ có `path` + `message`. Lỗi không lường trước → 500 `INTERNAL` với thông điệp chung (không lộ stack/lỗi DB).

## Xác thực

Không dùng `Authorization: Bearer`. Hai loại phiên, đều là **cookie HttpOnly** chứa token ngẫu nhiên đục; DB chỉ lưu hash.

| Cookie | Ai | Lưu trong DB | Hạn | Code |
|---|---|---|---|---|
| `quiq_session` | Cán bộ (`super_admin`, `school_admin`, `teacher`) | bảng `sessions`, `HMAC-SHA256(SESSION_SECRET, token)` | trượt 8 giờ (`STAFF_SESSION_TTL_MS`), mỗi request hợp lệ gia hạn + gửi lại cookie | `apps/api/src/http/session-cookie.ts`, `modules/auth/service.ts` |
| `quiq_stu` | Học sinh (mã bài thi + mã học sinh) | bảng `student_sessions`, SHA-256 token | đến khi bị thu hồi (nộp/hết giờ/vào lại); chưa có TTL | `apps/api/src/modules/student/student-session.ts` |

Cờ cookie: `HttpOnly; SameSite=Lax; Path=/`. `Secure`: cán bộ theo `NODE_ENV=production`; học sinh theo `ctx.secure` (xem gap G-05).

`SESSION_SECRET` **bắt buộc** khi khởi động API (≥ 32 ký tự, `apps/api/src/config.ts`); thiếu thì API dừng với thông báo rõ, không in giá trị.

### Guard cán bộ (`apps/api/src/http/guards.ts`)

`authenticate → requireRole(...) → requireTenant` (gộp: `staffGuard(deps, roles)`).

| Tình huống | Kết quả |
|---|---|
| Không có / sai / hết hạn / đã thu hồi phiên, tài khoản vô hiệu | 401 `UNAUTHENTICATED` |
| Trường bị khóa (`status='locked'`) | 403 `SCHOOL_LOCKED` |
| Sai vai trò; `super_admin` gọi route dữ liệu trường | 403 `FORBIDDEN` |
| Tài nguyên thuộc trường khác | **404** `NOT_FOUND` (không lộ tồn tại) |

`schoolId` **chỉ** lấy từ phiên (`tenantSchoolId(ctx)`), không bao giờ từ query/body/params.

## Endpoint

### Health (`modules/health`)

| Method + path | Auth | Kết quả |
|---|---|---|
| `GET /api/health` | public | `{ status: "ok" }` |
| `GET /api/health/db` | public | 200 `{ status: "ok", db: "up" }`; DB lỗi → 503 `DB_UNAVAILABLE` (thông điệp chung, log chỉ ghi tên/mã lỗi) |

### Đăng nhập cán bộ (`modules/auth`, hợp đồng `@quiq/shared/auth`)

| Method + path | Auth | Request | 200 | Lỗi |
|---|---|---|---|---|
| `POST /api/auth/login` | public | `loginRequestSchema` `{ username, password }` | `StaffMe`, đặt `quiq_session` | 401 `INVALID_CREDENTIALS` (chung cho sai tên/sai mật khẩu/tài khoản vô hiệu), 403 `SCHOOL_LOCKED`, 422 `VALIDATION`, 429 `LOGIN_THROTTLED` (+ header `Retry-After`, `details.retryAfterSeconds`) |
| `POST /api/auth/logout` | không bắt buộc | | `{ loggedOut: true }`, thu hồi phiên + xóa cookie (idempotent) | |
| `GET /api/auth/me` | `quiq_session` | | `StaffMe` (gia hạn phiên) | 401 `UNAUTHENTICATED`, 403 `SCHOOL_LOCKED` |

- `StaffMe` = `staffMeSchema`: `id, username, displayName, role, schoolId|null, schoolName|null, subject {id,name}|null`. Không bao giờ chứa hash mật khẩu.
- **Giới hạn đăng nhập**: 5 lượt / 15 phút theo khóa `IP + username` (chữ thường, trim), cửa sổ cố định, giữ chỗ đồng bộ trước khi so mật khẩu nên request song song không vượt được; lần thứ 6 trả 429 **kể cả mật khẩu đúng**; đăng nhập đúng thì xóa bộ đếm. Bộ đếm in-memory theo tiến trình (`modules/auth/rate-limit.ts`). Xem gap G-01, G-02.
- Đăng nhập kèm cookie `quiq_session` cũ → phiên cũ bị thu hồi sau khi mật khẩu đúng; mỗi lần đăng nhập cấp token mới.
- Tên đăng nhập không tồn tại vẫn chạy scrypt trên hash giả (tính sẵn lúc khởi động) để thời gian phản hồi không lộ tài khoản.

### Học sinh thi (`modules/student`, `modules/attempts`, hợp đồng `@quiq/shared/student`)

Mã bài thi/mã học sinh chuẩn hóa bằng `normalizeExamCode` / `normalizeStudentCode` (trim, chữ hoa; mã bài thi nhận cả link dán vào) ở cả web và API.

Quyền phiên (`requireStudentSession(ctx, deps, "active" | "read")`): **hiệu lực** = phiên còn sống của đúng học sinh + đúng lớp thi; **chỉ-xem** = phiên đã thu hồi mà (a) học sinh đã nộp bài trong lớp đó, hoặc (b) lớp đã `closed` và `revoked_at >= closed_at` (phiên bị thu hồi bởi chính lần Thu bài, hoặc phiên chỉ-xem cấp khi vào lớp đã thu bài). Thiếu phiên đủ quyền → 401 `STUDENT_SESSION_REQUIRED`; phiên chỉ-xem của lớp đã thu bài gọi route cần hiệu lực → 409 `EXAM_CLOSED`.

| Method + path | Phiên cần | Request | 200/201 | Lỗi chính |
|---|---|---|---|---|
| `POST /api/student/enter` | không | `enterBodySchema` `{ examCode, studentCode }` | `{ examCode }`, đặt `quiq_stu` | 404 `EXAM_NOT_FOUND`, 404 `STUDENT_NOT_ALLOWED` (chung cho mã sai/vô hiệu/lớp khác/trường khác), 403 `SCHOOL_LOCKED`, 409 `ATTEMPT_IN_PROGRESS`, 409 `ENTER_CONFLICT` |
| `GET /api/student/state` | chỉ-xem trở lên | | `StudentStateView` (`phase: waiting \| can_start \| in_progress \| completed \| closed`, thông tin bài, `attempt`, `serverNow`) | 401 `STUDENT_SESSION_REQUIRED` |
| `POST /api/student/attempts` | hiệu lực | | 201 `ExamPaperView` | 409 `EXAM_NOT_DISPATCHED`, `EXAM_CLOSED` (lớp đã thu bài, kể cả phiên chỉ-xem), `ATTEMPT_IN_PROGRESS`, `ATTEMPT_LIMIT_REACHED`, `ATTEMPT_ALREADY_COMPLETED` |
| `GET /api/student/attempts/:id` | hiệu lực | | `ExamPaperView` (đề + đáp án đã lưu, để tải lại trang) | 404 (attempt không phải của mình), 409 `ATTEMPT_ENDED` |
| `PUT /api/student/attempts/:id/answers` | hiệu lực | `saveAnswerBodySchema` `{ questionId, optionIds }` | `SaveAnswerResult` `{ questionId, optionIds, serverNow }` | 409 `ATTEMPT_ENDED` (quá `ends_at + 3s`, tự nộp), 422 `INVALID_ANSWER` |
| `POST /api/student/attempts/:id/submit` | chỉ-xem trở lên | | `AttemptResultView` (idempotent: nộp lại không đổi điểm) | 404 |
| `GET /api/student/attempts/:id/result` | chỉ-xem trở lên | | `AttemptResultView` | 409 `ATTEMPT_NOT_FINISHED` |

Quy tắc bất biến:
- **Đề (`ExamPaperView`) không bao giờ chứa `is_correct`** hay đáp án đúng; `AttemptResultView` (`score` thang 10 hai chữ số, `correct`, `total`, `endReason`, …) không chứa câu đã chọn hay đáp án đúng. `is_correct` chỉ dùng để chấm phía server.
- `ends_at = now + số phút` theo **giờ máy chủ** (`deps.clock`); client tính đồng hồ từ `serverNow`.
- Hết giờ kiểm **lười**: mọi request sau `ends_at + 3s` tự nộp bằng các câu đã lưu.
- Vào thi khi học sinh đang có attempt `in_progress` (ở bất kỳ bài nào) mà **không** mang phiên hiệu lực của chính mình ở đúng lớp → 409 `ATTEMPT_IN_PROGRESS`, không cấp/thu hồi phiên (chưa hỗ trợ đổi máy, FR-043).
- Vào thi ở lớp **đã thu bài** → 200 nhưng chỉ cấp phiên chỉ-xem (`state` trả `phase: closed`, `closedReason: class_closed`).
- Bắt đầu khóa hàng `exam_classes` (`FOR UPDATE`) rồi mới xét trạng thái lớp, nên không thể tạo attempt sau khi lớp đã thu bài.
- A đọc/sửa/nộp attempt của B → 404.

### Giáo viên: ngân hàng câu hỏi (`modules/questions`, hợp đồng `@quiq/shared/questions`)

Mọi route: `staffGuard(deps, ["teacher"])`; lọc `school_id` (từ phiên) + `teacher_id` (chủ sở hữu) ngay trong điều kiện ghi. Câu của giáo viên khác / trường khác / id không phải uuid → 404. Môn, chủ, trường **không** nhận từ client (môn = môn cố định của giáo viên, BR-017).

| Method + path | Request | 200/201 | Lỗi |
|---|---|---|---|
| `GET /api/teacher/questions?difficulty=&page=` | `difficulty?` easy\|medium\|hard, `page?` 1..10000 | `{ subject, stats{total,easy,medium,hard} (không theo bộ lọc), items: Question[], total, page, pageSize: 25 }`, mới nhất trước | 422 `VALIDATION` |
| `POST /api/teacher/questions` | `questionInputSchema` `{ content, difficulty, multiSelect, options[{content,isCorrect}] }` (2-4 đáp án, ≥ 1 đúng, `multiSelect=false` thì đúng 1) | 201 `Question` | 422 `VALIDATION` (`details[{path,message}]`, vd `options.1.content`) |
| `GET /api/teacher/questions/:id` | | `Question` | 404 |
| `PUT /api/teacher/questions/:id` | như POST | `Question` (thay toàn bộ đáp án trong một transaction) | 404, 422 |
| `DELETE /api/teacher/questions/:id` | | `{ id }` (xóa dây chuyền đáp án; đề đã ra giữ bản sao, BR-002) | 404 |

Giới hạn độ dài, số đáp án, kích thước trang: `packages/shared/src/questions/limits.ts`.

### Giáo viên: bài thi và điều khiển lớp (`modules/exams`, `modules/class-control`, hợp đồng `@quiq/shared/exams`)

Mọi route: `staffGuard(deps, ["teacher"])`; bài thi/lớp của giáo viên khác hoặc trường khác, id không phải uuid → 404.

| Method + path | Request | 200/201 | Lỗi |
|---|---|---|---|
| `GET /api/teacher/exams/classes` | | `AssignableClass[]` (lớp trong `assignments` của giáo viên, năm học hiện tại) | |
| `GET /api/teacher/exams/bank-counts` | | `{ easy, medium, hard }` (câu của chính giáo viên, đúng môn) | |
| `GET /api/teacher/exams` | | `ExamListItem[]` (`code`, `link: /thi/<mã>`, `drawConfig`, `classes[{classId,className,status}]`, `attemptCount`) | |
| `POST /api/teacher/exams` | `{ title, durationMinutes, drawConfig{total,easy,medium,hard}, classIds[] }` | 201 `ExamListItem` | 422 `VALIDATION`, 422 `INSUFFICIENT_QUESTIONS` (`details{difficulty,have,need}`, không tạo hàng nào), 422 `INVALID_DRAW_CONFIG`, 403 `CLASS_NOT_ASSIGNED` |
| `GET /api/teacher/exams/:id` | | `ExamDetailView` (bản sao câu hỏi **kèm đáp án đúng**, chỉ cho giáo viên chủ đề) | 404 |
| `DELETE /api/teacher/exams/:id` | | `{ id }` | 409 `EXAM_HAS_ATTEMPTS`, 404 |
| `POST /api/teacher/exams/:examId/classes/:classId/dispatch` | | `ExamClassState` (snapshot `max_attempts/warn_limit/interrupt_secs` từ trường) | 409 `CLASS_ALREADY_DISPATCHED`, `CLASS_ALREADY_CLOSED`, 404 |
| `POST .../classes/:classId/close` | | `CloseClassResult { examClass, finalizedAttempts }`; **idempotent** (lớp đã thu bài: chạy lại thu hồi phiên + chấm, 200) | 409 `CLASS_NOT_DISPATCHED` (lớp nháp), 404 |
| `GET .../classes/:classId/roster` | | `RosterView { examClass, students[{code, fullName, status: not_started\|waiting\|in_progress\|submitted, attemptsUsed, bestScore}], counts, serverNow }` (polling 3 giây) | 404 |

Quy tắc:
- Tạo đề: `drawQuestions` (engine) + sao chép câu/đáp án vào `exam_questions`/`exam_options` + tạo `exam_classes` (`draft`) trong **một transaction**. Mã bài thi 6 ký tự, bỏ `0 O 1 I L`, duy nhất toàn hệ thống (kiểm trước + retry khi trùng `exams_code_key`).
- Thu bài: (1) đóng lớp, (2) thu hồi mọi phiên học sinh của lớp với `revoked_at = closed_at`, (3) `finalizeAttempt(…, "closed")` mọi attempt `in_progress`.
- "Đang chờ" = có presence trong 15 giây (`WAITING_PRESENCE_FRESH_SECONDS`, `@quiq/shared/student`), bỏ qua khi lớp đã thu bài.

## Mã lỗi

| Nguồn | Mã |
|---|---|
| `packages/shared/src/common/errors.ts` | `BAD_REQUEST` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `PAYLOAD_TOO_LARGE` 413, `VALIDATION` 422, `RATE_LIMITED` 429, `INTERNAL` 500 |
| `packages/shared/src/auth/errors.ts` | `INVALID_CREDENTIALS` 401, `SCHOOL_LOCKED` 403, `LOGIN_THROTTLED` 429 |
| `packages/shared/src/student/errors.ts` | `EXAM_NOT_FOUND` 404, `STUDENT_NOT_ALLOWED` 404, `SCHOOL_LOCKED` 403, `STUDENT_SESSION_REQUIRED` 401, `ENTER_CONFLICT`, `EXAM_NOT_DISPATCHED`, `EXAM_CLOSED`, `ATTEMPT_ALREADY_COMPLETED`, `ATTEMPT_IN_PROGRESS`, `ATTEMPT_LIMIT_REACHED`, `ATTEMPT_ENDED`, `ATTEMPT_NOT_FINISHED` (409), `INVALID_ANSWER` 422 |
| `packages/shared/src/questions/errors.ts` | (chỉ thông điệp validate tiếng Việt; dùng mã chung `VALIDATION`, `NOT_FOUND`) |
| `packages/shared/src/exams/errors.ts` | `INSUFFICIENT_QUESTIONS` 422, `INVALID_DRAW_CONFIG` 422, `CLASS_NOT_ASSIGNED` 403, `EXAM_HAS_ATTEMPTS`, `CLASS_ALREADY_DISPATCHED`, `CLASS_ALREADY_CLOSED`, `CLASS_NOT_DISPATCHED` (409) |
| `modules/health/routes.ts` | `DB_UNAVAILABLE` 503 |

Thông điệp tiếng Việt nằm trong các file trên; web hiển thị `error` từ envelope.

## Rate limiting (hiện trạng)

- Đăng nhập cán bộ: như trên.
- `/api/student/enter` và các route khác: **chưa có** (gap G-03).
