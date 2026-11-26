# Task 01: Đăng nhập cán bộ, phiên, guard theo vai trò và trường, khung giao diện giáo viên

## Layer
2

## Type
build (initial)

## Description
Lát cắt dọc "vào được hệ thống bằng tài khoản cán bộ" (API + web). Sau task này bạn mở `localhost:3000/dang-nhap`, đăng nhập giáo viên mẫu và thấy khung giao diện với menu.

API (`apps/api/src/modules/auth/`):
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. Mật khẩu so bằng `verifyPassword` (`@quiq/db/security`). Cookie `quiq_session` (HttpOnly, SameSite=Lax, `Secure` khi production), token ngẫu nhiên đục, **chỉ lưu hash** trong bảng `sessions`, hết hạn trượt 8 giờ, thu hồi được.
- Giới hạn đăng nhập sai theo IP + tên đăng nhập (in-memory, lỗi 429 tiếng Việt). Lỗi chung "Tên đăng nhập hoặc mật khẩu không đúng" (không lộ ô nào sai). Trường bị khóa → chặn.
- Guard dùng chung (`apps/api/src/http/guards.ts`): `authenticate` → `requireRole(...)` → **tenant** (`schoolId` lấy từ phiên, không từ request). Truy cập chéo trường trả **404**.

Web:
- `/dang-nhap`: thẻ đăng nhập (design-spec §4.2), nút hiện/ẩn mật khẩu, lỗi gần ô, đăng nhập xong chuyển theo vai trò (`teacher` → `/giao-vien/ngan-hang`; vai trò khác chưa có màn → thông báo "Chưa có giao diện cho vai trò này", không lỗi trắng).
- Khung ứng dụng cán bộ (`AppShell`): sidebar 276px, logo, menu theo vai trò, khối người dùng + đăng xuất; route guard phía client (gọi `/api/auth/me`), hết phiên → dialog "Phiên đăng nhập đã hết hạn" rồi `/dang-nhap`.
- **Cấu hình menu `nav-config.ts` do task này sở hữu** và liệt kê các mục demo của giáo viên: Ngân hàng câu hỏi (`/giao-vien/ngan-hang`), Bài thi (`/giao-vien/bai-thi`), Phòng thi (`/giao-vien/phong-thi`). Các layer tính năng sau sửa file này tuần tự để thêm mục.
- `/giao-vien` chuyển hướng đến `/giao-vien/ngan-hang` (trang này do L3-01 tạo; đến lúc đó 404 chung là chấp nhận được).

## Dependencies
- layer-1-task-01 (bảng `staff_accounts`, `sessions`, seed, `hashPassword/verifyPassword`)
- layer-1-task-04 (điểm nối API: `deps.db`, `deps.clock`, `createTestApp()`)
- layer-1-task-03 (thành phần UI, api-client)

## Acceptance Criteria
- [ ] Đăng nhập đúng `gv.toan` (mật khẩu seed) → 200, cookie `quiq_session` HttpOnly; DB chỉ chứa hash token; sai mật khẩu → lỗi chung; 6 lần sai liên tiếp → 429.
- [ ] `GET /api/auth/me` trả vai trò, họ tên, `schoolId`, môn của giáo viên; không có cookie/hết hạn/bị thu hồi → 401.
- [ ] Đăng xuất thu hồi phiên (cookie cũ hết dùng được); phiên trượt: mỗi request làm mới hạn 8 giờ.
- [ ] Guard: route mẫu theo vai trò từ chối đúng 403; người trường A gọi tài nguyên trường B → **404**; trường `status='locked'` → không đăng nhập và phiên cũ bị chặn.
- [ ] Web: đăng nhập thành công vào khung giao diện giáo viên có menu 3 mục, đăng xuất hoạt động, dialog hết phiên, trạng thái loading/lỗi/trống đủ; chỉ desktop (MinWidthGuard); không em-dash trong chuỗi giao diện.
- [ ] Mật khẩu không bao giờ xuất hiện trong log, response hay URL; `SESSION_SECRET` bắt buộc khi khởi động api (thiếu thì báo lỗi rõ).
- [ ] Test (PGlite): đăng nhập/đăng xuất/phiên/khóa/chéo trường; test web cho form đăng nhập và route guard.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS (STRICT: auth/phiên/tenant)
- [ ] committed

## Files to Create/Modify
- `apps/api/src/modules/auth/routes.ts`, `apps/api/src/modules/auth/service.ts`, `apps/api/src/modules/auth/rate-limit.ts`, `apps/api/src/modules/auth/auth.test.ts`
- `apps/api/src/http/guards.ts`, `apps/api/src/http/guards.test.ts`, `apps/api/src/http/session-cookie.ts`
- `packages/shared/src/auth/index.ts`, `packages/shared/src/auth/schemas.ts`, `packages/shared/src/auth/errors.ts`
- `apps/web/src/app/dang-nhap/page.tsx`, `apps/web/src/app/giao-vien/layout.tsx`, `apps/web/src/app/giao-vien/page.tsx`
- `apps/web/src/features/auth/login-form.tsx`, `apps/web/src/features/auth/use-session.ts`, `apps/web/src/features/auth/session-expired-dialog.tsx`
- `apps/web/src/features/shell/app-shell.tsx`, `apps/web/src/features/shell/nav-config.ts`, `apps/web/src/features/auth/auth.test.tsx`

## Notes
- Đọc trước: `.context/design-spec.md` §3 (App shell), §4.2 (đăng nhập), §6.5 (phiên hết hạn); `docs/specs/2026-11-25-quiq-design.md` (Xác thực và phân quyền).
- Chỉ `apps/web/src/app/giao-vien/layout.tsx` và `page.tsx` được tạo trong thư mục `giao-vien` ở layer này; L3 thêm `ngan-hang/` và `bai-thi/`, `phong-thi/` ở thư mục con riêng nên không trùng file.
- `server.ts` có thể cần nối `SESSION_SECRET`/thời gian; nếu phải sửa `apps/api/src/server.ts` hay `app.ts` thì khai vào Files (L2-02 **không** sửa hai file này).
- Hash password và hằng số 8 giờ: dùng `@quiq/db/security`; không viết lại.
- Truy cập DB và thời gian qua `deps` (module `routes.ts` nhận `(router, deps)`), test tích hợp dùng `createTestApp()`; không dùng `new Date()`/`Date.now()` trong code nghiệp vụ, dùng `deps.clock.now()`.
- Risk đỏ: auth/phiên/tenant → Reviewer STRICT.
