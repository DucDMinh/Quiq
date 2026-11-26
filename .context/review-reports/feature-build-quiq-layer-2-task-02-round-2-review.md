Agent: reviewer

# Review: build-quiq layer-2-task-02, round 2 (luồng học sinh thi trọn vẹn)

- Worktree: `E:\Quiq\.worktrees\layer-2__task-02` (branch `wt/layer-2__task-02`, base 98a1590). Thay đổi chưa commit, chỉ có file mới.
- **Review level: STRICT**
- **Reason:** task đụng payload đáp án, vòng đời attempt và phiên học sinh (cấp, thu hồi, quyền đọc/ghi). Phần sửa C1 nằm đúng ở logic cấp phiên.
- **Blast radius:**
  - API `apps/api/src/modules/student/**` (`enterExam`, `issueStudentSession`, `isOwnActiveSession`, `requireStudentSession`).
  - API `apps/api/src/modules/attempts/**`.
  - Bảng `student_sessions`, `attempts`.
  - Shared `packages/shared/src/student/errors.ts` (thông điệp `ATTEMPT_IN_PROGRESS`, web dùng chung).
  - Web `apps/web/src/features/student/enter-form.tsx` (hiện lỗi 409) và `result-view.tsx`.

## Verify commands + result (chạy thật trong worktree)

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (db, engine, shared, api, web) |
| `pnpm lint` | PASS (eslint, không lỗi) |
| `pnpm test` | PASS, 23 file, **305/305** test |
| `pnpm build` | PASS (next build, đủ route /thi, /thi/[code], /phong-cho, /lam-bai, /ket-qua) |
| `git status --short --untracked-files=all` | chỉ có file mới `??` (32 file). **Không sửa file nào đã track.** |

## Đóng finding round 1

| Finding | Trạng thái | Bằng chứng |
|---|---|---|
| [CRITICAL] C1: chiếm bài đang làm, thu hồi phiên chéo lớp | **ĐÃ ĐÓNG** | phân tích bên dưới |
| [NIT] n1: tone `danger` | **ĐÃ ĐÓNG** | `result-view.tsx:84` là `<Alert tone="info">` |
| [MAJOR] M1: Doc-Impact | **Chuyển dispatcher** (theo brief) | nội dung đầy đủ ở mục Doc-Impact, không tính FAIL cho worktree |
| m1 / m2 / m3 | Đã chấp nhận ở round 1 | m2: dispatcher bật `app.proxy` hoặc dùng helper cookie chung khi merge với task-01. m3: chuyển L3-02. |

### Phân tích C1 (soi 1-3)

`enterExam` nằm ở `apps/api/src/modules/student/service.ts:103-147`.

| Đường vào khi học sinh đang `in_progress` | Kết quả |
|---|---|
| Không cookie | `isOwnActiveSession` trả false (`student-session.ts:77`). Sau `expireDueAttempts`, trong tx `hasAttemptWithStatus(tx, studentId, "in_progress")` (không lọc lớp) ném 409 (`service.ts:129-131`) trước `issueStudentSession`, nơi duy nhất thu hồi phiên. Route chỉ `setStudentCookie` sau khi `enterExam` trả về (`routes.ts:11-16`), nên không có Set-Cookie. Test `student.test.ts:222-250` kiểm: 409, `set-cookie` undefined, kẻ lạ GET attempt nhận 401, chủ bài vẫn thấy `answers`, nộp được với `correct=1`. |
| Cookie của học sinh khác | `isOwnActiveSession` lọc `tokenHash` + `studentId` + `examClassId` + `revokedAt IS NULL` (`student-session.ts:81-87`), nên trả false và kết quả là 409. |
| Cookie giả | hash không khớp, trả false, 409. |
| Cookie đã thu hồi hoặc cookie chỉ-xem | điều kiện `isNull(revokedAt)` không thỏa (phiên chỉ-xem được tạo với `revokedAt = now`, `student-session.ts:65`), trả false, 409. |
| Cookie đúng học sinh, lớp khác | `examClassId` không khớp, trả false. Kiểm `in_progress` không lọc lớp nên ra 409, phiên lớp X giữ nguyên. Test `student.test.ts:267-288`. |
| Cookie đúng học sinh, đúng lớp, còn hiệu lực | trả lại chính token, không cấp phiên mới (`service.ts:115-120`). Test `:252-265`: vẫn chỉ có 1 hàng session (C-13). |

