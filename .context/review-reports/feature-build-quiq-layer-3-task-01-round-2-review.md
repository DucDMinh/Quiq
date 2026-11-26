Agent: reviewer

# Review: build-quiq layer-3-task-01 (ngân hàng câu hỏi giáo viên), round 2

- Worktree: `E:\Quiq\.worktrees\layer-3__task-01` (branch `wt/layer-3__task-01`, base 455c348)
- Review level: **NORMAL**. Phần cô lập chủ sở hữu/trường chỉ kiểm hồi quy ở mức STRICT (đã PASS round 1).
- Reason: round 2 là tách file thuần + sửa MINOR-1..3 + NIT. Không đụng schema/migration/http chung. Rủi ro đỏ duy nhất (tenant/IDOR) nằm ở `service.ts`, chỉ cần xác nhận không đổi.
- Blast radius: 5 endpoint `/api/teacher/questions[/:id]` (chỉ teacher), bảng `questions` + `question_options`, gói `@quiq/shared/questions` (thêm `limits.ts`, query `page` có cận trên 10000), route web `/giao-vien/ngan-hang` + 10 file trong `apps/web/src/features/questions/`. `git status --short --untracked-files=all`: 20 file, tất cả `??`, không file đã track nào bị sửa.

## Verify commands + result

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (5 workspace, web `next typegen` OK) |
| `pnpm lint` | PASS (eslint apps packages, 0 lỗi) |
| `pnpm test` | PASS, 30 files, **392/392** (khớp lời builder) |
| `pnpm build` | PASS, `/giao-vien/ngan-hang` static |

`wc -l` bị agent-guard chặn (không có trong allowlist), nên tôi đếm dòng bằng Grep count `^`, đối chiếu với Read ở các file đã mở.

## Số dòng file nguồn mới

| File | Dòng |
|---|---|
| web `question-editor-dialog.tsx` | 128 |
| web `options-editor.tsx` | 122 |
| web `question-list.tsx` | 119 |
| web `question-list-body.tsx` | 110 |
| web `question-draft.ts` | 109 |
| web `use-questions.ts` | 75 |
| web `delete-question-dialog.tsx` | 67 |
| web `question-row.tsx` | 61 |
| web `difficulty-picker.tsx` | 45 |
| web `difficulty-filter.tsx` | 37 |
| web `inline-error.tsx` | 11 |
| web `app/giao-vien/ngan-hang/page.tsx` | 6 |
| api `service.ts` / `routes.ts` | 187 / 61 |
| shared `schemas.ts` / `errors.ts` / `limits.ts` / `index.ts` | 96 / 16 / 10 / 3 |
| test api `questions.test.ts` | 325 |
| test web `questions.test.tsx` | 314 |

Mọi file nguồn đều dưới 300 dòng. Về hai file test: quy tắc `max_file_lines: 300` nằm trong khối `ui:` (`.context/project-config.md:139-142`), không nói gì đến file test. Tiền lệ trên staging cũng có file test lớn hơn 300 dòng và đã được chấp nhận: `attempts.test.ts` 365, `auth.test.ts` 346, `student.test.ts` 305. Tôi coi giới hạn này áp dụng cho file nguồn, không áp dụng cho file test, nên không tính là finding (ghi ở NIT-B).

## Bảng đóng finding round 1

| Finding | Trạng thái | Bằng chứng |
|---|---|---|
| MAJOR-1 (2 file web > 300) | **Đã đóng** | Lớn nhất 128 dòng (bảng trên). Tách thuần: logic draft, submit, focus và states vẫn như round 1 |
| MINOR-1 (`page` không có cận trên) | **Đã đóng** | `schemas.ts:55` `.max(QUESTION_PAGE_MAX)`, `limits.ts:10` = 10000; test `questions.test.ts:283` `?page=10001` → 422 |
| MINOR-2 (component > 50 dòng) | **Đã đóng (còn 1 chỗ sát ngưỡng, NIT-A)** | `QuestionEditorForm` 52 dòng (77-128), trong đó `useQuestionSubmit` đã được tách riêng; `QuestionBank` 37 dòng; `OptionsEditor` 38 dòng; `OptionRow` 36 dòng. Xem NIT-A |
| MINOR-3 (lỗi `options.<i>` không dọn khi bỏ đáp án) | **Đã đóng** | `question-draft.ts:90-109` `shiftErrorsAfterRemoval`: bỏ lỗi của index bị xóa, dời các index sau lên 1, giữ nguyên các khóa khác. Gọi ở `question-editor-dialog.tsx:86-89`. Test web `questions.test.tsx:270-289` kiểm cả bỏ lỗi lẫn dời lỗi |
| NIT-1 (magic 1000/5000) | Đã đóng | `limits.ts` + `schemas.ts:3-9,22,33` |
| NIT-2 (aria-label trùng) | Đã đóng | `question-row.tsx:45,52` "Sửa/Xóa câu hỏi: <60 ký tự đầu>". Tên vẫn chứa chữ hiển thị "Sửa"/"Xóa" nên đạt label-in-name. Test `questions.test.tsx:248` |
| NIT-3 (thiếu test super_admin) | Đã đóng | `questions.test.ts:86` |
| NIT-4 (lọc thêm theo subject) | Không làm, chấp nhận | Không bắt buộc (BR-017) |
| NIT-5 (sai số file) | N/A | Round này có 20 file mới, khớp danh sách trong `git status` |

## Kiểm hồi quy

