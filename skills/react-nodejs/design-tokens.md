# Design Tokens: Quiq

> Sinh bởi `/design` ngày 2026-11-25 từ prototype `index.html` (thư mục gốc) + `taste-skill-v2` + `ui-ux-pro-max`.
> **Chủ dự án đã chốt (2026-11-25):** bảng màu A "Xanh ngọc (teal)" thay bảng màu tím của prototype; ô đáp án dùng chữ cái A B C D trong ô bo tròn (bỏ 4 hình hình học). Trạng thái: chờ ok cuối để sang `/graph`.
> Coding Agent phải đọc file này trước khi viết bất kỳ UI nào. Không hex thô trong component.
> Một hệ thiết kế duy nhất: Tailwind CSS (theme map từ các biến dưới đây) + Radix/shadcn primitives.
> Chỉ giao diện sáng (light). Không dark mode: phòng thi dùng màn hình sáng, chủ dự án không yêu cầu; quyết định có chủ đích.

## Khác prototype (đã sửa có lý do)

| Prototype | Token này | Lý do |
|---|---|---|
| Tím `#46178f` làm màu chủ đạo, bộ đỏ/xanh dương/vàng/xanh lá làm đáp án | Teal `#0f766e` + bộ hồng đậm/chàm/hổ phách/xanh lá | Chủ dự án muốn khác sản phẩm tham khảo |
| 4 hình (tam giác, thoi, tròn, vuông) + ô thứ 5 | Chữ cái A B C D trong ô bo tròn, tối đa 4 đáp án | Như trên; chữ cái giúp phân biệt không chỉ bằng màu |
| Biến `--k-*`, comment tên sản phẩm khác | `--quiq-*` | Không mang tên thương hiệu khác vào code |
| Focus ring vàng `#ffb300` (1.6:1 trên nền sáng) | Ring teal `--focus-ring`, ring trắng trên nền teal | WCAG 2.2 cần ≥ 3:1 cho thành phần giao diện |
| Hai hình hình học trang trí ở nền cổng vào | Nền phẳng `--bg-portal`, không hình trang trí | Bỏ nhận diện cũ |

## Colors

### Thương hiệu
--quiq-brand: #0f766e
--quiq-brand-dark: #134e4a
--quiq-brand-hover: #115e59
--quiq-brand-tint: #ccfbf1
--quiq-brand-tint-soft: #f0fdfa
--quiq-brand-border: #99f6e4

### Màu hành động ("lip" = màu cạnh dưới của nút nổi khối)
--quiq-rose: #be123c
--quiq-rose-lip: #881337
--quiq-indigo: #4338ca
--quiq-indigo-lip: #312e81
--quiq-amber: #f59e0b
--quiq-amber-lip: #b45309
--quiq-amber-ink: #1f1300
--quiq-green: #15803d
--quiq-green-lip: #14532d
--quiq-sky: #0369a1
--quiq-sky-lip: #075985
--quiq-red: #b91c1c        /* nút nguy hiểm, đồng hồ sắp hết giờ dùng --quiq-rose */
--quiq-red-lip: #7f1d1d

### Ô đáp án (theo vị trí; luôn có chữ cái; tối đa 4 đáp án)
--answer-a-bg: var(--quiq-rose)     /* chữ trắng */
--answer-b-bg: var(--quiq-indigo)   /* chữ trắng */
--answer-c-bg: var(--quiq-amber)    /* chữ var(--quiq-amber-ink) */
--answer-d-bg: var(--quiq-green)    /* chữ trắng */
> Huy hiệu chữ cái: ô bo tròn (`--radius-full`) nền trắng 90%, chữ đậm màu của ô, 36px, nằm bên trái ô đáp án. Đáp án đã chọn: dấu tick bên phải + viền trắng 3px + bóng trong; không chỉ đổi màu.

### Nền, viền, chữ
--bg-canvas: #f2f2f2
--bg-surface: #ffffff
--bg-portal: #f0fdfa         /* nền cổng vào, phòng chờ, kết quả */
--bg-subtle: #eaeaea
--bg-hover: #e0e0e0
--border-subtle: #dcdcdc
--border-strong: #bdbdbd
--text-primary: #1a1a1a
--text-secondary: #4a4a4a
--text-muted: #666666
--brand-primary: var(--quiq-brand)
--brand-primary-hover: var(--quiq-brand-hover)
--brand-primary-tint: var(--quiq-brand-tint)
--brand-primary-text: #ffffff
--on-brand-muted: #ccfbf1    /* chữ phụ trên nền teal */
--on-brand-dark-label: #fde68a /* nhãn trên nền teal đậm (khối điểm) */

### Trạng thái ngữ nghĩa (nền / chữ / viền)
--status-success-bg: #dcfce7
--status-success-text: #166534
--status-success-border: #86efac
--status-warning-bg: #fef3c7
--status-warning-text: #854d0e
--status-warning-border: #fcd34d
--status-danger-bg: #fee2e2
--status-danger-text: #991b1b
--status-danger-border: #fca5a5
--status-info-bg: #dbeafe
--status-info-text: #1e40af
--status-info-border: #93c5fd
--status-neutral-bg: #ededed
--status-neutral-text: #333333
--status-neutral-border: #cccccc

### Focus
--focus-ring: #0f766e            /* 5.47:1 trên trắng, 4.89:1 trên canvas */
--focus-ring-on-brand: #ffffff   /* trên topbar và nút teal */
--focus-ring-width: 3px
--focus-ring-offset: 2px

