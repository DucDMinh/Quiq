Agent: reviewer

# Review: build-quiq layer-2-task-01 (round 2)

Đăng nhập cán bộ, phiên, guard theo vai trò/trường, khung giao diện giáo viên.
Worktree: `E:\Quiq\.worktrees\layer-2__task-01` (branch `wt/layer-2__task-01`, base 98a1590, thay đổi chưa commit).
Round 1 report: `.context/review-reports/feature-build-quiq-layer-2-task-01-round-1-review.md` (FAIL, MAJOR-1).

## Review level
STRICT

## Reason
Task đụng auth, phiên, cookie, rate-limit, RBAC, cô lập tenant (school), guard dùng chung `http/guards.ts`, và điểm nối API dùng chung (`deps.ts`, `test-app.ts`, `config.ts`, `server.ts`).

## Blast radius
- API: `POST /api/auth/login` (thứ tự rate-limit mới, thu hồi phiên cũ khi re-login), `POST /api/auth/logout`, `GET /api/auth/me`.
- `modules/auth/rate-limit.ts` (viết lại: `tryAcquire`/`reset`/`size`), `modules/auth/routes.ts`, `modules/auth/service.ts` (`prepareLoginTiming`).
- Bảng `sessions`: thêm một lần `UPDATE revoked_at` theo hash cookie gửi lên khi login thành công.
- Điểm nối dùng chung: không đổi so với round 1. `git diff --stat` vẫn chỉ 4 file tracked được phép (`config.ts`, `http/deps.ts`, `server.ts`, `testing/test-app.ts`, 61+/4-); còn lại là file mới. Không đụng `app.ts`, `modules/loader.ts`, `http/errors.ts`, `http/middleware.ts`, `packages/db/**`, `package.json`, lockfile.
- `RegisterRoutes` của auth giờ là async; `loader.ts:11,47-48` đã khai báo `void | Promise<void>` và `await` nên hợp đồng tương thích, không sửa loader.

## Verify commands + result (chạy thật trong worktree)
| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (db, engine, shared, api, web) |
| `pnpm lint` | PASS (eslint apps packages, không output lỗi) |
| `pnpm test` | PASS: Test Files 24 passed (24), Tests 328 passed (328), khớp lời builder (321 + 7 mới) |
| `pnpm build` | PASS (Next build: `/dang-nhap`, `/giao-vien` ok) |

## Đóng finding round 1
| Finding | Trạng thái | Bằng chứng |
|---|---|---|
| MAJOR-1 race TOCTOU rate-limit | ĐÓNG | `routes.ts:31-39`: trước `acquireAttemptOrThrow` chỉ có `requireSessionConfig` (đồng bộ), `loginRequestSchema.parse` (đồng bộ), `loginRateLimitKey` (đồng bộ); không có `await` nào. `tryAcquire` (`rate-limit.ts:55-70`) kiểm và tăng `count` trong cùng một lượt đồng bộ, nên N request song song không cùng lọt qua `count < 5`. Lần thứ 6 trả số giây, không tăng thêm, cửa sổ cố định từ lượt đầu. Đúng mật khẩu: `limiter.reset(key)` ở `routes.ts:41`, sau nhánh `invalid`, trước nhánh `school_locked` (mật khẩu đúng nên reset là hợp lý). Test `auth.test.ts:152-160`: 10 request song song → đúng 5×401 + 5×429, rồi mật khẩu đúng vẫn 429. |
| MINOR-1 re-login không thu hồi phiên cũ | ĐÓNG | `routes.ts:44-47`: chỉ chạy sau khi `verifyLogin` trả `ok` và sau kiểm trường khóa; thu hồi theo `hashSessionToken(cookie, secret)` với `revokeSession` (`service.ts:94-99`, `WHERE token_hash = ? AND revoked_at IS NULL`). Chỉ thu hồi đúng phiên của token mà client đang cầm; muốn thu hồi phiên người khác phải có token của họ, tức là đã có quyền phiên đó, nên không mở thêm bề mặt tấn công. Test `auth.test.ts:162-178`: cookie cũ → 401, cookie mới → 200, đúng 1 phiên chưa thu hồi. |
| MINOR-2 dummy hash lười | ĐÓNG | `service.ts:24-30` `prepareLoginTiming()`, gọi `await` lúc đăng ký route (`routes.ts:63-66`); loader `await` register (`loader.ts:47-48`) nên hash có trước request đầu tiên. |
| MINOR-3 map không dọn | ĐÓNG (phần bộ nhớ) | `sweepExpired` theo `deps.clock`, tối đa một lần mỗi 15 phút (`rate-limit.ts:40-44`), không dùng timer; trần `LOGIN_LIMITER_MAX_KEYS=10_000` đuổi khóa cũ nhất (`rate-limit.ts:46-52`). Test `rate-limit.test.ts:33-49`. Đa instance vẫn là residual như round 1. |
| MINOR-4 login CSRF | Không yêu cầu round này | Chuyển residual/gap (dispatcher ghi). |
| R1 IP thật sau proxy | Không yêu cầu round này | Cần `app.proxy` trong `app.ts` (file khóa). Residual/gap. |

