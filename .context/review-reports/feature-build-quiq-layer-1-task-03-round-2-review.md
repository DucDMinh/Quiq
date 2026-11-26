Agent: reviewer

# Review: build-quiq layer-1 task-03 (Web nền), round 2 (vòng cuối)

- Worktree: `E:\Quiq\.worktrees\layer-1__task-03` (branch `wt/layer-1__task-03`), thay đổi chưa commit. Phạm vi: `apps/web/`.
- Review level: **STRICT** cho các thành phần dùng chung bị khóa với layer sau (`timer`, `dialog`, `select`, `toast`, `min-width-guard`, `portal-container`, `cn`, `api-client`, `answer-tile`). **NORMAL** cho phần còn lại.
- Reason: Layer 2 và 3 import các file này nhưng không được sửa. `api-client` có nhánh 401 liên quan tới session. `min-width-guard` bọc mọi màn.
- Blast radius: mọi màn web (layout gốc `MinWidthGuard > ToastProvider`), mọi Dialog/Select (giờ portal vào container bên trong guard), mọi lời gọi API, mọi chỗ gọi `cn`. Tầng API/DB không bị ảnh hưởng.

## Verify commands + result (tôi tự chạy trong worktree)

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS. 5 workspace; `apps/web: next typegen && tsc --noEmit` Done |
| `pnpm lint` | PASS (`eslint apps packages`, không có output lỗi) |
| `pnpm test` | PASS: `Test Files 8 passed (8)`, `Tests 78 passed (78)`. Vẫn còn cảnh báo Vite ESM/CJS cho `apps/web/vitest.config.ts` (nit vòng 1, chưa sửa) |
| `pnpm build` | PASS: Next.js 16.4.6, các route `/`, `/_not-found`, `/_ui` (static) |
| `.next/server/app/_ui.meta` | `"status": 404`: `/_ui` vẫn trả notFound ở production |
| `aislop scan --changes --json` | skip, aislop chưa cài (vòng 1: command not found) |
| `npx oxlint` | skip, repo chưa cấu hình oxlint (dùng eslint, đã PASS) |
| `ocr` | skip, ocr chưa cài |

Grep trên `apps/web/src`, không tính file test: không còn `—`, `Kahoot`, `Game PIN`, `46178f`, `fonts.googleapis`.

`git status --short`: chỉ sửa `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/tsconfig.json`. Còn lại là file mới trong `apps/web` và journal `.context/runs/build-quiq-layer-1-task-03.builder.md`; dispatcher sẽ xóa journal này. Không đổi `package.json`, lockfile hay `next.config.ts`.

## Trạng thái finding vòng 1

