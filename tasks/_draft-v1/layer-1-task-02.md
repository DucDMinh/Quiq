# Task 02: Web skeleton (Next.js, Tailwind từ tokens, primitive UI, spike SSE qua rewrite)

## Layer
1

## Type
build

## Description
Dựng khung `apps/web`: Next.js App Router (TypeScript), Tailwind map từ design tokens của Quiq, font tự host bằng `next/font`, bộ primitive UI (shadcn/Radix) dùng lại ở mọi màn, thông báo "chỉ hỗ trợ máy tính" dưới 1024px, rewrite `/api/*` sang Koa, và **spike SSE** kiểm tra rewrite của Next có làm đệm (buffer) luồng SSE hay không.

Task này không phụ thuộc `@quiq/shared`/`@quiq/api` (cùng layer): spike dùng một server SSE tạm tự viết trong thư mục scripts.

## Dependencies
- layer-0-task-01 (manifest `@quiq/web` đã có next, tailwind, radix, tanstack table, react-hook-form, tabler icons)

## Acceptance Criteria
- [ ] Đọc `skills/react-nodejs/design-tokens.md` và `.context/design-spec.md` §0, §1, §3 trước khi viết. `tailwind.config.ts` map **toàn bộ** token màu/typography/spacing/radius/shadow/lip/motion thành theme (không hex thô trong component); `globals.css` khai biến `--quiq-*`, `--status-*`, `--focus-ring*`... đúng tên trong tokens; chỉ giao diện sáng.
- [ ] Font nạp bằng `next/font` (Montserrat, Be Vietnam Pro, IBM Plex Mono; subsets `latin` + `vietnamese`, `display: swap`), không gọi Google Fonts lúc chạy; trang kiểm hiển thị đủ dấu (ắ, ể, ữ, ợ, ặ).
- [ ] Primitive trong `apps/web/src/components/ui/`: `button` (6 biến thể primary/secondary/subtle/success/danger/danger-outline, 3 cỡ 36/42/50px, "lip" 4px, nhấn dịch 2px, trạng thái đang xử lý khóa nút và đổi nhãn không đổi kích thước), `input` + `field` (nhãn trên, dấu `*`, hint, lỗi dưới ô), `select`, `textarea`, `badge` (6 loại), `card`, `kpi-card`, `dialog` (Radix; Esc + nút x, trả focus, bản "xác nhận xóa"), `toast` (góc dưới phải, `aria-live="polite"`, 5 giây, lỗi 8 giây), `alert` (5 loại), `tabs`, `skeleton`, `empty-state`, `data-table` (TanStack Table; header cố định, bọc `table-wrap` cuộn ngang, phân trang 25/trang + ô tìm kiếm khi >= 50 dòng, cột cuối "Thao tác" căn phải), `pill-filter`. Mọi nút chỉ-icon có `aria-label`; ring focus theo `--focus-ring`; tôn trọng `prefers-reduced-motion`.
- [ ] Icon dùng `@tabler/icons-react`; không emoji làm icon; không em-dash (`—`) trong mọi chữ giao diện (có test quét chuỗi nguồn của thư mục `src` tìm `—`).
- [ ] Tiện ích `cn()` và `formatScore`, `formatDuration` (mm:ss) trong `src/lib/utils.ts`, số/mã/điểm dùng `font-mono` + `tabular-nums`.
- [ ] Gác kích thước: dưới 1024px hiện toàn màn thông báo đúng câu: "Quiq chỉ hỗ trợ máy tính. Hãy mở bằng laptop hoặc máy bàn (màn hình rộng từ 1024px)." (component `ViewportGuard` bọc root layout, có tham số `allowNarrow` cho ngoại lệ trang tra cứu và tham số `keepMounted` cho màn đang thi: che nội dung bằng lớp phủ nhưng **không unmount** để đồng hồ/heartbeat/hàng đợi đáp án tiếp tục chạy; mặc định không render nội dung bên dưới khi bị chặn).
- [ ] `next.config.ts`: `rewrites` chuyển `/api/:path*` tới `API_ORIGIN` (mặc định `http://localhost:4000`), `compress: false` cho đường API, `transpilePackages: ['@quiq/shared']`; trang `/` redirect tạm tới `/dang-nhap` (L2-02 sẽ giữ nguyên redirect). Tiêu đề tab mặc định: `Quiq | Thi trắc nghiệm trực tuyến`.
- [ ] **Spike SSE** (`apps/web/scripts/sse-spike.mjs` + `sse-spike.test.mjs`): chạy server SSE tạm (Node `http`) phát 1 sự kiện/giây trong 10 giây + dòng keep-alive, chạy Next (production build hoặc dev) với rewrite trỏ tới nó, mở `GET /api/spike/stream` qua Next và đo **thời điểm nhận từng sự kiện**: PASS khi sự kiện đầu tới trong < 2 giây và các sự kiện tới rải rác (không dồn cuối). Kiểm thêm: kết nối sống >= 40 giây không bị cắt (proxy timeout), header `content-encoding` không có gzip. Ghi kết quả + số liệu + phiên bản Next vào `docs/specs/2026-11-25-sse-spike.md`, kèm **quyết định**: giữ rewrite, hay thêm route handler stream (`app/api/[...path]/route.ts`), hay cho SSE kết nối trực tiếp Koa. Triển khai phương án đã chọn trong `next.config.ts` (và nếu cần route handler tương ứng) để L7-03 dùng ngay.
- [ ] Trang `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/not-found.tsx` ("Không tìm thấy trang", dùng chung cho 403/404), `src/app/loading.tsx`, `src/app/error.tsx` (có nút thử lại). Trang dev `/dev-ui` (chỉ khi `NODE_ENV !== 'production'`) hiển thị toàn bộ primitive để reviewer xem.
- [ ] Test PASS (Vitest + Testing Library): button (biến thể, trạng thái đang xử lý), field lỗi, dialog trả focus, data-table phân trang/tìm kiếm, ViewportGuard, quét em-dash.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/web/src/index.ts` (xóa stub)
- `apps/web/tsconfig.json` (mở rộng cho Next)
- `apps/web/next.config.ts`
- `apps/web/postcss.config.mjs`
- `apps/web/tailwind.config.ts`
- `apps/web/next-env.d.ts`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/not-found.tsx`
- `apps/web/src/app/loading.tsx`
- `apps/web/src/app/error.tsx`
- `apps/web/src/app/dev-ui/page.tsx`
- `apps/web/src/lib/utils.ts`
- `apps/web/src/lib/fonts.ts`
- `apps/web/src/components/viewport-guard.tsx`
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/field.tsx`
- `apps/web/src/components/ui/input.tsx`
- `apps/web/src/components/ui/select.tsx`
- `apps/web/src/components/ui/textarea.tsx`
- `apps/web/src/components/ui/badge.tsx`
- `apps/web/src/components/ui/card.tsx`
- `apps/web/src/components/ui/kpi-card.tsx`
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/toast.tsx`
- `apps/web/src/components/ui/alert.tsx`
- `apps/web/src/components/ui/tabs.tsx`
- `apps/web/src/components/ui/skeleton.tsx`
- `apps/web/src/components/ui/empty-state.tsx`
- `apps/web/src/components/ui/data-table.tsx`
- `apps/web/src/components/ui/pill-filter.tsx`
- `apps/web/src/components/ui/ui.test.tsx`
- `apps/web/src/components/viewport-guard.test.tsx`
- `apps/web/src/lib/no-em-dash.test.ts`
- `apps/web/scripts/sse-spike.mjs`
- `apps/web/scripts/sse-spike.test.mjs`
- `docs/specs/2026-11-25-sse-spike.md`

