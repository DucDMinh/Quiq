Agent: reviewer

# Review: feature build-quiq, layer-1-task-04, round 1

Task: `tasks/build-quiq/layer-1-task-04.md` (điểm nối API: deps {db, clock}, loader, server, createTestApp, GET /api/health/db)

## Review level
NORMAL, nâng STRICT cho phần lộ lỗi DB (`modules/health/routes.ts`, `server.ts`) và khung `deps/loader/app`.

## Reason
Khung API dùng chung cho mọi layer sau (shared loader/app/deps), có đường log lỗi DB và chuỗi kết nối (security), nên phần đó là STRICT. Phần còn lại là thay đổi nhỏ, không schema/migration, không auth.

## Blast radius
- `apps/api/src/app.ts` (`createApp` đổi chữ ký, options bắt buộc), `modules/loader.ts` (`RegisterRoutes` thêm deps), `http/deps.ts` (mới): mọi module Layer 2+.
- `apps/api/src/server.ts`: khởi động thật, tạo pool postgres-js, shutdown.
- `apps/api/src/modules/health/routes.ts`: thêm `/api/health/db` (public, không auth).
- `apps/api/src/testing/*`: harness test tích hợp cho mọi task sau.
- `apps/api/vitest.config.ts`: timeout toàn bộ suite api.
- Nơi gọi `createApp(`: chỉ `server.ts:19`, `testing/test-app.ts:23`, `loader.test.ts`, `health.test.ts` (grep `apps/`), tất cả đã truyền `{ deps }`. Không còn chỗ gọi cũ `createApp()`.

## Verify commands + result
**BLOCKED.** Lệnh Bash đầu tiên `cd "E:/Quiq" && git status --short` bị hook `agent-guard.mjs` chặn:
`[agent-guard] reviewer/spec-validator: chỉ được cd "<worktree>" && <lệnh> với thư mục trong .worktrees/`.
Theo Tool Loop Guard, tôi dừng Bash ngay, không thử biến thể.

| Lệnh | Kết quả |
|---|---|
| `git status --short` | Blocked (agent-guard) |
| `git diff` | Not run (Bash blocked) |
| `pnpm typecheck` | Not run (Bash blocked) |
| `pnpm lint` | Not run (Bash blocked) |
| `pnpm test` | Not run (Bash blocked), không có số test thật |
| `pnpm build` | Not run (Bash blocked) |

Hệ quả: tôi không tự kiểm được (1) cả 4 lệnh verify, (2) phạm vi diff chỉ trong `apps/api/` và không đụng `packages/db`, migration, lockfile, `package.json`, (3) so `server.ts` với bản cũ (đọc `.env.local` "như cũ"), (4) `TestDb` gán được cho `DatabaseLike` tại `test-app.ts:23` mà không ép kiểu. Điểm (4) chỉ typecheck chứng minh được. Code không có cast ở đó, nhưng chưa có bằng chứng compile.

## Responsive Checklist Gate
N/A: diff không đụng UI (chỉ `apps/api/`).

## Skill gates
- aislop: skip, Bash blocked by agent-guard
- oxlint (anti-slop): skip, Bash blocked by agent-guard
- ocr (open-code-review): skip, Bash blocked by agent-guard
- AI-readable: OK. Tên rõ, hàm ngắn (lớn nhất `loadModules` khoảng 24 dòng), không magic number lạ (503, độ sâu cause 3, timeout có comment), comment giải thích WHY. 0 indicator.
- ai-friendly-web: N/A (API nội bộ, không phải web public)
- blitzstrike: skip, không có môi trường được phép / Bash blocked

