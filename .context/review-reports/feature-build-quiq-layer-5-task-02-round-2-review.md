Agent: reviewer

# Review: build-quiq layer-5-task-02 (Tra cứu điểm công khai `/tra-cuu`), round 2

- Worktree: `E:/Quiq/.worktrees/layer-5__task-02` (branch `wt/layer-5__task-02`). Thay đổi chưa commit.
- Round trước: `feature-build-quiq-layer-5-task-02-round-1-review.md` (FAIL vì M1 và m6).

## Review level
STRICT

## Reason
Giữ như round 1. Endpoint công khai không đăng nhập, đọc dữ liệu học sinh, phải chống dò mã, PII, cô lập trường và rate-limit.

## Blast radius
- Không đổi so với round 1: 3 endpoint `/api/lookup*`, `packages/shared/src/lookup/*`, `/tra-cuu` + `features/lookup/*`, 1 link ở `app/page.tsx`.
- Mới so với round 1:
  - File test `rate-limit.test.ts`, `test-fixtures.ts` trong module lookup.
  - `app.ts` **không** đổi (`git status` không có file này).

## Verify commands + result
| Lệnh | Kết quả |
|---|---|
| `pnpm test` | PASS: 41 file, 468 test |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS (`/tra-cuu` static) |

## Kiểm chứng M1 (BLOCKED của builder + quyết định của user)
- File: `node_modules/.pnpm/next@16.4.6_.../next/dist/server/lib/router-utils/proxy-request.js:30-41`.
  - `new ProxyServer({ target, changeOrigin: true, ignorePath: true, ws: true, proxyTimeout, headers: { 'x-forwarded-host': ... } })`.
  - Không có `xfwd: true`, chỉ thêm `x-forwarded-host`. Header của client (kể cả `X-Forwarded-For` tự đặt) được chuyển tiếp nguyên văn.
- Kết luận: bằng chứng của builder đúng. Trong topology này, bật `app.proxy` cho phép client tự đặt IP để né giới hạn, tức là tệ hơn giữ nguyên. Không có fix an toàn trong phạm vi task khi chưa có reverse proxy thật ghi đè XFF.
- Ngưỡng không bị nới: `rate-limit.ts:4-8` vẫn là `LOOKUP_MAX_REQUESTS = 30`, `LOOKUP_WINDOW_MS = 60_000`, `LOOKUP_LIMITER_MAX_KEYS = 10_000`.
- `routes.ts` vẫn tính lượt theo `ctx.ip` trước khi parse body.
- User đã chấp nhận rủi ro. M1 chuyển thành **accepted risk, không chặn PASS**, với điều kiện close-out bắt buộc:
  - (a) Cập nhật dòng G-01 ở `docs/changes/TECHNICAL_REQUIREMENT_GAPS.md` thêm `POST /api/lookup`. Ghi rõ hậu quả: giới hạn 30/phút cho cả site, DoS được, lớp đông dễ gặp 429. Ghi cả lý do không bật `app.proxy`: Next 16.4.6 rewrite không ghi XFF nên client giả mạo được.
  - (b) Chặn deploy production cho tới khi có reverse proxy thật ghi đè `X-Forwarded-For`. Lúc đó mới bật `app.proxy` + `maxIpsCount`.
  - (c) Ghi vào Residual risk của task file.

## Kiểm các fix round 1
| Finding | Kết quả | Bằng chứng |
|---|---|---|
| m2: lỗi tải năm học | FIXED | `use-lookup.ts:54-84`: `useYears` có `status` idle/loading/error/ready, `reload` tăng `attempt`. Kết quả về muộn bị loại nhờ khóa `schoolId#attempt`. `lookup-form.tsx:25-58`: placeholder "Không tải được năm học", lỗi gắn vào Field, nút "Tải lại năm học". Test web `lookup.test.tsx:191`. |
| m3: bảng cũ khi đổi lựa chọn | FIXED | `lookup-page.tsx:93-99` bọc cả 3 onChange bằng `changed()` gọi `lookup.reset()`. `use-lookup.ts:124-128`: reset tăng `latest` nên kết quả đang chờ bị bỏ qua. Test `lookup.test.tsx:211`. |
| m4: hàm > 50 dòng | FIXED | `school-picker.tsx`: `useSchoolCombobox` 17-51 (35 dòng), `SchoolOptions` 63-94, `SchoolPicker` 104-143 (40 dòng). |
| m5: file test > 300 dòng | FIXED | `lookup.test.ts` 202 dòng, `rate-limit.test.ts` 75, `test-fixtures.ts` 85. Không mất case: 13 + 4 test API, đủ các AC của round 1 (nhiều attempt/interrupted, điểm 0 không ghi DB, chưa công bố, 2 năm học, năm của trường khác, body giống hệt, không PII, trường khóa, cô lập, 422, 429 + Retry-After, input sai cũng tính lượt, trần khóa). |
| m6: heading fluid | FIXED | `lookup-page.tsx:58` `text-[clamp(1.5rem,1.2rem+1.5vw,1.875rem)]` (24px ở 375, 30px ở màn rộng). |
| Touch target | FIXED | `lookup-form.tsx:10` `TOUCH_TARGET = "min-h-11"` gắn cho Input mã (`:101`), Select năm (`:46`), nút Tra cứu (`:107`), nút Tải lại (`:55`). SchoolPicker input `min-h-11` (`school-picker.tsx:125`). Option `min-h-11` (`:84`). `RetryError` nút `min-h-11` (`lookup-page.tsx:18`). Test kiểm class `lookup.test.tsx:228`. Comment ghi token `--control-height-md` là 42px nên phải nâng. |
| m1: 400 vs 422 | Để close-out | Giữ 422 là đúng theo quy ước middleware. Close-out sửa câu AC + `docs/API_SPEC.md`. |

