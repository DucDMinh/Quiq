# Task 01: Khung monorepo chạy được (`pnpm dev`), cài sẵn mọi dependency của demo, điền lệnh verify

## Layer
0

## Type
build (initial)

## Description
Dựng monorepo pnpm sao cho bạn chạy `pnpm install` rồi `pnpm dev` là mở được `http://localhost:3000` (web) và `http://localhost:4000/api/health` (API). Task này **sở hữu mọi file manifest và `pnpm-lock.yaml`** của demo: cài trước toàn bộ dependency mà Layer 1 đến 3 cần, để các task chạy song song sau này không ai phải sửa `package.json` hay lockfile.

Nội dung:
- Workspace: `apps/web` (Next.js App Router), `apps/api` (Koa), `packages/shared`, `packages/db`, `packages/engine`. Tên gói `@quiq/web`, `@quiq/api`, `@quiq/shared`, `@quiq/db`, `@quiq/engine`.
- API tối thiểu: Koa app, helper `ok()/fail()`, `AppError`, middleware lỗi (trả envelope), **module loader tự quét `apps/api/src/modules/*/routes.ts`** (để task sau chỉ thêm thư mục, không sửa file đăng ký chung), route `GET /api/health`.
- Web tối thiểu: trang chủ `/` hiển thị "Quiq" + trạng thái gọi `/api/health` (qua Next rewrite `/api/*` → `http://localhost:4000`).
- `packages/shared`: `exports` dạng subpath `./*` → `./src/*/index.ts`; có sẵn `envelope` (kiểu `{success,data}|{success:false,error,details}`) và danh mục lỗi tiếng Việt khởi đầu (`common`).
- Lệnh verify điền vào `.context/project-config.md` rồi chạy `node scripts/apply-verify-permissions.mjs` (dry-run) và `--write`.

## Dependencies
- (không có; đây là task đầu tiên)

## Acceptance Criteria
- [ ] `pnpm install` thành công từ repo sạch; sinh `pnpm-lock.yaml`; Node 22.
- [ ] `pnpm dev` chạy đồng thời web (3000) và api (4000); `GET /api/health` trả `{ "success": true, "data": { "status": "ok" } }`; trang `/` hiển thị trạng thái "API sống" lấy qua rewrite.
- [ ] Module loader nạp được module mẫu `health` từ `apps/api/src/modules/health/routes.ts`; có test chứng minh thêm một thư mục module giả vào `modules/` thì route xuất hiện mà không sửa file khác.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` đều chạy được ở gốc (test có ít nhất health + loader + envelope).
- [ ] Mọi manifest đã khai sẵn dependency cho cả demo: api (`koa`, `@koa/router` hoặc tương đương, `koa-bodyparser`, `zod`, `drizzle-orm`, `postgres`, `tsx`, `vitest`), db (`drizzle-orm`, `drizzle-kit`, `postgres`, `@electric-sql/pglite`, `tsx`), engine (không dependency chạy), shared (`zod`), web (`next`, `react`, `tailwindcss`, các gói Radix cần, `class-variance-authority`, `clsx`, `tailwind-merge`, `@tabler/icons-react`, `react-hook-form`, `@hookform/resolvers`, `zod`). Task sau KHÔNG cần `pnpm add` (nếu bắt buộc thì khai `package.json` + `pnpm-lock.yaml` trong Files của task đó).
- [ ] `.context/project-config.md` đã điền: `install_command`, `lint_command`, `typecheck_command`, `test_command`, `build_command`, `migration_command` (`pnpm --filter @quiq/db db:migrate`), `source_roots: [apps, packages]` (đã có), và khối `check_commands`; `apply-verify-permissions.mjs --write` chạy xong, `.claude/agent-policy.json` có `verifyCommands`.
- [ ] `.gitattributes` có `* text=auto eol=lf`; `.gitignore` bổ sung `.next/`, `.turbo/`, `*.tsbuildinfo`, `coverage/`, `.pglite/`.
- [ ] `docs/RUN_LOCAL.md` (ngắn): yêu cầu Node 22 + pnpm (corepack), các lệnh `pnpm install`, `pnpm dev`, nơi đặt `.env.local` (từ `.env.local.example`).

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`; riêng task này là task điền lệnh nên tự chạy các lệnh vừa khai)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `.prettierrc`, `eslint.config.mjs`, `vitest.workspace.ts`, `.gitattributes`, `.gitignore` (bổ sung), `docs/RUN_LOCAL.md`
- `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/src/server.ts`, `apps/api/src/app.ts`, `apps/api/src/config.ts`, `apps/api/src/http/response.ts`, `apps/api/src/http/errors.ts`, `apps/api/src/http/middleware.ts`, `apps/api/src/modules/loader.ts`, `apps/api/src/modules/loader.test.ts`, `apps/api/src/modules/health/routes.ts`, `apps/api/src/modules/health/health.test.ts`
- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/globals.css`
- `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/common/index.ts`, `packages/shared/src/common/envelope.ts`, `packages/shared/src/common/errors.ts`, `packages/shared/src/common/envelope.test.ts`
- `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/src/index.ts` (stub)
- `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/index.ts` (stub)
- `.context/project-config.md` (chỉ các trường lệnh verify), `.claude/agent-policy.json` (do script sinh)

## Notes
- Đọc trước: `docs/specs/2026-11-25-quiq-design.md` (Architecture), `.context/project-config.md`, `.env.local.example`.
- `tools/` (có `agent-live.mjs`, `progress-write.mjs`) và `.context/design-spec.md`, `skills/react-nodejs/design-tokens.md`, `index.html` hiện **chưa nằm trong git**; worktree tạo từ HEAD sẽ không thấy. Người dùng cần commit chúng trước khi loop chạy (xem `_layer-plan.md` mục Tiền đề). Task này không tự commit chúng.
- Chỉ `apps/web` có Tailwind/PostCSS; phiên bản Tailwind và cách map theme là việc của L1-03. Ở đây chỉ cài và để `globals.css` tối thiểu để build qua.
- Cổng cố định: web 3000, api 4000; đọc từ env `PORT`/`API_PORT` với mặc định này.
- Không cần DB ở task này (`/api/health` không chạm DB).
- Nếu `pnpm` chưa có trên máy: ghi hướng dẫn `corepack enable` trong `docs/RUN_LOCAL.md`, không cài toàn cục thay người dùng.
- Risk: thấp.