- **So hash (soi 2):** SHA-256 hex của token nhận vào được so bằng phép bằng trong SQL, không so token thô. Không cookie nào ngoài phiên hiệu lực của chính học sinh ở chính lớp đó lọt qua được.
- **Nhánh hết giờ (soi 3):**
  - `expireDueAttempts` đưa attempt quá hạn về `submitted`, sau đó `readOnly = finished` (theo lớp này).
  - `issueStudentSession` tạo phiên với `revokedAt = now` và không thu hồi phiên khác.
  - `requireStudentSession` từ chối quyền `active` khi phiên đã thu hồi (`student-session.ts:167-170`).
  - Test `:290-304`: `POST /student/attempts` trả 401. Quyền ghi không được mở lại.
- **Quyền theo route** (`attempts/routes.ts`), đã đọc trực tiếp:

  | Route | Quyền |
  |---|---|
  | `POST /student/attempts` (`:10`) | `active` |
  | `GET /student/attempts/:id` (`:16`) | `active` |
  | `PUT .../answers` (`:23`) | `active` |
  | `POST .../submit` (`:30`) | `read` |
  | `GET .../result` (`:36`) | `read` |

  - Phiên đã thu hồi hay phiên chỉ-xem **không** đọc được `answers` (GET paper cần `active`) và không ghi được.
  - `read` cho phiên đã thu hồi chỉ được chấp nhận khi lớp đó đã có attempt `submitted`. Engine chặn bắt đầu lại sau khi đã hoàn thành, nên lớp đó không thể có `in_progress` song song. Vì vậy `submit` bằng quyền `read` không thể nộp thay một bài đang làm.
- **Thu hồi chéo lớp:** đã đóng. Phiên chỉ-xem không thu hồi gì (`student-session.ts:51`). Phiên hiệu lực chỉ được cấp khi không có `in_progress` ở bất kỳ lớp nào.

## Responsive Checklist Gate

Diff UI của round 2 chỉ đổi 1 prop (`tone`). AC ghi rõ "chỉ desktop" (design-spec §5).

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Layout 375/768 | N/A | AC desktop-only |
| Layout 1280 | Chưa xác minh bằng trình duyệt | không có browser, round 2 không đổi layout |
| Typography/Spacing | OK | dòng sửa chỉ đổi `tone` |
| Media | N/A | không có ảnh |
| Touch/Interaction | N/A | desktop-only |
| Viewport/A11y | N/A cho round này | không đổi, residual risk giữ như round 1 |

## Skill gates

| Gate | Kết quả |
|---|---|
| aislop | skip, không chạy lại (round 1: `aislop: command not found`) |
| oxlint (anti-slop) | skip, oxlint not configured |
| ocr | skip, ocr not installed |
| AI-readable | OK: `enterExam` khoảng 45 dòng, tên rõ, comment giải thích WHY, không có magic number, dưới 3 indicator |
| ai-friendly-web | N/A (luồng thi nội bộ của học sinh) |
| blitzstrike | skip, không cài, không có môi trường được phép |

## Findings mới

### [MINOR] m4: Vào không cookie khi học sinh đang ở phòng chờ thì giành được phiên (soi 4)