| Finding | Trạng thái | Bằng chứng (đọc code và test thật) |
|---|---|---|
| F1 Timer mốc 30 giây (MAJOR) | **Đã đóng** | `timer.tsx:4-6,20-25`: ba mốc 300/60/30, chữ "Còn tối đa 5 phút / 1 phút / 30 giây"; trên 300 giây vùng live để trống. Text chỉ đổi khi vượt mốc, nên trình đọc màn hình không đọc từng giây. Test `ui.test.tsx:535-555` phủ 301/300/299/61/60/31/30/29/0. Thử mutation trong đầu: đổi 30 thành 31 thì case 31 rớt; đổi 60 thành 61 thì case 61 rớt; đổi 300 thành 299 thì case 300 rớt; bỏ hẳn một nhánh thì case tương ứng rớt. |
| F2 Portal ngoài wrapper `hidden` | **Đã đóng** | `min-width-guard.tsx:64,71-74`: có điểm portal (`<div ref={setPortalContainer}>`) nằm trong wrapper `hidden`. `dialog.tsx:39-41` và `select.tsx:44,63` truyền `container`. `portal-container.tsx:12-14` trả `undefined` khi không có provider, nên Radix rơi về `<body>`. Test `min-width-guard.test.tsx:202-223`: Dialog đang mở bị ẩn khi thu hẹp, alert vẫn truy cập được (`getByRole` mặc định loại phần tử `aria-hidden`), nới rộng lại thì giữ nguyên state ô nhập. Phần suy luận tác dụng phụ ở mục dưới. |
| F3 test mutation | **Đã đóng** | `matchMedia` giả đọc `min-width` từ query, query lạ thì throw (`min-width-guard.test.tsx:17-34`). Test biên 1023 bị chặn, 1024 qua (`:168-184`): đổi 1024 thành 1000 thì 1023 không bị chặn, test rớt; đổi sang `max-width` thì throw. `opacity-60` được assert ở câu chọn 1 (`ui.test.tsx:471,475`) và vắng ở câu chọn nhiều (`:495`). Test SSR `renderToString` (`:226-251`): xóa `max-lg:hidden` thì `:234` rớt. |
| F4 px thô thành token | **Đã đóng** | `globals.css`: `--lip-width-sm: 3px`, `--lip-width-answer: 6px`, `--tile-border-width: 3px` khớp ghi chú tokens (`design-tokens.md:158` "nút nhỏ 3px, ô đáp án 6px"; `:49` viền 3px). Không đổi token đã chốt nào. `answer-tile.tsx:41` dùng `border-(length:--tile-border-width) border-b-(length:--lip-width-answer)`, cùng giá trị cũ nên hình hiển thị không đổi. Test quét `ui.test.tsx:68-73` chạy trên mọi `.tsx` trong `components/ui`. Hex/hàm màu thô vẫn bị test `:58-66` chặn. Xem thêm nit N1 về `--text-control`/`--text-badge`. |
| F5a `"use client"` | **Đã đóng** | Grep hook/handler: mọi file có hook hoặc tạo handler đều có directive (`answer-tile`, `dialog`, `select`, `field`, `tabs`, `toast`, `min-width-guard`, `portal-container`, `gallery`). `field.tsx:25-26` có ghi rõ ràng buộc render-prop chỉ dùng trong client component. |
| F5b setupFiles | **Đã đóng** | `vitest.config.ts:18` `setupFiles: ["./vitest.setup.ts"]`. `vitest.setup.ts` polyfill pointer capture và `scrollIntoView` bằng `??=`. `ui.test.tsx` không còn polyfill trùng (grep `hasPointerCapture`: không khớp). Test Select/Toast/Dialog PASS. |
| F5c tailwind-merge | **Đã đóng** | `cn.ts:6-14` khai `font-size: text-{score,control,badge}`, `shadow: shadow-{card,selected}`, `ease: ease-fast`. `cn.test.ts` chứng minh `text-score` và `text-ink` không gộp nhầm (theo cả hai thứ tự); `text-control` đi với `text-on-brand`; hai cỡ chữ thì class sau thắng; `bg-quiq-rose` và `bg-answer-a` gộp đúng nhóm màu; `shadow-card` và `shadow-quiq-rose` không xung đột; độ rộng viền token (`border-b-(length:...)`) không xóa màu viền. Lookup literal của tw-merge chạy trước validator, nên `shadow-card` không bị xếp vào shadow-color. Các test này PASS khi tôi chạy. |
| F5d `/api` prefix | **Đã đóng** | `api-client.ts:46-50`: `/api` và `/api/...` giữ nguyên; `/apiary` không khớp `"/api/"` nên thành `/api/apiary` (đúng). Test `api-client.test.ts:43-47` phủ `/exams`, `exams`, `/api/exams`, `/api`, `/api/`. `/apiary` không có test riêng (nit N3). |
| F6 AbortError | **Đã đóng** | `api-client.ts:86-88,117` kiểm `name === "AbortError"` rồi ném lại nguyên bản. Test `api-client.test.ts:112-116` dùng `DOMException(..., "AbortError")`. |
| Nit: "dưới" ở đúng mốc | **Đã đóng** | Chữ đổi thành "Còn tối đa ...". |
| Nit: toast lỗi polite | **Đã đóng** | `toast.tsx:63`: lỗi dùng `type="foreground"`. Test `ui.test.tsx:404-432` assert phần thông báo assertive/polite qua `[role=status][aria-live]`. |
| Nit: cảnh báo Vite ESM/CJS | **Chưa sửa** | Vẫn còn cảnh báo khi chạy test. Không ảnh hưởng hành vi, không chặn. |

