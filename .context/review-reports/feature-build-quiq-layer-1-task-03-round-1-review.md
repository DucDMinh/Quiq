Agent: reviewer

# Review: build-quiq layer-1 task-03 (Web nền: tokens, font, UI dùng chung, api-client), round 1

- Worktree: `E:\Quiq\.worktrees\layer-1__task-03` (branch `wt/layer-1__task-03`), thay đổi chưa commit.
- Review level: **STRICT** cho `api-client.ts`, `min-width-guard.tsx` và các thành phần dùng chung; NORMAL cho phần còn lại.
- Reason: đây là thành phần dùng chung và API client mà Layer 2 và 3 import nhưng **không được sửa** (task Notes). Phần 401 dính tới auth/session.
- Blast radius: mọi màn web (layout gốc bọc `MinWidthGuard` + `ToastProvider`), mọi lời gọi API (`@/lib/api-client`), mọi form/màn thi (`@/components/ui`). Tầng API/DB không bị ảnh hưởng.

## Verify commands + result (tôi tự chạy trong worktree)

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (5 workspace, `apps/web: next typegen && tsc --noEmit` Done) |
| `pnpm lint` | PASS (`eslint apps packages`, không có output lỗi) |
| `pnpm test` | PASS: 7 file test, 63 test. Có cảnh báo Vite: `apps/web/vitest.config.ts` là ESM nhưng được nạp như CommonJS |
| `pnpm build` | PASS: Next 16.4.6, các route `/`, `/_not-found`, `/_ui` (static) |
| `aislop scan --changes --json` | skip, `aislop: command not found` |
| `npx oxlint` | skip, repo chưa cấu hình oxlint (dùng eslint, đã PASS) |
| `ocr` | skip, ocr chưa cài |
| `pnpm dev` | không chạy (theo yêu cầu) |

Kiểm tra trên artifact build:
- `.next/server/app/_ui.meta` có `"status": 404`. Ở production, `/_ui` prerender ra trang notFound. Route được build từ thư mục `%5Fui` và đúng là `/_ui`.
- `index.html`: không có `fonts.googleapis`/`fonts.gstatic`. Title là `Quiq | Thi trắc nghiệm trực tuyến`. Wrapper nội dung có `class="max-lg:hidden"`. Thông báo màn hẹp `role="alert"` mang `hidden max-lg:flex`, nên trên màn rộng không nháy, trên màn hẹp thông báo có sẵn trước khi hydrate.

## Acceptance Criteria

| AC | Kết quả | Bằng chứng |
|---|---|---|
| Không có hex hoặc hàm màu thô trong `components/ui` | OK | Grep `#[0-9a-fA-F]{3,8}`, `rgb(`, `hsl(`, `oklch(` trên `apps/web/src`: chỉ khớp ở `app/globals.css`. Có test quét ở `ui.test.tsx:63-71`. Còn một số kích thước arbitrary px (minor F4) |
| Font tiếng Việt qua next/font, latin + vietnamese, swap | OK (mã) | `app/fonts.ts:6-24`. Không gọi Google Fonts lúc chạy (đã kiểm HTML build). Chưa xem dấu bằng mắt (residual) |
| mono + tabular-nums | OK | `timer.tsx:39`, KpiCard có test (`ui.test.tsx:264`) |
| Tương phản | OK | Tôi tự tính trắng/#0f766e = 5.47 và #0f766e/#f2f2f2 = 4.89, khớp tokens. `ui.test.tsx:123-148` đọc hex từ globals.css và tính luminance theo WCAG, nên phát hiện được khi token bị đổi |
| Focus ring teal, trắng trên `.on-brand` | OK | `globals.css` `:focus-visible` + `.on-brand` |
| Nút chỉ icon có aria-label | OK | `button.tsx:80-83`, `label` bắt buộc qua kiểu (Omit `aria-label`) |
| Dialog bẫy focus, Esc, trả focus | OK | Radix + test `ui.test.tsx:322-340` |
| Tabs điều hướng bằng mũi tên | OK | test `ui.test.tsx:352` |
| Toast có aria-live | OK | `toast.tsx:88`, polite, lỗi giữ 8 giây |
| MinWidthGuard chặn dưới 1024px | OK, có rủi ro (F2) | Children luôn mounted (`hidden`), có test giữ state và timer. `/tra-cuu` và `/tra-cuu/...` được miễn, `/tra-cuu-khac` không được miễn |
| AnswerTile | OK | Chọn 1 thì làm mờ ô khác, chọn nhiều thì không (`answer-tile.tsx:91`). Có tick + viền + `aria-pressed`, huy hiệu A-D, tối đa 4 (`slice`) |
| ApiClient | OK | Envelope, ApiError, 401 bắn event, `skipUnauthenticatedEvent`, NETWORK_ERROR, BAD_RESPONSE (kể cả HTTP 200 sai envelope), AbortError ném lại nguyên bản (`api-client.ts:103`). Các nhánh đều có test, riêng AbortError chưa có (F6) |
| `/_ui` chỉ có ở dev | OK | `page.tsx:10` + `_ui.meta` status 404 |
| Không em-dash, emoji, nhãn thương hiệu cũ | OK | Grep `—`, `Kahoot`, `Game PIN`, `46178f`, `@mui`, `antd`: không khớp. Có test quét `ui.test.tsx:73-87` |
| Timer: ≤ 120 giây đổi hồng đậm, aria-live assertive | **Một phần** | Thiếu mốc 30 giây (F1) |

