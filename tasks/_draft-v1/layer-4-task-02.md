# Task 02: Giáo viên: xem học sinh lớp phụ trách

## Layer
4

## Type
build

## Description
Lát cắt dọc cho **FR-063 / BR-016 / C-05**: giáo viên xem họ tên, mã, lớp, tên + SĐT người giám hộ của học sinh thuộc **lớp đang phụ trách (năm hiện tại)**; **không** thấy ngày sinh, quê quán, địa chỉ. Lớp năm học trước: chỉ điểm (kèm họ tên + mã), ẩn người giám hộ và SĐT. Gồm DTO `@quiq/shared/teacher-students`, module api `teacher-students`, trang `/giao-vien/hoc-sinh`.

## Dependencies
- layer-3-task-05 (`teacherAssignments`)
- layer-3-task-04 (học sinh, ghi danh, xóa dữ liệu cá nhân)
- layer-3-task-03 (năm học, lớp)
- layer-1-task-05 (`officialScore`)
- layer-1-task-04 (bảng `students`, `enrollments`, `attempts`, `exams`)
- layer-2-task-01 / layer-2-task-02 (guard, AppShell)
- layer-1-task-03 (zod nền)

## Acceptance Criteria
- [ ] `GET /api/teacher/students?yearId=&classId=&q=&page=`: chỉ lớp nằm trong **phân công của giáo viên** (qua `teacherAssignments`); lớp khác hoặc trường khác -> 404; mặc định năm hiện tại.
- [ ] Năm học hiện tại: mỗi dòng gồm `studentCode`, `fullName`, `className`, `guardianName`, `guardianPhone` và điểm chính thức của các bài thi **của giáo viên này** cho lớp đó (điểm cao nhất bằng `officialScore`). Schema phản hồi `strict`: **không bao giờ** có `dateOfBirth`, `hometown`, `address` (test duyệt toàn bộ khóa JSON).
- [ ] Năm học trước (C-05, FR-063): chỉ `studentCode`, `fullName`, `className` và điểm; **không** có `guardianName`/`guardianPhone`; học sinh đã xóa dữ liệu cá nhân hiện `fullName: null` (UI hiển thị "Đã xóa dữ liệu cá nhân" + mã).
- [ ] Quyền: chỉ `teacher`; admin trường không dùng route này (đã có kho chỉ đọc ở L7-06); giáo viên chỉ thấy lớp mình **đúng năm của phân công** (FR-060); test: giáo viên dạy lớp A năm cũ và E năm mới thấy đúng phần từng năm.
- [ ] Mọi route khai metadata (`scope: 'school'`, `roles: ['teacher']`, `params` entity `class`).
- [ ] Web `/giao-vien/hoc-sinh`: lọc Năm học + Lớp (chỉ các lớp được phân công), bảng (Mã, Họ tên, Lớp, Người giám hộ, SĐT người giám hộ, Điểm các bài thi trong năm); **không có cột ngày sinh/quê quán/địa chỉ**; với năm cũ ẩn cột người giám hộ và SĐT; empty "Bạn chưa được phân công lớp nào" + hướng dẫn liên hệ admin trường.
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §9.6 và §3; không em-dash; chỉ desktop; đủ loading/empty/error.
- [ ] Test PASS (PGlite + web): từng AC, gồm đối chiếu khóa JSON và cô lập chéo trường/chéo phân công.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/teacher-students/index.ts`
- `packages/shared/src/teacher-students/schemas.ts`
- `packages/shared/src/teacher-students/errors.ts`
- `apps/api/src/modules/teacher-students/routes.ts`
- `apps/api/src/modules/teacher-students/service.ts`
- `apps/api/src/modules/teacher-students/teacher-students.test.ts`
- `apps/web/src/app/giao-vien/hoc-sinh/page.tsx`
- `apps/web/src/features/teacher-students/roster-table.tsx`
- `apps/web/src/features/teacher-students/roster-filters.tsx`
- `apps/web/src/features/teacher-students/teacher-students-api.ts`
- `apps/web/src/features/teacher-students/teacher-students.test.tsx`

## Notes
- **Risk:** đỏ (dữ liệu cá nhân trẻ em, phạm vi quyền; reviewer STRICT, checklist quyền riêng tư). Không migration.
- Điểm có thể trống nếu chưa có bài thi/attempt; dùng truy vấn không `N+1` (gom theo lớp).
- Bảng điểm chi tiết theo bài thi là việc của L7-04; ở đây chỉ tóm tắt điểm trong năm.
- Chọn thiết kế "không có cột ẩn": server không trả trường bị cấm ở bất kỳ nhánh nào, UI không phải lọc.
