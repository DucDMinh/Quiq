# Task 01: Giáo viên: ngân hàng câu hỏi (chữ, 2 đến 4 đáp án)

## Layer
3

## Type
build (initial)

## Description
Lát cắt dọc ngân hàng câu hỏi riêng của giáo viên, **chưa có ảnh** (ảnh là tính năng sau). Sau task này giáo viên đăng nhập, vào "Ngân hàng câu hỏi", thêm, sửa, xóa câu hỏi và lọc theo mức khó.

API (`apps/api/src/modules/questions/`), chỉ vai trò `teacher`, mọi truy vấn lọc theo `schoolId` + **chủ sở hữu giáo viên**, và môn tự lấy từ môn cố định của giáo viên (FR-020, FR-024):
- `GET /api/teacher/questions?difficulty=` (kèm thống kê tổng/dễ/TB/khó cho thẻ KPI), `POST`, `GET/:id`, `PUT/:id`, `DELETE/:id`.
- Kiểm hợp lệ: 2 đến 4 đáp án, ít nhất 1 đáp án đúng, `multi_select` suy ra từ số đáp án đúng (hoặc cờ rõ ràng), `difficulty` ∈ easy|medium|hard, nội dung không rỗng.
- Xóa/sửa câu **không** ảnh hưởng đề đã ra (đề dùng bản sao, BR-002).

Web (`/giao-vien/ngan-hang`) đúng design-spec §9.1: 4 thẻ KPI, lọc pill theo mức, danh sách câu (nội dung rút gọn, badge mức, đáp án đúng), dialog soạn câu hỏi (nội dung, 2 đến 4 đáp án với công tắc "Cho phép chọn nhiều đáp án", chọn mức khó), xác nhận xóa; empty "Chưa có câu hỏi nào" + nút "Thêm câu hỏi".

## Dependencies
- layer-2-task-01 (đăng nhập, guard, khung giao diện, `nav-config`)
- layer-1-task-01 (bảng `questions`, `question_options`)
- layer-1-task-03 (thành phần UI)

## Acceptance Criteria
- [ ] Tạo/sửa/xóa/liệt kê đúng; câu chỉ thuộc giáo viên tạo ra, **giáo viên khác cùng trường không thấy** (404), trường khác không thấy (404); môn của câu luôn là môn cố định của giáo viên, không nhận từ client.
- [ ] Từ chối: 1 hoặc 5 đáp án, không đáp án đúng, nội dung rỗng, mức khó lạ; lỗi tiếng Việt gần ô (web) và `details` theo trường (api).
- [ ] KPI đếm đúng theo mức; lọc pill hoạt động; danh sách phân trang khi > 25 câu.
- [ ] Sửa câu nhiều đáp án ⇄ một đáp án giữ đúng dữ liệu; xóa có dialog xác nhận nêu hậu quả.
- [ ] Giao diện: đủ loading (skeleton)/empty/error; không em-dash; không hex thô; chỉ desktop; bàn phím mở/đóng dialog đúng focus.
- [ ] Test API (PGlite) gồm cô lập theo chủ sở hữu và theo trường; test web cho form soạn và lọc.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/api/src/modules/questions/routes.ts`, `apps/api/src/modules/questions/service.ts`, `apps/api/src/modules/questions/questions.test.ts`
- `packages/shared/src/questions/index.ts`, `packages/shared/src/questions/schemas.ts`, `packages/shared/src/questions/errors.ts`
- `apps/web/src/app/giao-vien/ngan-hang/page.tsx`
- `apps/web/src/features/questions/question-list.tsx`, `question-editor-dialog.tsx`, `use-questions.ts`, `questions.test.tsx`

## Notes
- Đọc trước: `.context/design-spec.md` §9.1; `SPECIFICATIONS.md` FR-020, 022, 023, 024.
- **Không sửa** `nav-config.ts` (mục menu đã khai ở L2-01) và không đụng migration. Ảnh (`media`, Supabase Storage) là tính năng sau; để cột/nút ảnh ra ngoài phạm vi này.
- Task này không trùng file với L3-02 (thư mục `questions/` và `ngan-hang/` riêng).
- Risk: thấp đến trung bình (quyền sở hữu). Reviewer NORMAL, STRICT phần cô lập sở hữu.
- **Ghi nhận từ review Layer 2:** route giáo viên dùng `staffGuard(deps, ["teacher"])` + `tenantSchoolId(ctx)` (`apps/api/src/http/guards.ts`), chéo trường 404; thêm mục menu chỉ sửa `apps/web/src/features/shell/nav-config.ts` (đã có sẵn 3 mục demo). Endpoint mới phải vào `docs/API_SPEC.md` ở close-out (`Doc-Impact` không được `none`).
