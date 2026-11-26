# Task 02: Admin trường: môn học và giáo viên

## Layer
3

## Type
build

## Description
Lát cắt dọc cho **môn học** (FR-018) và **tài khoản giáo viên** (FR-010): CRUD môn theo trường, tạo giáo viên gắn đúng **một môn cố định không đổi được** (BR-017), đặt lại mật khẩu. Gồm DTO `@quiq/shared/subjects`, `@quiq/shared/teachers`, hai module api `subjects` và `teachers`, hai trang `/quan-tri/mon-hoc` và `/quan-tri/giao-vien`.

## Dependencies
- layer-2-task-01 (guard, `revokeAccountSessions`, `writeAudit`, `createTestApp`)
- layer-2-task-02 (AppShell, api-client, `useResource`)
- layer-1-task-04 (bảng `subjects`, `staff_accounts`, trigger bất biến `subject_id`, fixtures)
- layer-1-task-03 (zod nền, `defineErrors`)
- layer-1-task-02 (primitive UI)

## Acceptance Criteria
- [ ] FR-018: `GET/POST /api/school/subjects`, `PATCH/DELETE /api/school/subjects/:id` (chỉ `school_admin`); tên môn duy nhất trong trường không phân biệt hoa thường (trùng -> 409 `SUBJECT_NAME_TAKEN`), môn của trường khác không thấy/không đụng được (404); hai trường được có môn trùng tên.
- [ ] C-08: xóa môn đang có **giáo viên, câu hỏi hoặc bài thi** gắn vào -> 409 `SUBJECT_IN_USE` kèm số lượng từng loại; danh sách trả `teacherCount`, `questionCount`, `examCount` để UI khóa nút Xóa với tooltip "Môn đang có giáo viên/câu hỏi/bài thi". Xóa môn trống thành công (ghi audit).
- [ ] FR-010, BR-012, BR-017: `POST /api/school/teachers { fullName, username, password >= 8, subjectId }` tạo tài khoản `teacher` (username trùng toàn hệ thống -> 409 `USERNAME_TAKEN`; `subjectId` phải thuộc trường của admin, không thì 404). **Không tồn tại endpoint đổi môn**: schema `PATCH /api/school/teachers/:id` là `strict` và từ chối `subjectId`; có test thử đổi qua API và qua UPDATE trực tiếp (trigger DB từ L1-04 chặn).
- [ ] `GET /api/school/teachers` trả họ tên, username, môn cố định, danh sách lớp phụ trách của năm học hiện tại (đọc bảng `assignments`, rỗng cho tới khi L3-05 có dữ liệu); `POST /api/school/teachers/:id/reset-password` sinh mật khẩu ngẫu nhiên hiện **một lần**, thu hồi mọi phiên của giáo viên, ghi audit; giáo viên đăng nhập được bằng tài khoản vừa tạo và `GET /api/auth/me` trả đúng môn.
- [ ] Không có route tự đăng ký giáo viên (test quét `listRoutes`); giáo viên và admin khác trường truy cập các route trên bị 403/404 đúng quy tắc; mọi route khai metadata (`scope: 'school'`, `roles: ['school_admin']`, `params` với entity `subject`/`teacher`).
- [ ] Web `/quan-tri/mon-hoc`: bảng (Tên môn, Số giáo viên đang gắn, Số câu hỏi, Thao tác Đổi tên/Xóa), dialog thêm/đổi tên, dialog xóa xác nhận, nút Xóa khóa kèm tooltip khi môn đang dùng, empty "Chưa có môn nào" + nút "Thêm môn".
- [ ] Web `/quan-tri/giao-vien`: bảng (Họ tên, Tên đăng nhập, **Môn cố định**, Lớp phụ trách (năm hiện tại), Đặt lại mật khẩu), dialog tạo giáo viên có select môn và ghi chú "Môn không đổi được sau khi tạo", **không có nút đổi môn**, dialog đặt lại mật khẩu hiện mật khẩu mới một lần có nút sao chép; nếu trường chưa có môn thì dialog dẫn tới `/quan-tri/mon-hoc`.
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §8 (Môn học, Giáo viên) và §3; không em-dash; chỉ desktop; đủ loading/empty/error.
- [ ] Test PASS (PGlite + web): toàn bộ AC trên, gồm cô lập chéo trường cho mọi route.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/subjects/index.ts`
- `packages/shared/src/subjects/schemas.ts`
- `packages/shared/src/subjects/errors.ts`
- `packages/shared/src/teachers/index.ts`
- `packages/shared/src/teachers/schemas.ts`
- `packages/shared/src/teachers/errors.ts`
- `apps/api/src/modules/subjects/routes.ts`
- `apps/api/src/modules/subjects/service.ts`
- `apps/api/src/modules/subjects/subjects.test.ts`
- `apps/api/src/modules/teachers/routes.ts`
- `apps/api/src/modules/teachers/service.ts`
- `apps/api/src/modules/teachers/teachers.test.ts`
- `apps/web/src/app/quan-tri/mon-hoc/page.tsx`
- `apps/web/src/app/quan-tri/giao-vien/page.tsx`
- `apps/web/src/features/subjects/subjects-table.tsx`
- `apps/web/src/features/subjects/subject-dialog.tsx`
- `apps/web/src/features/subjects/subjects-api.ts`
- `apps/web/src/features/subjects/subjects.test.tsx`
- `apps/web/src/features/teachers/teachers-table.tsx`
- `apps/web/src/features/teachers/create-teacher-dialog.tsx`
- `apps/web/src/features/teachers/reset-password-dialog.tsx`
- `apps/web/src/features/teachers/teachers-api.ts`
- `apps/web/src/features/teachers/teachers.test.tsx`

## Notes
- **Risk:** đỏ (tạo tài khoản, đặt lại mật khẩu, tenant; reviewer STRICT). Không migration; nếu cần cột (vd `staff_accounts.deactivated_at`) thì ghi "cần change".
- Đặt lại mật khẩu dùng `generatePassword()` và `revokeAccountSessions()` của `core/auth` (L2-01).
- Vai trò `teacher` đọc tên môn của mình qua `/api/auth/me`; admin trường mới xem danh sách môn.
- Số câu hỏi/bài thi của môn đọc từ bảng `questions`/`exams` (đã có ở L1-04, trống tới khi L3-06 và L4-01 chạy).
