Agent: reviewer

# Review: build-quiq layer-1 task-01, round 1 (Cơ sở dữ liệu nền)

- Worktree: `E:\Quiq\.worktrees\layer-1__task-01` (branch `wt/layer-1__task-01`), thay đổi chưa commit.
- Review level: **STRICT**
- Reason: DB/schema/migration đầu tiên, cô lập dữ liệu theo trường (school_id), băm mật khẩu, chuỗi kết nối bí mật, seed có thao tác ghi/xóa hàng loạt (`--reset-attempts`). Đều là risk đỏ.
- Blast radius: `packages/db` (schema, migrations 0000/0001, client, testing harness, security, seed) là nền cho mọi task Layer 2 đến 3 (`apps/api` đăng nhập cán bộ, luồng học sinh, ngân hàng câu hỏi, tạo/phát/thu đề, roster, tra cứu). Supabase staging DB (migration đã áp dụng theo lời builder). Exports mới `@quiq/db`, `@quiq/db/security`, `@quiq/db/testing`.

## Verify commands + result (tự chạy trong worktree)

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (db, engine, shared, api, web: Done) |
| `pnpm lint` | PASS (`eslint apps packages`, không lỗi) |
| `pnpm test` | PASS: `Test Files 7 passed (7)`, `Tests 67 passed (67)` |
| `pnpm build` | PASS (`next build` apps/web thành công) |
| `db:migrate` / `db:seed*` / `db:generate` | Không chạy (cấm ghi DB thật; `db:generate` có thể ghi file vào worktree của builder nên không chạy) |

- Lời khai builder "db:migrate lên staging OK, 19 bảng, RLS bật, 0 grant cho anon/authenticated": **chưa xác nhận độc lập** (reviewer không chạm DB thật). Bằng chứng gián tiếp: test PGlite áp dụng đúng 2 file migration thật và kiểm 19 bảng RLS bật, 0 policy, 0 quyền cho anon/authenticated sau khi mô phỏng default privileges kiểu Supabase.
- `db:seed:demo` chưa chạy trên Supabase (agent-guard chặn theo AGENTS). Đây là quy định, không phải lỗi builder.
- Lệnh đầu tiên dạng nối `git status && git log && git diff` bị agent-guard chặn (reviewer không được nối lệnh); đã chạy từng lệnh riêng.

## Scope / surgical diff

- File đổi: `packages/db/package.json` (chỉ thêm 4 script + 2 export, không thêm dependency), `packages/db/src/index.ts`, `packages/db/tsconfig.json` (include thêm 2 config, hợp lý để typecheck config), file mới dưới `packages/db/**`, `docs/SUPABASE_SETUP.md`, journal `.context/runs/build-quiq-layer-1-task-01.builder.md` (dispatcher xóa). Không có file ngoài scope khác. Lockfile không đổi. `.env.local` bị git bỏ qua (`!! .env.local` trong `git status --short --ignored`), không đọc nội dung.
- File/cột builder tự thêm, đánh giá: `src/migrate.ts` (OK, cần cho `db:migrate`, dùng chung ssl/prepare), `src/env.ts` (OK, nhỏ), `src/seed/question-bank.ts` (OK, tách dữ liệu khỏi logic), `src/schema/helpers.ts` (OK), `src/seed/demo.test.ts` (OK, cần cho AC seed), `vitest.config.ts` (OK), `exams.title` (OK, UI cần tên đề), `academic_years.starts_on/ends_on/is_current` + partial unique "một năm hiện tại" (OK, cần cho tra cứu theo năm và lớp thuộc năm), `exam_questions.source_question_id` (OK, truy vết; xem nit N3), migration `0001` custom (OK, chỉ REVOKE, có trong `_journal.json`).
- `drizzle.config.ts` không có `dbCredentials` nên drizzle-kit không thể push/migrate nhầm. Tốt.

## Đối chiếu Acceptance Criteria

