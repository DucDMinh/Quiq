# Task 01: Admin tổng (trường, tài khoản admin trường, thống kê tổng hợp)

## Layer
3

## Type
build

## Description
Lát cắt dọc cho vai trò **Admin tổng**: tạo/khóa/mở khóa trường, tạo tài khoản admin trường + đặt lại mật khẩu, thống kê tổng hợp **chỉ là con số**. Gồm DTO ở `@quiq/shared/platform`, module api `platform`, và ba trang `/admin-tong/*`. Admin tổng tuyệt đối không có route nào đọc dữ liệu riêng của trường (FR-004, BR-015) và không có chức năng tạo admin tổng (FR-005).

## Dependencies
- layer-2-task-01 (guard, phiên, `revokeAccountSessions`, `writeAudit`, `createTestApp`)
- layer-2-task-02 (AppShell, api-client, `useResource`, route guard `/admin-tong`)
- layer-1-task-04 (bảng `schools`, `staff_accounts`, fixtures, `hashPassword`)
- layer-1-task-03 (zod nền, `defineErrors`, enum)
- layer-1-task-02 (primitive UI: data-table, dialog, kpi-card, pill-filter, alert)

## Acceptance Criteria
- [ ] FR-001: `POST /api/platform/schools { name, code }` tạo trường (mã duy nhất không phân biệt hoa thường, trùng -> 409 `SCHOOL_CODE_TAKEN`), mặc định quy chế 3 lần làm / 2 cảnh báo / 60 giây (đúng với `DEFAULT_SCHOOL_SETTINGS`); `GET /api/platform/schools?status=` liệt kê (tên, mã, ngày tạo, quy chế, trạng thái); `POST /api/platform/schools/:id/lock` và `/unlock` (idempotent, ghi `audit_log`). Sau khi khóa: admin trường/giáo viên của trường đó không đăng nhập được và phiên đang có bị vô hiệu ngay (test tích hợp với guard L2-01).
- [ ] FR-002, BR-012: `POST /api/platform/school-admins { schoolId, fullName, username, password >= 8 }` tạo tài khoản `school_admin` (username trùng toàn hệ thống -> 409 `USERNAME_TAKEN`); `GET /api/platform/school-admins?schoolId=` (họ tên, username, trường, trạng thái trường); `POST /api/platform/school-admins/:id/reset-password` sinh mật khẩu mới ngẫu nhiên (>= 12 ký tự), trả về **đúng một lần** trong response, thu hồi mọi phiên của tài khoản đó, ghi audit. Admin trường đăng nhập được bằng tài khoản vừa tạo (test e2e API: tạo -> login).
- [ ] FR-003: `GET /api/platform/stats` trả tổng và theo từng trường chỉ gồm số đếm: `teachers, students, exams, questions, classes, attempts (lượt thi)`; schema phản hồi zod **strict** chỉ cho phép số nguyên và định danh trường (id, name, code, status); test khẳng định không có khóa nào khác (không tên học sinh/giáo viên, mã học sinh, điểm, nội dung câu hỏi).
- [ ] FR-004, BR-015: test dùng `listRoutes` khẳng định mọi route có `scope: 'platform'` thuộc đúng danh sách cho phép ở trên; admin tổng gọi mọi route `scope: 'school'` đều bị 403; không có route nào trả bản ghi học sinh/lớp/câu hỏi/đề/điểm cho admin tổng.
- [ ] FR-005: không tồn tại route nào tạo `super_admin` (test quét `listRoutes`); đăng nhập admin tổng bằng tài khoản seed (`seedSuperAdmin`) hoạt động.
- [ ] Phân quyền: chỉ `super_admin` gọi được `/api/platform/*` (admin trường/giáo viên -> 403, chưa đăng nhập -> 401); mọi route khai metadata đầy đủ (`scope: 'platform'`, `params` với entity `school`/`account`).
- [ ] Web `/admin-tong/thong-ke`: 4 thẻ KPI (Tổng số trường, giáo viên, học sinh, lượt làm bài), bảng "Số liệu tổng hợp từng trường" (Trường, Mã, Trạng thái, Số lớp, Số giáo viên, Số học sinh, Số câu hỏi, Số bài thi, Số lượt thi), alert info cố định "Chỉ hiển thị số liệu tổng hợp", empty "Chưa có trường nào" + nút "Tạo trường".
- [ ] Web `/admin-tong/truong`: lọc pill (Tất cả (n), Đang hoạt động, Đã khóa), bảng (Tên, Mã, Ngày tạo, Quy chế mặc định "3 lần / 2 cảnh báo / 60 giây", Trạng thái badge, Thao tác Khóa/Mở khóa), dialog "Tạo trường" (tên, mã), dialog khóa nêu hệ quả ("Giáo viên và admin của trường không đăng nhập được, học sinh không vào thi được, vẫn tra cứu được điểm").
- [ ] Web `/admin-tong/tai-khoan`: lọc theo trường, bảng (Họ tên, Tên đăng nhập, Trường phụ trách, Trạng thái trường, Thao tác Đặt lại mật khẩu), dialog "Tạo tài khoản Admin trường" (chọn trường, họ tên, tên đăng nhập, mật khẩu tối thiểu 8 ký tự), dialog đặt lại mật khẩu hiện mật khẩu mới một lần có nút sao chép.
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §7 (7.1 đến 7.3) và §3; một hệ thiết kế; không em-dash; chỉ desktop; mỗi màn có loading (skeleton), empty, error + thử lại; tiếng Việt có dấu, không hiện mã FR trong giao diện.
- [ ] Test PASS: api (PGlite) cho toàn bộ AC trên; web test cho dialog tạo trường, khóa trường, hiện mật khẩu một lần.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/platform/index.ts`
- `packages/shared/src/platform/schemas.ts`
- `packages/shared/src/platform/errors.ts`
- `apps/api/src/modules/platform/routes.ts`
- `apps/api/src/modules/platform/service.ts`
- `apps/api/src/modules/platform/stats.ts`
- `apps/api/src/modules/platform/platform.test.ts`
- `apps/api/src/modules/platform/no-private-data.test.ts`
- `apps/web/src/app/admin-tong/thong-ke/page.tsx`
- `apps/web/src/app/admin-tong/truong/page.tsx`
- `apps/web/src/app/admin-tong/tai-khoan/page.tsx`
- `apps/web/src/features/platform/stats-view.tsx`
- `apps/web/src/features/platform/schools-table.tsx`
- `apps/web/src/features/platform/create-school-dialog.tsx`
- `apps/web/src/features/platform/lock-school-dialog.tsx`
- `apps/web/src/features/platform/school-admins-table.tsx`
- `apps/web/src/features/platform/create-admin-dialog.tsx`
- `apps/web/src/features/platform/reset-password-dialog.tsx`
- `apps/web/src/features/platform/platform-api.ts`
- `apps/web/src/features/platform/platform.test.tsx`

## Notes
- **Risk:** đỏ (ranh giới tenant + quyền admin tổng, tạo/đặt lại mật khẩu; reviewer STRICT, checklist `skills/security`). Không migration: chỉ dùng bảng đã có (thiếu cột thì ghi "cần change", không sửa schema).
- Thống kê bằng truy vấn `COUNT` gom theo `school_id`, không `SELECT` bản ghi riêng trường rồi đếm ở ứng dụng.
- Mật khẩu sinh bằng `generatePassword()` của `core/auth` (L2-01); không ghi vào log/audit.
- Khóa trường chỉ đổi `schools.status`; hiệu lực tức thì dựa vào guard (L2-01 kiểm tra trạng thái trường ở mọi request). Học sinh bị chặn vào thi ở L6-02; tra cứu vẫn dùng được (C-09, L7-05).
- Mã trường dùng ở màn tra cứu công khai (chọn trường) nên chuẩn hóa chữ thường, chỉ `a-z0-9-`.
