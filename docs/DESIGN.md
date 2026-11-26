# Design Specification: trang trỏ + current-state

> Nguồn thiết kế (intent) của Quiq nằm ở các file dưới đây; không sao chép nội dung vào đây để tránh lệch.
> Phần **Current state** bên dưới là as-built (cập nhật khi code đổi, kèm pointer code).

| Nội dung | Vị trí |
|---|---|
| Design tokens (màu, chữ, khoảng cách, bo góc, đổ bóng, motion, contrast đã đo) | `skills/react-nodejs/design-tokens.md` |
| Screen specs (mọi màn, trạng thái, tương tác, quy tắc responsive, khác biệt với prototype) | `.context/design-spec.md` |
| Prototype tham chiếu tương tác được | `index.html` (thư mục gốc) |
| Design doc kiến trúc | `docs/specs/2026-11-25-quiq-design.md` |
| Hợp đồng API as-built | `docs/API_SPEC.md` |
| Gap code ↔ intent | `docs/changes/TECHNICAL_REQUIREMENT_GAPS.md` |

## Current state (as-built, sau Layer 3, 2026-11-26)

### API (Koa, `apps/api`)
- `createApp({ deps })` (`src/app.ts`): middleware `errorMiddleware → bodyParser → router`; module loader nạp `src/modules/*/routes.ts`, mỗi module nhận `(router, deps)`.
- `AppDeps` (`src/http/deps.ts`): `db`, `clock` (mọi mốc giờ nghiệp vụ dùng `deps.clock.now()`, không `new Date()`/`Date.now()`), `session?` (`SessionConfig { secret, secureCookie }`, thiếu thì route cán bộ fail closed 500).
- `server.ts` nạp `.env.local`, bắt buộc `SESSION_SECRET` ≥ 32 ký tự (`src/config.ts`), mở pool postgres-js, tắt êm qua `src/shutdown.ts`.
- Test tích hợp: `createTestApp()` (`src/testing/test-app.ts`) dựng PGlite đã migrate + đồng hồ giả.

### Xác thực cán bộ
- Luồng guard `authenticate → requireRole → requireTenant` (`src/http/guards.ts`); `schoolId` chỉ từ phiên; chéo trường 404; trường khóa 403.
- Phiên `quiq_session`: token 32 byte, DB lưu HMAC-SHA256(SESSION_SECRET, token), trượt 8 giờ, thu hồi khi đăng xuất hoặc đăng nhập lại.
- Giới hạn đăng nhập: bộ đếm in-memory, giữ chỗ đồng bộ trước khi so mật khẩu (chống race), dọn theo clock, trần 10.000 khóa (`modules/auth/rate-limit.ts`); hash giả tính sẵn lúc đăng ký route để chống dò tài khoản theo thời gian.

### Học sinh thi
- Phiên `quiq_stu` (`modules/student/student-session.ts`): **hiệu lực** (làm bài) và **chỉ-xem** (sau khi kết thúc: xem state, nộp lại idempotent, xem kết quả). Một học sinh tối đa một phiên hiệu lực (chỉ mục DB).
- **Chưa hỗ trợ đổi máy**: vào thi khi đang có attempt `in_progress` mà không mang phiên hiệu lực của chính mình → 409 `ATTEMPT_IN_PROGRESS` (bản tạm, chờ FR-043; lệch luồng takeover trong design doc, xem gap G-04).
- `finalizeAttempt(deps, attemptId, reason)` (`modules/attempts/finalize.ts`) là **điểm kết thúc duy nhất** (nộp, hết giờ, về sau thu bài/vi phạm): khóa hàng `FOR UPDATE`, chấm bằng engine, ghi `score`, thu hồi phiên học sinh của lớp đó.
- Hết giờ kiểm **lười** theo `ends_at + 3s` khi có request (`expireDueAttempts`); sweeper nền là tính năng sau (Layer 6).
- `is_correct` chỉ dùng để chấm; đề và kết quả trả về không bao giờ chứa đáp án đúng.
- Polling `GET /api/student/state` 3 giây thay cho SSE (Layer 4).
- Phiên chỉ-xem còn cấp cho lớp **đã thu bài**: phiên bị thu hồi bởi lần Thu bài (`revoked_at >= closed_at`) và lần vào lại sau đó chỉ xem được (`phase: closed`), không bao giờ lên quyền làm bài.

### Giáo viên ra đề và điều khiển lớp (sau Layer 3)
- Ngân hàng câu hỏi (`modules/questions`, `/giao-vien/ngan-hang`): câu thuộc riêng giáo viên (lọc trường + chủ trong điều kiện ghi), môn cố định của giáo viên, chưa có ảnh (Layer 15).
- Tạo đề (`modules/exams/create.ts`): rút câu bằng engine và **sao chép** sang `exam_questions/exam_options` trong một transaction, nên sửa/xóa ngân hàng không ảnh hưởng đề đã ra (BR-002).
- Vòng đời lớp (`modules/class-control`): `draft` → Phát đề (`dispatched`, chụp snapshot quy chế trường) → Thu bài (`closed`). Thu bài idempotent: đóng lớp → thu hồi mọi phiên học sinh của lớp (`revoked_at = closed_at`) → `finalizeAttempt(…, "closed")` mọi attempt đang làm; gọi lại để dọn nếu lần trước lỗi giữa chừng (web: "Thu bài lại lớp X").
- **Khóa đồng thời dùng chung:** Bắt đầu (`attempts/start.ts`) và xóa đề (`exams/delete.ts`) khóa hàng `exam_classes FOR UPDATE`; bước đóng lớp là UPDATE có điều kiện trên cùng hàng, nên Bắt đầu và Thu bài không chen nhau.
- Roster giáo viên polling 3 giây, "Đang chờ" = presence ≤ 15 giây (`WAITING_PRESENCE_FRESH_SECONDS`).
- Web giáo viên: `/giao-vien/ngan-hang`, `/giao-vien/bai-thi`, `/giao-vien/phong-thi` (`src/features/questions`, `features/exams`, `features/class-control`).

### Web (Next.js, `apps/web`)
- Gọi API same-origin `/api/*` qua rewrite (`next.config.ts`), `src/lib/api-client.ts` phát sự kiện `quiq:unauthenticated` khi 401.
- Cán bộ: `/dang-nhap`, khung `AppShell` (`src/features/shell/app-shell.tsx`); **`src/features/shell/nav-config.ts` là chỗ duy nhất** để layer sau thêm mục menu; dialog "Phiên đăng nhập đã hết hạn".
- Học sinh: `/thi`, `/thi/[code]`, `/phong-cho`, `/lam-bai`, `/ket-qua` (`src/features/student/`).
- Chỉ desktop (`MinWidthGuard` ở root layout).
