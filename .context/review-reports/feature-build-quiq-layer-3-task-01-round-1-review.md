Agent: reviewer

# Review: build-quiq layer-3-task-01 (ngân hàng câu hỏi giáo viên), round 1

- Worktree: `E:\Quiq\.worktrees\layer-3__task-01` (branch `wt/layer-3__task-01`, base 455c348)
- Review level: **NORMAL**, phần cô lập chủ sở hữu + trường (tenant/IDOR) review ở mức **STRICT** (dùng cap đọc STRICT 25 vì phần tenant; đã dùng hết cap).
- Reason: lát cắt dọc CRUD mới, toàn file mới, không đụng schema/migration/shared http. Có rủi ro đỏ tenant/ownership isolation nên service/routes soi theo STRICT.
- Blast radius: 5 endpoint mới `/api/teacher/questions[/:id]` (chỉ role teacher); bảng `questions` + `question_options` (ghi); gói `@quiq/shared/questions` (schema dùng chung api + web, L3-02 có thể đọc `DIFFICULTIES`); route web `/giao-vien/ngan-hang`. Không file đã track nào bị sửa (`git status --short --untracked-files=all` chỉ có 11 file `??`).

## Verify commands + result

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (5 workspace, web `next typegen` OK) |
| `pnpm lint` | PASS (eslint apps packages, 0 lỗi) |
| `pnpm test` | PASS, 30 files, **391/391** tests (khớp lời builder) |
| `pnpm build` | PASS, route `/giao-vien/ngan-hang` static |

## Kiểm theo các điểm được yêu cầu

1. **IDOR/tenant (STRICT)**: OK.
   - `apps/api/src/modules/questions/service.ts:37-41` `ownedBy`/`ownedQuestion` = `school_id = tenantSchoolId(ctx)` AND `teacher_id = staffId` (AND `id`).
   - GET list/stats/:id dùng điều kiện này (`service.ts:83,99,118`); options đọc thêm lọc `school_id` (`:62`).
   - PUT: `UPDATE ... WHERE ownedQuestion ... RETURNING` chính là bước ghi có điều kiện sở hữu, không có đọc-rồi-ghi tách rời; không trả hàng → `NOT_FOUND` ném trong transaction → rollback trước khi xóa/chèn options (`service.ts:169-180`). Xóa options chỉ chạy sau khi UPDATE có điều kiện sở hữu thành công, cùng tx, kèm `school_id`. Không có TOCTOU.
   - DELETE: `DELETE ... WHERE ownedQuestion RETURNING`, rỗng → 404 (`service.ts:185-186`).
   - Scope từ phiên: `loadTeacherScope` join `staff_accounts` + `subjects` theo `school_id` (`service.ts:26-34`). Body schema không có subjectId/teacherId/schoolId, zod object mặc định strip; test `questions.test.ts:90-111` chứng minh khóa lạ bị bỏ.
   - Role: `staffGuard(deps, ["teacher"])` (`routes.ts:32`) → `school_admin` 403 (test `:81-86`); `super_admin` 403 theo guard (không có test riêng, NIT-3). Giáo viên khác cùng trường + trường khác → 404 GET/PUT/DELETE, danh sách rỗng, câu gốc không đổi (test `:201-223`).
   - id không phải uuid → 404 thay vì 500 (`routes.ts:21-25`, test `:192-198`).
