# Task 04: Điểm nối API: createApp nhận deps (db, clock), module nhận deps, server tạo kết nối thật

## Layer
1 (bổ sung sau checkpoint Layer 1, chạy một mình trước Layer 2)

## Type
build (initial)

## Description
Phát hiện sau khi Layer 1 gộp: module API hiện chỉ nhận `router` (`(router) => void`), `createApp()` không nhận dependency nào, nên không module nào truy cập được database hay đồng hồ, và test không tiêm được PGlite. Hai task Layer 2 chạy song song đều cần điểm nối này; để tránh hai task cùng sửa `app.ts`/`loader.ts`/`server.ts`, làm riêng một lần ở đây.

Nội dung:
- `apps/api/src/http/deps.ts`: `Clock { now(): Date }`, `systemClock`, `AppDeps { db: DatabaseLike; clock: Clock }` (`DatabaseLike` từ `@quiq/db`, dùng chung cho postgres-js và PGlite).
- `loader.ts`: `RegisterRoutes = (router, deps: AppDeps) => void`; `loadModules(router, deps, modulesDir?)`. Module cũ (`health`) không nhận `deps` vẫn chạy được.
- `app.ts`: `createApp({ deps, modulesDir? })`; `deps` bắt buộc ngoại trừ khi test loader với `modulesDir` tạm thì cho phép truyền deps giả.
- `server.ts`: tạo `DbHandle` bằng `createDb()`, `systemClock`, truyền vào `createApp`; khi tắt (SIGINT/SIGTERM) đóng server rồi `close()` pool DB. Thiếu chuỗi kết nối thì dừng ngay với thông điệp rõ (lấy từ `resolveDatabaseUrl()`), không in chuỗi kết nối.
- `apps/api/src/testing/test-app.ts`: `createTestApp()` dựng PGlite áp dụng migration thật (`createTestDb` từ `@quiq/db/testing`) + đồng hồ giả, trả `{ app, db, clock, close }` để mọi task sau dùng cho test tích hợp qua HTTP (supertest). `apps/api/src/testing/test-clock.ts`: đồng hồ giả có `set(date)` và `advance(ms)`.
- `GET /api/health/db`: chạy `select 1` qua `deps.db`; thành công `{ status: "ok", db: "up" }`; lỗi trả 503 envelope thông điệp chung "Không kết nối được cơ sở dữ liệu." (KHÔNG lộ chi tiết lỗi/chuỗi kết nối). Dùng để người dùng tự kiểm kết nối Supabase từ trình duyệt.

## Dependencies
- layer-0-task-01 (khung API, loader, health)
- layer-1-task-01 (`@quiq/db`: `createDb`, `DatabaseLike`, `createTestDb`)

## Acceptance Criteria
- [ ] `createApp({ deps })` truyền đúng `deps` vào mọi `routes.ts`; test chứng minh một module giả trong thư mục tạm nhận được `deps.db` và `deps.clock`.
- [ ] Module chỉ khai `(router)` (không dùng deps) vẫn chạy; `health` cũ vẫn trả `{ success: true, data: { status: "ok" } }`.
- [ ] `createTestApp()` trả app chạy trên PGlite đã migrate; hai lần gọi cho hai DB độc lập; `close()` giải phóng; đồng hồ giả `advance` đổi `deps.clock.now()`.
- [ ] `GET /api/health/db` trả ok khi DB sống; khi DB lỗi (đóng PGlite hoặc db giả ném lỗi) trả 503 với thông điệp chung, và body/log không chứa chuỗi kết nối hay mật khẩu (test kiểm).
- [ ] `server.ts` đọc `.env.local` như cũ, tạo DB thật, đóng pool khi tắt; thiếu `DATABASE_URL_STAGING`/`DATABASE_URL` thì thoát mã khác 0 với thông điệp dẫn tới `docs/SUPABASE_SETUP.md` và không in giá trị biến nào.
- [ ] Không đổi hợp đồng đã có: `ok()/fail()`, `AppError`, `errorMiddleware`, thứ tự middleware.
- [ ] Tài liệu ngắn trong comment đầu `deps.ts`: quy ước dùng `deps.clock.now()` thay `new Date()`/`Date.now()` trong code nghiệp vụ.
- [ ] `pnpm typecheck`, `lint`, `test`, `build` đều qua; smoke tay của dispatcher: `pnpm dev` + `curl /api/health/db` với `.env.local` thật.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/api/src/http/deps.ts`, `apps/api/src/http/deps.test.ts`
- `apps/api/src/modules/loader.ts`, `apps/api/src/modules/loader.test.ts` (sửa)
- `apps/api/src/app.ts`, `apps/api/src/server.ts` (sửa)
- `apps/api/src/modules/health/routes.ts`, `apps/api/src/modules/health/health.test.ts` (sửa)
- `apps/api/src/testing/test-app.ts`, `apps/api/src/testing/test-clock.ts`, `apps/api/src/testing/test-app.test.ts`

## Notes
- Đọc trước: `apps/api/src/app.ts`, `server.ts`, `modules/loader.ts`, `packages/db/src/client.ts` (`DatabaseLike`, `DbHandle`), `packages/db/src/testing.ts`.
- Tiêm đồng hồ là điều kiện để test hết giờ, đẩy máy, gián đoạn ở các layer sau; mọi layer sau dùng `deps.clock`.
- Giữ nhỏ: không thêm tầng dịch vụ, không DI container; chỉ một object `deps` truyền xuống.
- Task này không đụng schema/migration; không `HIGH_RISK_MIGRATION`.
- Risk: trung bình (khung API). Reviewer NORMAL, chú ý rò rỉ thông tin lỗi DB và đóng pool đúng.