## Kiểm từng Acceptance Criteria (đọc code + test)
1. `createApp({ deps })` truyền deps vào mọi `routes.ts`: OK theo code (`app.ts:18` → `loader.ts:47`). Test `loader.test.ts:75-83` dùng module giả thật trong thư mục tạm, không mock loader, kiểm cả `deps.db.marker` và `deps.clock.now()`.
2. Module chỉ khai `(router)` vẫn chạy: OK, `loader.test.ts:65-73` (module JS `register(router)` thật). `health` cũ `{ success:true, data:{status:"ok"} }`: `health.test.ts:21-28`, `test-app.test.ts:39-50`.
3. `createTestApp()`: PGlite migrate thật (`createTestDb`), hai lần gọi độc lập (`test-app.test.ts:52-60`), `close()` (`:71-76`), dọn PGlite khi `createApp` lỗi (`test-app.ts:25-27`). `close` là closure (`packages/db/src/testing.ts:39`), truyền không bind vẫn an toàn. Clock mặc định `2026-01-01T00:00:00.000Z`, `set/advance` đúng, `now()` trả bản sao (có test).
4. `/api/health/db`: ok khi sống (`health.test.ts:30-36`), 503 `DB_UNAVAILABLE` khi PGlite đóng (`:38-50`), test chống rò rỉ (`:52-76`). Xem phân tích rò rỉ bên dưới.
5. `server.ts`: thiếu chuỗi kết nối thì `createDb()` → `resolveDatabaseUrl()` ném lỗi có `docs/SUPABASE_SETUP.md`, không in giá trị, rồi `main().catch` → `exit(1)`, trước khi `listen`. Shutdown đóng server rồi `dbHandle.close()`. Chưa test tự động (builder đã báo).
6. Hợp đồng `ok()/fail()`, `AppError`, `errorMiddleware`, thứ tự `errorMiddleware → bodyParser → router` (`app.ts:21-23`): theo nội dung file hiện tại thì không đổi. Không diff được để xác nhận (Blocked).
7. Comment quy ước đồng hồ ở đầu `deps.ts:5-7`: OK.
8. typecheck/lint/test/build: KHÔNG kiểm được (Blocked). Smoke tay `pnpm dev` + curl là việc của dispatcher, reviewer không chạy.

## Phân tích rò rỉ lỗi DB (STRICT)
- (a) `health/routes.ts:13-22` chỉ log `name(code)` theo chuỗi `cause` tối đa 3 tầng, không bao giờ log `message`/`stack`/object. Body là `AppError` thông điệp cố định. OK.
- (b) Test `health.test.ts:52-76` spy cả `error/warn/log/info`, `inspect` toàn bộ arguments với depth 6. Thử suy luận mutation: route log `err.message` → logText chứa `postgres://`, test fail. Log nguyên `err` → inspect in message và stack, test fail. Trả `err.message` trong body → kiểm body fail. Đổi sang `throw err` → 500 thay vì 503, test fail. Test bắt được cả bốn mutation.
- (c) Route gọi `fail()` trực tiếp. `response.ts:12-21` không log, nên không đi qua nhánh `ctx.app.emit("error")` của `errorMiddleware` (`middleware.ts:35`) và handler `onerror` mặc định của Koa (in stack). OK cho đường này.
- `server.ts:43-45` `describeError` in `error.stack`. Lỗi lúc khởi động gồm thông điệp `resolveDatabaseUrl` (an toàn) và `new URL()` hỏng (Node `ERR_INVALID_URL`, message "Invalid URL", input nằm ở property `input`, không vào stack). postgres-js kết nối lười, nên lỗi kết nối không xảy ra ở startup. Chấp nhận được (residual: chưa kiểm message chính xác của Node đang dùng).

## Findings
Không có CRITICAL/MAJOR về code trong phạm vi tôi đọc được.