## Phân tích F2 (STRICT)

- **Vị trí fixed / z-index:** wrapper không có `transform`, `filter`, `contain`, `overflow` hay `z-index`. Sau hydrate wrapper không có class; trước hydrate chỉ có `max-lg:hidden`, có tác dụng dưới 1024px. Vì vậy wrapper không tạo containing block hay stacking context. `fixed` của overlay/content Dialog vẫn tính theo viewport. Thứ tự lớp z-40 overlay, z-50 content, z-[100] toast, z-[200] thông báo vẫn so ở gốc, nên dialog không lệch vị trí ở màn ≥ 1024px. Preflight của Tailwind cho `[hidden]` là `display:none !important`, nên thuộc tính `hidden` thắng mọi class.
- **hideOthers / aria-hidden:** `hideOthers` của aria-hidden đi từ content lên body và chỉ gắn `aria-hidden` cho anh em ngoài nhánh đó: nội dung trang trong wrapper và anh em của wrapper. Package aria-hidden giữ lại phần tử có `[aria-live]`. Thông báo có `aria-live="assertive"` tường minh (`min-width-guard.tsx:38`), nên không bị ẩn kể cả khi đã mount trước Dialog. Test `:216` xác nhận cho trường hợp thông báo mount sau Dialog.
- **Focus trap khi bị ẩn rồi nới rộng:** khi wrapper bị `display:none`, trình duyệt bỏ focus khỏi phần tử trong Dialog. FocusScope của Radix bỏ qua `focusout` có `relatedTarget = null`, nên focus rơi về `<body>`. Khi nới rộng lại, focus không tự quay về Dialog cho tới khi người dùng bấm Tab. Lúc đó `focusin` ngoài scope sẽ bị kéo lại vào Dialog. Không có phím nào kích hoạt nhầm nút. Xem MINOR M1.
- **Esc khi đang bị chặn:** DismissableLayer nghe `keydown` trên document, nên bấm Esc lúc đang thấy thông báo vẫn đóng Dialog bị ẩn. Hành vi này lành tính vì chỉ là hủy. Click lên thông báo không đóng Dialog vì body đang `pointer-events: none` và thông báo không phải layer.
- **Scroll lock:** vẫn khóa ở body. Thông báo là `fixed inset-0` nên không bị ảnh hưởng.
- **Lồng nhau (Select trong Dialog, Dialog lồng Dialog):** các portal append vào cùng container và là anh em của nhau. Radix quản lý layer và focus bằng context/stack, không theo cây DOM, nên hành vi giống khi portal ra body.
- **Mount lần đầu:** `setPortalContainer` (ref callback) và `setMounted` trong `useLayoutEffect` của Radix Portal cùng nằm trong một commit, nên được flush chung. Dialog `defaultOpen` sẽ không mount vào body rồi chuyển chỗ. Đây là suy luận, chưa có test (residual).
- **Toast:** viewport nằm trong `ToastProvider`, provider nằm trong wrapper, nên bị ẩn cùng nội dung. Phần announce của Radix Toast tự portal ra body và chỉ tồn tại ngắn. Chấp nhận được.

## Findings mới (vòng 2)

Không có CRITICAL/MAJOR.

### [MINOR] M1. Focus không tự quay về Dialog sau khi nới rộng lại
- Vị trí: `min-width-guard.tsx:71`. Tương tác giữa `hidden` và FocusScope của Radix, theo suy luận ở trên; chưa kiểm trên trình duyệt thật.
- Sau khi thu hẹp rồi nới rộng, `document.activeElement` là `<body>` cho tới phím Tab đầu tiên.
- Không chặn: rủi ro thấp (desktop-only) và không gây kích hoạt nhầm.
- Nếu muốn khép hẳn: khi `blocked` chuyển từ true sang false, gọi lại focus vào phần tử đang focus trước đó. Có thể lưu `document.activeElement` trước khi chặn.

