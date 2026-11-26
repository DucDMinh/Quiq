# Design Specification: trang trỏ + current-state

> Nguồn thiết kế (intent) của Quiq nằm ở các file dưới đây; không sao chép nội dung vào đây để tránh lệch.
> Phần **Current state** bên dưới là as-built (cập nhật khi code đổi, kèm pointer code).

| Nội dung | Vị trí |
|---|---|
| Design tokens (màu, chữ, khoảng cách, bo góc, đổ bóng, motion, contrast đã đo) | `skills/react-nodejs/design-tokens.md` |
| Screen specs (mọi màn, trạng thái, tương tác, quy tắc responsive, khác biệt với prototype) | `.context/design-spec.md` |
| Prototype tham chiếu tương tác được | `index.html` (thư mục gốc) |
| Design doc kiến trúc | `docs/specs/2026-11-25-quiq-design.md` |
| Hợp đồng API as-built | `docs/API_SPEC.md` |
| Gap code ↔ intent | `docs/changes/TECHNICAL_REQUIREMENT_GAPS.md` |

## Current state (as-built, sau Layer 2, 2026-11-26)

### API (Koa, `apps/api`)
- `createApp({ deps })` (`src/app.ts`): middleware `errorMiddleware → bodyParser → router`; module loader nạp `src/modules/*/routes.ts`, mỗi module nhận `(router, deps)`.
- `AppDeps` (`src/http/deps.ts`): `db`, `clock` (mọi mốc giờ nghiệp vụ dùng `deps.clock.now()`, không `new Date()`/`Date.now()`), `session?` (`SessionConfig { secret, secureCookie }`, thiếu thì route cán bộ fail closed 500).
- `server.ts` nạp `.env.local`, bắt buộc `SESSION_SECRET` ≥ 32 ký tự (`src/config.ts`), mở pool postgres-js, tắt êm qua `src/shutdown.ts`.
- Test tích hợp: `createTestApp()` (`src/testing/test-app.ts`) dựng PGlite đã migrate + đồng hồ giả.

### Xác thực cán bộ
- Luồng guard `authenticate → requireRole → requireTenant` (`src/http/guards.ts`); `schoolId` chỉ từ phiên; chéo trường 404; trường khóa 403.
- Phiên `quiq_session`: token 32 byte, DB lưu HMAC-SHA256(SESSION_SECRET, token), trượt 8 giờ, thu hồi khi đăng xuất hoặc đăng nhập lại.
- Giới hạn đăng nhập: bộ đếm in-memory, giữ chỗ đồng bộ trước khi so mật khẩu (chống race), dọn theo clock, trần 10.000 khóa (`modules/auth/rate-limit.ts`); hash giả tính sẵn lúc đăng ký route để chống dò tài khoản theo thời gian.

### Học sinh thi
- Phiên `quiq_stu` (`modules/student/student-session.ts`): **hiệu lực** (làm bài) và **chỉ-xem** (sau khi kết thúc: xem state, nộp lại idempotent, xem kết quả). Một học sinh tối đa một phiên hiệu lực (chỉ mục DB).
- **Chưa hỗ trợ đổi máy**: vào thi khi đang có attempt `in_progress` mà không mang phiên hiệu lực của chính mình → 409 `ATTEMPT_IN_PROGRESS` (bản tạm, chờ FR-043; lệch luồng takeover trong design doc, xem gap G-04).
- `finalizeAttempt(deps, attemptId, reason)` (`modules/attempts/finalize.ts`) là **điểm kết thúc duy nhất** (nộp, hết giờ, về sau thu bài/vi phạm): khóa hàng `FOR UPDATE`, chấm bằng engine, ghi `score`, thu hồi phiên học sinh của lớp đó.
- Hết giờ kiểm **lười** theo `ends_at + 3s` khi có request (`expireDueAttempts`); sweeper nền là tính năng sau (Layer 6).
- `is_correct` chỉ dùng để chấm; đề và kết quả trả về không bao giờ chứa đáp án đúng.
- Polling `GET /api/student/state` 3 giây thay cho SSE (Layer 4).

### Web (Next.js, `apps/web`)
- Gọi API same-origin `/api/*` qua rewrite (`next.config.ts`), `src/lib/api-client.ts` phát sự kiện `quiq:unauthenticated` khi 401.
- Cán bộ: `/dang-nhap`, khung `AppShell` (`src/features/shell/app-shell.tsx`); **`src/features/shell/nav-config.ts` là chỗ duy nhất** để layer sau thêm mục menu; dialog "Phiên đăng nhập đã hết hạn".
- Học sinh: `/thi`, `/thi/[code]`, `/phong-cho`, `/lam-bai`, `/ket-qua` (`src/features/student/`).
- Chỉ desktop (`MinWidthGuard` ở root layout).