2. **PUT thay options trong transaction**: OK (`service.ts:169`). Delete trước insert cùng tx nên không đụng unique `(question_id, position)`; lỗi giữa chừng rollback toàn bộ, câu không mất đáp án.
3. **Validate**: OK. 2-4 đáp án, >=1 đúng, single-select đúng 1 (`schemas.ts:39-47`), nội dung trim + min 1, max 5000/1000, difficulty enum; query `difficulty` lạ → 422 (test `:278-281`), `page` coerce int >=1. Xem MINOR-1 về `page` không có cận trên.
4. **BR-002**: OK. `packages/db/src/schema/exam.ts:63,72` `source_question_id` cố ý không có FK; `question_options` FK ghép `(school_id, question_id)` `onDelete cascade` (`packages/db/src/schema/bank.ts:65-69`) → xóa câu xóa đáp án, đề đã ra giữ bản sao.
5. **Rủi ro đổi môn**: không áp dụng. `SPECIFICATIONS.md:50,65`, BR-017 (`:136`), out-of-scope (`:202`): giáo viên gắn đúng một môn cố định, không đổi được. Ngân hàng không lọc theo môn vẫn nhất quán với L3-02 rút theo môn. Không cần gap; chỉ NIT-4 phòng thủ.
6. **Web**: OK về hành vi. Loading skeleton (`question-list.tsx:189,290-302`, KPI `loading`), empty "Chưa có câu hỏi nào" + nút "Thêm câu hỏi" (`:192-206`), empty theo filter (`:207-214`), error + "Thử lại" (`:174-188`). Lỗi gần ô từ zod client và 422 `details` dùng chung `toFieldErrors` (`question-editor-dialog.tsx:56-60,169-171`). Focus trả về nút mở bằng `useReturnFocus` (`question-list.tsx:32-43`), test web có Esc/focus (`questions.test.tsx:194,270`). `Button`/`IconButton` mặc định `type="button"` (`components/ui/button.tsx:52,90`) nên Hủy/Thêm đáp án không submit nhầm. Không em-dash, không hex thô (Grep 0 kết quả trong web + shared). Design-spec §9.1 khớp, trừ ảnh (ngoài scope theo task Notes).
7. **Ownership file**: OK. Không file tracked bị sửa; không đụng `nav-config.ts`, `http/**`, `testing/**`, `packages/db/**`, `docs/**`. 11 file mới đúng danh sách "Files to Create/Modify" (builder báo 12, NIT-5).
8. **Doc-Impact**: xem mục dưới.

## Responsive Checklist Gate

Profile `.context/project-config.md:139-140` khai `ui.responsive_breakpoints: [375, 768, 1280]`, nhưng design-spec là nguồn chính sách: `.context/design-spec.md:22` "Giao diện chỉ cho máy tính", `:31` "< 1024: toàn màn hiện thông báo ... không render nội dung" (do shell chung, không thuộc diff). Vì vậy 375/768 không render màn này; kiểm ở 1024-1279 và >= 1280 theo §1.
- Layout: OK. 375/768: N/A (bị chặn bởi thông báo desktop-only theo design-spec §1). 1024 (sidebar 276px → vùng nội dung ~700px): KPI `grid-cols-4` ~170px/cột vẫn đủ cho số + nhãn; header `flex justify-between`, pill row 4 nút, dòng câu `min-w-0 flex-1` + nhóm nút `shrink-0` không tràn ngang (CSS math, chưa có browser). Không container width px cố định.
- Typography/Spacing: OK, token Tailwind (rem), không px thô.
- Media: N/A (chưa có ảnh trong task này).
- Touch/Interaction: OK, pill/label radio/checkbox `min-h-11` (44px); nav N/A; table N/A (danh sách dạng card).
- Viewport/A11y: OK, không dùng `100vh`, không `overflow:hidden` che lỗi; transition 150ms qua token chung (reduced-motion chưa xác minh trên browser, xem Residual risk).

## Skill gates

- aislop: skip, `aislop` not installed (exit 127).
- oxlint (anti-slop): skip, oxlint not configured (không có `.oxlintrc*`). eslint PASS.
- ocr (open-code-review): skip, `ocr` v1.14.4 có cài; `ocr review --format json` chạy nền, tại thời điểm ghi report output chỉ có lỗi 429 quota Gemini free tier, chưa có finding nào. Không kiểm chứng được, không chặn PASS/FAIL. Nếu dispatcher muốn, xem output cuối ở `C:\Users\DUCDAO~1\AppData\Local\Temp\claude\3657ae16b6baf5ce\ccd0ed22-7cb1-4bf0-8bce-c6ed46ed2476\tasks\bzzdzn7sj.output`.
- AI-readable (`skills/ai-readable-codebase/SKILL.md` §6): OK (không FAIL). Indicator thấy: (a) "Hàm >50 dòng" (`QuestionEditorForm` ~107, `QuestionBank` ~82, `OptionsEditor` ~84; không component nào >200); (b) magic number 1000/5000 (`schemas.ts:20,31`). 2 < 3. Comment chủ yếu WHY.
- ai-friendly-web: N/A (màn nội bộ cần đăng nhập).
- blitzstrike: skip, không có môi trường được phép; thay bằng kiểm tĩnh + test IDOR.

## Findings

Không có CRITICAL. **1 MAJOR.**

