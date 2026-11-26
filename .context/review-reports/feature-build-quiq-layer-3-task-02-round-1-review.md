Agent: reviewer

# Review: build-quiq layer-3-task-02 (round 1): giáo viên tạo bài thi, phát đề, thu bài, roster

- Worktree: `E:\Quiq\.worktrees\layer-3__task-02` (branch `wt/layer-3__task-02`, base 455c348, thay đổi chưa commit)
- Review level: **STRICT**
- Reason: quyền sở hữu/tenant (school + teacher), transaction tạo đề, snapshot thiết lập trường, thay đổi `requireStudentSession` (phiên học sinh, shared auth path), đồng thời Bắt đầu và Thu bài (concurrency), xóa dây chuyền nhiều bảng.
- Blast radius: API mới `apps/api/src/modules/exams/**`, `apps/api/src/modules/class-control/**` (9 endpoint giáo viên); `apps/api/src/modules/student/student-session.ts` (mọi route học sinh dùng `read`: `GET /student/state`, `POST /student/attempts/:id/submit`, `GET /student/attempts/:id/result`); `packages/shared/src/student/schemas.ts` (hằng số mới, dùng chung student và roster); shared `@quiq/shared/exams`; web `/giao-vien/bai-thi`, `/giao-vien/phong-thi`. Dữ liệu: `exams`, `exam_questions`, `exam_options`, `exam_classes`, `attempts`, `student_sessions`, `waiting_presence`.

## Verify commands + result

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (5 package, không lỗi) |
| `pnpm lint` | PASS (eslint không cảnh báo) |
| `pnpm test` | PASS: 31 file, **385/385** test (khớp số builder báo) |
| `pnpm build` | PASS (exit 0) |

## Responsive Checklist Gate

Task AC và design-spec §9 ghi màn giáo viên **chỉ desktop**; profile có `ui.responsive_breakpoints: [375, 768, 1280]`.

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Layout 1280 (không tràn ngang) | OK (CSS math) | `control-panel.tsx:62` `grid-cols-[1fr_16rem_auto]`, `:239` `grid-cols-4`: ở 1280px đủ chỗ (16rem = 256px + nút + cột co giãn) |
| Layout 375/768 | N/A | Task ghi rõ "chỉ desktop" (AC Web); không yêu cầu mobile cho màn giáo viên |
| Typography rem / clamp | OK | Tailwind class theo token, không px font mới trong diff |
| Media | N/A | Không có ảnh/video |
| Touch target / nav mobile | N/A | Desktop-only; nav thuộc `features/shell` (không đổi) |
| Table scroll wrapper | N/A desktop | `roster-table.tsx` dùng component bảng chung |
| 100vh / reduced-motion / overflow hidden | OK | Không thấy `100vh`/`overflow-hidden` mới trong file đã đọc |

## Skill gates

| Gate | Kết quả |
|---|---|
| aislop | skip, `aislop` not installed (exit 127) |
| oxlint (anti-slop) | skip, oxlint not configured (không có `.oxlintrc.json`); eslint PASS |
| ocr | skip, ocr not installed |
| AI-readable | OK (2 nhóm indicator: hàm > 50 dòng (`insertExamWithCopies` ~56 dòng, `ControlPanel` ~70 dòng) và file `exams/service.ts` 425 dòng > 300; tên rõ, comment WHY, không magic number lạ). < 3 nhóm, ghi MINOR |
| ai-friendly-web | N/A (màn nội bộ giáo viên, cần đăng nhập) |
| blitzstrike | skip, không có môi trường được phép |
| No em-dash | OK (Grep `—|–` trong mọi file mới: 0 kết quả) |
| Ownership (file cấm) | OK: chỉ sửa `student/student-session.ts`, `shared/student/schemas.ts` (không thuộc danh sách cấm); `finalize.ts`, `questions/**`, `auth/**`, `http/**`, `app.ts`, `packages/db/**`, `docs/**`, `package.json`, lockfile không đổi |

## Kiểm theo checklist STRICT