- [MINOR] `apps/api/src/server.ts:26-39`: shutdown không chống gọi hai lần (SIGINT rồi SIGTERM). Lần hai, callback của `server.close` nhận `ERR_SERVER_NOT_RUNNING`, bị bỏ qua, rồi gọi `client.end` lần nữa. Có `timeout: 5` nên không treo vô hạn. `closeAllConnections()` gọi ngay sau `close()` nên keep-alive không làm treo. Đề xuất: cờ `let shuttingDown = false` và return sớm nếu đã chạy. SIGINT lần hai rơi về handler mặc định (kill), chấp nhận được.
- [MINOR] `apps/api/src/server.ts:9-12` + `packages/db/src/client.ts:36`: nếu shell có `DATABASE_URL_STAGING=` rỗng, `process.loadEnvFile` không ghi đè biến đã tồn tại (hành vi Node, chưa tự kiểm trên Node 22), nên `resolveDatabaseUrl` rơi sang `DATABASE_URL` hoặc báo thiếu, dù `.env.local` có giá trị. Thông điệp gây hiểu nhầm nhưng không lộ gì. Đề xuất ghi chú trong `docs/SUPABASE_SETUP.md`, hoặc chấp nhận.
- [MINOR] `apps/api/vitest.config.ts:9-10`: ngoài danh sách Files. Lý do hợp lý (PGlite WASM + migration). Nhưng `testTimeout` 30s che test chậm thật. Khuyến nghị Layer 2: mỗi file test dùng một `createTestApp` trong `beforeAll` và dọn dữ liệu giữa các test (truncate), hoặc tạo snapshot/clone một PGlite đã migrate, thay vì 1-2 giây cho mỗi test. Cân nhắc hạ timeout khi đã tối ưu.
- [NIT] `apps/api/src/modules/loader.ts:11,47`: `RegisterRoutes` trả `void` và loader không `await`. Nếu module Layer 2 viết `async` register, lỗi lúc setup sẽ thành unhandled rejection. Đề xuất ghi rõ "register phải đồng bộ" trong comment, hoặc cho phép `void | Promise<void>` và `await`.
- [NIT] `apps/api/src/testing/test-app.test.ts:62-69`: test "advance đổi deps.clock.now() mà các module nhìn thấy" chỉ kiểm chính object `clock`, không qua route. Đúng nhờ `test-app.ts:21-24` dùng cùng biến, nhưng tên test hứa nhiều hơn những gì test kiểm. Có thể chấp nhận vì `loader.test.ts:75-83` đã chứng minh clock đi tới module.
- Quy ước `Date.now/new Date(`: grep `apps/` chỉ thấy `systemClock` (`deps.ts:15`), `test-clock.ts` và file test. OK.
- Ép kiểu: `as unknown as DatabaseLike` chỉ trong test (`health.test.ts:59`, `loader.test.ts:30`) cho db giả, hợp lý. Không có `as any`/`@ts-` trong code mới. `test-app.ts:23` không ép kiểu (cần typecheck xác nhận).

## Residual risk / không kiểm được
- Cả 4 lệnh verify, `git status`/`git diff` và phạm vi file (Bash bị agent-guard chặn với path gốc repo).
- Grep bí mật trong file mới: đã đọc toàn bộ file trong `apps/api/src`. Chuỗi `Sup3rSecretPw` trong `health.test.ts:53` là giả cố ý, không phải bí mật thật. File `.context/runs/build-quiq-layer-1-task-04.builder.md` chưa đọc.
- Kết nối Supabase thật, SIGINT/SIGTERM thật, message chính xác của `ERR_INVALID_URL` và hành vi `loadEnvFile` với biến rỗng trên Node đang dùng.

## Verdict
FAIL (unverifiable).

Theo phần code tôi đọc được, task không có lỗi CRITICAL hay MAJOR. FAIL chỉ vì thiếu bằng chứng verify: reviewer không chạy được typecheck/lint/test/build và git diff do agent-guard chặn `cd "E:/Quiq"`.

Cách gỡ cho dispatcher: chạy reviewer trên path worktree dưới `.worktrees/`, hoặc dispatcher tự chạy `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `git status --short`, `git diff --stat` rồi đính kèm output. Sau đó chạy lại round 1, ghi đè file này. Nếu cả bốn lệnh PASS và diff chỉ trong `apps/api/` thì có thể chuyển PASS, các MINOR không chặn.