- **[MAJOR-1]** Vượt giới hạn cấu hình `ui.max_file_lines: 300` (`.context/project-config.md:141`): `apps/web/src/features/questions/question-editor-dialog.tsx` 365 dòng, `apps/web/src/features/questions/question-list.tsx` 364 dòng. Đây là luật project khai rõ, sửa rẻ. Fix (không đổi hành vi):
  - Tách `DeleteQuestionDialog` (`question-list.tsx:304-363`) sang `delete-question-dialog.tsx`; tách `QuestionRow` + `correctAnswersText` + `DifficultyFilter` (hoặc `QuestionListSkeleton`) sang file riêng, ví dụ `question-row.tsx`.
  - Tách `OptionsEditor` + `DifficultyPicker` + `InlineError` (`question-editor-dialog.tsx:218-364`) sang `question-editor-fields.tsx`.
  - Thêm file mới vào phạm vi `apps/web/src/features/questions/**` là chấp nhận được (cùng thư mục sở hữu của task).
- **[MINOR-1]** `packages/shared/src/questions/schemas.ts:53` `page` không có cận trên. Có thể gây 500 khi `page` cực lớn (offset vượt bigint) nếu zod `.int()` không chặn giá trị ngoài safe-integer; chưa kiểm chứng. Fix: thêm `.max(...)` hợp lý (vd 10000).
- **[MINOR-2]** Hàm/component > `max_function_lines: 50` (`project-config.md:142`): `QuestionEditorForm` (`question-editor-dialog.tsx:109-216`), `QuestionBank` (`question-list.tsx:46-128`), `OptionsEditor` (`question-editor-dialog.tsx:228-312`). Phần lớn là JSX; tách khi làm MAJOR-1 (vd hook `useQuestionDraft` cho các handler draft).
- **[MINOR-3]** `question-editor-dialog.tsx:149-150,264` lỗi theo index `options.<i>.content` không dọn khi xóa đáp án, lỗi cũ có thể hiện dưới đáp án đã dịch chỗ tới lần submit sau. Fix: xóa các key `options.*` trong `errors` ở `removeOption`.
- **[NIT-1]** `schemas.ts:20,31` số 1000/5000: đặt hằng `QUESTION_CONTENT_MAX`/`QUESTION_OPTION_CONTENT_MAX` cạnh `QUESTION_OPTION_MAX`.
- **[NIT-2]** `question-list.tsx:277,281` `aria-label` "Sửa câu hỏi"/"Xóa câu hỏi" trùng cho mọi dòng; cân nhắc `aria-describedby` trỏ tới nội dung câu.
- **[NIT-3]** Thiếu test `super_admin` gọi `/api/teacher/questions` (guard đã chặn về logic).
- **[NIT-4]** Có thể thêm `eq(questions.subjectId, scope.subjectId)` vào `ownedBy` để khớp tuyệt đối với L3-02; không bắt buộc vì BR-017.
- **[NIT-5]** Builder báo 12 file mới, thực tế 11 (đúng danh sách task).

## Doc-Impact

**Bắt buộc, không được `none`.** Close-out dispatcher thêm vào `docs/API_SPEC.md` 5 endpoint: `GET /api/teacher/questions?difficulty=&page=` (response `QuestionListResult`: subject, stats không theo filter, items, total, page, pageSize=25), `POST /api/teacher/questions` (201), `GET/PUT/DELETE /api/teacher/questions/:id` (PUT thay toàn bộ options; DELETE trả `{ id }`; không thuộc chủ/trường hoặc id không phải uuid → 404; role khác teacher → 403; body sai → 422 `VALIDATION` + `details[{path,message}]`). `docs/DESIGN.md` current-state: thêm module questions + màn `/giao-vien/ngan-hang` nếu file liệt kê module/route. ERD: no doc impact (không đổi schema).

## Residual risk

- ocr chưa ra finding (rate-limit), aislop không cài: không có scan tự động thứ hai.
- Không chạy browser: layout 1024 và focus/keyboard chỉ xác minh bằng CSS math + test jsdom; reduced-motion chưa xác minh.
- `school_admin` được spec cho "xem (không sửa) câu hỏi" (`SPECIFICATIONS.md:49`): endpoint này đúng là chỉ teacher; cần đảm bảo graph có task cho phần xem của admin.
- Concurrency PUT/DELETE cùng câu: an toàn theo khóa hàng UPDATE/DELETE của Postgres, chưa có test song song (PGlite một kết nối).
- Đã dùng hết cap đọc STRICT (25); không đọc `errors.ts`, `index.ts` của shared (typecheck/build/test PASS bao phủ).

## Verdict

**FAIL** (1 MAJOR: vượt `max_file_lines: 300` ở 2 file web). Logic API, cô lập tenant/chủ sở hữu, transaction, validate, BR-002 và UI states đều đạt; round 2 chỉ cần tách file (MAJOR-1), nên kèm MINOR-1..3. Không commit/push khi chưa PASS.