1. **Thay đổi phiên học sinh**: chỉ mở `read`, nhánh `active` không đổi (`student-session.ts:167-172`). Điều kiện `revoked_at >= closed_at` có thể đúng cho phiên bị thu hồi vì vào thi máy khác SAU khi lớp đóng, nhưng `read` chỉ lộ trạng thái/nộp/kết quả của chính học sinh đó; mức MINOR. Test mới có cho nhánh "thu hồi bởi thu bài" và "thu hồi TRƯỚC thu bài" (`class-control.test.ts:115,193`); thiếu test "thu hồi bởi máy khác sau thu bài". Test cũ student/attempts xanh.
2. **Race Bắt đầu và Thu bài**: chặn, xem MAJOR-1.
3. **Thu bài không transaction bao ngoài**: không tự phục hồi, xem MAJOR-2.
4. **Tạo đề**: OK. `drawQuestions` chạy trong transaction trước mọi insert (`exams/service.ts:175-176`), thiếu câu ném 422 không ghi hàng (test `exams.test.ts:108`); ngân hàng lọc school + teacher + subject (`:97-103`); lớp kiểm theo `assignments` năm hiện tại, 403 `CLASS_NOT_ASSIGNED` (`:117-124`, test `:135`); mã pre-check `upper()` + bắt unique violation, retry ngoài transaction (`:253-265`, test va chạm `:148`). classIds dedupe ở schema.
5. **IDOR/tenant**: OK. Mọi route `staffGuard(deps, ["teacher"])`; `loadOwnedExamClass` lọc examId + classId + school + teacher, khác → 404 (`class-control/service.ts:34-63`); update dispatch/close theo `examClasses.id` đã sở hữu; id sai định dạng → 404. Test cô lập `class-control.test.ts:205`, `exams.test.ts:207`.
6. **Snapshot**: OK. Dispatch chụp `max_attempts/warn_limit/interrupt_secs`, update có điều kiện `status='draft'` (`class-control/service.ts:109-120`); test đổi trường sau phát + lớp B vẫn draft (`class-control.test.ts:74`).
7. **Xóa đề**: OK, chặn khi có attempt và kiểm lại trong transaction; xóa con trước cha (`exams/service.ts:401-423`). Xem MINOR-4 về cửa sổ còn lại.
8. **Đáp án trong `GET /teacher/exams/:id`**: OK, chỉ qua route teacher có guard + `getExamSummary` lọc chủ sở hữu; không route học sinh nào gọi `getExamDetail`.
9. **Roster**: OK. Chỉ học sinh ghi danh lớp đó, mã chưa vô hiệu (`class-control/service.ts:225-236`); ưu tiên in_progress > submitted > waiting > not_started; presence 15 giây theo `deps.clock`; lớp closed không còn "waiting".
10. **Web**: OK. Dialog tạo đề, dialog xác nhận phát/thu (nêu số đang làm), polling 3 giây có `clearInterval` + cờ `cancelled` khi unmount/đổi lớp (`use-roster.ts:44-67`), loading/empty/error có.
11. **Ownership**: OK (bảng trên).
12. **Doc-Impact**: chưa reconcile trong worktree (đúng phân công: dispatcher làm ở close-out). Xem mục Doc-Impact.

## Findings

### [MAJOR-1] Race Bắt đầu vs Thu bài để lại attempt `in_progress` trong lớp đã `closed`
- `apps/api/src/modules/attempts/start.ts:64-75`: `insertAttempt` đọc `examClasses.status` trong transaction nhưng **không khóa** hàng. `closeClass` (`class-control/service.ts:150-162`) đóng lớp bằng một autocommit riêng; lần quét thứ hai chỉ bắt được lần Bắt đầu đã commit TRƯỚC lần quét đó.
- Kịch bản: transaction Bắt đầu đọc `dispatched` trước bước (1) và commit sau lần quét thứ hai (dễ xảy ra hơn khi lớp đông, vì bước 2 chạy tuần tự từng `finalizeAttempt`). Kết quả: lớp `closed` còn attempt `in_progress` (vi phạm AC4 "mọi attempt đang làm được nộp ngay và chấm"); phiên của học sinh đã bị thu hồi ở bước (3) nên `GET paper` và `PUT answers` (yêu cầu `active`) trả 401 trong khi `state` (read, nhánh mới) báo `in_progress`, học sinh kẹt trên bài không làm được; `enterExam` trả 409 `ATTEMPT_IN_PROGRESS` cho MỌI bài thi khác (BR-004) tới khi `endsAt + grace` (tối đa 300 phút) và chỉ khi có request kiểm lười; roster hiện "Đang làm" cho lớp đã thu bài.
- Fix đề xuất (L3-02 được sửa có giới hạn): khóa hàng lớp trong transaction start, ví dụ `.for("update", { of: examClasses })` (hoặc `for share`) trên select ở `start.ts:64-75`. Update bước (1) của close khi đó phải chờ start commit, và lần quét bước (2) sẽ thấy attempt mới. Sau khi có khóa, lần quét thứ hai có thể giữ làm phòng hờ. PGlite một kết nối không tái hiện được race; đánh giá theo lập luận, nhưng thêm một test khẳng định Bắt đầu sau khi close trả `EXAM_CLOSED` vẫn nên giữ.

### [MAJOR-2] Thu bài lỗi giữa chừng không có đường phục hồi
- `apps/api/src/modules/class-control/service.ts:146-162`: nếu bước (2) hoặc (3) ném lỗi sau khi bước (1) đã commit, lớp ở `closed`, attempt còn `in_progress`, phiên còn hiệu lực. `saveAnswer` (`attempts/service.ts:155`) không kiểm trạng thái lớp nên học sinh tiếp tục lưu đáp án sau "thu bài". Gọi lại close trả 409 `CLASS_ALREADY_CLOSED` (`:147` qua `rejectByStatus`) và web tắt nút khi `status !== "dispatched"` (`control-panel.tsx:135`), nên không có cách nào hoàn tất.
- Fix đề xuất: khi lớp đã `closed`, close chạy lại bước (2) và (3) (cả hai idempotent: `finalizeAttempt` bỏ qua attempt đã nộp, revoke lọc `revoked_at IS NULL`) rồi trả kết quả (200 với `finalizedAttempts` = số vừa chốt), thay vì 409; hoặc giữ 409 cho UI nhưng vẫn quét trước khi ném. Dùng `closedAt` đã lưu (không phải `now` mới) làm `revokedAt` để nhánh `wasRevokedByClassClose` vẫn đúng (`>=` vẫn thỏa với now mới, nên cả hai đều được). Thêm test: lớp `closed` còn attempt `in_progress` + phiên hiệu lực, gọi close thì attempt được chấm và phiên bị thu hồi.

