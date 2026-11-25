# Task 03: Admin trường: năm học, lớp, lên lớp

## Layer
3

## Type
build

## Description
Lát cắt dọc cho **năm học và lớp** (FR-012, BR-018): tạo năm học, đặt năm hiện tại, CRUD lớp theo năm, **lên lớp** (chuyển học sinh từ lớp năm cũ sang lớp năm mới mà vẫn giữ lịch sử học sinh-lớp-năm). Gồm DTO `@quiq/shared/academic`, module api `academic`, trang `/quan-tri/lop`.

## Dependencies
- layer-2-task-01 (guard, `writeAudit`, `createTestApp`)
- layer-2-task-02 (AppShell, api-client, `useResource`)
- layer-1-task-04 (bảng `academic_years`, `classes`, `enrollments`, FK ghép cùng trường, fixtures)
- layer-1-task-03 (zod nền, `defineErrors`)
- layer-1-task-02 (primitive UI)

## Acceptance Criteria
- [ ] FR-012: `GET/POST /api/school/years` (`name` dạng `2025-2026`, `startYear` suy ra từ tên; trùng tên trong trường -> 409 `YEAR_NAME_TAKEN`), `POST /api/school/years/:id/set-current` (đúng một năm hiện tại mỗi trường, đổi thì năm cũ tự bỏ cờ trong một transaction; test chạy song song không tạo hai năm hiện tại).
- [ ] `GET/POST /api/school/classes?yearId=`, `PATCH/DELETE /api/school/classes/:id`: tên lớp duy nhất trong năm (không phân biệt hoa thường, 409 `CLASS_NAME_TAKEN`); xóa lớp chỉ khi **không có học sinh ghi danh, không có phân công, không có bài thi gán** (ngược lại 409 `CLASS_IN_USE` kèm số lượng); danh sách trả sĩ số và danh sách giáo viên phân công (đọc `assignments`, rỗng tới khi L3-05 có dữ liệu).
- [ ] BR-018, FR-012 **lên lớp**: `POST /api/school/promotions { sourceClassId, targetClassId, studentIds?, dryRun? }`: lớp đích phải thuộc **năm học khác (muộn hơn)** nhưng cùng trường; `dryRun` trả số học sinh sẽ chuyển và số bị bỏ qua (đã có ghi danh năm đích, đã xóa dữ liệu cá nhân/mã vô hiệu); thực thi tạo bản ghi `enrollments` mới cho năm đích và **giữ nguyên bản ghi năm cũ** (lịch sử); chạy lại không tạo trùng (idempotent); atomic (lỗi giữa chừng không để lại nửa chừng). Test: sau khi lên lớp, học sinh có hai ghi danh (năm cũ + năm mới) và điểm cũ vẫn gắn lớp cũ.
- [ ] Truy cập lớp/năm của trường khác -> 404 ở mọi route; chỉ `school_admin` gọi được; mọi route khai metadata (`scope: 'school'`, `params` entity `year`/`class`).
- [ ] Web `/quan-tri/lop`: thanh pill chọn năm học (đánh dấu năm hiện tại), bảng lớp (Tên lớp, Năm học, Sĩ số, GV phân công), nút "Tạo năm học", "Tạo lớp", "Đặt làm năm hiện tại", "Lên lớp cho học sinh" (dialog chọn lớp nguồn rồi lớp đích, **xem trước số học sinh** bằng `dryRun`, xác nhận), dialog xóa lớp nêu hậu quả; empty "Chưa có năm học nào" + nút tạo.
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §8 (Năm học & Lớp) và §3; không em-dash; chỉ desktop; đủ loading/empty/error.
- [ ] Test PASS (PGlite + web) cho toàn bộ AC, gồm cô lập chéo trường.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/academic/index.ts`
- `packages/shared/src/academic/schemas.ts`
- `packages/shared/src/academic/errors.ts`
- `apps/api/src/modules/academic/routes.ts`
- `apps/api/src/modules/academic/service.ts`
- `apps/api/src/modules/academic/promotion.ts`
- `apps/api/src/modules/academic/academic.test.ts`
- `apps/api/src/modules/academic/promotion.test.ts`
- `apps/web/src/app/quan-tri/lop/page.tsx`
- `apps/web/src/features/academic/years-bar.tsx`
- `apps/web/src/features/academic/classes-table.tsx`
- `apps/web/src/features/academic/create-year-dialog.tsx`
- `apps/web/src/features/academic/class-dialog.tsx`
- `apps/web/src/features/academic/promote-dialog.tsx`
- `apps/web/src/features/academic/academic-api.ts`
- `apps/web/src/features/academic/academic.test.tsx`

## Notes
- **Risk:** vàng/đỏ (dữ liệu lịch sử và tenant; thao tác hàng loạt trên ghi danh). Không migration.
- Học sinh mới nhập (L3-04) gán lớp qua `enrollments`; L3-03 không tạo học sinh. Lịch sử hiển thị theo học sinh nằm ở L3-04 (`/api/school/students/:id/history`).
- "Năm hiện tại" quyết định mặc định ở nhiều nơi (phân công, bài thi, tra cứu); chỉ L3-03 được đổi cờ này.
- Chuyển lớp trong cùng một năm là việc của L3-04 (sửa học sinh), không nằm ở đây.
