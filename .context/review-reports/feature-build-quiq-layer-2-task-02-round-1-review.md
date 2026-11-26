Agent: reviewer

# Review: build-quiq layer-2-task-02, round 1 (luồng học sinh thi trọn vẹn)

- Worktree: `E:\Quiq\.worktrees\layer-2__task-02` (branch `wt/layer-2__task-02`, base 98a1590), thay đổi chưa commit, chỉ có file mới.
- **Review level: STRICT**
- **Reason:** task đụng payload đáp án (đáp án chỉ ở máy chủ), vòng đời attempt (chấm điểm, hết giờ, race, idempotent), phiên học sinh (cookie/token, thu hồi, quyền truy cập), API contract dùng chung web.
- **Blast radius:** API `apps/api/src/modules/student/**`, `apps/api/src/modules/attempts/**` (`finalizeAttempt` sẽ được L3-02 gọi lại); bảng `student_sessions`, `attempts`, `attempt_answers`, `waiting_presence`; shared contract `packages/shared/src/student/**` (web + api); web `apps/web/src/app/thi/**`, `apps/web/src/features/student/**`.

## Verify commands + result (chạy thật trong worktree)

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (db, engine, shared, api, web) |
| `pnpm lint` | PASS (eslint, không lỗi) |
| `pnpm test` | PASS, 23 file, **301/301** test |
| `pnpm build` | PASS (next build, có route /thi, /thi/[code], /phong-cho, /lam-bai, /ket-qua) |
| `git status --short --untracked-files=all` | chỉ file mới `??`, **không có thay đổi ở file đã track** |

## Responsive Checklist Gate

AC ghi rõ "chỉ desktop" (design-spec §5). Profile có `responsive_breakpoints: [375, 768, 1280]` nhưng phạm vi task là desktop-only.

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Layout 375/768 | N/A | AC "chỉ desktop" |
| Layout 1280 (không scroll ngang) | Chưa xác minh bằng trình duyệt | không có môi trường browser, xem Residual risk |
| Typography/Spacing | OK | dùng token Tailwind của design system (text-base/text-2xl/text-score), không px cứng trong file đã đọc |
| Media | N/A | không có ảnh (ảnh là tính năng sau) |
| Touch/Interaction | N/A | desktop-only |
| Viewport/A11y (100vh, reduced-motion) | Chưa xác minh đầy đủ | chỉ đọc `result-view.tsx`, xem Residual risk |

## Skill gates

| Gate | Kết quả |
|---|---|
| aislop | skip, `aislop: command not found` |
| oxlint (anti-slop) | skip, oxlint not configured (profile không có oxlint) |
| ocr (open-code-review) | skip, ocr not installed |
| AI-readable | OK, tên rõ ràng, hàm ngắn, comment giải thích WHY, < 3 indicators |
| ai-friendly-web | N/A, luồng thi của học sinh, không phải trang public SEO |
| blitzstrike | skip, không cài, không có môi trường được phép |

## Đã kiểm và đạt

