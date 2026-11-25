# Task 01: API skeleton (Koa app, module loader, response/lỗi, SSE hub, rate-limit)

## Layer
1

## Type
build

## Description
Dựng khung `apps/api`: Koa app, helper phản hồi `ok()/fail()`, lớp lỗi `AppError`, middleware lỗi tập trung, **module loader tự quét `apps/api/src/modules/*/routes.ts`** (để task sau không phải sửa file đăng ký chung), **registrar route có metadata** (roles, scope, params kèm entity) phục vụ quét cô lập ở L8-01, `Clock` tiêm được, endpoint `/api/health`, **SSE hub in-process** và tiện ích **rate-limit** dùng lại cho đăng nhập, vào thi, tra cứu.

Task này KHÔNG phụ thuộc `@quiq/shared` hay `@quiq/db` (cùng layer): kiểu lỗi và envelope khai cục bộ theo cấu trúc tương thích; L2-01 sẽ nối DB và danh mục lỗi.

## Dependencies
- layer-0-task-01 (workspace, manifest `@quiq/api` với koa/@koa/router/@koa/bodyparser/busboy/tsx/supertest)

## Acceptance Criteria
- [ ] `createApp(deps)` trả về Koa app; `server.ts` đọc cấu hình (`API_PORT` mặc định 4000), tự nạp `.env.local` ở gốc repo nếu có (`process.loadEnvFile`), lắng nghe, tắt êm khi nhận SIGINT/SIGTERM (đóng SSE trước).
- [ ] `ok(ctx, data, status=200)` trả `{ success: true, data }`; `fail(ctx, status, code, message, details?)` trả `{ success: false, error: { code, message }, details? }`. `AppError({ status, code, message, details? })` ném được từ handler; middleware lỗi chuyển `AppError` thành `fail`, lỗi lạ thành 500 với thông báo tiếng Việt chung ("Đã xảy ra lỗi hệ thống, vui lòng thử lại"), **không lộ stack** ra client, có log phía máy chủ.
- [ ] Body parser JSON giới hạn 1 MB; JSON hỏng trả 400 mã `INVALID_JSON` với thông báo tiếng Việt; route không tồn tại trả 404 qua `fail` (mã `NOT_FOUND`).
- [ ] `Clock` (`now(): Date`, `nowMs()`) là phần của `AppDeps`; có `systemClock` và `createFakeClock(start)` có `advance(ms)` dùng cho test sweeper/heartbeat.
- [ ] `defineModule({ name, register(r, deps) })` và registrar `r.get|post|put|patch|delete(path, meta, ...handlers)`. `meta` bắt buộc: `{ roles: Role[] | 'public' | 'student', scope: 'platform' | 'school' | 'student' | 'public', params: Record<string, Entity>, summary: string }` (Role = `super_admin|school_admin|teacher`; Entity thuộc `school, account, subject, teacher, year, class, student, assignment, question, media, exam, examClass, attempt`). Thiếu metadata hoặc khai param không có trong path => lỗi lúc khởi động (throw), có test.
- [ ] Registrar nhận `deps.guardFactory?: (meta) => Middleware[]` và **tự chèn các middleware đó trước handler** của mọi route (L2-01 cung cấp bản cài đặt xác thực/phân quyền theo `meta`; ở L1 mặc định không có guard). Nhờ đó không route nào có thể "quên" guard và L8-01 quét được theo metadata. Có test với guardFactory giả.
- [ ] `loadModules(app, deps)` quét `modules/*/routes.ts` (default export là `defineModule`), đăng ký route, trùng (method + path) => throw. `listRoutes(app)` trả về mảng `{ method, path, meta, module }` (xuất ra để L8-01 dùng).
- [ ] `/api/health` (module `health`) trả `{ status: 'ok', time }` không cần đăng nhập; metadata đầy đủ.
- [ ] `createSseHub({ clock, keepAliveMs })`: `subscribe(channel, ctx)` đặt header `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`, tắt nén, gửi dòng comment keep-alive định kỳ (mặc định 15 giây), tự gỡ subscriber khi socket đóng; `publish(channel, event)` gửi `event:`/`data:` JSON tới mọi subscriber của channel; `closeAll()`; đếm `subscriberCount(channel)`. Có test với stream giả (nhiều subscriber, chỉ đúng channel nhận, gỡ khi đóng, không rò bộ nhớ).
- [ ] `createRateLimiter({ windowMs, max, clock })` cửa sổ trượt in-memory: `consume(key)` trả `{ allowed, remaining, retryAfterSec }`; có `rateLimitMiddleware({ limiter, keyFn, code, message })` trả 429 mã `RATE_LIMITED` kèm `Retry-After`. Test: vượt ngưỡng, hết cửa sổ (đồng hồ giả), key độc lập, dọn key cũ.
- [ ] `apps/api/src/testing/app.ts` xuất `createTestApp(overrides?)` (clock giả, hub thật, không DB) và `request(app)` bọc supertest; L2-01 sẽ mở rộng file này, các task sau chỉ import.
- [ ] Test PASS: response/lỗi, loader (thiếu metadata, trùng route), health, SSE hub, rate-limit.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/api/src/index.ts` (thay stub)
- `apps/api/src/app.ts`
- `apps/api/src/server.ts`
- `apps/api/src/config.ts`
- `apps/api/src/core/response.ts`
- `apps/api/src/core/errors.ts`
- `apps/api/src/core/clock.ts`
- `apps/api/src/core/deps.ts`
- `apps/api/src/core/module.ts`
- `apps/api/src/core/loader.ts`
- `apps/api/src/core/error-middleware.ts`
- `apps/api/src/core/sse-hub.ts`
- `apps/api/src/core/rate-limit.ts`
- `apps/api/src/modules/health/routes.ts`
- `apps/api/src/testing/app.ts`
- `apps/api/src/core/response.test.ts`
- `apps/api/src/core/loader.test.ts`
- `apps/api/src/core/sse-hub.test.ts`
- `apps/api/src/core/rate-limit.test.ts`
- `apps/api/src/modules/health/health.test.ts`

## Notes
- **Risk:** vàng (nền tảng mọi route; sai ở đây lan xuống tất cả). Không có migration.
- Cơ chế loader dùng `import()` động trên đường dẫn quét được; phải chạy được cả dưới `tsx` và dưới Vitest (dùng `import.meta.glob` không có ở Node; dùng `fs.readdir` + `pathToFileURL`).
- `AppDeps` ở task này chỉ có `clock`, `config`, `logger`, `sse`, `rateLimit`, `guardFactory?`. **L2-01** thêm `db`, `storage` và sửa `core/deps.ts` + `testing/app.ts`. L5-01 thêm sweeper vào `server.ts`.
- SSE: phải kiểm tra thủ công/ghi chú rằng Koa không tự đóng response (đặt `ctx.respond = false` hoặc dùng stream không kết thúc) và không để middleware nén chạm vào. Spike proxy qua Next ở L1-02.
- Rate-limit là in-memory, một tiến trình (khớp thiết kế Scalability: off). Ghi chú giới hạn này trong comment đầu file.
- Mã lỗi chung để dành cho `@quiq/shared`: `INVALID_JSON`, `NOT_FOUND`, `RATE_LIMITED`, `INTERNAL_ERROR`; L1-03 đặt cùng mã để L2-01 chỉ cần nối.
