Agent: reviewer

# Review: build-quiq layer-2-task-01 (round 1)

Đăng nhập cán bộ, phiên, guard theo vai trò/trường, khung giao diện giáo viên.
Worktree: `E:\Quiq\.worktrees\layer-2__task-01` (branch `wt/layer-2__task-01`, base 98a1590, thay đổi chưa commit).

## Review level
STRICT

## Reason
Task đụng auth, phiên, cookie, rate-limit, RBAC, cô lập tenant (school), guard dùng chung (`http/guards.ts`) cho mọi layer sau, và điểm nối API dùng chung (`deps.ts`, `test-app.ts`, `config.ts`, `server.ts`).

## Blast radius
- API: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (mới); `http/guards.ts` sẽ là guard của mọi route dữ liệu trường ở L3+.
- Điểm nối: `AppDeps.session?` (tùy chọn), `createTestApp({ session? })`, `TEST_SESSION_CONFIG`; `loadConfig()` giờ ném lỗi khi thiếu `SESSION_SECRET` (api không khởi động nếu thiếu biến).
- Shared: `@quiq/shared/auth` (schemas, errors, `STAFF_SESSION_TTL_MS`).
- Web: `/dang-nhap`, `/giao-vien` layout + redirect, `features/auth/*`, `features/shell/*` (nav-config do task này sở hữu).
- Data: bảng `sessions` (insert/update `expires_at`/`revoked_at`), đọc `staff_accounts`, `schools`, `subjects`. Không đổi schema.

Ownership điểm nối: `git status --short` chỉ thấy sửa `config.ts`, `http/deps.ts`, `server.ts`, `testing/test-app.ts` (đúng danh sách được phép), còn lại là file mới. KHÔNG đụng `app.ts`, `modules/loader.ts`, `http/errors.ts`, `http/middleware.ts`, `packages/shared/src/common/**`, `api-client.ts`, `next.config.ts`, `app/page.tsx`, `app/layout.tsx`, `packages/db/**`, `package.json`, `pnpm-lock.yaml`, student/attempts/thi. Chữ ký `createApp({deps:{db,clock}})` vẫn hợp lệ (session tùy chọn), `createTestApp(options?)` chỉ thêm option, `RegisterRoutes` không đổi (auth module dùng đúng `(router, deps)`).

## Verify commands + result (chạy thật trong worktree)
| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (db, engine, shared, api, web) |
| `pnpm lint` | PASS (eslint apps packages, không lỗi/cảnh báo) |
| `pnpm test` | PASS: Test Files 23 passed (23), Tests 321 passed (321), khớp lời builder |
| `pnpm build` | PASS (exit 0) |

## Responsive Checklist Gate
App là desktop-only theo AC ("chỉ desktop (MinWidthGuard)"); `MinWidthGuard` bọc toàn bộ ở `apps/web/src/app/layout.tsx:20` (file có sẵn, không đổi). Mốc 375/768 bị guard thay bằng thông báo, nên chỉ đánh giá thực chất ở 1280.
- Layout, không cuộn ngang: OK. Shell `grid-cols-[var(--layout-sidebar-width)_minmax(0,1fr)]` (`app-shell.tsx:151`), cột nội dung `minmax(0,1fr)` + `min-w-0`. Sidebar 276px là cố định theo design-spec §3/task, OK-by-spec.
- Container không fixed px: OK (`max-w-(--layout-content-max)`, thẻ login `w-full max-w-md`).
- Typography rem: OK (lớp Tailwind theo token; `text-[1.375rem]` dùng rem).
- Media: N/A (không có ảnh/video).
- Touch target ≥44px: OK, link menu `min-h-11` (`app-shell.tsx:72`); nút theo component có sẵn.
- Nav mobile/hamburger: N/A (desktop-only, MinWidthGuard).
- Table: N/A.
- Viewport: OK, dùng `min-h-dvh`/`h-dvh` (`dang-nhap/page.tsx:16`, `app-shell.tsx:59,91,151`), không `100vh`.
- Reduced motion: OK, chỉ `transition-colors duration-150`, không animation chuyển động.
- Không che lỗi bằng overflow hidden: OK (`overflow-y-auto` chỉ ở nav sidebar).
Không có browser: xác minh bằng CSS/class, xem Residual risk.

## Skill gates
- aislop: skip, `aislop: command not found` (exit 127).
- oxlint (anti-slop): skip, oxlint not configured (lint là eslint; `pnpm lint` PASS).
- ocr (open-code-review): skip, ocr not installed (không chạy).
- AI-readable: OK. 1 indicator nhẹ (file test `auth.test.ts` dài hơn 300 dòng, khoảng 320). Tên rõ, hàm ngắn, comment giải thích WHY, không magic number (hằng `LOGIN_MAX_FAILURES`, `LOGIN_FAILURE_WINDOW_MS`, `STAFF_SESSION_TTL_MS`). Dưới ngưỡng 3.
- ai-friendly-web: N/A (khu vực cán bộ nội bộ, không public).
- blitzstrike: skip, không có môi trường pentest được phép.
- Em-dash: OK, grep `—` trong `apps/web/src` không ra kết quả.

