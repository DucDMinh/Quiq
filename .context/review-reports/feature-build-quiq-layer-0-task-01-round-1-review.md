Agent: reviewer

# Review: build-quiq, Layer 0, Task 01 (khung monorepo pnpm), round 1

- Review level: STRICT
- Reason: task không đụng auth, DB, quyền hay schema. Nhưng nó tạo các hợp đồng dùng chung mà mọi màn và mọi endpoint sẽ dùng: envelope response, `AppError`/middleware lỗi, module loader, exports của `@quiq/shared`, rewrite `/api/*`. Task cũng sở hữu toàn bộ manifest và `pnpm-lock.yaml` (supply-chain). Theo rule reviewer, API response shape dùng nhiều client và shared service/API client buộc phải review STRICT.
- Blast radius: mọi task Layer 1 đến 3. Cụ thể:
  - `apps/api/src/modules/loader.ts`: cách mọi module đăng ký route.
  - `apps/api/src/http/{response,errors,middleware}.ts`: hình dạng response và lỗi của mọi endpoint.
  - `packages/shared/src/common/*`: kiểu envelope mà web và api cùng dùng.
  - `apps/web/next.config.ts`: rewrite `/api/*`.
  - Toàn bộ `package.json` và `pnpm-lock.yaml`.
  - `.context/project-config.md` và `.claude/agent-policy.json`: allowlist lệnh verify của reviewer.

## Verify commands + result

| Lệnh | Kết quả |
|---|---|
| `pnpm install --frozen-lockfile` | **Blocked**: agent-guard báo lệnh không nằm trong allowlist. Không lách. |
| `pnpm install` | **Blocked**: auto-mode classifier từ chối. Không lách. Dùng `node_modules` có sẵn trên đĩa. |
| `pnpm typecheck` | PASS. 5/6 project: db, engine, shared, api, web (`next typegen && tsc --noEmit`) đều Done. |
| `pnpm lint` | PASS. `eslint apps packages` không có output, tức 0 lỗi và 0 cảnh báo. |
| `pnpm test` | PASS. Vitest 5.1.2, 4 file test, 16/16 test pass, mất 1.06s. |
| `pnpm build` | PASS. Next.js 16.4.6 (Turbopack) compile thành công, prerender tĩnh `/` và `/_not-found`. api/db/shared/engine không có script build (`--if-present`). |
| `pnpm dev` + `curl http://localhost:4000/api/health` | **Không kiểm được.** `pnpm dev`/`curl` không nằm trong allowlist verify của reviewer, và luật cấm reviewer chạy app. Hành vi route được chứng minh gián tiếp qua `health.test.ts` (supertest trên `createApp()` thật). Rewrite được kiểm bằng cách đọc `next.config.ts`. |
| `git status --short --ignored .env.local node_modules apps/web/.next` | `!! .env.local`, `!! apps/web/.next/`, `!! node_modules/`: cả ba đều bị ignore. `git check-ignore` bị guard chặn vì không thuộc nhóm git read-only được phép, nên dùng `git status --ignored` thay. Không đọc nội dung `.env.local`. |
| Thay thế một phần cho frozen-lockfile: Grep `importers` trong `pnpm-lock.yaml` | Đủ 6 importer: `.`, `apps/api`, `apps/web`, `packages/db`, `packages/engine`, `packages/shared`. Đây chỉ là bằng chứng một phần; vẫn còn residual risk về install sạch. |

## Đối chiếu Acceptance Criteria