**Hành vi hiện tại:**
1. Học sinh A đang ở phòng chờ, chưa có `in_progress`.
2. Client khác vào bằng cùng mã bài và mã học sinh, không có cookie.
3. `issueStudentSession` thu hồi phiên phòng chờ của A và cấp phiên hiệu lực cho client đó (`student-session.ts:51-58`). Test `student.test.ts:124-149` khẳng định đúng hành vi này.
4. Kẻ đó bấm Bắt đầu và làm bài thay A.
5. A vào lại thì nhận 409 `ATTEMPT_IN_PROGRESS` và bị khóa ngoài cho tới khi bài kia kết thúc.

**Vì sao xếp MINOR, không chặn task:**
- Khi chưa có attempt đang làm, đây chính là "đổi máy" spec chủ định. `docs/specs/2026-11-25-quiq-design.md:89` ghi: trình duyệt không token thì tạo phiên mới, thu hồi phiên cũ, máy mới vào phòng chờ. Dòng `:115` coi trình duyệt khác không cookie là đổi máy.
- Xác thực chỉ dựa vào mã, không có mật khẩu, nên ai biết mã thì mạo danh được trước khi người thật bắt đầu. Đây là rủi ro của thiết kế, không phải lỗi của diff.
- Lúc ở phòng chờ chưa có `answers` để lộ. Phạm vi là demo.
- Khác C1: C1 cho phép đọc và ghi đè bài **đang làm**, trái C-03.

**Đề xuất:**
- Giảm rủi ro bằng FR-043: `takeover_logs`, giáo viên thấy lịch sử, máy bị đẩy nhận `kicked`. Thêm rate limit cho `/student/enter`.
- Ghi vào Notes của FR-043: hiện tại vào không cookie khi đang `in_progress` bị từ chối 409. Đây là cách làm bảo thủ, lệch spec dòng 89 (spec muốn attempt cũ thành `interrupted` và máy mới làm lần mới). FR-043 phải thay bằng luồng takeover đúng spec.

### [MINOR] m5: Cửa sổ race giữa "vào không cookie" và "Bắt đầu" (đúng như comment `service.ts:128` thừa nhận)

**Nguyên nhân:**
- `insertAttempt` (`attempts/start.ts:62-110`) không kiểm lại trong tx rằng phiên của request còn hiệu lực. `requireStudentSession` chạy trước tx.
- Hai luồng không dùng chung khóa hàng nào.

**Kịch bản** (Postgres thật, Read Committed):
1. A bấm Bắt đầu và đã qua bước kiểm phiên.
2. Cùng lúc, request vào không cookie thấy chưa có `in_progress`, thu hồi phiên A và cấp phiên mới.
3. Tx của A chèn attempt.

Kết quả: phiên hiệu lực thuộc về kẻ lạ, gắn với attempt `in_progress` vừa tạo.

**Vì sao MINOR:**
- Cửa sổ vài ms, phải canh đúng lúc.
- Attempt mới chưa có đáp án nên không lộ dữ liệu.
- Hệ quả không nặng hơn m4.
- PGlite chỉ có một kết nối nên không tái hiện được.

**Đề xuất** (FR-043 hoặc hardening): trong tx `insertAttempt`, `SELECT ... FOR UPDATE` hàng `student_sessions` theo `session.id` và kiểm `revoked_at IS NULL`. Hoặc khóa hàng `students` ở cả hai luồng.

Không có CRITICAL hay MAJOR mới.

## Hồi quy (soi 5)

- **Không có diff giữa hai round:** mọi file đều untracked nên không so được round 1 với round 2.
- **Điều đã xác minh:**
  - Toàn bộ suite PASS 305/305, gồm `attempts.test.ts`: không lộ đáp án, IDOR 404, kiểm câu thuộc đề, dung sai 3s, chấm điểm, race Bắt đầu, thu hồi phiên sau khi nộp.
  - Đọc lại `start.ts`: vẫn dùng `canStartAttempt`, unique violation đổi thành 409.
  - Đọc lại `attempts/routes.ts`: quyền theo route ghi ở trên.
  - `finalize.ts:103` vẫn `.for("update")`.
  - `expireDueAttempts` được gọi ở `service.ts:137,148,240` của attempts, ở `getStudentState` và (mới) ở `enterExam`.
