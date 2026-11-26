Agent: reviewer

# Review: build-quiq layer-3-task-02 (round 2): tạo bài thi, phát đề, thu bài, roster

- Worktree: `E:\Quiq\.worktrees\layer-3__task-02` (branch `wt/layer-3__task-02`, base 455c348, chưa commit)
- Review level: **STRICT**
- Reason: khóa đồng thời (Bắt đầu / Thu bài / Xóa đề), thay đổi `requireStudentSession` (đường auth phiên học sinh dùng chung), cấp phiên trong `enterExam`, quyền sở hữu/tenant giáo viên, xóa dây chuyền nhiều bảng.
- Blast radius: `attempts/start.ts` (mọi lần Bắt đầu); `student/student-session.ts` (mọi route học sinh: `state`, `submit`, `result` dùng `read`; `attempts`, `attempts/:id`, `answers` dùng `active`); `student/service.ts` (`enterExam`); module mới `exams/**`, `class-control/**` (9 endpoint giáo viên); `@quiq/shared/exams`, `@quiq/shared/student` (hằng số presence); web `/giao-vien/bai-thi`, `/giao-vien/phong-thi`. Bảng: `exams`, `exam_questions`, `exam_options`, `exam_classes`, `attempts`, `student_sessions`, `waiting_presence`.

## Verify commands + result

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (5 package) |
| `pnpm lint` | PASS (eslint, không cảnh báo) |
| `pnpm test` | PASS: 31 file, **388/388** (khớp số builder báo) |
| `pnpm build` | PASS (Next build có route `/giao-vien/bai-thi`, `/giao-vien/phong-thi`) |
| `git diff --stat 455c348 -- finalize.ts http testing features/shell packages/db docs` | rỗng (không đổi) |
| `wc -l` | Agent-guard chặn (không có trong allowlist). Đếm dòng bằng Grep `^` count, xem mục 6 |

## Bảng đóng finding round 1

