Agent: reviewer

# Review: feature build-quiq, layer-1-task-04, round 2

Task: `tasks/build-quiq/layer-1-task-04.md` (điểm nối API: deps {db, clock}, loader, server, createTestApp, GET /api/health/db)
Worktree: `E:\Quiq\.worktrees\layer-1__task-04` (branch `wt/layer-1__task-04`), thay đổi chưa commit.

## Review level
NORMAL. Nâng STRICT cho phần lộ lỗi DB (`modules/health/routes.ts`, `server.ts`) và khung `deps/loader/app/shutdown`.

## Reason
Khung API dùng chung cho mọi layer sau (loader, app, deps, harness test). Có đường log lỗi DB và chuỗi kết nối (security), nên phần đó review STRICT. Không có schema/migration/auth.

## Blast radius
- `apps/api/src/app.ts`: `createApp(options)` giờ bắt buộc `{ deps }`. Mọi chỗ gọi đã truyền deps: `server.ts:33`, `testing/test-app.ts:30`, `loader.test.ts` (8 chỗ), `health.test.ts:64`.
- `apps/api/src/modules/loader.ts`: `RegisterRoutes = (router, deps) => void | Promise<void>`, `loadModules(router, deps, modulesDir?)`, có `await` register. Mọi module Layer 2+ phụ thuộc vào đây.
- `apps/api/src/http/deps.ts` (mới): `Clock`, `systemClock`, `AppDeps { db: DatabaseLike; clock: Clock }`.
- `apps/api/src/server.ts` + `apps/api/src/shutdown.ts` (mới): khởi động thật, pool postgres-js, tắt êm.
- `apps/api/src/modules/health/routes.ts`: thêm `/api/health/db` (public, không auth).
- `apps/api/src/testing/*` (mới): `createTestApp`, `createTestClock` cho test tích hợp mọi task sau.
- `apps/api/vitest.config.ts`: timeout toàn suite api.
- `packages/db/src/security/password.test.ts`: chỉ đổi test, `password.ts` không đổi.

## Verify commands + result (chạy thật trong worktree)
| Lệnh | Kết quả |
|---|---|
| `git status --short` | 7 file M trong `apps/api/` + `packages/db/src/security/password.test.ts`. File mới: `apps/api/src/http/deps.ts`, `deps.test.ts`, `shutdown.ts`, `shutdown.test.ts`, `apps/api/src/testing/` |
| `git diff` (chạy đầy đủ thay cho `--stat`) | Chỉ các file trên. Không đổi schema/migration/lockfile/`package.json`/`password.ts` |
| `pnpm typecheck` | PASS. db, engine, shared, api, web đều `Done` |
| `pnpm lint` | PASS. `eslint apps packages` không có output lỗi |
| `pnpm test` | PASS. `Test Files 19 passed (19)`, `Tests 270 passed (270)`, 17.00s |
| `pnpm build` | PASS. `apps/web build: Done` (api không có script build, `--if-present`) |
| `pnpm vitest run packages/db/src/security/password.test.ts` | PASS. `26 passed (26)`, 1.45s |

Ghi chú: lần đầu tôi gửi `pnpm typecheck` và `pnpm lint` có `| tail`, agent-guard chặn vì có pipe. Tôi chạy lại không pipe, đúng luật hook cho phép. Không chạy `pnpm dev`, không kết nối Supabase, không đọc `.env.local`.

File test mật khẩu chạy 2 lần (1 lần trong suite, 1 lần riêng), cả hai PASS. Tôi không chạy thêm vì Tool Loop Guard cấm lặp cùng một lệnh. Test này xác định theo cách dựng, xem mục 4.

