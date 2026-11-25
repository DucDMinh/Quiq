# Task 05: Tra cứu điểm công khai

## Layer
7

## Type
build

## Description
Màn tra cứu điểm của học sinh (FR-064, BR-013, C-09): chọn trường, nhập mã học sinh, chọn năm học (mặc định hiện tại), thấy **điểm chính thức theo môn của các bài đã công bố bảng điểm**, tuyệt đối không thông tin cá nhân, không lộ mã đúng/sai, chống dò hàng loạt, trường bị khóa vẫn tra được. Gồm DTO `@quiq/shared/lookup`, module api `lookup`, trang `/tra-cuu`.

## Dependencies
- layer-5-task-01 (`getOfficialScore`, dữ liệu attempt)
- layer-6-task-01 (`scores_published_at` do giáo viên công bố)
- layer-4-task-01 (bài thi, mã, `year_id`)
- layer-3-task-04 (học sinh, mã vô hiệu), layer-3-task-03 (năm học), layer-3-task-01 (trường)
- layer-1-task-01 (rate-limit)
- layer-2-task-02 (`PortalShell`, api-client), layer-1-task-02 (primitive UI, `ViewportGuard allowNarrow`)

## Acceptance Criteria
- [ ] `GET /api/lookup/schools?q=` (công khai): danh sách trường (`id`, `name`) để chọn, **bao gồm cả trường bị khóa** (C-09); không lộ mã nội bộ nào khác; có rate-limit.
- [ ] `GET /api/lookup/years?schoolId=`: các năm học của trường (tên, cờ năm hiện tại) để chọn; trường không tồn tại -> danh sách rỗng (cùng dạng phản hồi).
- [ ] `POST /api/lookup { schoolId, studentCode, yearId? }` (FR-064): mặc định năm học hiện tại, chọn được năm trước; trả `{ year, rows: [{ subject, examTitle, examCode, score }] }` chỉ gồm bài thi mà lớp của học sinh đã **công bố bảng điểm** (`scores_published_at` có giá trị, BR-013, FR-038), điểm là **điểm chính thức = cao nhất** các lần đã chấm; chưa công bố thì **không có dòng**; sau khi giáo viên chấm lại (FR-039) lần tra kế tiếp hiện điểm mới (đọc điểm hiện tại, không cache). Schema phản hồi `strict`: không họ tên, ngày sinh, địa chỉ, SĐT, lớp, `anon_ref`, `attemptId`.
- [ ] **Mã sai, mã không tồn tại, mã đã vô hiệu/đã xóa dữ liệu (FR-016), trường không tồn tại, hoặc không có bài nào công bố đều trả cùng một dạng phản hồi rỗng** (`rows: []`, cùng thông điệp "Chưa có bài nào được công bố bảng điểm"); test so sánh byte-cho-byte cấu trúc phản hồi và độ trễ không phân biệt được (tính xấp xỉ bằng cùng số truy vấn).
- [ ] **Rate-limit chống dò**: theo IP, theo (IP, trường) và trần theo trường; vượt -> 429 kèm số giây; test bằng đồng hồ giả. Không có chức năng liệt kê học sinh.
- [ ] Trường bị khóa vẫn tra cứu được (test); học sinh chỉ thấy điểm của chính mã đó.
- [ ] Mọi route khai metadata (`scope: 'public'`, `roles: 'public'`, `params` rỗng/đúng); ghi chú trong metadata là route công khai có rate-limit.
- [ ] Web `/tra-cuu` (Portal shell, **ngoại lệ không bị chặn dưới 1024px**): thẻ lọc 3 ô trên một hàng (Trường: select có tìm kiếm; Mã học sinh; Năm học mặc định hiện tại) + nút "Tra cứu"; bảng kết quả (Môn học, Bài thi, Mã bài thi, Điểm chính thức mono, không cột cá nhân); trạng thái loading skeleton, empty "Chưa có bài thi nào được công bố bảng điểm" (dùng cả khi mã sai), error có nút thử lại, 429 hiển thị số giây chờ; điểm làm tròn hiển thị 2 chữ số.
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §4.3 và §3; không em-dash; một hệ thiết kế.
- [ ] Test PASS (PGlite + web): từng AC, gồm chưa/đã công bố, chấm lại cập nhật, mã vô hiệu đồng nhất, trường khóa, rate-limit.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/lookup/index.ts`
- `packages/shared/src/lookup/schemas.ts`
- `packages/shared/src/lookup/errors.ts`
- `apps/api/src/modules/lookup/routes.ts`
- `apps/api/src/modules/lookup/service.ts`
- `apps/api/src/modules/lookup/lookup.test.ts`
- `apps/api/src/modules/lookup/no-pii.test.ts`
- `apps/web/src/app/tra-cuu/page.tsx`
- `apps/web/src/features/lookup/lookup-form.tsx`
- `apps/web/src/features/lookup/lookup-results.tsx`
- `apps/web/src/features/lookup/school-select.tsx`
- `apps/web/src/features/lookup/lookup-api.ts`
- `apps/web/src/features/lookup/lookup.test.tsx`

## Notes
- **Risk:** đỏ (endpoint công khai chứa dữ liệu điểm của trẻ em, nguy cơ dò mã; người ngoài lớp biết mã học sinh vẫn xem được điểm là rủi ro **đã được chủ dự án chấp nhận**, nhưng không được hiện thông tin cá nhân; reviewer STRICT, checklist `skills/security`).
- Danh sách trường công khai là cần thiết theo spec (chọn trường); chỉ trả tên và id, không trả số liệu.
- Không cache điểm phía server/CDN để chấm lại có hiệu lực ngay.
- Quy tắc "một thông điệp" cũng áp dụng cho trường hợp học sinh có nhiều attempt nhưng chưa công bố.
