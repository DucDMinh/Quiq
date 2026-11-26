# Task 02: Playwright smoke e2e và kiểm RLS trên Supabase staging

## Layer
8

## Type
build

## Description
Một luồng **smoke e2e** xuyên suốt bằng Playwright trên stack thật (Next build + Koa) với DB PGlite trong tiến trình (không cần mạng): giáo viên ra đề, phát đề, **hai học sinh** vào phòng chờ và làm bài, nộp, giáo viên theo dõi, công bố đáp án + bảng điểm, học sinh tra cứu. Cộng thêm một **kiểm RLS/anon key** chạy trên project Supabase staging **nếu có** (thiếu thì ghi Blocked).

## Dependencies
- layer-7-task-01, layer-7-task-02, layer-7-task-03, layer-7-task-04, layer-7-task-05 (UI và API toàn luồng)
- layer-6-task-01, layer-6-task-02, layer-6-task-03
- layer-3-task-01 đến layer-3-task-06, layer-4-task-01 (dữ liệu nguồn)
- layer-1-task-04 (migration, `@quiq/db/testing`, role Supabase cho kiểm RLS)
- layer-0-task-01 (`@playwright/test`, script `e2e`)

## Acceptance Criteria
- [ ] `e2e/playwright.config.ts`: một worker, không chạy song song; `webServer` khởi động (1) API e2e (`e2e/helpers/start-api.ts`: dựng Koa bằng `createApp` với PGlite đã migrate + dữ liệu seed trong bộ nhớ, storage memory, cổng riêng) và (2) Next production (`next build` + `next start`, `API_ORIGIN` trỏ tới API e2e); trace/screenshot khi lỗi; chạy bằng `pnpm e2e`.
- [ ] Seed (`e2e/helpers/seed.ts`) dùng fixtures của `@quiq/db`: 1 trường, môn, năm hiện tại, lớp 10A, giáo viên (phân công lớp), 2 học sinh ghi danh, 6 câu hỏi (đủ mức dễ/TB/khó, có một câu nhiều đáp án và một câu có ảnh), quy chế mặc định 3/2/60.
- [ ] **Luồng smoke** (`e2e/smoke.spec.ts`), mỗi bước có kiểm tra đầu ra hiển thị: (1) giáo viên đăng nhập `/dang-nhap`; (2) tạo bài thi (cấu hình rút theo mức, gán lớp 10A) và lấy mã + link; (3) học sinh 1 và học sinh 2 (hai browser context) vào bằng mã bài thi + mã học sinh, đều thấy "Đang chờ giáo viên phát đề"; (4) màn Phòng thi của giáo viên hiện **2 học sinh "Đang chờ" cập nhật trực tiếp qua SSE** (không tải lại); (5) giáo viên "Phát đề" (qua dialog); (6) hai học sinh bấm "Bắt đầu làm bài" (toàn màn hình), làm bài, thứ tự câu/đáp án **khác nhau** giữa hai học sinh, chọn đáp án, nộp (một học sinh nộp thủ công, một để hệ thống chấm khi thu bài hoặc nộp); (7) giáo viên thấy "Đã nộp"; (8) trang kết quả học sinh hiện **điểm đúng với đáp án đã chọn** (2 chữ số) và "Xem đáp án" báo "Giáo viên chưa công bố đáp án"; (9) giáo viên "Công bố đáp án" rồi học sinh xem được đáp án đúng (không hiện câu đã chọn); (10) giáo viên "Công bố bảng điểm"; (11) học sinh mở `/tra-cuu`, chọn trường, nhập mã, thấy đúng điểm chính thức, **không có thông tin cá nhân**.
- [ ] **Kịch bản đẩy máy** (`e2e/takeover.spec.ts`): học sinh vào ở context A, vào lại bằng cùng mã ở context B (không có cookie); context A hiện màn "Mã của bạn vừa được dùng ở thiết bị khác" trong <= 10 giây (một nhịp heartbeat + dung sai), context B vào phòng chờ được.
- [ ] **Kịch bản vi phạm** (`e2e/violation.spec.ts`): học sinh làm bài, mô phỏng rời tab (đổi `document.visibilityState` qua `page.evaluate`/sự kiện) -> thấy dialog cảnh báo "n/M"; vượt ngưỡng -> bài tự nộp và sang trang kết quả (lý do "Vi phạm quy chế").
- [ ] Mọi test ổn định (không dùng `waitForTimeout` dài; chờ theo điều kiện); chạy sạch hai lần liên tiếp; không phụ thuộc thứ tự test.
- [ ] **Kiểm RLS/anon key** (`e2e/rls-staging.spec.ts`, chạy chỉ khi có `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL_STAGING` trong `.env.local`): dùng anon key gọi REST của Supabase (`/rest/v1/<bảng>`) cho **mọi bảng nghiệp vụ** và khẳng định trả rỗng/401/403 (không đọc, không ghi được); đối chiếu danh sách bảng với schema để không sót bảng mới. Thiếu biến -> test `skip` có lý do và ghi **Blocked** trong báo cáo, không giả lập thành công. Không bao giờ chạy trên prod, không ghi dữ liệu vào staging.
- [ ] `e2e/README.md`: cách chạy (`pnpm e2e`), biến cần cho phần staging, cách xem trace, lưu ý không chạy song song.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `e2e/playwright.config.ts`
- `e2e/helpers/start-api.ts`
- `e2e/helpers/seed.ts`
- `e2e/helpers/pages.ts`
- `e2e/smoke.spec.ts`
- `e2e/takeover.spec.ts`
- `e2e/violation.spec.ts`
- `e2e/rls-staging.spec.ts`
- `e2e/README.md`

## Notes
- **Risk:** đỏ về luồng thi toàn diện (reviewer STRICT cho độ ổn định và độ phủ luồng; kiểm UI chạm tay tất cả màn chính).
- Script `e2e` ở `package.json` gốc do L0-01 khai (`playwright test -c e2e/playwright.config.ts`); task này không sửa manifest. Trình duyệt Playwright cần `pnpm exec playwright install chromium` một lần (ghi trong README).
- Nếu SSE không chạy qua `next start` theo spike L1-02, bước (4) dùng phương án đã chọn ở `docs/specs/2026-11-25-sse-spike.md`.
- Toàn màn hình trong Playwright: dùng cờ khởi chạy Chromium hoặc cấp quyền trong context; ghi cách làm trong README.
- Đồng hồ thật được dùng (không giả); để không chờ lâu, seed bài thi với thời gian ngắn hợp lý (vd 5 phút) và nộp thủ công.
- Task này không viết test cô lập chéo trường (đã có L8-01) và không sửa mã ứng dụng; lỗi phát hiện ghi báo cáo và đề xuất `/change`.