## Kiểm từng điểm soi kỹ
1. Race: đóng (xem bảng). Mutation suy luận (không sửa source nên không chạy được): đặt lại thứ tự cũ (kiểm, `await verifyLogin`, rồi mới ghi) thì cả 10 request supertest gửi qua `Promise.all` đều tới handler trong khi lượt đầu còn chờ truy vấn PGlite + scrypt (scrypt chạy async trong threadpool, tốn hàng chục ms), nên gần như chắc chắn cả 10 qua kiểm → 10×401, assert `[401×5, 429×5]` fail. Test bắt được mutation với xác suất cao, nhưng không chứng minh tuyệt đối (xem Residual R5).
2. Lỗi giữa chừng: nếu `verifyLogin` ném (DB lỗi), lượt đã giữ chỗ không được trả lại, tức tính là một lần sai. Hậu quả: tối đa 5 lỗi hạ tầng liên tiếp có thể khóa oan một tài khoản 15 phút; không rò bộ đếm theo hướng có lợi cho kẻ tấn công (fail closed). Mức MINOR-5, không chặn. Nếu `createSession`/`revokeSession`/`loadStaffMe` ném sau khi mật khẩu đúng thì bộ đếm đã reset, không khóa oan.
3. Đuổi khóa khi vượt trần: khóa gồm IP + username, Map giữ thứ tự chèn nên khóa nạn nhân (chèn sớm) bị đuổi khi kẻ tấn công chèn đủ khoảng 10.000 khóa mới trong cùng cửa sổ. Như vậy kẻ tấn công có thể được thêm 5 lượt đoán cho mỗi khoảng 10.000 request (mỗi request vẫn tốn một lần scrypt phía server). Đây là giới hạn bị suy yếu chứ không bị gỡ bỏ: tốc độ đoán thực tế khoảng 5/10.005 request, cộng chi phí tải mà chính đợt spam gây ra. Đánh giá MINOR-6 / residual, không chặn ở phạm vi demo một tiến trình. Hướng cứng hóa: ưu tiên đuổi khóa có `count` thấp hoặc giữ riêng khóa đã chạm ngưỡng, kèm giới hạn theo IP (cần R1).
4. Thu hồi phiên khi re-login: đúng thứ tự (sau mật khẩu đúng và sau kiểm trường khóa), chỉ theo hash cookie gửi lên (xem bảng). Login sai hoặc 429 không chạm phiên cũ.
5. Hồi quy: không thấy. Rò rỉ (không log body, `loadStaffMe` chọn cột tường minh), enumeration (`verifyLogin` vẫn so mật khẩu trước khi xét `isActive`/trường khóa, `service.ts:52-58`; dummy hash vẫn dùng), phiên/cookie, tenant/guard, web không đổi so với round 1; 4 file điểm nối giữ nguyên phạm vi; `createApp`/`createTestApp`/`RegisterRoutes` tương thích; toàn bộ test cũ vẫn PASS (328/328). Test cũ "6 lần tuần tự → 429 kể cả đúng mật khẩu" và "đúng mật khẩu xóa bộ đếm" (`auth.test.ts:129-150,180-188`) vẫn qua với ngữ nghĩa mới.

## Responsive Checklist Gate
Round này không đổi UI (diff chỉ ở `apps/api/src/modules/auth/*`). Kết quả round 1 giữ nguyên: Layout OK, Container OK, Typography OK, Media N/A, Touch target OK, Nav mobile N/A (desktop-only, MinWidthGuard), Table N/A, Viewport OK (`dvh`), Reduced motion OK, overflow OK. Bằng chứng ở report round 1.

## Skill gates
- aislop: skip, không có lệnh `aislop` (round 1: command not found).
- oxlint (anti-slop): skip, oxlint not configured; `pnpm lint` (eslint) PASS.
- ocr (open-code-review): skip, ocr not installed.
- AI-readable: OK. Tên rõ (`tryAcquire`, `acquireAttemptOrThrow`, `prepareLoginTiming`), hàm ngắn (`handleLogin` khoảng 22 dòng), hằng có tên, comment giải thích WHY. File test `auth.test.ts` dài hơn 300 dòng (NIT từ round 1). Dưới ngưỡng 3 indicator.
- ai-friendly-web: N/A (khu vực cán bộ nội bộ).
- blitzstrike: skip, không có môi trường pentest được phép.