## Findings

### [MAJOR / blocker] F1. Timer thiếu mốc thông báo 30 giây
- `apps/web/src/components/ui/timer.tsx:4-5, 17-22`. Chỉ có hai mốc 300 và 60 giây, comment ghi "chỉ đổi chữ ở hai mốc".
- `.context/design-spec.md:199` (khả năng tiếp cận) yêu cầu "chỉ đọc ở mốc 5 phút, 1 phút, 30 giây", và brief review cũng nêu ba mốc. `design-spec.md:68` (§3) chỉ ghi 5 phút và 1 phút, nghĩa là spec tự mâu thuẫn. Tôi lấy yêu cầu chặt hơn vì theo task Notes, Layer 2 và 3 **không được sửa** file này, nên thiếu sót không thể vá sau ở tầng tính năng. Nếu orchestrator muốn chốt chỉ hai mốc 5 phút và 1 phút, việc đó phải đi qua sửa spec, không phải để reviewer tự quyết.
- Test `ui.test.tsx:498-506` chốt luôn hành vi thiếu.
- Cách sửa: thêm `ANNOUNCE_THIRTY_SECONDS = 30` và trả "Còn dưới 30 giây" khi `remainingSeconds <= 30`. Thêm case test ở 29 giây. Ghi gap về mâu thuẫn §3 và §6 cho người giữ spec.

### [MINOR] F2. MinWidthGuard: Dialog và portal Radix nằm ngoài wrapper `hidden`
- `min-width-guard.tsx:66` ẩn children bằng `hidden`, nhưng `dialog.tsx:39` portal ra `<body>`. Khi đang mở Dialog mà cửa sổ bị thu hẹp:
  - Dialog bị overlay phủ về mặt hình ảnh (z-50 < z-[200]).
  - FocusScope vẫn giữ focus trong Dialog, nên Enter/Space có thể kích hoạt nút trong hộp thoại mà người dùng không thấy (ví dụ "Nộp bài").
  - `hideOthers` của Radix gắn `aria-hidden` lên các con khác của body, kể cả thông báo `role="alert"`, nên trình đọc màn hình mất thông báo.
- Mức độ: Layer 1 chưa có dialog ở màn thi, và ứng dụng chỉ dành cho desktop, nên rủi ro thực tế thấp. Tuy vậy, design-spec §6 nói "chặn nội dung" khi đang thi.
- Đề xuất: cho `DialogContent` nhận prop `container`, hoặc tạo một portal root nằm trong wrapper được guard để `hidden` che luôn portal. Cách khác: khi `blocked`, đặt `inert` lên các con khác của body, trừ thông báo. Vì Layer 2 và 3 không được sửa `dialog.tsx`, orchestrator cần quyết định sửa ngay trong task này hay mở một task nền trước layer thi.