### Contrast đã đo (WCAG, công thức luminance)
| Cặp | Tỷ lệ | Kết quả |
|---|---|---|
| Trắng / teal `#0f766e` (nút primary, topbar thi) | 5.47 | Đạt AA |
| Trắng / teal hover `#115e59` | 7.58 | Đạt AAA |
| Teal / trắng (link, ring) · teal / canvas · teal / nền portal | 5.47 · 4.89 · 5.25 | Đạt AA |
| Teal đậm `#134e4a` / tint `#ccfbf1` (badge brand) | 8.41 | Đạt AAA |
| Chữ phụ `#ccfbf1` / teal (topbar) | 4.86 | Đạt AA |
| Nhãn `#fde68a` / teal đậm `#134e4a` (khối điểm) | 7.61 | Đạt AAA (trên teal thường `#0f766e` chỉ 4.39, **không dùng**) |
| Trắng / teal đậm `#134e4a` | 9.48 | Đạt AAA |
| Huy hiệu chữ cái đáp án (nền trắng): A `#be123c`, B `#4338ca`, C ink, D `#15803d` | 6.29, 7.90, 18.24, 5.02 | Đạt AA |
| Trắng / hồng đậm `#be123c` (đáp án A, đồng hồ sắp hết giờ) | 6.29 | Đạt AA |
| Trắng / chàm `#4338ca` (đáp án B) | 7.90 | Đạt AAA |
| Ink `#1f1300` / hổ phách `#f59e0b` (đáp án C) | 8.49 | Đạt AAA |
| Trắng / xanh lá `#15803d` (đáp án D, nút success) | 5.02 | Đạt AA |
| Trắng / xanh biển `#0369a1` (nút info) | 5.93 | Đạt AA |
| Trắng / đỏ `#b91c1c` (nút nguy hiểm) | 6.47 | Đạt AA |
| Chữ/nền badge success, warning, danger, info | 6.49, 6.15, 6.80, 7.15 | Đạt AA |
| text-muted `#666` / canvas, surface, nền portal | 5.13, 5.74, 5.51 | Đạt AA |
| Trắng / hổ phách (KHÔNG dùng) | 1.79 | Không đạt, luôn dùng ink |

## Typography

--font-display: 'Montserrat', 'Be Vietnam Pro', system-ui, sans-serif   /* tiêu đề, nút, số lớn */
--font-sans: 'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif   /* thân bài */
--font-mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Consolas, monospace   /* mã, đồng hồ, điểm */

> Cả ba có bộ ký tự tiếng Việt. Nạp bằng `next/font` (tự host, subsets `latin` + `vietnamese`, `display: swap`), không gọi Google Fonts lúc chạy: ổn định trên mạng trường và không gửi địa chỉ IP học sinh ra ngoài. Kiểm hiển thị đủ dấu (ắ, ể, ữ, ợ, ặ) khi build.

--font-size-xs: 12px         /* chỉ nhãn phụ, không dùng cho nội dung bắt buộc đọc */
--font-size-sm: 14px
--font-size-base: 16px
--font-size-lg: 18px
--font-size-xl: 20px         /* câu hỏi khi làm bài: 20px/800 display */
--font-size-2xl: 24px
--font-size-3xl: 30px
--font-size-score: 44px      /* điểm lớn ở trang kết quả, mono */
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
--font-weight-bold: 700
--font-weight-extrabold: 800
--line-height-body: 1.55
--line-height-tight: 1.2
--num: tabular-nums           /* mọi số liệu, điểm, đồng hồ, mã */

## Spacing (lưới 4px)

--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 16px
--spacing-lg: 24px
--spacing-xl: 32px
--spacing-2xl: 48px

## Border Radius (một hệ góc duy nhất)

--radius-sm: 6px     /* nút, input, badge */
--radius-md: 10px    /* thẻ, ô đáp án, dialog nhỏ */
--radius-lg: 14px    /* thẻ nổi bật, dialog lớn */
--radius-full: 9999px /* đồng hồ, chip, huy hiệu chữ cái đáp án */

## Shadows và độ sâu

--shadow-card: 0 2px 0 rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)
--shadow-lg: 0 16px 40px rgba(6,44,41,0.28)   /* dialog, toast */
--lip-width: 4px             /* viền dưới "nút nổi khối": nút 4px, nút nhỏ 3px, ô đáp án 6px, thẻ KPI 4px */
--lip-pressed: 2px           /* khi nhấn: dịch xuống 2px, lip còn 2px */

## Kích thước tương tác

--control-height-sm: 36px
--control-height-md: 42px
--control-height-lg: 50px
--answer-min-height: 82px
> Chỉ dành cho máy tính có chuột; nút nhỏ 36px chấp nhận được. Ô đáp án, "Bắt đầu làm bài", "Nộp bài" luôn ≥ 50px.

## Motion

--motion-fast: 150ms cubic-bezier(0.2, 0.8, 0.2, 1)
--motion-press: 100ms ease
> Chỉ chuyển trạng thái (hover, nhấn, chọn đáp án, mở dialog, toast). Không animation vòng lặp, không parallax. `prefers-reduced-motion: reduce` tắt mọi transition.

## Bố cục

--layout-min-width: 1024px   /* dưới ngưỡng này hiện thông báo "chỉ hỗ trợ máy tính" */
--layout-sidebar-width: 276px
--layout-content-max: 1380px  /* vùng nội dung admin/giáo viên */
--layout-portal-max: 1140px   /* cổng vào, mặc định; phòng chờ thu hẹp còn 780px */
--layout-result-max: 860px
--layout-exam-max: 1280px
--layout-exam-aside: 310px    /* cột danh sách câu hỏi khi làm bài */
> Prototype có breakpoint 720px và 1024px kiểu mobile. Dự án chỉ hỗ trợ máy tính nên bỏ nhánh 720px; nhánh 1024px thay bằng thông báo.