### [MINOR-1] `exams/service.ts` 425 dòng (> 300); `insertExamWithCopies` (`:173-228`, ~56 dòng) và `ControlPanel` (`control-panel.tsx:31-101`, ~70 dòng) > 50 dòng
- Fix: tách phần đọc (list/detail/summary) sang `exams/queries.ts`; tách bước sao chép đáp án ra hàm riêng; tách phần chọn bài/lớp của `ControlPanel` thành component con.

### [MINOR-2] Retry tạo đề nuốt mọi unique violation
- `exams/service.ts:262`: `isUniqueViolation(error)` bắt mọi vi phạm duy nhất trong transaction, không riêng `exams_code_key`; lỗi duy nhất khác (vd trùng `exam_classes` hay vị trí câu) sẽ bị retry 8 lần rồi thành `Error` chung (500, `:266`). Fix: chỉ retry khi constraint là `exams_code_key`; lỗi hết lượt nên ném `AppError("INTERNAL")` có thông điệp.

### [MINOR-3] Nhánh `read` mới chấp nhận phiên bị thu hồi vì vào máy khác SAU khi lớp đóng
- `student-session.ts:181-195`: `revoked_at >= closed_at` không phân biệt lý do thu hồi. Chỉ lộ dữ liệu của chính học sinh nên không chặn. Ghi thêm test cho trường hợp này, hoặc so bằng `revokedAt === closedAt` nếu close (MAJOR-2) dùng chung `closedAt`.

### [MINOR-4] Xóa đề vẫn còn cửa sổ nhỏ với một lần Bắt đầu
- `exams/service.ts:411-421`: `$count` trong transaction không khóa `exam_classes`; một attempt chen vào sau lần đếm sẽ làm `delete examClasses` lỗi FK (500, rollback, không mất dữ liệu). Sửa chung với MAJOR-1 (khóa `exam_classes` FOR UPDATE trong delete) để trả 409 sạch.

### [NIT] Ngoài scope
- `enterExam` (`student/service.ts:103-147`, có sẵn từ L2) cấp phiên `active` cho lớp đã `closed`; không gây hại vì Bắt đầu bị chặn, nhưng "thu hồi mọi phiên khi thu bài" chỉ đúng tại thời điểm thu. Đề xuất task riêng.

## Doc-Impact (dispatcher làm ở close-out, trailer KHÔNG được `none`)
- `docs/API_SPEC.md`: 9 endpoint mới: `GET /api/teacher/exams/classes`, `GET /api/teacher/exams/bank-counts`, `GET|POST /api/teacher/exams`, `GET|DELETE /api/teacher/exams/:id`, `POST .../:examId/classes/:classId/dispatch`, `POST .../close`, `GET .../roster`, kèm mã lỗi `INSUFFICIENT_QUESTIONS`, `CLASS_NOT_ASSIGNED`, `EXAM_HAS_ATTEMPTS`, `CLASS_ALREADY_*`, `CLASS_NOT_DISPATCHED`; hành vi mới của phiên học sinh `read` khi lớp đã thu bài.
- `docs/DESIGN.md`: luồng thu bài (3 bước + quét lại, sau khi sửa MAJOR), presence 15 giây dùng chung.
- `docs/changes/TECHNICAL_REQUIREMENT_GAPS.md`: G-06 → resolved sau khi sửa MAJOR-1/2.
- `docs/ERD.md`: no schema change.

## Residual risk
- Race (MAJOR-1) không tái hiện được bằng PGlite (một kết nối); fix phải được đánh giá theo lập luận khóa hàng.
- AC "Kiểm thử trọn vẹn bằng tay trên web" (tạo bài → phát → 2 học sinh nộp → thu → điểm) **chưa có evidence**; reviewer không chạy server theo brief. Journal ghi dispatcher sẽ smoke E2E sau merge và user thử web ở checkpoint Layer 3; bắt buộc chạy và ghi kết quả trước close-out.
- Responsive chỉ xác minh bằng CSS math ở 1280; 375/768 N/A theo "chỉ desktop".
- aislop/ocr/oxlint không chạy được (chưa cài/chưa cấu hình).

## Verdict
**FAIL** (2 MAJOR). Builder cần sửa MAJOR-1 (khóa `exam_classes` trong start) và MAJOR-2 (close phục hồi được khi đã `closed`), kèm test; MINOR nên sửa cùng vòng nếu gọn.