| AC | Kết quả | Bằng chứng |
|---|---|---|
| `pnpm install` từ repo sạch, có lockfile, Node 22 | OK một phần (residual) | Có `pnpm-lock.yaml` (lockfileVersion 9.0) với đủ 6 importer. `engines.node >=22`, `packageManager pnpm@10.28.0`. Các bản resolve khớp manifest: next 16.4.6, vitest 5.1.2, vite 8.3.8, eslint 10.15.0, jsdom 31.0.1, typescript 6.0.3, koa 3.3.0, drizzle-kit 0.31.11. Reviewer không chạy được install sạch hay frozen. |
| `pnpm dev` chạy web 3000 + api 4000; health trả envelope; `/` hiện "API sống" qua rewrite | OK theo code, chưa chạy thật | Root `dev` = `pnpm --parallel --filter @quiq/api --filter @quiq/web dev`. API chạy `tsx watch src/server.ts` với `API_PORT` mặc định 4000 (`config.ts:5`). `health/routes.ts:5` gọi `ok(ctx,{status:"ok"})`; `health.test.ts:13` khẳng định body bằng đúng `{success:true,data:{status:"ok"}}`. Phía web: `page.tsx:19` gọi `fetch("/api/health")` same-origin, `next.config.ts:12` rewrite `/api/:path*` sang `${apiOrigin}/api/:path*`, nhãn `alive: "API sống"`. |
| Loader nạp `health`; có test chứng minh thêm thư mục module giả thì route xuất hiện | OK | `loader.ts` quét thật: `readdir`, lọc thư mục, `import(pathToFileURL(routes.ts))`, kiểm `default` là hàm. `loader.test.ts:33-45` dùng thư mục tạm thật (`mkdtemp`, không mock): trước khi tạo module, `/api/ghost/ping` trả 404; sau khi `mkdir ghost` và ghi `routes.ts` thật thì trả 200 kèm `{reply:"boo"}`. Có thêm case bỏ qua file lẻ hoặc thư mục rỗng, và case báo lỗi rõ tên module. |
| typecheck/lint/test/build chạy ở gốc; test có health + loader + envelope | OK | Xem bảng verify. Có `health.test.ts`, `loader.test.ts`, `envelope.test.ts`, thêm `middleware.test.ts`. `tsconfig.base.json` bật `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`. |
| Manifest khai sẵn dependency cho cả demo | OK | **api**: koa, @koa/router, koa-bodyparser, zod, drizzle-orm, postgres, tsx, vitest (dev). **db**: drizzle-orm, drizzle-kit (dev), postgres, @electric-sql/pglite, tsx. **engine**: không có dependency chạy. **shared**: zod. **web**: next, react, react-dom, tailwindcss (+@tailwindcss/postcss, postcss), 13 gói Radix, cva, clsx, tailwind-merge, @tabler/icons-react, react-hook-form, @hookform/resolvers, zod. Ngoài ra cài sẵn bộ test web (testing-library, jsdom, @vitejs/plugin-react, vite) cho L1-03. |
| project-config điền lệnh + `check_commands`; agent-policy có `verifyCommands` | OK | `git diff` cho thấy đã điền install/lint/typecheck/test/build/migration, web và api typecheck/lint, và khối `check_commands`. `.claude/agent-policy.json` có 7 `verifyCommands`. Guard thực sự cho phép `pnpm typecheck/lint/test/build`, chứng tỏ script đã chạy `--write`. |
| `.gitattributes` / `.gitignore` | OK | `.gitattributes:1` là `* text=auto eol=lf`. `.gitignore` thêm `.next/`, `.turbo/`, `*.tsbuildinfo`, `coverage/`, `.pglite/` và cả `next-env.d.ts`. |
| `docs/RUN_LOCAL.md` | OK | Ghi đủ Node 22+, pnpm 10 qua `corepack enable`, `pnpm install`, `pnpm dev`, vị trí `.env.local` (copy từ `.env.local.example` ở gốc), cổng và `API_ORIGIN`. |

## Đánh giá các điểm lệch builder tự khai

| # | Lệch | Đánh giá |
|---|---|---|
| a | `vitest.config.ts` gốc dùng `test.projects` thay `vitest.workspace.ts` | **Chấp nhận.** Cùng mục đích; `pnpm test` gốc chạy được cả 4 file test. Không còn `vitest.workspace.ts` thừa. |
| b | Thêm `apps/api/src/http/middleware.test.ts` | **Chấp nhận.** Test trực tiếp envelope lỗi mà task sở hữu, truy được về AC. |
| c | Envelope lỗi thêm `code` | **Chấp nhận**, nhưng đây là đổi hợp đồng so với AC (`{success:false,error,details}`) và `docs/API_SPEC.md`. Cần reconcile ở close-out hoặc Layer cuối (xem Doc impact). |
| d | `agentRules: false` + xóa `apps/web/AGENTS.md` tự sinh | **Chấp nhận.** Tránh có hai AGENTS.md mâu thuẫn với router gốc. Glob xác nhận không còn `apps/web/*.md`. Typecheck và build pass nên option hợp lệ với Next 16.4.6. |
| e | TypeScript pin `6.0.3` | **Chấp nhận.** Pin chính xác và đồng nhất ở 6 manifest, có lý do tương thích typescript-eslint. |
| f | Root `"type":"module"` | **Chấp nhận.** Root chỉ có `eslint.config.mjs` và `vitest.config.ts`; lint và test chạy được. |
| g | "Tắt build script esbuild" | **Chấp nhận, nhưng mô tả chưa chính xác.** Không có cấu hình nào (`pnpm-workspace.yaml` chỉ có `packages`, không có `.npmrc` hay trường `pnpm`). Đây là mặc định của pnpm 10, vốn an toàn hơn về supply-chain. Build và test vẫn chạy. |
| h | Không khai `@tanstack/react-table`, `date-fns` | **Chấp nhận.** Hai gói này không có trong danh sách AC. `.context/design-spec.md:14` có nhắc tới, nhưng không task nào trong `tasks/build-quiq/` tham chiếu. Task nào cần thì phải khai `package.json` + `pnpm-lock.yaml` trong Files của task đó. |
| i | `.context/runs/start-quiq-layer-0-task-01.builder.md` | **Chấp nhận như ghi chú runtime.** Tuy vậy AGENTS.md §Session Handoff quy định subagent không ghi journal. Primary nên gộp nội dung vào journal chính và không commit file này. |