| Finding | Trạng thái | Bằng chứng |
|---|---|---|
| MAJOR-1 race Bắt đầu vs Thu bài | **Đóng** | `start.ts:67-79` chạy `SELECT ... FOR UPDATE OF exam_classes` trước khi xét status (`:83-92`). Với READ COMMITTED có hai trường hợp. (a) Thu bài (`markClosed` UPDATE, `class-control/service.ts:139-144`) commit trước: SELECT FOR UPDATE chờ khóa, EvalPlanQual trả bản mới `closed`, kết quả `EXAM_CLOSED`. (b) Bắt đầu giữ khóa trước: UPDATE của close chờ, WHERE `status='dispatched'` vẫn đúng, close commit sau. Bước thu hồi và quét `finalizeRunningAttempts` là statement mới nên thấy attempt đã commit. Deadlock: không có chu trình. Start giữ một hàng `exam_classes` rồi chỉ insert `attempts` (FK lấy KEY SHARE trên hàng chính nó đã khóa). `finalizeAttempt` khóa `attempts` và update `student_sessions`, không khóa `exam_classes`. Close gồm các autocommit riêng, không giữ khóa chéo. Delete khóa `exam_classes` rồi mới đọc/xóa bảng con. Test `class-control.test.ts:207` (lớp closed, phiên còn hiệu lực, Bắt đầu trả 409 `EXAM_CLOSED`) và test race cũ đều xanh. |
| MAJOR-2 thu bài lỗi giữa chừng bị kẹt | **Đóng** | `closeClass` (`service.ts:162-184`): lớp `draft` trả 409. Lớp `closed` dùng lại `closedAt` đã lưu, chạy lại thu hồi phiên và finalize, trả 200. `markClosed` xử lý hai lần close cùng lúc bằng cách đọc lại `closed_at` đã lưu (`:146-151`). Thứ tự mới là đóng, thu hồi, chấm. `saveAnswer` cần `active` nên bị 401 sau bước thu hồi. Cửa sổ giữa đóng và thu hồi chỉ cho lưu đáp án vào attempt CHƯA chấm, và attempt đó được chấm ở bước sau (`finalizeAttempt` khóa attempt FOR UPDATE). Cửa sổ này hẹp hơn round 1. Test `:207` mô phỏng lớp kẹt rồi close lại: attempt thành `submitted/closed`, không còn phiên hiệu lực. Test `:198-204`: close lặp idempotent, `finalizedAttempts: 0`, `closedAt` không đổi. Web hiện nút "Thu bài lại lớp X" khi `closed && in_progress > 0` (`control-panel.tsx:152-163`). |
| MINOR-1 file/hàm dài | **Đóng phần lớn** | `exams/service.ts` còn 224 dòng (đã tách `create.ts` 187, `delete.ts` 53). `insertExamWithCopies` còn 10 dòng. Phần còn lại xem MINOR-A. |
| MINOR-2 retry mọi unique violation | **Đóng bằng code, thiếu test nhánh âm** | `create.ts:143-158` chỉ retry khi là `exams_code_key` (so constraint, constraint_name, message, có duyệt `cause`). Hết lượt thì ném `AppError("INTERNAL")` có thông điệp tiếng Việt (`:186`), có test `exams.test.ts:168`. Chưa có test cho trường hợp vi phạm duy nhất khác bị ném nguyên mà không retry (Grep `constraint|23505|isExamCodeViolation` trong `exams.test.ts` không ra kết quả). Xem MINOR-C. |
| MINOR-3 read cho phiên bị thu hồi sau khi đóng | **Đóng** | `student-session.ts:174-178`. Close thu hồi với `revoked_at = closed_at` nên điều kiện `>=` đúng. Phiên bị thu hồi TRƯỚC khi đóng (`revoked_at < closed_at`, chưa nộp) vẫn 401, có test `:246`. Trường hợp "máy khác sau khi đóng" chỉ còn xảy ra khi lớp kẹt, và chỉ lộ dữ liệu của chính học sinh đó. |
| MINOR-4 xóa đề lỗi FK thành 500 | **Đóng** | `delete.ts:29-44` khóa mọi hàng lớp FOR UPDATE rồi mới `$count` (statement mới, thấy attempt đã commit), trả 409. Lần Bắt đầu đang chờ khóa sẽ thấy hàng đã bị xóa và trả 404 thay vì lỗi FK. Không tái hiện được bằng PGlite. |
| NIT `enterExam` cấp phiên active cho lớp closed | **Đóng** | `student/service.ts:66-73,139` dùng `readOnly: finished \|\| classClosed`. Test `:172-186`: vào lại lớp closed không có phiên active, Bắt đầu trả 409 `EXAM_CLOSED`. |

## Kiểm theo checklist

1. **Khóa:** như bảng trên. Status được kiểm SAU khi khóa: cùng câu SELECT FOR UPDATE, giá trị trả về là bản đã khóa.
2. **Close lặp:** dọn được trạng thái kẹt. Quy tắc read `>=` không mở cho phiên bị thu hồi trước khi đóng (có test).
3. **Phiên chỉ-xem lớp closed:**
   - `revoked_at` khác null nên mọi route `active` bị chặn (`:167` chỉ trả sớm khi `revokedAt` null).
   - 409 `EXAM_CLOSED` chỉ trả cho phiên tạo sau `closed_at`. Người nhận là người giữ token hợp lệ, và thông tin này `GET state` đã cho thấy, nên không lộ gì thêm.
   - Đường ghi duy nhất qua `read` là `POST submit`: idempotent, chỉ có tác dụng khi lớp kẹt, trên attempt của chính học sinh (xem NIT-2).
4. **Delete:** OK.
5. **Hồi quy round 1:** không đổi so với round 1, test xanh.
   - Tạo đề trong transaction, thiếu câu trả 422 mà không để lại hàng (`create.ts:122-131`, rút câu trước khi insert).
   - Lọc theo giáo viên + môn (`bankFilter`), `CLASS_NOT_ASSIGNED` (`create.ts:21-28`).
   - IDOR/tenant trả 404 (`loadOwnedExamClass`, `loadSummaries` lọc school + teacher).
   - Snapshot lúc dispatch có điều kiện `draft`.
   - Đáp án đúng chỉ có trong `getExamDetail` (route giáo viên).
   - Roster 4 trạng thái, presence 15 giây theo `deps.clock`, polling dọn interval.