Phần cốt lõi bảo mật không đổi so với round 1. Đã soát lại `service.ts` (167 dòng, như cũ) và `routes.ts`.

## Findings

### [CRITICAL]
Không có.

### [MAJOR]
Không có MAJOR còn chặn. M1 đã được user chấp nhận rủi ro, kèm điều kiện close-out (a)-(c) ở trên.

### [MINOR]
- **m1 (còn mở, close-out):** sửa AC "400" thành "422 VALIDATION theo envelope lỗi chung" trong task file. `docs/API_SPEC.md` thêm 3 endpoint (Doc-Impact không được `none`).
- **n1:** khi năm học lỗi tải mà vẫn bấm "Tra cứu", `lookup-page.tsx:105` gửi `academicYearId` undefined nên máy chủ dùng năm hiện tại. Hành vi chấp nhận được và form đã hiện lỗi rõ. Chỉ ghi chú, không cần sửa.

### [NIT]
- Test touch target (`lookup.test.tsx:228`) chỉ kiểm class trong jsdom, không đo layout thật. Chấp nhận.
- Các residual 2, 3, 5, 6 và m7 giữ đánh giá như round 1, ghi vào task file.

## Responsive Checklist Gate
Xác minh bằng CSS math, không có browser.

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Không horizontal scroll ở document | OK | Form `grid-cols-1` dưới `lg`, `minmax(0,…)` từ `lg` (`lookup-form.tsx:88`). Bảng nằm trong wrapper `overflow-auto` (`components/ui/table.tsx:15`). |
| Mobile-first media query | OK | `lg:` là min-width |
| Grid không cố định số cột | OK | `minmax(0, fr)` |
| Container không fixed px | OK | Không thêm |
| Font-size rem | OK | |
| Heading fluid `clamp()` | OK | `lookup-page.tsx:58` |
| Media | N/A | Không có ảnh/video |
| Touch target ≥ 44px | OK | `min-h-11` trên mọi điều khiển, xem bảng fix |
| Nav mobile | N/A | |
| Table scroll wrapper | OK | |
| `100vh` | OK | Không dùng |
| prefers-reduced-motion | N/A | Không thêm animation |
| Không che lỗi bằng overflow:hidden | OK | |

Residual: chưa nhìn thực tế trên browser ở 375/768/1280, nhất là dropdown combobox và nút "Tải lại năm học" ở 375px.

## Skill gates
| Gate | Kết quả |
|---|---|
| aislop | skip, `aislop` not installed (exit 127 ở round 1) |
| oxlint (anti-slop) | skip, oxlint not configured. eslint PASS |
| ocr | skip, ocr not installed |
| AI-readable | OK. 0 indicator: hàm ≤ 50 dòng, file ≤ 300, tên rõ ràng, hằng số có tên (`TOUCH_TARGET`, `YEAR_PLACEHOLDER`) |
| ai-friendly-web | N/A cho task này (việc deploy toàn site) |
| blitzstrike | skip, không có môi trường được phép. Đã review tay |

## Surgical diff
OK. Không đụng `app.ts`, `modules/auth/*` hay module bị cấm. Chỉ có file trong scope.

## Verdict
PASS

Không còn CRITICAL hoặc MAJOR chặn. Responsive gate đạt hết. Verify xanh.

Điều kiện close-out bắt buộc trước commit:
1. Cập nhật G-01 thêm `POST /api/lookup`, ghi hậu quả DoS và lý do không bật `app.proxy` (Next rewrite không ghi XFF). Chặn deploy production tới khi có reverse proxy thật.
2. Sửa câu AC 400 thành 422.
3. `docs/API_SPEC.md` thêm 3 endpoint.
4. Ghi các residual vào task file.