## Bảng đóng finding round 1
| # | Finding cũ | Trạng thái | Bằng chứng |
|---|---|---|---|
| FAIL | Unverifiable (Bash bị chặn) | ĐÓNG | Đủ 4 lệnh verify + git đã chạy thật, đều PASS |
| (a) | [MINOR] shutdown chạy 2 lần | ĐÓNG | `shutdown.ts:16-19` có cờ `shuttingDown`, set đồng bộ trước `server.close`, không có race trong một luồng JS. Thứ tự là `server.close` → (callback) `closeDb` → `exit(0)`. Lỗi `closeDb` → `logError` + `exit(1)`. `closeAllConnections` ngay sau `close` nên keep-alive không làm treo. `closeDb` = `client.end({ timeout: 5 })` (`packages/db/src/client.ts:65`) nên không treo vô hạn. Test `shutdown.test.ts:25-60` kiểm thứ tự sự kiện, gọi 3 lần chỉ chạy 1 lần, nhánh exit 1. `server.ts:39-45` nối dây đúng, dùng `process.once` |
| (b) | [NIT] loader không await | ĐÓNG | `loader.ts:11` kiểu `void \| Promise<void>`, `loader.ts:48` có `await`. Test `loader.test.ts` "chờ register async xong" (setTimeout 20ms rồi mới đăng ký route, trả 200) và "register async ném lỗi thì createApp reject" (`rejects.toThrow("setup hỏng")`) |
| (c) | [MINOR] biến rỗng trong shell | ĐÓNG | `server.ts:17-27` thông điệp nói rõ "chưa được đặt hoặc đang rỗng", có câu "Biến đang rỗng ngay trong shell cũng tính", trỏ `docs/SUPABASE_SETUP.md`. Không in giá trị. `resolveDatabaseUrl` (`client.ts:35-41`) chỉ ném đúng một lỗi là thiếu biến, nên catch rồi viết lại không bóp méo. `describeError` (`server.ts:51-53`) chỉ in stack/message, không in object, nên thuộc tính `input` của `ERR_INVALID_URL` không ra log |
| (d) | [NIT] test clock không qua route | ĐÓNG | `test-app.test.ts:65-88` dựng module `clockprobe` trong thư mục tạm, `createTestApp({ modulesDir })`, gọi `GET /api/now` trước và sau `advance(60_000)`, chênh đúng 60000ms |
| (e) | Lộ lỗi DB (STRICT) | OK | Xem mục phân tích bên dưới |
| - | [MINOR] vitest timeout 30s/60s | CHẤP NHẬN | `vitest.config.ts:8-11` có comment lý do (PGlite WASM + migration) và hướng dẫn Layer sau dùng `beforeAll`. `test-app.ts:23-24` nhắc lại |

## Phân tích rò rỉ lỗi DB (STRICT)
- `health/routes.ts:13-22` `describeDbError` chỉ ghi `name(code)` theo chuỗi `cause` tối đa 3 tầng. Không có `message`, `stack` hay object. Body dùng `AppError("DB_UNAVAILABLE")` với thông điệp cố định.
- Suy luận mutation trên test `health.test.ts:52-76`. Test spy `error/warn/log/info`, inspect depth 6, kiểm 4 chuỗi bí mật trong body và log, và kiểm log có `ECONNREFUSED`.
  - Log `err.message`: message có `postgres://...`, test FAIL. Bắt được.
  - Log nguyên `err`: inspect in message/stack, test FAIL. Bắt được.
  - Trả `err.message` trong body: `toEqual` body và kiểm secret đều FAIL. Bắt được.
  - `fail()` → `throw err`: `errorMiddleware` trả 500, test 503 FAIL. Bắt được.
  - `fail()` → `throw new AppError(...)` cùng status 503: hành vi tương đương. `middleware.ts:35` emit `error` với status ≥500, Koa in stack của AppError, nhưng thông điệp là chuỗi cố định nên không lộ gì. Không phải lỗ hổng.
  - Bỏ hẳn log: kiểm `toContain("ECONNREFUSED")` FAIL. Bắt được.
- Test 503 thật dùng PGlite đã đóng (`health.test.ts:38-50`), không mock.

## Mục 4: sửa test mật khẩu
- Lập luận nguyên nhân gốc đúng. 16 byte salt → 22 ký tự base64url không padding = 132 bit, dư 4 bit. 64 byte key → 86 ký tự = 516 bit, dư 4 bit. `Buffer.from(x, "base64url")` của Node bỏ qua các bit dư, nên đổi ký tự cuối sang ký tự cùng 4 bit cao cho ra cùng byte. Xác suất khoảng 1/16 với mỗi lần đổi, khớp quan sát 30/506.
- Chấp nhận chuỗi base64url không chuẩn là vô hại. Byte giải mã giống hệt nên đầu vào scrypt và kết quả giống hệt. Người sửa được chuỗi hash đã lưu thì cũng ghi được hash tùy ý. Không cần bắt `verifyPassword` từ chối dạng không chuẩn.
- Test mới (`password.test.ts:57-72`) đổi byte đầu bằng XOR 0xff, luôn đổi giá trị, mã hóa lại chuẩn, nên xác định 100%. Có cả kiểm đối chứng `stored` gốc vẫn `true`.
  - Mutation "bỏ `timingSafeEqual`, luôn true": ca "khóa" FAIL. Bắt được.
  - Mutation "bỏ qua salt đã lưu": ca "salt" FAIL vì salt đổi thì khóa dẫn xuất đổi. Bắt được.
  - Index 4 = salt, 5 = key khớp định dạng `scrypt$N$r$p$salt$hash` (`password.ts:3,46-53`).