| AC | Kết quả | Bằng chứng |
|---|---|---|
| db:generate sinh 0000; db:migrate staging | OK (migrate staging: lời khai, chưa xác nhận) | `migrations/0000_init.sql`, `meta/_journal.json` 2 entry; `src/migrate.ts` dùng `drizzle-orm/postgres-js/migrator` |
| Client chọn URL STAGING rồi DATABASE_URL; prepare:false cổng 6543; tài liệu IPv6/Session pooler; không khóa thật | OK | `client.ts:35-52`, `SUPABASE_SETUP.md` §2; grep `sb_secret_`, `sb_publishable_`, project ref, JWT `eyJhbGci`, `postgres://user:pass@` trong file mới: 0 kết quả (chuỗi trong test chỉ là `pw` giả) |
| UNIQUE(school_id, code) học sinh, UNIQUE(code) exams, partial in_progress; test vi phạm thật | OK | `0000_init.sql:113,208,317`; `schema.test.ts:122-188` kiểm SQLSTATE 23505 |
| PGlite áp dụng migration thật, `createTestDb()` từ `@quiq/db/testing` | OK | `testing.ts:28-40` gọi `migrate()` trên `MIGRATIONS_FOLDER`; export `./testing` |
| hashPassword/verifyPassword scrypt, salt, hằng thời gian, `@quiq/db/security`, có test | OK (xem m1) | `security/password.ts`: N=16384, r=8, p=1, salt 16 byte `randomBytes`, khóa 64 byte, `timingSafeEqual`, trần N≤2^17, r≤16, p≤4 |
| Seed đủ dữ liệu, idempotent, `--reset-attempts`, mật khẩu dev in console | OK | `seed/demo.ts`, `demo.test.ts:54-208` |
| Seed từ chối NODE_ENV=production / trùng DATABASE_URL_PROD | OK (xem m2) | `demo.ts:51-76`, kiểm trước khi mở kết nối `run.ts:9-13`; test `demo.test.ts:210-236`; `.env.local.example:74` có dòng `DATABASE_URL_PROD` (comment) |
| Không HIGH_RISK_MIGRATION | OK | Đọc từng dòng: 0000 chỉ `CREATE TABLE`, `ENABLE ROW LEVEL SECURITY`, `ADD CONSTRAINT` (FK trên bảng mới rỗng), `CREATE [UNIQUE] INDEX`. 0001 chỉ `REVOKE` + `ALTER DEFAULT PRIVILEGES ... REVOKE`. Không DROP/ALTER COLUMN/SET NOT NULL/TRUNCATE; test `schema.test.ts:389-397` khóa điều này |
| `superadmin` script | OK | `seed/superadmin.ts`: mật khẩu ≥ 12 ký tự, đọc từ env, không in, không ghi đè (tra `lower(username)`), từ chối nếu username thuộc role khác |

## Đối chiếu bảng thực thể với design doc / task

Đủ 19 bảng: schools (status, max_attempts 3, warn_limit 2, interrupt_secs 60), staff_accounts (+CHECK scope theo role), sessions, subjects, academic_years, classes, students (PII nullable, anonymized_at, code_voided, CHECK anonymized ⇒ voided), enrollments, assignments, questions, question_options, exams, exam_questions, exam_options (bản sao + is_correct), exam_classes (status, dispatched_at, closed_at, 3 snapshot, answers_published_at, scores_published_at), student_sessions, waiting_presence, attempts (đủ cột task liệt kê), attempt_answers.

Không thấy cột/bảng thiếu buộc Layer 2 đến 3 phải SỬA 0000. Những thứ design doc nêu nhưng không thuộc demo scope (`audit_log`, `violation_logs`, `takeover_logs`, media) thêm bằng migration riêng đúng quy ước task.

Lệch so với design doc (chấp nhận):
- `sessions`: design doc dòng 48 mô tả "(hash token, vai trò, user, school)"; schema chỉ có `staff_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at`. Role và school suy ra qua join `staff_accounts`, nên đổi role/khóa tài khoản có hiệu lực ngay, không phải đồng bộ hai nơi. Nếu cần lưu thêm thì là migration thêm cột, không đụng 0000. (nit)
- Tên trạng thái: design §state machine dùng `completed` / `assigned`, task và schema dùng `submitted` / `draft`. Schema theo task file; Layer 3 phải dùng đúng tên trong schema. (nit)

## Migration 0001 trên Supabase thật

- Khối `DO` kiểm `pg_roles` trước khi REVOKE: an toàn trên PGlite (không có role, bỏ qua) và Supabase (role có, chạy). Không có `--> statement-breakpoint` nên migrator gửi nguyên khối, đúng.
- `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon/authenticated` không có `FOR ROLE` nên chỉ áp dụng cho bảng do role đang chạy migration (postgres) tạo sau này. Chỉ thu hồi từ anon/authenticated, không đụng quyền `postgres` hay `service_role`. Không thấy rủi ro làm hỏng quyền máy chủ. Default privileges cho sequence/function của anon không bị thu hồi; hiện chưa tạo sequence/function nên chưa ảnh hưởng.
- RLS bật trên cả 19 bảng (đếm từng `ENABLE ROW LEVEL SECURITY`), 0 policy.

## Cô lập trường ở tầng DB

