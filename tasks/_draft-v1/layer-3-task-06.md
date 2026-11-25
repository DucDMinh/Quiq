# Task 06: Giáo viên: ngân hàng câu hỏi và ảnh câu hỏi

## Layer
3

## Type
build

## Description
Lát cắt dọc cho **ngân hàng câu hỏi riêng của giáo viên** (FR-020..FR-024) và **ảnh câu hỏi** (FR-021): soạn câu 2-4 đáp án, 1 hoặc nhiều đáp án đúng, mức khó; tải ảnh (<= 2 MB, jpeg/png/webp, kiểm magic bytes) lên Supabase Storage riêng tư qua proxy Koa có kiểm quyền. Gồm DTO `@quiq/shared/questions` + `@quiq/shared/media`, hai module api `questions` và `media`, trang `/giao-vien/ngan-hang`.

## Dependencies
- layer-2-task-01 (guard, `createTestApp` với storage memory, multipart)
- layer-2-task-02 (AppShell, api-client, `useResource`)
- layer-1-task-06 (`ObjectStorage`, `validateImage`, `questionMediaPath`)
- layer-1-task-04 (bảng `questions`, `question_options`, `media`, fixtures)
- layer-1-task-03 (zod nền, `MEDIA_MAX_BYTES`, `QUESTION_OPTIONS_MIN/MAX`)
- layer-1-task-02 (primitive UI)

## Acceptance Criteria
- [ ] FR-020, FR-023, FR-024: `POST/GET/PATCH/DELETE /api/teacher/questions`: nội dung (<= 2.000 ký tự, lưu văn bản thuần), mức khó đúng 1 trong `easy|medium|hard`, môn lấy **từ phiên giáo viên** (không nhận `subjectId` từ client), chỉ thấy/sửa/xóa câu của **chính mình** (câu của giáo viên khác cùng trường -> 404); danh sách có lọc mức, tìm kiếm, phân trang; ngân hàng còn nguyên qua các năm học.
- [ ] FR-022: 2 đến 4 đáp án (không rỗng, <= 500 ký tự), **ít nhất 1 đáp án đúng**; `multi_answer` do server suy ra từ số đáp án đúng (> 1); lỗi "Cần ít nhất 1 đáp án đúng" tiếng Việt; vị trí đáp án 0..3 ổn định.
- [ ] `GET /api/teacher/questions/stats` trả `{ total, easy, medium, hard }` của giáo viên (dùng cho thẻ KPI và cho dialog tạo bài thi ở L4-01).
- [ ] BR-002 (phía ngân hàng): sửa/xóa câu không ảnh hưởng đề đã ra vì đề sao chép nội dung riêng (test: có `exam_questions` sao chép, sửa/xóa câu gốc không đổi bản sao); xóa câu xóa luôn ảnh ngân hàng của nó (file + dòng `media`) nhưng **không** đụng bản sao ảnh của đề.
- [ ] FR-021 upload: `POST /api/media` (multipart, trường `file` và `alt`), chỉ giáo viên; chặn ngay trên stream khi vượt 2 MB; `validateImage` từ chối sai magic bytes/SVG/GIF/mime lệch; lưu tại `questionMediaPath(schoolId, teacherId, mediaId, ext)`; `alt` bắt buộc (<= 200 ký tự, cho phép giá trị "Ảnh minh họa không mang thông tin"); trả `{ id, mime, size, alt }`. `DELETE /api/media/:id` chỉ cho ảnh chưa gắn câu hỏi nào của chính mình.
- [ ] `GET /api/media/:id` phát ảnh qua proxy với `Content-Type` đúng, `X-Content-Type-Options: nosniff`, `Cache-Control: private`; quyền: giáo viên chủ sở hữu hoặc `school_admin` **cùng trường** (đọc chỉ xem); người khác/trường khác/chưa đăng nhập -> 404/401; **không có URL công khai** của Storage nào lọt ra response. Câu hỏi chỉ gắn được ảnh của chính giáo viên đó.
- [ ] Mọi route khai metadata (`scope: 'school'`, `roles: ['teacher']` hoặc kèm `school_admin` cho `GET /api/media/:id`, `params` entity `question`/`media`); test cô lập: giáo viên trường B không đọc được câu/ảnh trường A (404).
- [ ] Web `/giao-vien/ngan-hang`: tiêu đề nêu môn cố định; 4 thẻ KPI (Tổng, Dễ, Trung bình, Khó); lọc pill theo mức; danh sách câu (nội dung rút gọn 2 dòng, badge mức, ảnh thu nhỏ, đáp án đúng); **dialog soạn câu hỏi** rộng: nội dung, tải ảnh (xem trước, nhập `alt`, báo lỗi quá 2 MB/sai định dạng ngay trên client), 2-4 đáp án với huy hiệu chữ cái A-D, công tắc "Cho phép chọn nhiều đáp án" (tắt thì chỉ chọn 1 đúng), chọn mức khó; empty "Chưa có câu hỏi nào" + nút "Thêm câu hỏi"; dialog xóa xác nhận.
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §9.1 và §3; ô đáp án theo token `--answer-*` với chữ cái, không dùng hình; không em-dash; chỉ desktop; đủ loading/empty/error.
- [ ] Test PASS (PGlite + storage memory + web): từng AC trên, gồm upload giả mạo, đúng 2 MB, ảnh của giáo viên khác, sửa câu không đổi đề.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/questions/index.ts`
- `packages/shared/src/questions/schemas.ts`
- `packages/shared/src/questions/errors.ts`
- `packages/shared/src/media/index.ts`
- `packages/shared/src/media/schemas.ts`
- `packages/shared/src/media/errors.ts`
- `apps/api/src/modules/questions/routes.ts`
- `apps/api/src/modules/questions/service.ts`
- `apps/api/src/modules/questions/questions.test.ts`
- `apps/api/src/modules/media/routes.ts`
- `apps/api/src/modules/media/service.ts`
- `apps/api/src/modules/media/upload.ts`
- `apps/api/src/modules/media/serve.ts`
- `apps/api/src/modules/media/media.test.ts`
- `apps/web/src/app/giao-vien/ngan-hang/page.tsx`
- `apps/web/src/features/questions/question-list.tsx`
- `apps/web/src/features/questions/question-dialog.tsx`
- `apps/web/src/features/questions/image-uploader.tsx`
- `apps/web/src/features/questions/kpi-row.tsx`
- `apps/web/src/features/questions/questions-api.ts`
- `apps/web/src/features/questions/questions.test.tsx`

## Notes
- **Risk:** đỏ (upload file, tenant, proxy ảnh; reviewer STRICT, checklist `skills/security`). Không migration.
- `apps/api/src/modules/media/serve.ts` xuất hàm `streamMedia(ctx, mediaRow, storage)` để L6-03 (đường ảnh cho học sinh) dùng lại với chính sách quyền riêng; không đưa chính sách học sinh vào đây.
- Ảnh của đề (kind `exam`) do L4-01 sao chép; chính sách đọc của chủ sở hữu giáo viên + admin cùng trường ở đây đã đủ cho xem đề.
- Ảnh mồ côi (tải lên nhưng không gắn câu): chấp nhận tạm, ghi trong báo cáo; dọn bằng `DELETE` thủ công.
- Nội dung câu hỏi lưu văn bản thuần, React tự escape; không render HTML.
- Công thức toán và nhập từ Word: ngoài phạm vi ("làm sau").