6. **Kích thước** (Grep `^` count): mọi file nguồn mới/sửa ≤ 300.
   - API: `student/service.ts` 283, `class-control/service.ts` 279, `student-session.ts` 190, `create.ts` 187, `start.ts` 132, `exams/service.ts` 224, `test-fixtures.ts` 96, `exams/routes.ts` 55, `delete.ts` 53, `class-control/routes.ts` 33, `exam-code.ts` 14.
   - Web: `control-panel.tsx` 275, `create-exam-dialog.tsx` 270, `exam-table.tsx` 245, `use-exams.ts` 96, `use-roster.ts` 72, `roster-table.tsx` 61.
   - Shared: `exams/schemas.ts` 176, `errors.ts` 21, `index.ts` 2.
   - Hai file `page.tsx` chưa đếm (xem Residual risk). Hàm > 50 dòng: xem MINOR-A.
7. **Ownership:** chỉ sửa trong phạm vi cho phép.
   - `attempts/start.ts`: chỉ thêm khóa và đọc lại status.
   - `student/**`, `shared/student/**`.
   - File mới trong exams, class-control, shared exams, web bai-thi, phong-thi, features exams + class-control.
   - `finalize.ts`, `http/**`, `testing/**`, `nav-config.ts`, `packages/db/**`, `docs/**` không đổi. `git status` không có file mới nào dưới các đường cấm.

## Responsive Checklist Gate

Theo AC và design-spec §9, màn giáo viên chỉ dùng trên desktop. Diff UI round 2 chỉ đổi nhãn và điều kiện của nút.

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Layout 1280 | OK (CSS math) | `control-panel.tsx:97` `grid-cols-[1fr_16rem_auto]`, `:266` `grid-cols-4`, hàng nút dùng `flex-wrap` |
| Layout 375/768 | N/A | desktop-only theo AC |
| Typography rem/clamp | OK | class Tailwind theo token, không có font px mới |
| Media | N/A | không có ảnh/video |
| Touch target / nav mobile | N/A | desktop-only; shell không đổi |
| Table scroll wrapper | N/A | bảng dùng component chung, desktop |
| 100vh / reduced-motion / overflow hidden | OK | diff không thêm mới |

## Skill gates

| Gate | Kết quả |
|---|---|
| aislop | skip, chưa cài (round 1 trả exit 127) |
| oxlint | skip, oxlint not configured; eslint PASS |
| ocr | skip, ocr not installed |
| AI-readable | OK: 1 nhóm indicator (vài hàm/component > 50 dòng). Tên rõ, comment giải thích WHY, hằng số có tên (`MAX_CODE_TRIES`, `EXAM_CODE_CONSTRAINT`, `WAITING_PRESENCE_FRESH_SECONDS`) |
| ai-friendly-web | N/A (màn nội bộ, cần đăng nhập) |
| blitzstrike | skip, không có môi trường được phép |

## Findings mới

### [MINOR-A] Còn vài hàm > 50 dòng
- Vị trí:
  - `apps/web/src/features/class-control/control-panel.tsx:191-259`: `ConfirmActionDialog` khoảng 69 dòng.
  - `control-panel.tsx:31-85`: `ControlPanel` khoảng 55 dòng.
  - `apps/api/src/modules/exams/service.ts:106-162`: `loadSummaries` khoảng 57 dòng.
- Fix đề xuất: tách phần thân dialog (đoạn văn theo action) và hàm `confirm` ra hook nhỏ; tách việc gom `classesByExam`/`attemptsByExam` trong `loadSummaries` ra helper. Không chặn.

### [MINOR-B] `enterExam` đọc trạng thái lớp ngoài transaction cấp phiên
- `apps/api/src/modules/student/service.ts:62-73` đọc `status` trước transaction ở `:127-141`.
- Nếu Thu bài (đóng + thu hồi phiên) chen vào giữa, học sinh có thể nhận phiên `active` ở lớp đã đóng.
- Vô hại: Bắt đầu bị chặn bởi khóa hàng (`start.ts:79`), không có attempt để lưu đáp án, và phiên này bị thu hồi khi học sinh vào bài khác.
- Fix (tùy chọn): đọc lại `exam_classes.status` trong transaction ở `:127`.