### [MINOR] F3. Test chưa bắt được một số mutation
- `min-width-guard.test.tsx:14-27`: `matchMedia` giả bỏ qua `query`, nên đổi `1024` thành `1023` hoặc `max-width` ở `min-width-guard.tsx:8` vẫn qua test. Nên assert `matchMedia` được gọi với `"(min-width: 1024px)"`.
- Chưa có test SSR/pre-hydration (`renderToString`) cho class `max-lg:hidden` và `hidden max-lg:flex`. Tôi đã kiểm thủ công trên `index.html`.
- `ui.test.tsx:432-449` chỉ assert `data-dimmed`, không assert class `opacity-60`. Xóa `dimmed && !selected && "opacity-60"` (`answer-tile.tsx:45`) vẫn qua test. Nên assert class `opacity-60`, và assert không có class đó khi `multiple`.
- Ngược lại, bỏ `aria-live` ở Timer thì test bắt được (`ui.test.tsx:500` query trả null). Các test tương phản và quét em-dash/hex là test thật.

### [MINOR] F4. Kích thước arbitrary px trong component thay vì token
- `answer-tile.tsx:39` có `border-[3px] border-b-[6px]`, `button.tsx:29` có `border-b-[3px]`, `tabs.tsx:23` có `border-b-[3px] text-[0.9375rem]`.
- AC yêu cầu "màu/cỡ/bo góc lấy từ biến token". `--lip-width` có trong `:root` nhưng không được dùng. Nên đưa vào token, ví dụ `--lip-width-sm/answer`.

### [MINOR] F5. Hợp đồng cho Layer 2 và 3
- `answer-tile.tsx` không có `"use client"` nhưng `AnswerTileGroup` tạo handler `onClick`. Gọi nó từ Server Component sẽ lỗi khi render. Nên thêm `"use client"` hoặc ghi rõ trong JSDoc.
- `Field` (`field.tsx`, client) nhận children dạng render-prop. Hàm không đi qua được ranh giới RSC, nên Field chỉ dùng được bên trong client component. Cần ghi rõ cho Layer 2 và 3.
- Polyfill `hasPointerCapture` chỉ nằm trong `ui.test.tsx:46-48`. Test của layer sau dùng Select hoặc Toast sẽ lỗi trong jsdom nếu không copy theo. Đề xuất đưa vào một setup file của vitest (`vitest.config.ts` `setupFiles`).
- `tailwind-merge` với tên màu tùy biến: theo hiểu biết của tôi về tailwind-merge v3, `bg-*`/`text-*`/`border-*` có tên lạ được xếp vào nhóm màu, nên không gây xung đột với cỡ chữ chuẩn. Riêng token `--text-score` (cỡ chữ, `globals.css:170`) sẽ bị twMerge coi là màu: `cn("text-score", "text-ink")` sẽ bỏ `text-score`. Hiện chưa có nơi nào dùng, nhưng là bẫy cho màn kết quả. Đề xuất `extendTailwindMerge` khai báo `font-size: ["score"]`.
- `/api` prefix: `buildUrl` (`api-client.ts:45`) nhận `"/api/x"` nhưng chuỗi `"/api"` (không có `/` cuối) sẽ thành `/api/api`. Trường hợp biên, nit.

### [MINOR] F6. ApiClient: nhánh AbortError chưa có test
- `api-client.ts:103` đúng về mã, nhưng `api-client.test.ts` không có case `DOMException('AbortError')`. Thêm 1 test (Layer 3 cần huỷ request khi đổi bộ lọc).

### [NIT]
- `timer.tsx:19-20`: ở đúng 60 hoặc 300 giây, thông báo ghi "dưới", về ngữ nghĩa là "còn". Không ảnh hưởng.
- `toast.tsx:62`: toast lỗi cũng là `type="background"` (polite). Chấp nhận được theo spec (polite).
- `apps/web/vitest.config.ts`: cảnh báo Vite ESM/CJS. Đổi sang `.mts` để tắt cảnh báo.

## Quyết định của builder

| Quyết định | Đánh giá |
|---|---|
| Thư mục `src/app/%5Fui/` | Chấp nhận. Build ra route `/_ui`, production trả 404 |
| `tsconfig.json` thêm `paths "@/*"` | Chấp nhận. Cần cho import `@/components/ui` mà Layer 2 và 3 dùng. Nằm ngoài danh sách Files nhưng truy được về task |
| Title `Quiq \| Thi trắc nghiệm trực tuyến` + template | Chấp nhận (D-10), không em-dash |
| Table là vùng cuộn focus được khi có `aria-label` | Chấp nhận, đúng a11y cho vùng cuộn (test `ui.test.tsx:277`) |
| Lip của nút primary dùng `--quiq-brand-dark` | Chấp nhận. Tokens không định nghĩa lip riêng cho teal |
| Ô chưa chọn mờ 60% | Chấp nhận (tokens không chốt con số), nhưng xem F3 về test |
| Không sửa `package.json`, `pnpm-lock.yaml`, `next.config.ts`, không dependency mới | OK theo `git status` (chỉ sửa `globals.css`, `layout.tsx`, `tsconfig.json`; còn lại là file mới trong `apps/web`) |
| Journal `.context/runs/build-quiq-layer-1-task-03.builder.md` | Ghi nhận, dispatcher sẽ xóa |