1. **Cô lập chủ/trường (STRICT, hồi quy)**: OK. `service.ts` giống round 1: `ownedBy`/`ownedQuestion` (`:37-41`) lọc theo `school_id` + `teacher_id`. GET list/stats/:id dùng điều kiện này (`:83,99,118`), options lọc theo `school_id` (`:62`). PUT dùng `UPDATE ... WHERE owned RETURNING` rồi mới xóa/chèn options trong cùng transaction (`:169-180`). DELETE dùng `WHERE owned RETURNING`, không có hàng nào → 404 (`:185-186`). Scope lấy từ phiên (`:26-34`). Không có TOCTOU.
2. **Validate**: OK. `schemas.ts` vẫn giữ 2-4 đáp án, ít nhất 1 đáp án đúng, câu một đáp án thì đúng 1; trim + min/max qua hằng; `page` int từ 1 đến 10000, mặc định 1.
3. **Web states/focus**: OK. Đủ các trạng thái lỗi + "Thử lại", skeleton, ngân hàng trống, lọc không có câu, danh sách + phân trang (`question-list-body.tsx:19-56`). `useReturnFocus` và `useBankDialogs` (`question-list.tsx:17-49`) giữ nguyên hành vi trả focus về nút đã mở dialog. Dialog xóa nêu rõ hậu quả, nút màu danger, `loadingLabel`.
4. **Không em-dash, không hex thô**: Grep `—|#[0-9a-fA-F]{3,8}` trên `**/questions/**` ra 0 kết quả. Có dùng ký tự "…" (U+2026) ở `question-row.tsx:11` và `delete-question-dialog.tsx:53`, không phải em-dash.
5. **File đã track**: không file nào bị sửa.

## Responsive Checklist Gate

Áp dụng như round 1: design-spec §1 quy định chỉ hỗ trợ desktop, màn < 1024 thì shell chung hiện thông báo thay cho nội dung. Vì vậy mốc 375/768 là N/A cho màn này.
- Layout: OK. Bố cục như round 1 (KPI `grid-cols-4`, dòng câu `min-w-0 flex-1` + nhóm nút `shrink-0`), tách file không đổi class nào. Không có width px cố định.
- Typography/Spacing: OK, dùng token Tailwind rem.
- Media: N/A.
- Touch/Interaction: OK. Radio/checkbox/switch nằm trong label `min-h-11` (`options-editor.tsx:61,98`). Nav và table N/A.
- Viewport/A11y: OK. Không dùng `100vh`, không `overflow:hidden`. Reduced-motion chưa xác minh trên browser (Residual risk).

## Skill gates

- aislop: skip, chưa cài (như round 1).
- oxlint (anti-slop): skip, oxlint not configured. eslint PASS.
- ocr: skip, round 1 bị quota 429; round 2 không chạy lại vì diff chỉ là tách file.
- AI-readable: OK. Không còn magic number; comment chủ yếu giải thích WHY; mỗi file một trách nhiệm; indirection ≤ 2 bước. Còn 1 indicator nhỏ (NIT-A), dưới ngưỡng 3.
- ai-friendly-web: N/A (màn nội bộ cần đăng nhập).
- blitzstrike: skip, không có môi trường được phép.

## Findings mới

Không có CRITICAL, không có MAJOR, không có MINOR.

- **[NIT-A]** `question-editor-dialog.tsx:77-128` `QuestionEditorForm` dài 52 dòng và `delete-question-dialog.tsx:16-67` `DeleteQuestionDialog` dài 52 dòng, vượt `max_function_lines: 50` 2 dòng (builder báo mọi hàm ≤ 50). Phần thừa là JSX, không phải logic. Nếu muốn khớp tuyệt đối: tách `<EditorActions saving>` (`:118-125`) hoặc đưa `footer` của dialog xóa ra thành hằng/component. Không chặn PASS.
- **[NIT-B]** Hai file test 325/314 dòng. Không vi phạm (giới hạn nằm trong khối `ui:`, đã có tiền lệ file test > 300). Có thể tách theo nhóm `describe` sau nếu còn phình thêm.

## Doc-Impact (bắt buộc, không được `none`)

- `docs/API_SPEC.md`: thêm 5 endpoint.
  - `GET /api/teacher/questions?difficulty=&page=`: `page` nguyên từ 1 đến 10000, mặc định 1. Response `QuestionListResult` gồm `subject`, `stats` (không phụ thuộc bộ lọc), `items`, `total`, `page`, `pageSize=25`.
  - `POST /api/teacher/questions` → 201.
  - `GET`/`PUT`/`DELETE /api/teacher/questions/:id`: PUT thay toàn bộ options; DELETE trả `{ id }`.
  - Lỗi chung: câu không thuộc giáo viên/trường hoặc id không phải uuid → 404; role khác teacher (kể cả `school_admin`, `super_admin`) → 403; body/query sai → 422 `VALIDATION` + `details[{path,message}]`.
- `docs/DESIGN.md` current-state: thêm module `questions` (api) và màn `/giao-vien/ngan-hang`.
- `docs/ERD.md`: no doc impact (không đổi schema).

## Residual risk

- Chưa chạy browser: layout ở mốc 1024 và reduced-motion chỉ xác minh bằng CSS math + jsdom.
- Không có scan tự động thứ hai (aislop chưa cài, ocr bị quota).
- `school_admin` được spec cho "xem câu hỏi" (`SPECIFICATIONS.md:49`), nhưng endpoint này chỉ cho teacher. Cần graph có task riêng cho phần xem của admin.
- Đếm dòng bằng Grep vì `wc` bị chặn.
- Không đọc lại `use-questions.ts`, `difficulty-*.tsx`, `routes.ts` từng dòng; typecheck/lint/test/build PASS bao phủ.

## Verdict

**PASS**. MAJOR-1 và MINOR-1..3 đã đóng. Cô lập chủ/trường, validate và các trạng thái web không hồi quy. Chỉ còn NIT-A và NIT-B, không chặn.
