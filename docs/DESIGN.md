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

## Current state (as-built, sau Layer 5, 2026-11-27)

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
- Chỉ desktop (`MinWidthGuard` ở root layout), trừ `/tra-cuu` (`MIN_WIDTH_EXEMPT_PATHS`).

### Theo dõi trực tiếp (Layer 4)
- **SSE hub trong tiến trình** (`apps/api/src/realtime/hub.ts`, gắn qua `deps.realtime?`): `publish(examClassId)` chỉ báo "lớp đổi", không mang dữ liệu. Điểm phát tín hiệu, **luôn sau commit**: presence phòng chờ mới/quay lại (`touchPresence`), Bắt đầu, `finalizeAttempt` (nộp, hết giờ, thu bài), phát đề, thu bài.
- Stream (`modules/class-control/stream.ts`) nhận tín hiệu thì kiểm lại phiên giáo viên rồi tính lại `getRoster` (một nguồn sự thật với `GET roster`) và đẩy `event: roster`; nhịp ~10 giây để presence hết hạn. Dọn listener + interval + timer gộp khi client ngắt, server lỗi, phiên hỏng hoặc đệm > 1 MB.
- Web (`features/class-control/use-roster.ts`): `EventSource` → huy hiệu "Trực tiếp"; watchdog 5 giây (chưa có ảnh chụp đầu) / 25 giây (im lặng) hoặc lỗi → polling 3 giây, huy hiệu "Đang kết nối lại", thử lại SSE sau 10 giây; chỉ một nguồn dữ liệu tại một thời điểm.
- Phiên hỏng khi đang theo dõi: server đóng luồng → client polling → `GET roster` 401 → dialog hết phiên; 403 `SCHOOL_LOCKED` → Alert lỗi, bảng giữ ảnh chụp cuối.
- Giới hạn: hub một tiến trình (G-15), chưa giới hạn số kết nối SSE (G-16); học sinh vẫn polling `state` 3 giây (SSE chỉ cho giáo viên).
- `GET roster` không còn chỉ đọc: kiểm hết giờ lười cho bài quá `ends_at + 3s` (G-12).

### Công bố và tra cứu điểm (Layer 5)
- Hai thao tác riêng theo lớp (BR-010), **chỉ sau thu bài**, một chiều, idempotent: `publish-answers` / `publish-scores` (`modules/class-control/service.ts`). Công bố đáp án còn cần **mọi lớp của bài** đã thu bài và không còn attempt đang làm: một transaction khóa mọi hàng `exam_classes` của bài theo `ORDER BY id` rồi mới ghi, nên không chen với phát đề/thu bài/Bắt đầu của lớp khác.
- Học sinh xem đáp án chỉ từ trang kết quả (`GET /student/attempts/:id/answers`, `modules/attempts/answers.ts`): kiểm attempt đã hoàn thành, lớp đã công bố và mọi lớp của bài đã xong **trước** khi đọc `is_correct` (bộ đọc riêng, `loadPaperQuestions` không đổi); không trả lựa chọn của học sinh. Web gọi API mỗi lần bấm "Xem đáp án".
- Tra cứu công khai `/tra-cuu` (`modules/lookup`, `features/lookup`): không đăng nhập, chỉ bài đã công bố bảng điểm, điểm cao nhất, không làm bài = 0 (tính lúc trả), không PII, mã sai/vô hiệu trả như "chưa có bài"; rate-limit theo IP thực chất toàn cục (G-01, chặn deploy production).