- **Payload đáp án:** `loadPaperQuestions` (`attempts/service.ts:59-94`) chỉ select id/content/multiSelect, và map option chỉ lấy `{id, content}` (`:90`). Vì vậy kể cả khi có mutation thêm `is_correct` vào select thì cũng không lộ ra. `isCorrect` chỉ xuất hiện ở `loadAnswerKey` (`finalize.ts:28-61`), dùng để chấm. Test `expectNoAnswerKey` duyệt khóa ở mọi tầng của paper, của lần tải lại và của state (`attempts.test.ts:46-62, 82`). Kết quả không chứa bất kỳ option id nào (`:263-267`) và có danh sách khóa chính xác (`:246-257`). Trang kết quả không hiện câu đã chọn hay đáp án đúng; nút "Xem đáp án" chỉ hiện thông báo "Giáo viên chưa công bố đáp án".
- **IDOR giữa hai phiên:** `loadOwnedAttempt` lọc theo id, studentId và examClassId của phiên. A đọc hoặc sửa bài của B thì nhận 404 (`attempts.test.ts:101-103`).
- **Kiểm câu thuộc đề (ghi nhận L1 #3):** `validateSelection` kiểm câu có trong `questionOrder` **và** join `exam_classes` theo đề, kiểm đáp án thuộc `optionOrders[q]`, không trùng, câu chọn 1 thì tối đa 1 (`selection.ts:17-29`). Test có câu của đề khác, đáp án của câu khác, chọn 2 ở câu chọn 1, đáp án trùng (`attempts.test.ts:185-208`). Mutation bỏ một trong hai kiểm vẫn bị kiểm còn lại chặn; bỏ cả hai thì test bắt.
- **Thời gian:** code nghiệp vụ API không có `new Date()`/`Date.now()`, mọi mốc lấy từ `deps.clock.now()`. `ends_at` dùng `computeEndsAt` của engine. Web bù lệch qua `serverNow` (`use-exam-attempt.ts:34,128`) và có test máy học sinh nhanh 1 giờ 30 phút.
- **Dung sai 3 giây:** đúng `ends_at + 3s` vẫn lưu được, quá 1 ms thì tự nộp theo câu đã lưu và trả 409 `ATTEMPT_ENDED` (`attempts.test.ts:317-338`). Mutation bỏ dung sai sẽ bị bắt.
- **Chấm điểm:** dùng `scoreAttempt` của engine. Test: đúng một phần = sai, bỏ trống = sai, 3/8 = 3.75; nộp lần hai không đổi điểm.
- **Race và FOR UPDATE:** `finalizeAttempt` và `saveAnswer` cùng khóa hàng attempt. Bắt đầu đồng thời trả [201, 409]; DB từ chối hàng `in_progress` thứ hai (`attempts.test.ts:120-155`).
- **Ghi nhận L1 #1 (thu hồi phiên):** `finalizeAttempt` gọi `revokeStudentSessions` (`finalize.ts:114`). Test kiểm còn 0 phiên hiệu lực sau khi nộp và vào bài sau bình thường (`attempts.test.ts:287-313`). Mutation bỏ thu hồi sẽ bị bắt.
- **Ghi nhận L1 #2 (chuẩn hóa mã):** `normalizeExamCode`/`normalizeStudentCode` ở shared, so bằng `upper()`, mã trùng hơn 1 coi như không thấy.
- **Thông báo chung khi vào thi:** mã sai, mã vô hiệu, học sinh lớp khác hay trường khác đều trả `STUDENT_NOT_ALLOWED` (`student.test.ts:67`). Cookie HttpOnly, SameSite=Lax; DB chỉ lưu SHA-256 của token; token không có trong body.
- Không có em-dash, không có chữ "Game PIN" trong `apps/web/src` và `packages/shared/src/student`.

## Findings

### [CRITICAL] C1: Vào thi không cần cookie khi đang `in_progress` thì chiếm được bài đang làm của học sinh khác (lệch #3)

- `apps/api/src/modules/student/service.ts:94-115` luôn gọi `issueStudentSession`. Hàm đó thu hồi **mọi** phiên còn hiệu lực của học sinh rồi cấp phiên hiệu lực mới (`student-session.ts:47-58`). `readOnly` chỉ bật khi đã có attempt `submitted`.
- Hệ quả: một bạn cùng lớp chỉ cần mã bài thi (công khai trong lớp) và mã học sinh dạng `HS001` (dễ đoán), không cần cookie, là:
  1. đẩy máy của học sinh thật ra giữa giờ thi;
  2. `GET /api/student/state` lấy `attempt.id`;
  3. `GET /api/student/attempts/:id` đọc các câu học sinh thật đã chọn (`buildPaper` trả `answers`, `attempts/service.ts:131`);
  4. `PUT .../answers` ghi đè đáp án, rồi `POST .../submit` nộp thay.
- `loadOwnedAttempt` chỉ lọc theo studentId/examClassId nên không chặn được trường hợp này.
- **Trái spec:**
  - C-03: máy mới phải vào phòng chờ và làm **lần mới từ đầu**, **không** giữ câu đã chọn.
  - C-13: không có token nghĩa là đổi máy, máy cũ bị đẩy và **mất 1 lượt**.
  - Task ghi rõ "đẩy máy" thuộc mục **Chưa làm**.
  - Cách làm này không phải bản tạm của FR-043 mà ngược với FR-043, và không có test nào cho đường này.
- Ảnh hưởng thêm: `issueStudentSession` thu hồi phiên ở **mọi** lớp. Học sinh đang thi bài X mà ai đó vào bài Y bằng mã đó (kể cả Y đã nộp, phiên read-only) thì phiên X cũng bị thu hồi giữa giờ.
- **Yêu cầu sửa (ràng buộc, không bắt một thiết kế cụ thể):**
  - Vào thi không có cookie hợp lệ của chính phiên đó, trong khi học sinh đang có attempt `in_progress`, thì **không bao giờ** được cấp quyền vào attempt đó hay xem đáp án đã lưu.
  - Cách bảo thủ trong scope: gọi `expireDueAttempts` trước, sau đó nếu còn `in_progress` thì từ chối bằng một lỗi thống nhất (ví dụ 409 `ATTEMPT_IN_PROGRESS` "Mã đang làm bài ở máy khác"), **không** thu hồi phiên đang làm. Việc đổi máy để lại cho FR-043.
  - Cấp phiên read-only không được thu hồi phiên hiệu lực ở lớp khác.
  - Có cookie hợp lệ thì vẫn làm tiếp được (C-13), qua `GET /attempts/:id`.
  - Thêm test: (a) A đang làm, client khác không cookie vào thi bằng mã A thì bị từ chối, phiên A vẫn lưu và nộp được; (b) A đang làm bài X, vào bài Y thì phiên X không bị thu hồi (hoặc bị từ chối có chủ đích).

### [MAJOR] M1: Doc-Impact chưa làm
- `docs/API_SPEC.md` và `docs/DESIGN.md` có tồn tại nhưng không có endpoint student nào. Grep `student/enter|student/state|student/attempts|finalizeAttempt` trong `docs/` chỉ thấy `docs/specs/2026-11-25-quiq-design.md`.
- Trước khi commit phải cập nhật:
  - `API_SPEC.md`: 7 endpoint `POST /student/enter`, `GET /student/state`, `POST /student/attempts`, `GET /student/attempts/:id`, `PUT /student/attempts/:id/answers`, `POST /student/attempts/:id/submit`, `GET /student/attempts/:id/result`; shape response (ExamPaperView, StudentStateView, AttemptResultView, `serverNow`); bảng mã lỗi `STUDENT_ERRORS` và status code; cookie `quiq_stu`.
  - `DESIGN.md`: phiên chỉ-xem (revoked + đã nộp thì được `read`), `finalizeAttempt` là điểm kết thúc duy nhất (khóa FOR UPDATE, thu hồi phiên), hết giờ kiểm lười, dung sai 3s.
- Trailer Doc-Impact **không được** ghi `none`.
- Đây là việc bắt buộc ở close-out, không phải lỗi code.

### [MINOR] m1: Mã `ATTEMPT_ALREADY_COMPLETED` không còn tới được qua HTTP (lệch #2)
- `apps/api/src/modules/attempts/start.ts:20`: sau khi nộp, phiên bị thu hồi nên `POST /student/attempts` trả 401 trước khi tới `canStartAttempt`.
- Test `attempts.test.ts:270,279` vẫn khẳng định DB chỉ có 1 attempt và pha `completed`, nên bảo đảm "không làm lại được" không bị làm yếu. Web coi 401 là kết thúc bài (`use-exam-attempt.ts:16`), UX không hỏng.
- Tuy vậy, nhánh `already_completed` không có test nên mutation ở đó không bị bắt. Đề xuất: test đơn vị cho `DENIED_ERROR`, hoặc ghi chú rằng nhánh này dành cho trường hợp phiên còn hiệu lực về sau (FR-043/045).

### [MINOR] m2: Cookie `Secure` theo `ctx.secure` (lệch #4)
- `student-session.ts:87`: grep `proxy` trong `apps/api/src/app.ts`, `server.ts` không thấy `app.proxy`. Sau reverse proxy HTTPS, `ctx.secure` là false nên cookie thiếu Secure.
- Ép `secure: true` mà không bật trust proxy thì Koa sẽ ném lỗi.
- Cần thống nhất với layer-2-task-01 lúc merge: bật `app.proxy` trong `app.ts` (file task này không sở hữu) hoặc dùng chung một helper cho cả hai cookie. Ghi vào ghi chú merge layer-2.

### [MINOR] m3: Phiên phòng chờ không có TTL; thu bài không thu hồi phiên của học sinh chưa bắt đầu (lệch #5)
- `finalizeAttempt` chỉ thu hồi phiên của học sinh có attempt.
- L3-02 (thu bài) phải thu hồi trực tiếp mọi phiên còn hiệu lực theo `exam_class_id`, nếu không học sinh vào phòng chờ mà không làm sẽ giữ mã. Ghi vào Notes của L3-02. Không chặn task này.

### [NIT] n1
`result-view.tsx:84`: "Giáo viên chưa công bố đáp án" dùng `Alert tone="danger"`. Đây là thông tin, không phải lỗi; cân nhắc `tone="info"` theo design-spec.

## Đánh giá 6 lệch builder tự khai

1. **`GET /api/student/attempts/:id`: CHẤP NHẬN.** Cần cho C-13 ("còn cookie thì làm tiếp", tải lại trang). Phải ghi vào API_SPEC (M1). Lưu ý endpoint này chính là đường lộ `answers` trong C1.
2. **Phiên chỉ-xem, 401 thay vì 409: CHẤP NHẬN (MINOR m1).** Test không bị làm yếu ở điểm cốt lõi (vẫn kiểm 1 hàng DB và pha completed); `ATTEMPT_ALREADY_COMPLETED` thành mã chết qua HTTP.
3. **"Đổi máy tạm": PHẢI SỬA (CRITICAL C1).** Trái C-03/C-13, ngoài scope, cho phép chiếm và sửa bài người khác chỉ bằng mã dễ đoán.
4. **Cookie Secure theo `ctx.secure`: CHẤP NHẬN có điều kiện (MINOR m2).** Xử lý lúc merge với task-01 (`app.proxy`).
5. **Không TTL, thu bài không thu hồi phiên chưa làm: CHẤP NHẬN (MINOR m3).** Chuyển cho L3-02.
6. **Prettier sửa nhầm `loader.ts`, `health.test.ts`: ĐÃ XÁC MINH.** `git status --short --untracked-files=all` chỉ có file mới, không có file đã track nào bị sửa. Ownership đạt.

## Doc-Impact

Chưa làm (M1). Trailer bắt buộc: `Doc-Impact: docs/API_SPEC.md (7 endpoint student/attempts + mã lỗi + cookie), docs/DESIGN.md (phiên chỉ-xem, finalizeAttempt, hết giờ kiểm lười)`.

## Residual risk

- Test race Bắt đầu chạy trên PGlite (một kết nối, tự tuần tự hóa). Tính đúng khi đồng thời thật dựa vào chỉ mục duy nhất, và đã có test riêng chứng minh DB từ chối hàng thứ hai.
- `/student/enter` không có rate limit trong khi mã học sinh dễ đoán, làm C1 nặng hơn. Rate limit ngoài scope, đề xuất task riêng.
- Layout desktop 1280, `100vh`, reduced-motion của exam shell chưa xác minh bằng trình duyệt. Chỉ đọc `result-view.tsx`, chưa đọc `exam-view.tsx`/`waiting-room.tsx` vì giới hạn tool đọc STRICT.
- Làm tròn 2 chữ số tin vào engine (đã review ở Layer 1). Test 3.75/2.5 không phân biệt được việc làm tròn.

## Verdict: FAIL

Có 1 CRITICAL (C1) và 1 MAJOR close-out (M1). Builder sửa C1 kèm test, sau đó cập nhật Doc-Impact trước khi commit, rồi chạy review round 2.
