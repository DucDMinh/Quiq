# Task 01: Workspace root, manifest mọi package, lệnh verify

## Layer
0

## Type
build

## Description
Dựng monorepo pnpm cho Quiq (Node 22): file gốc (workspace, tsconfig nền, eslint flat config, prettier, `.gitattributes` eol=lf, scripts), **manifest đầy đủ cho cả 2 app và 3 package** với danh sách dependency cuối cùng, tsconfig + vitest config + stub `src/index.ts` cho từng package, chạy `pnpm install` đúng một lần để sở hữu `pnpm-lock.yaml`. Task này cũng điền các lệnh verify vào `.context/project-config.md` và đồng bộ quyền verify cho reviewer.

Vì sao gom hết manifest ở đây: các task song song ở Layer 1/3/7 không được cùng sửa `package.json` hay `pnpm-lock.yaml` (xem `_layer-plan.md` mục A3).

## Dependencies
- (không có, đây là task đầu tiên)

## Acceptance Criteria
- [ ] `package.json` gốc có script: `typecheck` (`pnpm -r --if-present typecheck`), `lint` (`eslint .`), `test` (`pnpm -r --if-present test`), `build` (`pnpm -r --if-present build`), `e2e` (`playwright test -c e2e/playwright.config.ts`, L8-02 sẽ tạo cấu hình), `format`.
- [ ] `pnpm-workspace.yaml` khai `apps/*` và `packages/*`; có đúng 5 package: `@quiq/web` (apps/web), `@quiq/api` (apps/api), `@quiq/shared`, `@quiq/db`, `@quiq/engine`. Tất cả `"type": "module"`, `"private": true`, `engines.node >= 22`, `packageManager` ghi phiên bản pnpm đang dùng.
- [ ] Mỗi package có script `typecheck` (`tsc --noEmit`) và `test` (`vitest run`, dùng `--passWithNoTests` cho tới khi có test); `@quiq/web` thêm `dev`, `build`, `start`; `@quiq/api` thêm `dev` (tsx watch), `start`, `build` (= `tsc --noEmit`, ghi chú API chạy bằng tsx); `@quiq/db` thêm `generate`, `migrate`, `seed:superadmin` (trỏ tới file sẽ do L1-04 tạo, chưa cần tồn tại).
- [ ] Workspace package dùng nội bộ bằng `workspace:*`: `@quiq/api` phụ thuộc `@quiq/shared`, `@quiq/db`, `@quiq/engine`; `@quiq/web` phụ thuộc `@quiq/shared`; `@quiq/db` không phụ thuộc package nội bộ; `@quiq/engine` không phụ thuộc package nội bộ. `exports` của `@quiq/shared`: `"."` -> `./src/common/index.ts` và `"./*"` -> `./src/*/index.ts`; `@quiq/db`: `"."` -> `./src/index.ts`, `"./testing"` -> `./src/testing.ts`, `"./password"` -> `./src/password.ts`, `"./schema"` -> `./src/schema/index.ts`; `@quiq/engine`: `"."` -> `./src/index.ts` (package consume mã nguồn TS trực tiếp, không build).
- [ ] Dependency đã khai đủ cho các task sau (không task nào phải `pnpm add`): 
  - api: `koa`, `@koa/router`, `@koa/bodyparser`, `busboy`, `zod`, `drizzle-orm`, `exceljs`, `tsx` (dev), `supertest` (dev), `@types/koa`, `@types/koa__router`, `@types/busboy`, `@types/supertest`;
  - web: `next`, `react`, `react-dom`, `tailwindcss` (3.4), `postcss`, `autoprefixer`, `tailwindcss-animate`, `@radix-ui/react-dialog|tabs|select|tooltip|toast|switch|checkbox|label|slot|dropdown-menu|popover`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@tabler/icons-react`, `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`, `zod`, `date-fns`, và dev: `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@vitejs/plugin-react`;
  - shared: `zod`; db: `drizzle-orm`, `postgres`, `@electric-sql/pglite`, `drizzle-kit` (dev), `tsx` (dev); engine: không có dependency runtime;
  - gốc (devDependencies): `typescript`, `vitest`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `@next/eslint-plugin-next`, `prettier`, `@playwright/test`, `@types/node`.
- [ ] Mỗi package có `tsconfig.json` (extends `tsconfig.base.json`, `strict` bật, `moduleResolution: Bundler`, `include: ["src"]`), `vitest.config.ts` (api/db/engine/shared môi trường node; web dùng jsdom + `@vitejs/plugin-react`) và stub (`export {}`: `src/index.ts`, riêng shared là `src/common/index.ts`) để `tsc` không báo TS18003. Các task Layer 1 sẽ thay stub của package mình.
- [ ] `eslint.config.mjs` (flat config) áp cho toàn repo: `typescript-eslint` recommended, react-hooks, next plugin chỉ cho `apps/web`; ignore `node_modules`, `.next`, `dist`, `.worktrees`, `packages/db/drizzle`, `index.html`, `tools`. Có quy tắc `max-lines` 300/file và `max-lines-per-function` 50 (theo `ui:` trong project-config; mức `warn` cho test).
- [ ] `.gitattributes` (`* text=auto eol=lf`), `.nvmrc` (22), `.prettierrc.json`, `.prettierignore`, `.env.example` (chỉ tên biến: `DATABASE_URL_STAGING`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `API_PORT`, `STORAGE_BUCKET`; không có giá trị bí mật).
- [ ] `vitest.shared.ts` ở gốc chứa cấu hình dùng chung (alias, `testTimeout`); các `vitest.config.ts` của package import nó.
- [ ] `pnpm install` chạy thành công; `pnpm-lock.yaml` được sinh; sau đó `pnpm install --frozen-lockfile` cũng PASS.
- [ ] Sau khi điền, các lệnh sau PASS: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` (đều "xanh" trên repo gần như trống).
- [ ] `.context/project-config.md` được điền: `install_command: pnpm install`, `typecheck_command: pnpm typecheck`, `lint_command: pnpm lint`, `test_command: pnpm test`, `build_command: pnpm build`, `web_typecheck_command: pnpm --filter @quiq/web typecheck`, `api_typecheck_command: pnpm --filter @quiq/api typecheck`, `web_lint_command` và `api_lint_command` (eslint theo thư mục), `migration_command: pnpm --filter @quiq/db migrate`, và khối `check_commands:` tương ứng; `source_roots` giữ `[apps, packages]`. Không dùng ký tự `;&|` $()<>*` trong các giá trị lệnh (script `apply-verify-permissions` sẽ bỏ qua lệnh có metacharacter).
- [ ] Chạy `node scripts/apply-verify-permissions.mjs` (dry-run) rồi `node scripts/apply-verify-permissions.mjs --write`; xác nhận `.claude/agent-policy.json` có các lệnh trên; ghi lại cảnh báo nếu lệnh nào bị bỏ qua.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass (task này chỉ cần các lệnh verify xanh)
- [ ] Check commands pass (theo `.context/project-config.md`, vừa được điền ở task này)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `tsconfig.base.json`
- `eslint.config.mjs`
- `.prettierrc.json`
- `.prettierignore`
- `.gitattributes`
- `.nvmrc`
- `.env.example`
- `vitest.shared.ts`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/vitest.config.ts`
- `apps/api/src/index.ts`
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/vitest.config.ts`
- `apps/web/src/index.ts`
- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/vitest.config.ts`
- `packages/shared/src/common/index.ts`
- `packages/db/package.json`
- `packages/db/tsconfig.json`
- `packages/db/vitest.config.ts`
- `packages/db/src/index.ts`
- `packages/engine/package.json`
- `packages/engine/tsconfig.json`
- `packages/engine/vitest.config.ts`
- `packages/engine/src/index.ts`
- `.context/project-config.md`
- `.claude/agent-policy.json`

## Notes
- **Risk:** vàng (hạ tầng dùng chung; không có logic nghiệp vụ). Không có migration, không `HIGH_RISK_MIGRATION`.
- `tools/` hiện **untracked** (xem `_layer-plan.md` mục 5 tiền đề 1): task này không tự commit nó; loop/dispatcher phải đảm bảo `tools/progress-write.mjs` có mặt trước khi ghi progress.
- Task L1 sẽ thay stub của package mình (stub của shared nằm ở `src/common/index.ts` vì `exports` trỏ vào đó). Không tạo file nào ngoài danh sách trên.
- `apps/web/tsconfig.json` ban đầu chỉ cần chạy được `tsc --noEmit` trên stub; L1-02 sẽ mở rộng cho Next (jsx, plugin) vì L1-02 sở hữu app đó.
- Chạy `pnpm` có thể cần `corepack enable`. Nếu không có mạng hoặc không có pnpm: ghi `Blocked`, KHÔNG tự sinh lockfile bằng tay.
- Windows: `.gitattributes` eol=lf để tránh CRLF làm lệch hash migration và diff.
- Sau khi xong layer 0, mọi package có thể dùng `pnpm --filter <tên> <script>`; các task sau chỉ thêm file trong package của mình.