- **Web:** `enter-form.tsx:46-49,121` hiện thông điệp 409 mới bằng `Alert tone="danger"`. Đây là lỗi thật nên tone đúng.
- **Ownership:** không sửa file nào đã track.

## Doc-Impact (dispatcher cập nhật ở close-out Layer 2, sau merge, trước commit đóng layer)

Nguồn status code: `packages/shared/src/student/errors.ts`. Nguồn quyền: `attempts/routes.ts`, `student/routes.ts`.

### `docs/API_SPEC.md` (as-built): thêm mục "Học sinh (cổng thi)"

1. **Cookie `quiq_stu`**
   - HttpOnly, SameSite=Lax, path `/`. Secure theo `ctx.secure` (m2: cần `app.proxy` sau reverse proxy).
   - Token đục base64url 32 byte. DB chỉ lưu SHA-256. Token không bao giờ có trong body.
2. **`POST /api/student/enter`**
   - Body `{ examCode, studentCode }`, đã chuẩn hóa (trim, chữ hoa, chấp nhận dán link). Trả 200 `{ examCode }` kèm Set-Cookie.
   - Cookie là phiên hiệu lực đúng học sinh, đúng lớp: giữ phiên.
   - Đang `in_progress` ở bất kỳ lớp nào mà không có cookie đó: 409 `ATTEMPT_IN_PROGRESS`, không Set-Cookie, không thu hồi.
   - Đã nộp ở lớp này: phiên chỉ-xem.
   - Các trường hợp còn lại: phiên hiệu lực mới, thu hồi phiên hiệu lực cũ.
   - Lỗi: 404 `EXAM_NOT_FOUND`, 403 `SCHOOL_LOCKED`, 404 `STUDENT_NOT_ALLOWED` (thông điệp chung cho mã sai, mã vô hiệu, lớp khác, trường khác), 409 `ATTEMPT_IN_PROGRESS`, 409 `ENTER_CONFLICT` (vào đồng thời), 422 validation.
3. **`GET /api/student/state`** (quyền `read`)
   - Trả `StudentStateView`:
     - `phase`: `waiting` | `can_start` | `in_progress` | `completed` | `closed`.
     - `closedReason`: `class_closed` | `max_attempts` | null.
     - `exam{code,title,subjectName,durationMinutes,questionCount}`.
     - `student{code,fullName}`.
     - `className`.
     - `attempt{id,attemptNo,endsAt}` | null.
     - `attemptsUsed`, `maxAttempts`, `warnLimit`, `serverNow`.
   - Kiểm hết giờ lười. Ghi `waiting_presence` khi phiên hiệu lực ở pha waiting/can_start.
4. **`POST /api/student/attempts`** (quyền `active`)
   - Trả 201.
   - 409: `EXAM_NOT_DISPATCHED`, `EXAM_CLOSED`, `ATTEMPT_IN_PROGRESS`, `ATTEMPT_LIMIT_REACHED`, `ATTEMPT_ALREADY_COMPLETED` (thực tế không tới được qua HTTP, xem m1).
   - 401 `STUDENT_SESSION_REQUIRED` khi phiên đã thu hồi.
5. **`GET /api/student/attempts/:id`** (quyền `active`)
   - Trả đề theo thứ tự xáo cùng `answers` đã lưu, `endsAt`, `serverNow`.
   - **Không có** `is_correct`.
   - 404 khi attempt không thuộc phiên.
6. **`PUT /api/student/attempts/:id/answers`** (quyền `active`)
   - Body `{ questionId, optionIds }`.
   - 422 `INVALID_ANSWER` khi câu không thuộc đề, đáp án không thuộc câu, đáp án trùng, hoặc chọn nhiều ở câu chọn 1.
   - Quá `endsAt + 3s`: tự nộp và trả 409 `ATTEMPT_ENDED`.