### [NIT] N1. `--text-control` và `--text-badge` nằm ngoài thang cỡ chữ của tokens
- Vị trí: `globals.css`, khối `@theme static`. Giá trị 15px và 13px không có trong thang `design-tokens.md:121-128`.
- Không mâu thuẫn với token đã chốt; chỉ token hóa giá trị đã có từ vòng 1. Nên ghi vào tokens ở lần cập nhật design sau.

### [NIT] N2. `buildUrl` không xử lý path đã có query
- Vị trí: `api-client.ts:53-61`.
- Gọi `api.get("/exams?x=1", { query })` sẽ ra `?x=1?page=2`. URL tuyệt đối cũng bị biến thành `/api/http://...`. Thiết kế chỉ gọi cùng origin, nên chấp nhận được.
- Nên ghi một dòng JSDoc "path không kèm query; dùng `options.query`".

### [NIT] N3. Thiếu test cho `/apiary`
- Vị trí: `api-client.test.ts:43`. Mã hiện tại đúng.
- Một case `/apiary` sẽ khóa ranh giới tiền tố.

### [NIT] N4. Cảnh báo Vite ESM/CJS cho `vitest.config.ts` vẫn còn
- Còn từ vòng 1, không chặn.

## File ngoài danh sách Files của task

- `apps/web/src/components/portal-container.tsx`: chấp nhận. Truy được trực tiếp về F2. Context nhỏ (14 dòng), đặt cạnh `min-width-guard.tsx`, fallback an toàn.
- `apps/web/vitest.setup.ts`: chấp nhận. Truy được về F5b, chỉ chứa polyfill jsdom và jest-dom matcher dùng chung.

## Responsive Checklist Gate (dự án chỉ desktop ≥ 1024px)

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Không cuộn ngang ≥ 1024 | OK (CSS math) | Không đổi so với vòng 1. Dialog `max-w-[calc(100vw-4rem)]`; container portal là block bình thường, nội dung bên trong là `fixed` |
| Mobile-first media query | N/A | Dưới 1024px chỉ hiện thông báo (design-spec §1) |
| Grid auto-fit | N/A | `AnswerTileGroup` 2x2 cố định theo thiết kế |
| Font rem | OK | `--text-control`/`--text-badge` dùng rem; `--text-score: 44px` đúng token |
| Không dùng `100vh` đơn thuần | OK | Dialog dùng `100dvh` |
| prefers-reduced-motion | OK | Khối media query trong `globals.css` |
| Che lỗi bằng overflow:hidden | OK | Không có |
| Touch target | N/A | Desktop |
| Màn hẹp chặn nội dung kể cả portal | OK | F2 đã đóng, test `min-width-guard.test.tsx:202-223` |

## Skill gates

- aislop: skip, chưa cài.
- oxlint (anti-slop): skip, chưa cấu hình oxlint; eslint PASS.
- ocr (open-code-review): skip, chưa cài.
- AI-readable: OK. Tên rõ ràng, hàm ngắn, comment nói lý do (WHY), không có magic number mới ngoài các hằng có tên. Dưới 3 chỉ dấu.
- ai-friendly-web: N/A. Trang nền, chưa public.
- blitzstrike: skip, chưa cài và không có môi trường.

## Residual risk

- Không chạy trình duyệt thật. Hành vi focus/Esc khi wrapper `display:none` (M1), việc Dialog `defaultOpen` không mount vào body ở lần đầu, và dấu tiếng Việt trong font là suy luận, chưa kiểm bằng mắt.
- Tôi dựa vào hiểu biết về hành vi giữ `[aria-live]` của aria-hidden và lookup literal của tw-merge. Hai điểm này đều có test PASS trong repo.

## Verdict

**PASS**. Mọi finding vòng 1 (F1 đến F6 và hai nit hành vi) đã đóng, kiểm bằng code và test thật. Không có CRITICAL/MAJOR mới. Còn 1 MINOR (M1) và 4 NIT (N1 đến N4), không chặn.