- Mọi bảng nghiệp vụ có `school_id` trừ `sessions` (phiên cán bộ, super_admin không có trường; tenant suy ra qua staff_id, chấp nhận).
- FK phức hợp `(school_id, x_id) -> (school_id, id)` cho: enrollments (student, class), assignments (teacher, class), classes (year), staff_accounts (subject), questions (teacher, subject), question_options, exams (teacher, subject), exam_questions, exam_options, exam_classes (exam, class), attempts (student, exam_class), attempt_answers (attempt, exam_question), student_sessions, waiting_presence. Chặn liên kết chéo trường thật.
- Test chứng minh bằng vi phạm thật (SQLSTATE 23503) cho enrollments, assignments, exam_classes, attempts, staff_accounts.subject (`schema.test.ts:241-289`). Chưa có test cho các bảng còn lại (xem m4).

## Ràng buộc nghiệp vụ / CHECK có chặn luồng hợp lệ?

- `attempts` mặc định `waiting`, chỉ `in_progress` mới bắt buộc started_at/ends_at, chỉ `submitted` mới bắt buộc submitted_at; `interrupted` không ràng buộc. Phòng chờ không cần attempt (`waiting_presence` riêng). Thu bài: exam_classes `closed` cần `closed_at` + dispatched; design không có luồng đóng đề chưa phát. Seed thỏa mọi CHECK (test PASS). Không thấy CHECK quá chặt.
- `student_sessions_one_active_key` (một phiên chưa thu hồi mỗi student_id): student_id là hàng theo trường, nên cùng mã ở hai trường là hai học sinh khác nhau, không xung đột. Với "đổi máy" (C-13) khớp: thu hồi phiên cũ rồi tạo phiên mới; Layer 3 phải revoke TRƯỚC insert trong cùng transaction (index không deferrable). Xem m3 về phiên không có hạn.

## Findings

Không có [CRITICAL] (blocker) hay [MAJOR].

- **m1 [MINOR] (minor)** `packages/db/src/security/password.ts:63-75`: `isPowerOfTwo` chấp nhận `N=1` (`log2(1)=0`), `scrypt` của Node yêu cầu N>1 nên `deriveKey` reject và `verifyPassword` **ném lỗi** thay vì trả `false`, trái docstring dòng 57. Độ dài khóa kỳ vọng (`expected.length`) cũng không có trần. Hash nằm trong DB nên không khai thác được từ ngoài. Fix: yêu cầu `cost >= 2`, giới hạn `expected.length` (vd 32 đến 128), bọc `deriveKey` bằng try/catch trả `false`. Layer 2 nên giới hạn độ dài mật khẩu đầu vào trước khi gọi hàm.
- **m2 [MINOR] (minor)** `packages/db/src/seed/demo.ts:62-76`: hàng rào prod so host+cổng+db+user, nên cùng project prod nhưng đi đường khác (prod khai báo bằng Session pooler `postgres.<ref>@pooler`, chuỗi đang dùng là direct `postgres@db.<ref>.supabase.co`) sẽ lọt. Cần cấu hình sai mới xảy ra, còn có NODE_ENV và agent-guard. Fix gợi ý: so thêm project ref trích từ user `postgres.<ref>` hoặc host `db.<ref>.supabase.co`.
- **m3 [MINOR] (minor, cho Layer 3)** `packages/db/migrations/0000_init.sql:251-260,319`: `student_sessions` không có `expires_at` và unique "một phiên còn hiệu lực" là toàn cục theo học sinh (mọi bài). Phiên của bài tuần trước còn hiệu lực sẽ khiến lần vào bài mới ở máy khác bị coi là "đổi máy" (ghi takeover_logs giả) trừ khi Layer 3 thu hồi phiên khi nộp/thu bài hoặc khi đổi exam_class. Không phải sửa 0000; ghi để task luồng học sinh xử lý.
- **m4 [MINOR] (minor)** `packages/db/src/schema.test.ts:241-289`: test cô lập chỉ phủ 5 FK. Đổi FK của `question_options`, `exam_questions`, `exam_options`, `attempt_answers`, `student_sessions`, `waiting_presence`, `questions.teacher/subject`, `classes.year` về FK đơn sẽ không có test nào bắt. `demo.test.ts:197-207` "không đụng trường khác" chỉ kiểm học sinh trường khác còn, không tạo attempt ở trường khác nên không chứng minh `resetDemoAttempts` giữ attempt của trường khác. Fix: thêm 1 test vi phạm/bảng (dạng bảng tham số) và tạo attempt ở trường khác trong test reset.
- **m5 [MINOR] (minor)** `packages/db/migrations/0000_init.sql:214-222`: `attempt_answers` chỉ ràng `exam_question` cùng trường, không ràng cùng exam với attempt (câu của đề khác cùng trường vẫn nhận). Lỗi toàn vẹn trong trường, không rò chéo trường. Layer 3 phải kiểm ở API (hoặc migration sau thêm ràng buộc).
- **m6 [MINOR] (minor)** `packages/db/migrations/0000_init.sql:113,208`: UNIQUE `exams.code` và `(school_id, students.code)` phân biệt hoa thường (khác `staff_accounts` dùng `lower(username)`). Học sinh gõ mã tay: Layer 2 đến 3 phải chuẩn hóa (upper/trim) khi ghi và tra, nếu không có thể tồn tại cả `demo01` và `DEMO01`.
- **m7 [MINOR] (minor, perf)** `packages/db/migrations/0000_init.sql:313-319`: thiếu index cho cột FK hay tra: `enrollments(class_id)` (roster), `assignments(class_id)`, `exam_classes(class_id)`, `attempts(student_id)` ngoài index từng phần. Dữ liệu demo nhỏ; thêm bằng migration sau khi cần.
- **m8 [MINOR] (minor, code quality)** `packages/db/src/seed/demo.ts`: 329 dòng (> 300) và `ensureDemoExam` (dòng 239-299) khoảng 60 dòng (> 50). Fix: tách phần sao chép câu hỏi sang hàm/file riêng.
- **m9 [MINOR] (minor, security note)** `packages/db/src/seed/demo.ts:33,105` + `docs/SUPABASE_SETUP.md:71-75`: seed tạo `superadmin` với mật khẩu công khai trên DB staging. Theo spec, chỉ dev/staging, deploy đang `skip`: chấp nhận được. Tài liệu nên thêm một câu: không seed lên môi trường truy cập được từ Internet, đổi/xóa tài khoản demo nếu staging được public.