### [MINOR-C] Thiếu test cho nhánh âm của retry mã đề
- `apps/api/src/modules/exams/exams.test.ts`: chưa có test cho trường hợp vi phạm duy nhất khác `exams_code_key` bị ném nguyên mà không retry.
- Fix: thêm test cho `isExamCodeViolation` (ví dụ lỗi giả có `constraint: "exam_classes_..."` thì trả false, `exams_code_key` qua `cause` thì trả true), hoặc test `createExam` với generator gây một vi phạm duy nhất khác.

### [NIT-1] Hai lần xóa cùng một đề nhiều lớp cùng lúc
- `delete.ts:29-33` dùng FOR UPDATE trên nhiều hàng mà không `ORDER BY`.
- Về lý thuyết có thể deadlock (40P01 thành 500, rollback, không mất dữ liệu). Rất hiếm.
- Thêm `.orderBy(examClasses.id)` nếu muốn chắc chắn.

### [NIT-2] Lớp kẹt: phiên chỉ-xem `POST submit` được với `endReason = submitted` thay vì `closed`
- Chỉ xảy ra khi lần thu bài trước lỗi giữa chừng, và chỉ trên attempt của chính học sinh đó.
- Thu bài lại vẫn dọn phần còn lại. Ghi nhận, không cần sửa trong task này.

## Doc-Impact (dispatcher làm ở close-out, trailer KHÔNG được `none`)
- `docs/API_SPEC.md`:
  - 9 endpoint giáo viên: `GET /api/teacher/exams/classes`, `GET /api/teacher/exams/bank-counts`, `GET|POST /api/teacher/exams`, `GET|DELETE /api/teacher/exams/:id`, `POST .../:examId/classes/:classId/dispatch`, `POST .../close`, `GET .../roster`.
  - Mã lỗi: `INSUFFICIENT_QUESTIONS`, `INVALID_DRAW_CONFIG`, `CLASS_NOT_ASSIGNED`, `EXAM_HAS_ATTEMPTS`, `CLASS_ALREADY_DISPATCHED`, `CLASS_NOT_DISPATCHED`.
  - Close **idempotent**: lớp closed trả 200, chạy lại thu hồi + chấm.
  - `enterExam` vào lớp closed: cấp phiên chỉ-xem.
  - Quy tắc `read`: đã nộp, HOẶC lớp closed và `revoked_at >= closed_at`.
  - Phiên chỉ-xem tạo sau khi đóng gọi route `active`: 409 `EXAM_CLOSED`.
- `docs/DESIGN.md`:
  - Luồng thu bài: đóng, thu hồi phiên với `revoked_at = closed_at`, rồi chấm.
  - Khóa đồng thời `exam_classes FOR UPDATE`, dùng chung giữa Bắt đầu / Thu bài / Xóa đề.
  - Presence 15 giây dùng chung.
- `docs/changes/TECHNICAL_REQUIREMENT_GAPS.md`: G-06 chuyển sang resolved.
- `docs/ERD.md`: no schema change.

## Residual risk
- Lập luận khóa (MAJOR-1, MINOR-4) không tái hiện được bằng PGlite một kết nối; đánh giá theo ngữ nghĩa READ COMMITTED của Postgres. Nên smoke trên Postgres thật khi chạy E2E.
- AC "kiểm thử trọn vẹn bằng tay trên web" chưa có evidence. Kịch bản: tạo bài, phát đề, 2 học sinh nộp, thu bài, xem điểm. Theo brief, dispatcher chạy E2E API và user thử web sau merge; không tính FAIL ở vòng này.
- Responsive chỉ xác minh bằng CSS math ở 1280; 375/768 là N/A (desktop-only).
- aislop/ocr/oxlint không chạy được; `wc -l` bị agent-guard chặn (đếm bằng Grep count).
- Chưa đếm dòng hai file `apps/web/src/app/giao-vien/{bai-thi,phong-thi}/page.tsx` (page wrapper, build PASS).

## Verdict
**PASS**. Đã đóng MAJOR-1, MAJOR-2 và các MINOR/NIT của round 1; không có CRITICAL/MAJOR mới. MINOR-A/B/C và NIT-1/2 không chặn, có thể làm ở task sau.
