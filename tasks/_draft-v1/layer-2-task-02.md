# Task 02: Trang đăng nhập, API client, App shell theo vai trò, route guard (web)

## Layer
2

## Type
build

## Description
Phần web của xác thực cán bộ: trang `/dang-nhap`, **API client** dùng chung (`/api/*` cùng origin, bóc envelope, lỗi có kiểu, xử lý hết phiên), `AuthProvider`, **App shell** (sidebar 276px theo 3 vai trò, khối người dùng + đăng xuất) với **menu liệt kê TẤT CẢ route tương lai ngay từ đầu** (theo bảng route trong `_layer-plan.md` §4.4) để task sau không sửa menu, **Portal shell** dùng chung cho các trang công khai/học sinh, route guard theo vai trò, trang trường bị khóa, và hook tải dữ liệu nhỏ dùng lại ở L3+.

## Dependencies
- layer-1-task-02 (primitive UI, tokens, ViewportGuard, not-found)
- layer-1-task-03 (hợp đồng `@quiq/shared/auth`: `loginRequestSchema`, `meResponseSchema`, `landingPathForRole`, mã lỗi)

## Acceptance Criteria
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` và `.context/design-spec.md` §3 (App shell, Portal shell, Dialog, Toast), §4.2 (đăng nhập), §6.5 (phiên hết hạn, trường bị khóa, 404). Một hệ thiết kế; không em-dash; chỉ desktop.
- [ ] `src/lib/api-client.ts`: `apiFetch<T>(path, { method, body, signal })` gọi `/api/...` cùng origin kèm cookie, bóc `{ success, data | error }`, ném `ApiError { status, code, message, details }`; `apiGet/apiPost/apiPut/apiPatch/apiDelete`; tải file (`apiDownload`) cho xuất `.xlsx` về sau; lỗi mạng ném `ApiError` mã `NETWORK` với thông báo tiếng Việt. Khi nhận 401 `SESSION_EXPIRED` từ API cán bộ: phát sự kiện toàn cục để hiện dialog "Phiên đăng nhập đã hết hạn" rồi chuyển `/dang-nhap?next=<trang đang xem>` (giữ lại trang để quay về); khi nhận `SCHOOL_LOCKED` hiện màn "Trường của bạn đang bị khóa. Liên hệ quản trị hệ thống." Không có 401 lặp vô hạn (có test).
- [ ] `src/lib/use-resource.ts`: hook `useResource(fetcher, deps)` trả `{ data, error, loading, reload }` (huỷ request cũ khi đổi deps) và `useMutation(fn)` trả `{ run, loading, error }`; dùng chung cho mọi trang L3+ (có test).
- [ ] `src/lib/nav.ts`: cấu hình menu theo vai trò (nhãn, icon Tabler, route) **đủ toàn bộ mục** của `_layer-plan.md` §4.4: Admin tổng (Thống kê tổng hợp, Quản lý trường học, Tài khoản Admin trường), Admin trường (Môn học, Giáo viên, Năm học & Lớp, Học sinh, Phân công & Quy chế, Kho dữ liệu chỉ đọc), Giáo viên (Ngân hàng câu hỏi, Bài thi, Phòng thi, Kết quả, Học sinh lớp phụ trách). Mục trỏ tới trang chưa tồn tại vẫn hiện (404 chung tới khi layer sau xong).
- [ ] `AuthProvider` + `useAuth()` lấy `/api/auth/me`; **route guard** ở layout từng khu: chưa đăng nhập -> `/dang-nhap?next=...`; sai vai trò -> trang `not-found` chung (không lộ khu vực khác); `super_admin` không vào `/quan-tri` và `/giao-vien`.
- [ ] `src/app/dang-nhap/page.tsx` + `LoginForm` (react-hook-form + zod): 2 ô (tên đăng nhập, mật khẩu có nút hiện/ẩn có `aria-label`), nút "Đăng nhập" (primary), trạng thái "Đang đăng nhập…", lỗi chung ngay dưới form (`INVALID_CREDENTIALS`, `SCHOOL_LOCKED_LOGIN`, 429 kèm số giây còn lại), Enter gửi form, đăng nhập xong chuyển `next` (nếu hợp lệ cùng khu vực) hoặc `landingPathForRole`. Đã đăng nhập mà vào `/dang-nhap` thì chuyển thẳng tới trang của vai trò. Không có "Mở nhanh tài khoản mẫu".
- [ ] Layout `admin-tong`, `quan-tri`, `giao-vien` dùng `AppShell`: sidebar 276px (logo, menu theo vai trò, mục đang chọn rõ, khối người dùng + tên trường/môn + nút Đăng xuất ở chân), vùng nội dung tối đa `--layout-content-max`, tiêu đề trang + phụ đề; trang `page.tsx` của từng khu chỉ redirect tới mục đầu (`/admin-tong/thong-ke`, `/quan-tri/mon-hoc`, `/giao-vien/ngan-hang`). Giáo viên: tiêu đề trang luôn nêu **môn cố định**.
- [ ] `PortalShell` (`src/components/portal-shell/portal-shell.tsx`): topbar (logo, điều hướng pill), nội dung căn giữa, nền `--bg-portal`, tham số độ rộng (780/860/1140); dùng cho `/dang-nhap` và sẽ được `/thi/*`, `/tra-cuu` dùng ở L7.
- [ ] Skeleton khi `me` đang tải (không spinner toàn trang); lỗi tải `me` có nút "Thử lại".
- [ ] Test PASS: api-client (bóc envelope, ApiError, 401 sự kiện, mạng lỗi), use-resource, nav (mỗi vai trò đủ mục, không mục trùng route), LoginForm (validate, lỗi, điều hướng), route guard (3 trường hợp), không em-dash trong chữ giao diện của các file mới.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/use-resource.ts`
- `apps/web/src/lib/nav.ts`
- `apps/web/src/lib/auth/auth-context.tsx`
- `apps/web/src/lib/auth/route-guard.tsx`
- `apps/web/src/components/app-shell/app-shell.tsx`
- `apps/web/src/components/app-shell/sidebar.tsx`
- `apps/web/src/components/app-shell/user-block.tsx`
- `apps/web/src/components/app-shell/page-header.tsx`
- `apps/web/src/components/portal-shell/portal-shell.tsx`
- `apps/web/src/components/session-expired-dialog.tsx`
- `apps/web/src/components/school-locked-screen.tsx`
- `apps/web/src/features/auth/login-form.tsx`
- `apps/web/src/app/dang-nhap/page.tsx`
- `apps/web/src/app/admin-tong/layout.tsx`
- `apps/web/src/app/admin-tong/page.tsx`
- `apps/web/src/app/quan-tri/layout.tsx`
- `apps/web/src/app/quan-tri/page.tsx`
- `apps/web/src/app/giao-vien/layout.tsx`
- `apps/web/src/app/giao-vien/page.tsx`
- `apps/web/src/lib/api-client.test.ts`
- `apps/web/src/lib/use-resource.test.tsx`
- `apps/web/src/lib/nav.test.ts`
- `apps/web/src/features/auth/login-form.test.tsx`
- `apps/web/src/lib/auth/route-guard.test.tsx`

## Notes
- **Risk:** đỏ (bề mặt xác thực + khung giao diện cho mọi khu; reviewer STRICT, kiểm a11y: focus, `aria-live`, nhãn nút icon).
- Chưa tạo trang giữ chỗ cho các mục menu; các task L3/L4/L6/L7 mỗi task sở hữu đúng trang của mình (xem bảng route). Redirect ở `page.tsx` mỗi khu là file cố định, task sau không sửa.
- Sự kiện hết phiên: quản lý bằng một `EventTarget` nhỏ trong `api-client.ts`; `SessionExpiredDialog` mount trong layout gốc của từng khu.
- Không lưu token hay dữ liệu nhạy cảm vào `localStorage`/`sessionStorage`; chỉ dùng `next` trong query (kiểm tra là đường dẫn nội bộ bắt đầu bằng `/`, chống open redirect, có test).
- Màn trường bị khóa với học sinh không thuộc task này (L6-02/L7-01); tra cứu điểm vẫn dùng được (L7-05).
- Tham khảo prototype `index.html` (grep `sidebar`, `login`) cho bố cục, không sao chép tím/"Kahoot"/dữ liệu mẫu.