## Kiểm từng điểm soi kỹ
1. Rò rỉ mật khẩu/token/secret: OK. Không log body; lỗi zod chỉ trả `path`+`message` (`http/middleware.ts:14-17`), message không chứa giá trị; `loadStaffMe` chọn cột tường minh không có `password_hash`; config báo lỗi không in giá trị secret (có test). Form `method="post"` nên Enter trước hydrate không đưa mật khẩu vào URL (`login-form.tsx:78`); mật khẩu chỉ đi body POST (có test web).
2. Timing/enumeration: OK. `verifyLogin` luôn chạy scrypt (dummy hash cho username không tồn tại), so mật khẩu TRƯỚC khi xét `isActive`/trường khóa (`service.ts:47-53`); sai mật khẩu ở trường khóa vẫn là lỗi chung (có test).
3. Rate-limit: xem MAJOR-1 (race) và Residual risk R1 (proxy/IP).
4. Phiên: token 32 byte `randomBytes`, DB lưu HMAC-SHA256(secret, token) (`session-cookie.ts:9-16`); token mới mỗi lần login (không fixation); cookie HttpOnly, SameSite=Lax, Secure khi `NODE_ENV=production`, path `/`, Max-Age 8h; hết hạn trượt cập nhật cả DB lẫn cookie (`guards.ts:54-55`); logout thu hồi `revoked_at`; tài khoản vô hiệu → 401 + xóa cookie; trường khóa → 403 SCHOOL_LOCKED. Thiếu `deps.session` → 500 fail closed (có test cho cả login lẫn /me).
5. Tenant: OK. `schoolId` chỉ từ phiên (`tenantSchoolId`), có test bỏ qua `?schoolId=`; chéo trường 404 cho cả hai cách lọc; `super_admin` (school null) bị `requireTenant` chặn 403. `SCHOOL_STATUSES = ["active","locked"]` nên chỉ cần chặn `locked`.
6. Web: open-redirect chặn ở `postLoginPath` (`nav-config.ts:49-54`): bắt đầu `/`, không `//`, không `\`, và phải nằm dưới `basePath` của vai trò, nên `/\t/evil.com` cũng bị loại vì không thuộc `/giao-vien/`. Dialog "Phiên đăng nhập đã hết hạn" có test; loading skeleton, lỗi + thử lại, trường khóa, sai vai trò (404 chung) đều có nhánh và test. `/giao-vien` redirect về `homePath`.
7. Doc-Impact: xem mục riêng.
8. Mutation:
   - Bỏ kiểm khóa trường (login hoặc guard): bị bắt (`auth.test.ts` "trường bị khóa…", `guards.test.ts:120`).
   - Bỏ trượt hạn: bị bắt (`auth.test.ts` "hạn trượt…", `guards.test.ts:179`).
   - Bỏ so mật khẩu: bị bắt (test lỗi chung khi sai mật khẩu).
   - Lấy schoolId từ query: bị bắt (`guards.test.ts:165`).
   - Bỏ `isNull(revokedAt)`: bị bắt (logout test, `guards.test.ts:108`).
   - Bỏ dummy hash: KHÔNG có test timing (chấp nhận, khó test ổn định).
   - Rate-limit dưới tải song song: KHÔNG có test, và thực tế đang sai (MAJOR-1).

## Findings

### [CRITICAL]
Không có.

### [MAJOR]
**MAJOR-1: Rate-limit có race TOCTOU, burst song song vượt giới hạn 5 lần.**
`apps/api/src/modules/auth/routes.ts:33-40`. `throwIfThrottled` kiểm đồng bộ, rồi `await verifyLogin(...)` nhường event loop (truy vấn DB + scrypt), và `limiter.recordFailure(key)` chỉ chạy sau khi verify xong. Không có gì giữ chỗ cho lượt thử đang chạy, nên N request sai mật khẩu gửi đồng thời đều vượt qua kiểm `count < 5` trước khi lỗi nào được ghi. Giới hạn "5 lần / 15 phút" (AC: "6 lần sai liên tiếp → 429") thành "bao nhiêu cũng được trong một đợt burst". Lỗi này độc lập với vấn đề proxy/IP và nằm hoàn toàn trong file của task.
Cách sửa đề xuất: tính lượt thử TRƯỚC khi verify (vd. `limiter.recordAttempt(key)` tăng đếm rồi mới `verifyLogin`; đúng mật khẩu thì `reset(key)`), hoặc giữ bộ đếm in-flight cộng vào `blockedForSeconds`. Giữ nguyên ngữ nghĩa tuần tự hiện có (lần thứ 6 bị 429 kể cả mật khẩu đúng).
Test bắt buộc thêm: gửi khoảng 10 request sai đồng thời bằng `Promise.all` cùng username, khẳng định tối đa 5 request tới bước so mật khẩu (hoặc ít nhất 5 request còn lại nhận 429), sau đó lần đúng mật khẩu vẫn bị 429.

### [MINOR]
- MINOR-1: Đăng nhập lại khi trình duyệt đang có cookie phiên cũ không thu hồi phiên cũ (`routes.ts:45-47`); token cũ sống tới 8h nếu bị lộ. Đề xuất: nếu request login có `quiq_session` thì `revokeSession` trước khi cấp mới.
- MINOR-2: `getDummyHash` memo hóa lười (`service.ts:24-25`), nên request đầu tiên với username không tồn tại tốn 2 lần scrypt (hash + verify), lệch thời gian một lần sau mỗi lần khởi động. Đề xuất: khởi tạo khi đăng ký route (warm-up) hoặc dùng hash hằng tính sẵn.
- MINOR-3: Bộ đếm in-memory theo tiến trình (`rate-limit.ts:28-29`): nhiều instance thì giới hạn nhân lên; trong một cửa sổ map tăng một entry cho mỗi username khác nhau (chỉ xóa entry hết hạn khi ≥1000). Chấp nhận cho demo một tiến trình; ghi cho layer cứng hóa.
- MINOR-4: Login CSRF: `/auth/login` không kiểm Origin; SameSite=Lax không ngăn trang ngoài POST để đặt phiên của kẻ tấn công vào trình duyệt nạn nhân (nếu bodyparser nhận form-urlencoded). Tác động thấp; đề xuất kiểm `Origin`/`Content-Type: application/json` ở layer cứng hóa.

### [NIT]
- `auth.test.ts` dài hơn 300 dòng; có thể tách `auth.session.test.ts`.

## Doc-Impact
KHÔNG phải `none`. Dispatcher cập nhật lúc close-out:
- `docs/API_SPEC.md`: thêm `POST /api/auth/login` (body `{username, password}`, 200 trả `StaffMe` + Set-Cookie), `POST /api/auth/logout` (luôn 200 `{loggedOut:true}`, xóa cookie, thu hồi phiên), `GET /api/auth/me` (200 `StaffMe`: id, username, displayName, role, schoolId, schoolName, subject). Cookie `quiq_session` (HttpOnly, SameSite=Lax, Secure khi production, Max-Age 8h, trượt mỗi request). Mã lỗi: `INVALID_CREDENTIALS` 401, `SCHOOL_LOCKED` 403, `LOGIN_THROTTLED` 429 + header `Retry-After` + `details.retryAfterSeconds`, `UNAUTHENTICATED` 401, `VALIDATION` 422, `FORBIDDEN` 403, `NOT_FOUND` 404 chéo trường.
- `docs/DESIGN.md` (current-state): luồng guard `authenticate → requireRole → requireTenant`, `schoolId` chỉ lấy từ phiên, 404 chéo trường, token đục lưu HMAC, fail closed khi thiếu `deps.session`.
- Tài liệu môi trường: `SESSION_SECRET` bắt buộc ≥32 ký tự (đã có trong `.env.local.example`; kiểm lại hướng dẫn chạy/deploy).

## Residual risk
- R1 (proxy/IP, KHÔNG chặn task này, phải đăng ký gap/task follow-up): `app.proxy` tắt nên qua rewrite Next `ctx.ip` luôn là IP proxy; trong production khóa rate-limit thực chất chỉ là username. Hệ quả: bất kỳ ai biết username giáo viên có thể khóa tài khoản đó 15 phút, lặp lại được (ví dụ học sinh khóa giáo viên trong giờ thi). Lý do không chặn: bật `app.proxy` cần sửa `app.ts` (file bị khóa với task này); đọc `X-Forwarded-For` khi chưa có proxy tin cậy còn tệ hơn (giả mạo được để vượt giới hạn); trường học sau NAT dùng chung IP nên thành phần IP vốn bảo vệ yếu kể cả khi đúng. Dispatcher phải ghi vào gap register hoặc task cứng hóa thuộc chủ `app.ts` (bật `proxy` có cấu hình tin cậy + cân nhắc cơ chế chống khóa tài khoản, vd. trễ tăng dần thay vì khóa cứng, giới hạn theo IP riêng).
- R2: Không có browser; responsive/UI xác minh qua class CSS và test jsdom.
- R3: Vượt cap đọc STRICT: chưa đọc trực tiếp `.context/design-spec.md` §3/§4.2/§6.5, `docs/specs/2026-11-25-quiq-design.md`, `.agent/FEATURE_WORKFLOW.md`, `.context/project-config.md` (chỉ dùng lệnh verify theo brief), `session-expired-dialog.tsx` toàn văn, `staff-fixtures.ts`. Độ khớp thị giác với design-spec chưa được kiểm đầy đủ.
- R4: aislop/ocr/blitzstrike không chạy được (xem Skill gates).

## Verdict
FAIL

Lý do: MAJOR-1 (race rate-limit cho phép vượt giới hạn 5 lần bằng request song song, không có test bắt). Các phần còn lại (phiên, cookie, enumeration, tenant, web, ownership điểm nối, 4 lệnh verify) đạt. Sửa MAJOR-1 + thêm test song song rồi chạy round 2; MINOR có thể làm cùng lúc hoặc ghi follow-up.