Ngoài các điểm trên, không có file nào nằm ngoài mục Files. `.context/progress.json` (`inProgressTask`) và `.context/runs/start-quiq-layer-0-task-01.md` là trạng thái workflow.

## Bảo mật / rò rỉ

- **Bí mật trong file mới: không có.** Đã grep `sb_secret_|sb_publishable_|mcdxiwmtjfwmxjhxjnrk|postgres(ql)?://|password[:=]|eyJhbGci|service_role` trên toàn bộ file mới. Các dòng trùng:
  - `.context/project-config.md`: `postgres://localhost:5432/$SCHEMA` và tên biến `SUPABASE_SERVICE_ROLE_KEY`. Cả hai có từ trước và không chứa giá trị thật.
  - `apps/web/.next/**`: mã framework khớp chữ "password". Grep riêng mẫu khóa/host/URL trong `.next` ra **No matches**.
- **`.env.local`:** bị ignore (`!!`). Không đọc nội dung.
- **Nạp env:** `server.ts:7-10` gọi `process.loadEnvFile` chỉ để nạp, không in giá trị. Log duy nhất là URL health kèm cổng (`server.ts:18`).
- **Lỗi 500:** `middleware.ts:24,35-36` gửi về client câu chung `COMMON_ERRORS.INTERNAL`. Lỗi gốc chỉ đi qua `app.emit("error")` để log phía server. `middleware.test.ts:70-78` khẳng định body không lộ chuỗi bí mật.
- **Bề mặt API:** chỉ có `GET /api/health`, không nhận input. `bodyParser()` dùng giới hạn mặc định; 413 được map sang envelope.

## Supply-chain

- Lockfile v9, các bản resolve khớp manifest. Không có gói lạ hay typosquat trong direct deps.
- `vite` khai riêng cạnh `vitest`: trùng nhẹ, chấp nhận được (L1-03 cần `@vitejs/plugin-react`).
- `koa-bodyparser@4` là gói cũ (bản mới là `@koa/bodyparser`). AC cho phép (nit).
- Không tra được ngày phát hành của next 16.4.6, vitest 5.1.2, vite 8.3.8, eslint 10.15.0, jsdom 31.0.1, vì `pnpm view`/`pnpm audit` không nằm trong allowlist. Đây là residual risk, không đoán.
- `pnpm audit` theo báo cáo builder: 1 moderate (esbuild cũ qua `drizzle-kit > @esbuild-kit`; lockfile có `esbuild@0.18.20`). Gói này dev-only, chỉ nằm trong CLI migration, không vào runtime. Chấp nhận, theo dõi khi drizzle-kit nâng cấp. Reviewer không tự chạy audit được.

## Chất lượng test

- **health:** khẳng định cả body lẫn status, qua `createApp()` thật.
- **loader:** dùng FS thật và import động thật, có case âm (404 trước) và dương (200 sau), không mock. Chứng minh đúng AC.
- **envelope:** kiểm cả parse thành công lẫn từ chối, và danh mục mã/status.
- **middleware:** kiểm status, code, details, và 500 không lộ chi tiết.

## Responsive Checklist Gate