## Mục 5: hợp đồng cho Layer 2
- Khớp yêu cầu: `RegisterRoutes` (`loader.ts:11`), `loadModules(router, deps, modulesDir?)` (`loader.ts:27-31`), `createApp({ deps, modulesDir? })` (`app.ts:8-15`), `AppDeps` (`deps.ts:17-21`), `createTestApp(options?)` trả `{ app, db, clock, close }` (`test-app.ts:11-36`), `createTestClock(start?)` mặc định `2026-01-01T00:00:00.000Z` (`test-clock.ts:9`).
- Ép kiểu: `as unknown as DatabaseLike` chỉ có ở `health.test.ts:59` và `loader.test.ts:30` (db giả trong test). Không có `as any` hay `@ts-`. `test-app.ts:30` không ép kiểu và typecheck PASS.
- `Date.now` / `new Date(`: ngoài file test chỉ có ở `deps.ts:15` (`systemClock`), `test-clock.ts` và một comment ở `deps.ts:6`. OK.

## Mục 6: hồi quy
- `/api/health` vẫn trả `{ success: true, data: { status: "ok" } }` (`health.test.ts`, `test-app.test.ts:50-52`).
- Thứ tự middleware `errorMiddleware → bodyParser → router` không đổi. Diff `app.ts` chỉ đụng chữ ký và lời gọi `loadModules`.
- Loader vẫn quét `modules/*/routes.ts`, bỏ qua thư mục không có `routes.ts`, có test cũ giữ nguyên.
- `ok()`, `fail()`, `AppError`, `middleware.ts` không nằm trong diff.

## Mục 7: bí mật
Grep chuỗi kết nối có mật khẩu, JWT, `service_role`, khóa trong `apps/api`: chỉ có `health.test.ts:53`. Đó là chuỗi giả cố ý dùng cho test rò rỉ, không phải bí mật thật.

## Phạm vi
- File mới `shutdown.ts`/`shutdown.test.ts` nằm ngoài danh sách task, nhưng chấp nhận được. Đây là logic shutdown của `server.ts` (trong scope) tách ra để test được, và trực tiếp đóng finding (a).
- `deps.test.ts` mới là test cho `systemClock`. OK.
- `vitest.config.ts` và `password.test.ts` là ngoại lệ đã biết, có lý do.

## Responsive Checklist Gate
N/A: diff không đụng UI (chỉ `apps/api/` và một test của `packages/db`).

## Skill gates
- aislop: skip. Tôi không chạy, agent-guard chỉ cho lệnh đơn và tôi không xác minh được aislop đã cài.
- oxlint (anti-slop): skip, oxlint not configured (không có `.oxlintrc*`). ESLint của repo PASS.
- ocr (open-code-review): skip, ocr not installed hoặc không kiểm được.
- AI-readable: OK, 0 indicator. Tên rõ, hàm ngắn (`loadModules` khoảng 25 dòng, `createShutdown` khoảng 15 dòng). Magic number có lý do (503, độ sâu 3, timeout có comment). Comment giải thích lý do, không mô tả lại code.
- ai-friendly-web: N/A, API nội bộ.
- blitzstrike: skip, không có môi trường được phép.

## Findings
Không có CRITICAL hay MAJOR.

- [MINOR] `apps/api/src/shutdown.ts:3,20`: kiểu `close(callback: () => void)` bỏ qua tham số `err` của `server.close`. Nếu server chưa listen, vẫn đóng DB rồi `exit(0)`. Hiện vô hại vì `listen` gọi trước khi gắn handler, chỉ ghi lại.
- [NIT] `apps/api/src/server.ts:20`: `catch {}` không phân loại lỗi. Hiện đúng vì `resolveDatabaseUrl` chỉ ném một loại lỗi. Nếu sau này hàm đó ném thêm loại khác, thông điệp sẽ sai. Có thể chấp nhận.
- [NIT] `apps/api/src/http/deps.ts:2`: comment ghi `(router, deps) => void`, còn kiểu thật là `void | Promise<void>`. Lệch nhẹ trong tài liệu.

## Residual risk / không kiểm được
- Kết nối Supabase thật (`/api/health/db` trên postgres-js), `server.ts` chạy thật, SIGINT/SIGTERM thật. Builder hoặc dispatcher cần smoke tay (`pnpm dev` + curl).
- Hành vi `process.loadEnvFile` với biến rỗng trên Node đang dùng: chỉ suy luận, thông điệp đã bao trường hợp này.
- aislop/ocr/blitzstrike không chạy.

## Verdict
PASS. Mọi finding round 1 đã đóng. Typecheck, lint, test (270/270) và build đều PASS khi chạy thật. Diff đúng phạm vi. Chỉ còn 1 MINOR và 2 NIT, không chặn.