## Notes
- **Risk:** đỏ về UI (nền tảng thiết kế dùng lại ở mọi màn; reviewer chạy STRICT cho tokens, contrast, a11y). Không có migration.
- Task UI: đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §0 (nguyên tắc), §1 (responsive), §3 (thành phần dùng chung), §11 (a11y). Một hệ thiết kế (Tailwind + Radix/shadcn); không em-dash; chỉ desktop.
- Tham khảo bố cục nút/ô đáp án trong prototype `index.html` bằng grep đoạn (class `.btn`, `.answer`), không đọc cả file; **không sao chép** màu tím, hình học, chữ "Kahoot"/"Game PIN".
- Ô đáp án (`answer-option`) và đồng hồ thi thuộc L7-02, không tạo ở đây; chỉ khai sẵn token `--answer-*` trong theme.
- Spike: nếu Next không khởi động được trong môi trường builder thì ghi `Blocked` cho phần spike nhưng vẫn hoàn thành phần còn lại; không đoán kết quả. Cần nhớ `experimental.proxyTimeout` của Next khi rewrite dài hạn.
- Web `lint` dùng eslint ở gốc (L0-01); không thêm file cấu hình eslint riêng ở đây.
- Cookie và URL: trình duyệt chỉ gọi `/api/*` cùng origin (không CORS). Ghi trong spike doc nếu phát hiện rewrite làm rơi `Set-Cookie`.