## Responsive Checklist Gate (dự án chỉ desktop ≥ 1024px)

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Không cuộn ngang ≥ 1024 | OK (CSS math) | Width cố định chỉ có Dialog `w-[28/36/48rem]` kèm `max-w-[calc(100vw-4rem)]`, Toast `w-[24rem] max-w-[calc(100vw-2rem)]`. Table nằm trong khung `overflow-auto` |
| Mobile-first media query | N/A | Dưới 1024px chỉ hiện thông báo, theo design-spec §1 |
| Grid auto-fit | N/A | `AnswerTileGroup` dùng `grid-cols-2` cố định, theo thiết kế 2x2 |
| Font rem | OK | Tiện ích `text-*` của Tailwind dùng rem |
| Không dùng `100vh` đơn thuần | OK | Grep `h-screen`/`100vh`: không có. Dialog dùng `100dvh` |
| prefers-reduced-motion | OK | `globals.css` có khối `@media (prefers-reduced-motion: reduce)` |
| Che lỗi bằng overflow:hidden | OK | Không thấy |
| Touch target | N/A | Desktop. Cỡ nút nhỏ nhất 36px |
| Màn hẹp | OK | Thông báo `role="alert"`, có test cho các đường được miễn |

## Skill gates

- aislop: skip, chưa cài.
- oxlint (anti-slop): skip, chưa cấu hình oxlint; eslint PASS.
- ocr: skip, chưa cài.
- AI-readable: OK. Tên rõ ràng, hàm ngắn, comment nói lý do (WHY). Dưới 3 chỉ dấu.
- ai-friendly-web: N/A. Trang nền, `/_ui` có `robots noindex`. Phần `llms.txt`/`robots.txt` thuộc task deploy hoặc public.
- blitzstrike: skip, chưa cài và không có môi trường.
- UI craft (impeccable/frontend-checklist): OK ở mức mã (một hệ Tailwind 4 + Radix, icon Tabler, không MUI/Ant).

## Secret scan

- Grep không phân biệt hoa thường trên `apps/web/src`, mẫu `api[_-]?key|secret|private[_-]?key|BEGIN ... PRIVATE|AKIA...|sk-...|bearer ...|password`.
- Chỉ khớp `api-client.test.ts:46,48` (`password: "mat-khau"`). Đây là dữ liệu giả trong test, không phải bí mật. Không có khóa hay token thật.

## Residual risk (không kiểm được)

- Không chạy trình duyệt thật. Chưa xem bằng mắt dấu tiếng Việt trong ba font, bố cục `/_ui`, hiệu ứng lip/nhấn, ring focus thực tế.
- Tôi bị giới hạn số lượt đọc nên chưa đọc chi tiết `gallery.tsx`, `table.tsx`, `field.tsx`, `select.tsx`, `badge.tsx`, `alert.tsx`, `kpi-card.tsx`, `empty-state.tsx`, `input.tsx`, `textarea.tsx`, `skeleton.tsx`, `letter-badge.tsx`, `index.ts`. Đã kiểm gián tiếp qua test, grep màu/em-dash/secret và build.
- Hành vi tailwind-merge với tên tùy biến (F5) là suy luận, chưa có test.

## Verdict

**FAIL**: 1 MAJOR/blocker (F1, thiếu mốc thông báo 30 giây trong Timer dùng chung mà layer sau không được sửa).

Gợi ý cho round 2: các file này sẽ bị khóa cho Layer 2 và 3, nên builder nên sửa luôn trong cùng lượt những minor rẻ:
- polyfill vào `setupFiles` của vitest;
- thêm `"use client"` cho `answer-tile.tsx`;
- assert query `matchMedia`;
- assert class `opacity-60`;
- thêm test AbortError.

F2 cần orchestrator quyết định: sửa ngay trong task này hay mở task nền trước layer thi.