## Findings

### [CRITICAL]
Không có.

### [MAJOR]
Không có.

### [MINOR]
- MINOR-5 `apps/api/src/modules/auth/routes.ts:37-40`: lượt đã giữ chỗ không trả lại khi `verifyLogin` ném lỗi hạ tầng, nên 5 lỗi DB liên tiếp khóa oan tài khoản 15 phút. Fail closed, chấp nhận được. Nếu muốn: bọc `verifyLogin` trong try/catch, lỗi không phải `invalid` thì gọi thêm hàm `release(key)` (giảm count) rồi ném lại.
- MINOR-6 `apps/api/src/modules/auth/rate-limit.ts:46-52`: đuổi khóa cũ nhất cho phép reset bộ đếm nạn nhân bằng khoảng 10.000 username rác trong một cửa sổ (5 lượt đoán thêm cho mỗi khoảng 10k request). Ghi vào gap cứng hóa cùng R1: ưu tiên đuổi khóa `count` thấp / không đuổi khóa đã chạm ngưỡng, thêm giới hạn theo IP.

### [NIT]
- `auth.test.ts` dài hơn 300 dòng (từ round 1), có thể tách `auth.session.test.ts`.

## Doc-Impact
KHÔNG phải `none`. Dispatcher cập nhật lúc close-out:
- `docs/API_SPEC.md`: như round 1 (`POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, cookie `quiq_session` HttpOnly/SameSite=Lax/Secure khi production/Max-Age 8h trượt, mã lỗi `INVALID_CREDENTIALS` 401, `SCHOOL_LOCKED` 403, `LOGIN_THROTTLED` 429 + `Retry-After` + `details.retryAfterSeconds`, `UNAUTHENTICATED` 401, `VALIDATION` 422, `FORBIDDEN` 403, `NOT_FOUND` 404 chéo trường). Bổ sung round 2: giới hạn 5 lượt thử chưa thành công / 15 phút theo khóa IP + username (không phân biệt hoa thường), cửa sổ cố định tính từ lượt đầu, lượt thứ 6 trả 429 kể cả đúng mật khẩu, đăng nhập đúng xóa bộ đếm; login thành công khi request kèm cookie phiên cũ thì phiên cũ bị thu hồi.
- `docs/DESIGN.md` (current-state): như round 1 (guard `authenticate → requireRole → requireTenant`, `schoolId` chỉ từ phiên, 404 chéo trường, token đục lưu HMAC-SHA256, fail closed khi thiếu `deps.session`). Bổ sung: rate-limit in-memory một tiến trình, giữ chỗ đồng bộ trước khi kiểm mật khẩu, dọn theo `deps.clock` tối đa 1 lần/cửa sổ, trần 10.000 khóa đuổi khóa cũ nhất; dummy hash tính sẵn lúc đăng ký route.
- Tài liệu môi trường: `SESSION_SECRET` bắt buộc, tối thiểu 32 ký tự.
- Gap register: ghi R1 (proxy/IP), MINOR-4 (login CSRF Origin), MINOR-6 (đuổi khóa), đa instance.

## Residual risk
- R1 (proxy/IP): như round 1, `app.proxy` tắt nên sau rewrite Next khóa thực chất chỉ là username; ai biết username có thể khóa giáo viên 15 phút, lặp lại được. Cần task cứng hóa thuộc chủ `app.ts`.
- R2 login CSRF (MINOR-4 round 1): `/auth/login` không kiểm `Origin`.
- R3 đa instance: bộ đếm theo tiến trình, nhiều instance thì giới hạn nhân lên.
- R4 MINOR-6 đuổi khóa (xem Findings).
- R5 mutation race chỉ suy luận, không chạy được vì reviewer không sửa source; test song song phụ thuộc vào việc 10 request supertest chồng lấn nhau thật (rất có khả năng vì scrypt async + PGlite async).
- R6 không có browser; UI không đổi round này.
- R7 aislop/ocr/blitzstrike không chạy được.

## Verdict
PASS

Lý do: MAJOR-1 đã đóng (giữ chỗ đồng bộ trước mọi `await`, có test song song), MINOR-1/2/3 đã xử lý, không có hồi quy, 4 lệnh verify PASS (328/328 test). Còn MINOR-5/6 và residual R1-R3 để dispatcher ghi gap, không chặn PASS.
