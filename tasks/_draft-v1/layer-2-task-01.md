# Task 01: Xác thực cán bộ, phiên, guard theo vai trò và trường (api)

## Layer
2

## Type
build

## Description
Nối DB và storage vào api, rồi làm **xác thực cán bộ** (admin tổng, admin trường, giáo viên): đăng nhập bằng username + mật khẩu `scrypt`, phiên token đục lưu hash trong bảng `sessions` + cookie HttpOnly `quiq_session` (trượt 8 giờ, thu hồi được), và **bộ guard** gắn tự động theo metadata route: authenticate -> role -> tenant (schoolId lấy từ phiên, không từ request). Mở rộng harness test để các task sau có sẵn app + DB PGlite + helper đăng nhập.

## Dependencies
- layer-1-task-01 (app, registrar có `guardFactory`, rate-limit, `testing/app.ts`)
- layer-1-task-03 (hợp đồng `@quiq/shared/auth`, mã lỗi, hằng số)
- layer-1-task-04 (`@quiq/db`, bảng `sessions`/`staff_accounts`/`schools`, `password.ts`, fixtures, PGlite)
- layer-1-task-06 (`ObjectStorage`, `createMemoryStorage`)

## Acceptance Criteria
- [ ] `AppDeps` có thêm `db: Database` và `storage: ObjectStorage`; `server.ts` tạo `db` từ `DATABASE_URL_STAGING` (fallback `DATABASE_URL`; pooler thì `prepare: false`) và `storage` từ `createStorageFromEnv`; khởi động báo lỗi rõ ràng nếu thiếu DB; `createTestApp()` trả `{ app, db (PGlite đã migrate), clock (giả), storage (memory), loginAs(account), request }` (L3+ chỉ import, không sửa).
- [ ] `POST /api/auth/login` `{ username, password }` (zod từ `@quiq/shared/auth`): tên đăng nhập không phân biệt hoa thường; sai thông tin trả `INVALID_CREDENTIALS` **cùng một thông điệp** cho "không có tài khoản" và "sai mật khẩu" (vẫn chạy so sánh băm với băm giả để thời gian tương đương); tài khoản `is_active = false` -> `ACCOUNT_DISABLED`; trường bị khóa -> `SCHOOL_LOCKED_LOGIN` (admin trường và giáo viên không đăng nhập được; FR-001); admin tổng không bị ảnh hưởng.
- [ ] **Rate-limit đăng nhập** theo (IP + username) và theo IP: mặc định 5 lần sai/15 phút/(IP+username) và 30 lần/15 phút/IP, trả 429 `LOGIN_RATE_LIMITED` kèm `Retry-After`; đăng nhập đúng không tính vào hạn mức; test bằng đồng hồ giả.
- [ ] Phiên: token ngẫu nhiên 32 byte (base64url), lưu `token_hash = HMAC-SHA256(SESSION_SECRET, token)` (không lưu token thô); cookie `quiq_session` HttpOnly, SameSite=Lax, Path=/, `Secure` khi `NODE_ENV=production`; hết hạn trượt 8 giờ (gia hạn khi dùng, ghi DB tối đa 1 lần/phút); phiên hết hạn/thu hồi -> 401 `SESSION_EXPIRED`.
- [ ] `POST /api/auth/logout` thu hồi phiên và xóa cookie; `GET /api/auth/me` trả đúng `meResponseSchema` (kèm trường + môn cố định của giáo viên). Admin trường/giáo viên có phiên mà trường **bị khóa sau đó** -> request kế tiếp trả `SCHOOL_LOCKED` (phiên vô hiệu ngay, không chờ hết hạn).
- [ ] `createGuardFactory(deps)` (gắn vào `deps.guardFactory`): với `meta.scope === 'public'` không guard; `'platform'` yêu cầu `super_admin`; `'school'` yêu cầu `school_admin` hoặc `teacher` theo `meta.roles` và **bắt buộc có schoolId từ phiên** (admin tổng gọi route `school` -> 403); `'student'` gọi hook `deps.studentAuth` (L5-01 cung cấp; chưa có thì 401). Đặt `ctx.state.auth = { accountId, role, schoolId, subjectId, sessionId }`. Helper `requireSchoolId(ctx)`.
- [ ] **CSRF**: cookie dùng SameSite=Lax; với route ghi (POST/PUT/PATCH/DELETE) có xác thực cookie, từ chối khi `Content-Type` không phải `application/json` (trừ upload multipart ở route khai báo cho phép) hoặc khi có `Origin` khác `Host`; test cả hai.
- [ ] Tiện ích dùng lại cho L3: `revokeAccountSessions(db, accountId)` (đặt lại mật khẩu thì thu hồi mọi phiên của tài khoản), `writeAudit(db, { schoolId, actorAccountId, action, entity, entityId, meta })`, `generatePassword(length = 12)` (dùng `crypto.randomInt`, bỏ ký tự dễ nhầm; L3-01 và L3-02 dùng lại cho "đặt lại mật khẩu").
- [ ] Không có route nào tạo admin tổng (FR-005); không có route đăng ký (BR-012); test đăng nhập admin tổng bằng tài khoản đã seed qua `seedSuperAdmin`.
- [ ] Test PASS (PGlite): đăng nhập đúng/sai/khóa/vô hiệu, rate-limit, phiên trượt + hết hạn, logout, `me` từng vai trò, guard từ chối sai vai trò (403) và thiếu phiên (401), tenant lấy từ phiên (cố truyền `schoolId` trong body/query không có tác dụng), trường bị khóa vô hiệu phiên cũ, CSRF.
- [ ] Mọi route mới khai metadata đầy đủ (`roles`, `scope`, `params`).

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/api/src/core/deps.ts` (thêm `db`, `storage`, `studentAuth?`)
- `apps/api/src/server.ts` (nối db, storage, guardFactory)
- `apps/api/src/app.ts` (gắn guardFactory)
- `apps/api/src/config.ts` (biến DB, SESSION_SECRET)
- `apps/api/src/testing/app.ts` (mở rộng: PGlite, clock giả, storage memory, loginAs)
- `apps/api/src/core/auth/session.ts`
- `apps/api/src/core/auth/guards.ts`
- `apps/api/src/core/auth/csrf.ts`
- `apps/api/src/core/auth/audit.ts`
- `apps/api/src/core/auth/index.ts`
- `apps/api/src/modules/auth/routes.ts`
- `apps/api/src/modules/auth/service.ts`
- `apps/api/src/modules/auth/auth.test.ts`
- `apps/api/src/core/auth/guards.test.ts`
- `apps/api/src/core/auth/session.test.ts`

## Notes
- **Risk:** đỏ (xác thực, phiên, phân quyền, tenant; reviewer STRICT, checklist `skills/security`). Không có migration (dùng bảng đã có ở L1-04; thiếu cột thì ghi "cần change").
- Thứ tự guard theo design: authenticate -> role -> tenant -> (ownership/phân công do từng module) -> handler (zod validate trước handler nghiệp vụ).
- Truy cập chéo trường trả **404** (không 403) ở từng module khi tra theo id; guard chỉ cấp `schoolId` đúng của phiên.
- `SESSION_SECRET` bắt buộc >= 32 byte; thiếu thì api không khởi động ở production.
- L5-01 sẽ cung cấp `deps.studentAuth` và sweeper trong `server.ts`; L2-01 chỉ để chỗ nối (không import code học sinh).
- Lỗi đăng nhập không nêu ô nào sai (design-spec §4.2). Mật khẩu không bao giờ vào log.
- `/api/auth/me` trả `subject` của giáo viên để UI luôn nêu môn cố định trên tiêu đề trang.