### nit

- N1 `packages/db/src/client.ts:61`: `ssl: "require"` của postgres-js mã hóa nhưng không xác minh chứng chỉ. Chấp nhận cho Supabase pooler.
- N2 `packages/db/src/seed/demo.ts:294`: `dispatchedAt: new Date()` không dùng `options.now` như phần còn lại.
- N3 `packages/db/migrations/0000_init.sql:187`: `exam_questions.source_question_id` không có FK (cố ý để xóa câu gốc không ảnh hưởng đề), nên không chặn trỏ sang câu của trường khác; chỉ dùng truy vết.
- N4 `docs/SUPABASE_SETUP.md:83` ghi "mỗi mức có 2 câu nhiều đáp án đúng"; test chỉ kiểm "có câu nhiều đáp án" và DEMO01 nhất quán, chưa kiểm con số 2/mức.
- N5 `packages/db/src/seed/demo.ts:152-158`: `ensureStaff` tìm theo `username` đúng chữ, unique index dùng `lower()`; nếu staging đã có `SuperAdmin` (tạo bằng `seed:superadmin`) thì seed demo lỗi 23505 thay vì bỏ qua. Không mất dữ liệu (transaction).
- N6 `sessions` lệch mô tả design doc (không lưu role/school), xem mục đối chiếu ở trên.

## Hướng dẫn tự chạy seed (`docs/SUPABASE_SETUP.md`)

Rõ ràng: lệnh, `--reset-attempts`, mật khẩu demo, tài khoản, hàng rào prod, cảnh báo "chỉ dev/staging", không dán chuỗi kết nối. An toàn ở mức chấp nhận được; nên bổ sung theo m9.

## Skill gates

| Gate | Kết quả |
|---|---|
| aislop | skip, `aislop` not installed (exit 127) |
| oxlint (anti-slop) | skip, oxlint not configured (không có `.oxlintrc*`); eslint PASS |
| open-code-review (ocr) | skip, ocr not installed |
| AI-readable | OK: 2 indicator (file > 300 dòng, 1 hàm > 50 dòng), dưới ngưỡng 3. Tên rõ, comment giải thích WHY, có `SUPABASE_SETUP.md` |
| ai-friendly-web | N/A (không public-facing) |
| blitzstrike | skip, không có môi trường được phép (không chạm DB/app thật) |
| Responsive Checklist Gate | N/A: diff không đụng UI |

## Residual risk

- Áp dụng migration trên Supabase staging: lời khai builder, chưa xác nhận độc lập.
- Không chạy `db:generate` để kiểm drift giữa schema TS và `0000_init.sql`; đã đối chiếu tay `schema/attempt.ts` với SQL (khớp), các file schema khác chỉ đối chiếu qua SQL + test.
- `question-bank.ts`, `password.test.ts`, `vitest.config.ts`, `schema/helpers.ts`, các file schema ngoài `attempt.ts` không đọc từng dòng (giới hạn tool STRICT); hành vi được test phủ.

## Verdict

**PASS**: không có blocker/major. 4 lệnh verify PASS (67/67 test). Nên sửa m1, m2, m4, m8 ở task kế hoặc round sau; m3, m5, m6, m7 chuyển cho task Layer 2 đến 3 liên quan.
