# Task 03: Web nền (tokens teal, font tiếng Việt, thành phần giao diện dùng chung, api-client)

## Layer
1

## Type
build (initial)

## Description
`apps/web`: nền giao diện dùng chung cho mọi màn của demo và các tính năng sau. Đưa **design tokens đã chốt (bảng màu A teal, ô đáp án chữ cái A B C D)** vào Tailwind/CSS và dựng bộ thành phần cơ bản đúng `.context/design-spec.md` §3.

Gồm:
- Tokens: biến CSS và theme Tailwind map từ `skills/react-nodejs/design-tokens.md` (màu thương hiệu teal, màu đáp án, trạng thái, nền, chữ, bo góc, đổ bóng, "lip" nút nổi khối, chiều cao điều khiển, motion, focus ring teal).
- Font: `next/font` tự host Montserrat, Be Vietnam Pro, IBM Plex Mono, subsets `latin` + `vietnamese`, `display: swap`.
- Thành phần `src/components/ui/`: Button (6 biến thể, 3 cỡ, trạng thái đang xử lý), Input, Select, Textarea, Field (nhãn + hint + lỗi), Badge (6 loại), Card, KpiCard, Alert (5 loại), Dialog (Radix), Toast, Tabs, Table (trong khung cuộn ngang), Skeleton, EmptyState, `AnswerTile` (ô đáp án với huy hiệu chữ cái, 4 màu, đã chọn/dimmed), `Timer` (pill mono, sắp hết giờ đổi hồng đậm), `LetterBadge`.
- `MinWidthGuard`: dưới 1024px hiện "Quiq chỉ hỗ trợ máy tính..." và không render nội dung (design-spec §1).
- `src/lib/api-client.ts`: `fetch` cùng origin `/api/*`, `credentials: 'include'`, parse envelope, ném `ApiError {status, code, message}`, xử lý 401 (sự kiện để shell điều hướng đăng nhập).
- Trang `/_ui` (chỉ dev, `notFound()` khi production) hiển thị mọi thành phần để xem bằng mắt.

## Dependencies
- layer-0-task-01 (dependency web đã cài sẵn, `apps/web` khung)

## Acceptance Criteria
- [ ] Mọi giá trị màu/cỡ/bo góc lấy từ biến token, **không hex thô trong component** (có test hoặc lint quét `components/ui/`).
- [ ] Tiếng Việt hiển thị đủ dấu (ắ, ể, ữ, ợ, ặ) ở cả ba font; `font-mono` + `tabular-nums` cho số, đồng hồ, mã.
- [ ] Tương phản đúng bảng đã đo trong tokens (nút primary trắng/teal 5.47:1; ô C chữ tối); focus ring thấy rõ (teal trên nền sáng, trắng trên nền teal); mọi nút chỉ icon có `aria-label`.
- [ ] Dialog bẫy focus, đóng bằng Esc, trả focus; Tabs điều hướng bằng phím mũi tên; Toast có `aria-live`.
- [ ] `MinWidthGuard` chặn nội dung dưới 1024px (test render với `matchMedia` giả).
- [ ] `AnswerTile`: chọn 1 đáp án làm mờ các ô còn lại; câu chọn nhiều đáp án **không** làm mờ (design-spec D-5); trạng thái chọn thể hiện bằng dấu tick + viền, không chỉ màu.
- [ ] `ApiClient` có test: parse envelope thành công/lỗi, ném `ApiError`, bắn sự kiện khi 401.
- [ ] Trang `/_ui` render không lỗi; `pnpm build` của web qua; không em-dash (`—`) trong mọi chuỗi giao diện (test quét thư mục `src`).
- [ ] Không có nhãn thương hiệu/hình của sản phẩm tham khảo cũ; không emoji làm icon (Tabler Icons).

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/app/fonts.ts`, `apps/web/src/app/_ui/page.tsx`
- `apps/web/tailwind.config.ts` (nếu phiên bản Tailwind dùng file cấu hình) hoặc phần theme trong `globals.css`
- `apps/web/src/components/ui/button.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`, `field.tsx`, `badge.tsx`, `card.tsx`, `kpi-card.tsx`, `alert.tsx`, `dialog.tsx`, `toast.tsx`, `tabs.tsx`, `table.tsx`, `skeleton.tsx`, `empty-state.tsx`, `answer-tile.tsx`, `letter-badge.tsx`, `timer.tsx`, `index.ts`
- `apps/web/src/components/min-width-guard.tsx`, `apps/web/src/lib/cn.ts`, `apps/web/src/lib/api-client.ts`
- `apps/web/src/components/ui/ui.test.tsx`, `apps/web/src/lib/api-client.test.ts`, `apps/web/src/components/min-width-guard.test.tsx`, `apps/web/vitest.config.ts`

## Notes
- Đọc trước: `skills/react-nodejs/design-tokens.md` (tokens + contrast), `.context/design-spec.md` §0 (nguyên tắc), §1 (responsive), §3 (thành phần); prototype `index.html` chỉ **grep đoạn** (`.btn`, `.kahoot-opt` đã đổi thành chữ cái) lấy ý bố cục nút nổi khối, **không sao chép** màu tím, hình học, chữ tên thương hiệu cũ, em-dash.
- Một hệ thiết kế duy nhất: Tailwind + Radix primitives. Không MUI/Ant.
- Spike SSE qua Next rewrite (buffer?) **không** làm ở đây; thuộc layer tính năng "theo dõi trực tiếp".
- Layer 2 và 3 import từ `@/components/ui` và `@/lib/api-client`; task đó không được sửa các file này (cần thêm biến thể thì tạo thành phần riêng trong thư mục tính năng của chúng).
- Risk: trung bình (UI, nhiều file). Reviewer NORMAL kèm checklist `skills/frontend-checklist`.