Diff đụng UI ở mức tối thiểu: `page.tsx`, `layout.tsx` và `globals.css` (`globals.css` chỉ có đúng 1 dòng `@import "tailwindcss";`). Giao diện thật thuộc L1-03. Không có browser, nên xác minh bằng code.

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Layout: không cuộn ngang, mobile-first, grid auto-fit, container không fixed px | OK | `page.tsx` chỉ có `<main><h1><p>`, không có width cố định, grid hay media query, và không có CSS tùy biến. Không có gì tràn ở 375/768/1280. |
| Typography/Spacing rem/clamp | N/A | Không có style tùy biến; token thuộc L1-03. |
| Media srcset/aspect-ratio | N/A | Không có ảnh hay video. |
| Touch target ≥44px / nav mobile / table | N/A | Không có phần tử tương tác, nav hay bảng. |
| Viewport/A11y: 100vh, reduced-motion, overflow hidden | OK | `globals.css` chỉ import tailwind: không có `100vh`, animation hay `overflow:hidden`. Next tự chèn meta viewport. Có `<html lang="vi">`. |

## Skill gates

- **aislop:** skip, không nằm trong allowlist verify của reviewer.
- **oxlint (anti-slop):** skip, oxlint chưa được cấu hình (repo dùng ESLint flat config; `pnpm lint` 0 lỗi).
- **ocr (open-code-review):** skip, không chạy được trong allowlist.
- **AI-readable:** OK, 0/3 indicator.
  - Tên rõ; hàm dài nhất là `loadModules` (khoảng 24 dòng); indirection ≤2.
  - Không có magic number (cổng 4000 có tên và schema); comment giải thích WHY.
  - Có `docs/RUN_LOCAL.md`.
- **ai-friendly-web:** N/A, chưa có trang public.
- **blitzstrike:** N/A, không có auth hay input public.

## Findings

0 blocker (CRITICAL), 0 major (MAJOR).

- **[MINOR] Lỗi 4xx bị gộp thành 400.** `apps/api/src/http/middleware.ts:21-23` biến mọi lỗi 4xx không phải AppError thành `BAD_REQUEST` 400, nên `ctx.throw(401|403|404|409|429)` ở route sau này sẽ bị đổi status. Đề xuất một trong hai:
  - map theo status sang mã COMMON_ERRORS tương ứng;
  - hoặc ghi quy ước "chỉ throw AppError" trong `docs/DESIGN.md`.
- **[MINOR] Tên file `routes.ts` bị cứng.** `apps/api/src/modules/loader.ts:35` chỉ chạy dưới tsx/vitest. Hiện chấp nhận được vì api không build ra JS. Nếu sau này compile ra `dist/` thì loader sẽ không thấy module nào. Cần ghi lại trong `docs/DESIGN.md` hoặc hỗ trợ `routes.js` khi có build.
- **[MINOR] Subagent tự ghi journal.** File `.context/runs/start-quiq-layer-0-task-01.builder.md` do subagent ghi, trái §Session Handoff. Primary nên gộp vào journal và không commit file này.
- **[NIT] Mô tả lệch (g) chưa chính xác.** Đây là mặc định của pnpm 10, không phải cấu hình. Chỉ cần ghi đúng trong task file.
- **[NIT] Gói cũ.** `apps/api/package.json:19` dùng `koa-bodyparser@4`; cân nhắc `@koa/bodyparser` sau.

## Doc impact (reconcile ở close-out hoặc Layer cuối, không bắt lỗi builder)

- **`docs/API_SPEC.md`:** đang mô tả envelope lỗi `{success:false,error,details}`, thiếu `code`. Code thật trả `{success:false,code,error,details?}` (`packages/shared/src/common/envelope.ts:10-15`, `apps/api/src/http/response.ts:13-18`).
- **`docs/DESIGN.md` (current-state):** nên ghi quy ước module loader (`modules/<tên>/routes.ts` export default `(router)=>void`, prefix `/api`) và quy ước lỗi (chỉ throw AppError; lỗi 500 trả câu chung).

## Residual risk (không chặn PASS)

- **Chưa smoke test thật:** chưa chạy `pnpm install --frozen-lockfile` từ repo sạch, và chưa chạy `pnpm dev` + curl health. Đề xuất primary hoặc bạn chạy một lần trước khi commit: `pnpm install --frozen-lockfile`, `pnpm dev`, mở `http://localhost:4000/api/health` và `http://localhost:3000`, rồi tắt tiến trình.
- **Chưa tra được ngày phát hành của các bản dependency.**

## Verdict

PASS. Không có CRITICAL hay MAJOR. Các AC kiểm được đều đạt, và các lệch builder khai đều chấp nhận được. Còn 3 MINOR, 2 NIT và một số residual risk về smoke test; không cái nào chặn commit.