7. **`POST /api/student/attempts/:id/submit`** (quyền `read`)
   - Nộp idempotent, trả kết quả.
   - Phiên đã thu hồi vẫn nộp lại được (trả kết quả cũ).
8. **`GET /api/student/attempts/:id/result`** (quyền `read`)
   - Trả điểm, số đúng, `endReason`. Không có option id hay đáp án đúng.
   - 409 `ATTEMPT_NOT_FINISHED` khi chưa nộp.
9. **Bảng mã lỗi `STUDENT_ERRORS`**: chép nguyên code, status, message từ `packages/shared/src/student/errors.ts`, gồm cả 401 `STUDENT_SESSION_REQUIRED`.
10. **Cần dispatcher xác nhận khi viết:** field cụ thể của response 201 (start), `ExamPaperView` và `AttemptResultView`. Lấy theo `packages/shared/src/student/schemas.ts`. Reviewer chưa đọc file này ở round 2.

### `docs/DESIGN.md` (current-state)

1. **Phiên học sinh**
   - Mỗi học sinh có tối đa 1 phiên hiệu lực (`student_sessions_one_active_key`).
   - Phiên chỉ-xem được tạo ở trạng thái đã thu hồi, chỉ có quyền `read` khi lớp của phiên đã có attempt `submitted`.
   - `active` dùng cho start, paper, save. `read` dùng cho state, submit, result.
2. **Chống chiếm bài**
   - Vào thi khi đang làm bài thì trả 409, không thu hồi phiên.
   - Đây là cách làm tạm, lệch luồng takeover C-13 (`interrupted` + `takeover_logs`). FR-043 sẽ thay.
3. **`finalizeAttempt` là điểm kết thúc duy nhất**
   - Khóa hàng attempt bằng FOR UPDATE (`finalize.ts:103`).
   - Chấm bằng `scoreAttempt` của engine.
   - Thu hồi phiên của học sinh ở lớp đó.
   - Nộp lần hai không đổi điểm.
4. **Hết giờ**
   - Kiểm lười qua `expireDueAttempts`: ở state, enter và các handler attempts.
   - Dung sai 3s sau `ends_at`.
   - Mọi mốc thời gian lấy từ `deps.clock`. Client bù lệch bằng `serverNow`.
5. **Payload đáp án:** `is_correct` chỉ được đọc trong `loadAnswerKey` để chấm.

**Trailer:** `Doc-Impact: docs/API_SPEC.md (cookie quiq_stu + 7 endpoint student/attempts + bảng STUDENT_ERRORS), docs/DESIGN.md (phiên hiệu lực/chỉ-xem, chống chiếm bài 409, finalizeAttempt, hết giờ kiểm lười + dung sai 3s)`. **Không** ghi `none`.

## Residual risk

- m5: race chỉ xảy ra trên Postgres nhiều kết nối, PGlite không tái hiện được.
- m4: mạo danh trước khi bắt đầu là bản chất của xác thực chỉ bằng mã. Phụ thuộc FR-043 và rate limit (chưa có).
- Layout desktop 1280, `100vh`, reduced-motion chưa xác minh bằng trình duyệt (như round 1).
- Không có diff giữa hai round. Hồi quy dựa vào suite test và các file đã đọc lại.
- M1 phụ thuộc dispatcher làm đúng Doc-Impact trước commit đóng Layer 2.

## Verdict: PASS

- C1 đã đóng: mọi đường cấp phiên hiệu lực khi đang `in_progress` đều bị chặn. Phiên thu hồi hay chỉ-xem không đọc được `answers` và không ghi được. Có test cho các nhánh chính.
- n1 đã đóng. M1 chuyển dispatcher, nội dung Doc-Impact đầy đủ ở trên.
- Không còn CRITICAL hay MAJOR. 2 MINOR mới (m4, m5) không chặn task, chuyển vào Notes của FR-043.
