# Task 03: Reconcile tài liệu as-built (ERD, API_SPEC, PERMISSION) và hướng dẫn chạy local

## Layer
8

## Type
build

## Description
Thay các tài liệu **as-built** còn là template (`docs/ERD.md`, `docs/API_SPEC.md`, `docs/PERMISSION.md`) bằng nội dung đúng dự án Quiq (pointer tới schema thật, danh sách route sinh từ metadata của router, ma trận quyền), và viết hướng dẫn chạy local. Tuân thủ quy tắc Doc Impact trong `AGENTS.md`: chỉ sửa tài liệu **as-built**, **không** sửa tài liệu intent (`docs/BRD.md`, `SPECIFICATIONS.md`) cho khớp code; chỗ lệch ghi vào danh sách chênh lệch.

## Dependencies
- layer-7-task-01 đến layer-7-task-06 (toàn bộ route và màn đã có)
- layer-6-task-01, layer-6-task-02, layer-6-task-03
- layer-5-task-01, layer-4-task-01, layer-4-task-02
- layer-3-task-01 đến layer-3-task-06
- layer-2-task-01 (`listRoutes`, metadata)
- layer-1-task-04 (schema, migration, hướng dẫn Supabase)

## Acceptance Criteria
- [ ] `docs/API_SPEC.md`: tạo bằng script `apps/api/scripts/gen-api-spec.ts` đọc **metadata thật** từ `listRoutes` (method, path, vai trò, scope, tham số/entity, mô tả) nhóm theo module; có hướng dẫn chạy lại script; kèm quy ước envelope `{ success, data | error, details }`, mã lỗi chính (401/403/404/409/422/429), cookie `quiq_session`/`quiq_stu`, SSE `stream`. Số route trong tài liệu **bằng** số route của `listRoutes` (test của script khẳng định).
- [ ] `docs/ERD.md`: tổng quan thực thể theo nhóm (Hệ thống, Trường, Ngân hàng, Bài thi, Làm bài), sơ đồ quan hệ (mermaid) khớp schema Drizzle, các ràng buộc quan trọng (mã học sinh duy nhất theo trường, mã bài thi duy nhất, một attempt `in_progress`, một phiên học sinh hoạt động, snapshot theo lớp, mã vô hiệu), RLS bật không policy, và **trỏ tới `packages/db/src/schema/*` và `packages/db/drizzle/*` là nguồn thật**; không chép lại từng cột.
- [ ] `docs/PERMISSION.md`: ma trận vai trò (Admin tổng, Admin trường, Giáo viên, Học sinh) x nhóm chức năng/route (sinh từ metadata), quy tắc tenant (schoolId từ phiên, chéo trường 404), quyền xem dữ liệu cá nhân (FR-063, BR-016, C-05), quy tắc không lộ đáp án, rủi ro đã được chủ dự án chấp nhận; liên kết `docs/SECURITY_REVIEW.md` (nếu đã có từ L8-01 thì tham chiếu đúng mục, nếu chưa thì ghi "xem L8-01").
- [ ] `docs/RUNNING_LOCAL.md` (hướng dẫn chạy local, thay cho README dự án; **không sửa `README.md` gốc** vì đó là tài liệu của template workflow): yêu cầu (Node 22, pnpm), biến `.env.local` (`DATABASE_URL_STAGING`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `API_PORT`, `STORAGE_BUCKET`, `API_ORIGIN`), cách tạo project Supabase staging và bucket (trỏ `docs/SUPABASE_SETUP.md`), `pnpm install`, `pnpm --filter @quiq/db migrate`, `seed:superadmin`, `pnpm --filter @quiq/api dev`, `pnpm --filter @quiq/web dev`, `pnpm test`, `pnpm e2e`, các lưu ý (chạy một tiến trình Koa, giới hạn gói free Supabase, tự tạm dừng khi không dùng).
- [ ] `docs/DESIGN.md` (current-state): bổ sung/đối chiếu mục kiến trúc thực tế khác thiết kế (nếu có, vd vị trí `packages/db`, `packages/engine`, quyết định SSE theo spike); không đổi intent.
- [ ] **Danh sách chênh lệch** (ghi trong `docs/API_SPEC.md` hoặc `docs/DESIGN.md`, mục "Chênh lệch BRD so với as-built"): các điểm spec ghi đè BRD (C-01..C-13) và quyết định thực thi (gỡ phân công bị chặn khi đã có bài thi, nhập file cả-file-hoặc-không, quy ước hiển thị học sinh đã xóa dữ liệu); **không sửa `docs/BRD.md`**, đề xuất `/change` nếu cần đồng bộ BRD.
- [ ] Nếu `.context/project-config.md` đã khai `check_commands.docs_inventory` thì chạy và đính kèm kết quả; nếu `null` thì ghi `skip, not configured` (không tự khai).
- [ ] Mọi liên kết nội bộ trong các tài liệu trên trỏ tới file tồn tại (script/test kiểm liên kết).

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `docs/API_SPEC.md`
- `docs/ERD.md`
- `docs/PERMISSION.md`
- `docs/RUNNING_LOCAL.md`
- `docs/DESIGN.md`
- `apps/api/scripts/gen-api-spec.ts`
- `apps/api/scripts/gen-api-spec.test.ts`
- `docs/links.test.mjs`

## Notes
- **Risk:** vàng (tài liệu; đỏ ở chỗ không được "hợp pháp hóa" chênh lệch: nếu code lệch intent thì ghi vào danh sách chênh lệch, không sửa intent doc).
- Root `README.md` hiện là tài liệu của template workflow (dài, không phải của Quiq): giữ nguyên; chủ dự án quyết định thay hay không (ghi trong báo cáo).
- `docs/generated/*` (nếu có) do `scripts/generate-inventory.mjs` quản lý; chỉ chạy lại khi `docs_inventory` được khai.
- Tránh trùng file với L8-01 (`docs/SECURITY_REVIEW.md`) và L8-02 (`e2e/*`).
