# Task 04: Database (Drizzle schema đầy đủ, migration đầu, PGlite harness, seed admin tổng)

## Layer
1

## Type
build

## Description
Task **duy nhất** sở hữu schema và migration của cả dự án (`HIGH_RISK_MIGRATION`: không, chỉ CREATE). Dựng package `@quiq/db`: schema Drizzle cho **toàn bộ thực thể** theo design doc, migration versioned đầu tiên, RLS bật không policy, ràng buộc tầng DB (mã duy nhất, một attempt `in_progress` mỗi học sinh, một phiên học sinh hoạt động mỗi mã, toàn vẹn tham chiếu cùng trường), harness **PGlite** chạy đúng migration thật cho test, bộ fixture dựng dữ liệu cho mọi test sau, tiện ích băm mật khẩu `scrypt`, script `seed:superadmin` (FR-005) và hướng dẫn kết nối Supabase.

Quy ước chống xung đột: **không task nào khác sửa schema/migration**. Cần cột/bảng mới thì ghi "cần change" vào task đó và dừng. Vì vậy phần liệt kê cột dưới đây phải đủ cho mọi FR.

## Dependencies
- layer-0-task-01 (manifest `@quiq/db` với drizzle-orm, postgres, @electric-sql/pglite, drizzle-kit, tsx)

## Acceptance Criteria
- [ ] Khóa chính `uuid` (`gen_random_uuid()`), thời gian `timestamptz`; mọi bảng nghiệp vụ có `school_id` (trừ `schools`, `sessions` của admin tổng, `audit_log` có thể null). Bảng và cột tối thiểu:
  - Hệ thống: `schools(name, code unique không phân biệt hoa thường, status active|locked, max_attempts default 3 >=1, warn_limit default 2 >=0, interrupt_secs default 60 và >= 10, created_at, locked_at)`; `staff_accounts(role, school_id null, username unique toàn hệ thống không phân biệt hoa thường, password_hash, full_name, subject_id null, is_active, created_at, password_changed_at)` với CHECK: `super_admin` thì `school_id` null, vai trò khác thì bắt buộc có `school_id`; `teacher` thì bắt buộc `subject_id`, vai trò khác thì null; `sessions(token_hash unique, account_id, role, school_id null, created_at, last_seen_at, expires_at, revoked_at)`; `audit_log(school_id null, actor_account_id null, action, entity, entity_id, meta jsonb, created_at)`.
  - Trường: `subjects(unique (school_id, lower(name)))`; `academic_years(name, start_year, is_current; unique (school_id, name); chỉ một is_current mỗi trường qua partial unique)`; `classes(year_id, name; unique (year_id, lower(name)))`; `students(student_code unique (school_id, lower(student_code)), full_name/date_of_birth/hometown/address/guardian_name/guardian_phone đều nullable, anonymized_at, code_voided default false, anon_ref uuid default gen_random_uuid(), created_at, updated_at)`; `enrollments(student_id, class_id, year_id, unique (student_id, year_id))`; `assignments(teacher_id, class_id, year_id, unique (teacher_id, class_id))`.
  - Ngân hàng: `questions(teacher_id, subject_id, content, difficulty, multi_answer, media_id null, created_at, updated_at)`; `question_options(question_id, position 0..3 unique theo câu, content, is_correct)`; `media(owner_teacher_id, storage_path unique, mime, size_bytes, alt_text, kind question|exam, created_at)`.
  - Bài thi: `exams(teacher_id, subject_id, year_id, title, code unique toàn hệ thống không phân biệt hoa thường, duration_minutes > 0, draw_config jsonb, total_questions, created_at)`; `exam_questions(exam_id, position, content, difficulty, multi_answer, media_id null, source_question_id null không FK)`; `exam_options(exam_question_id, position, content, is_correct)`; `exam_classes(exam_id, class_id, status default assigned, dispatched_at, closed_at, answers_published_at, scores_published_at, snapshot_max_attempts, snapshot_warn_limit, snapshot_interrupt_secs đều null tới lúc phát đề, unique (exam_id, class_id))`.
  - Làm bài: `student_sessions(token_hash unique, student_id, exam_id, exam_class_id, created_at, last_seen_at, expires_at, revoked_at, revoked_reason null|takeover|left|closed; partial unique (student_id) WHERE revoked_at IS NULL)`; `waiting_presence(exam_class_id, student_id, student_session_id, last_seen_at; unique (exam_class_id, student_id))`; `attempts(exam_id, exam_class_id, student_id, student_session_id null, attempt_no, status, end_reason null, started_at, ends_at, finished_at null, last_heartbeat_at, violation_count default 0, question_order jsonb, option_order jsonb, total_count, correct_count null, score numeric(4,2) null, graded_at null; unique (student_id, exam_id, attempt_no); partial unique (student_id) WHERE status = 'in_progress')`; `attempt_answers(attempt_id, exam_question_id, selected_option_ids uuid[], saved_at; PK (attempt_id, exam_question_id))`; `violation_logs(attempt_id, kind, occurred_at, count_after, caused_auto_submit)`; `takeover_logs(student_id, student_code, exam_id null, old_session_id, new_session_id, interrupted_attempt_id null, occurred_at)`.
- [ ] Chỉ mục phục vụ truy vấn nóng: `attempts(exam_class_id, student_id)`, `attempts(last_heartbeat_at) WHERE status='in_progress'`, `attempts(ends_at) WHERE status='in_progress'`, `waiting_presence(exam_class_id, last_seen_at)`, `enrollments(class_id)`, `assignments(teacher_id)`, `questions(teacher_id, difficulty)`.
- [ ] **Toàn vẹn cùng trường** bằng khóa ngoại ghép `(school_id, id)` (kèm unique `(school_id, id)` ở bảng cha) cho các cặp: `enrollments -> students/classes`, `assignments -> staff_accounts/classes`, `classes -> academic_years`, `questions -> staff_accounts`, `exams -> staff_accounts`, `exam_classes -> exams/classes`, `attempts -> students/exam_classes`. Có test: chèn bản ghi tham chiếu chéo trường bị DB từ chối.
- [ ] Migration `0000_init.sql` sinh bằng drizzle-kit (`--name init`) và `0001_hardening.sql` (custom, `--custom --name hardening`): `ENABLE ROW LEVEL SECURITY` trên **mọi** bảng, không tạo policy; thu hồi quyền của role `anon`/`authenticated` trên mọi bảng/sequence bọc trong khối `DO` kiểm tra role tồn tại (PGlite không có các role này); trigger **chặn UPDATE `subject_id` của giáo viên** sau khi đã gán (BR-017) và chặn đổi `school_id` của các bảng chính. Migration idempotent theo journal, đã commit cả thư mục `drizzle/meta`.
- [ ] `src/client.ts`: `createDb({ url, pooler?: boolean })` dùng `postgres` với `prepare: false` khi `pooler` (hoặc URL chứa `pooler.supabase.com`/cổng 6543), trả về `Database` (kiểu Drizzle `PgDatabase` chung để chạy được trên cả postgres-js và PGlite); `closeDb`. `src/migrate.ts` + script `migrate` (programmatic migrator, KHÔNG dùng `drizzle-kit push/migrate` CLI; hỗ trợ `--check` chỉ kiểm tra kết nối).
- [ ] `src/testing.ts` (`@quiq/db/testing`): `createTestDb()` tạo PGlite in-memory, chạy **đúng các file migration** trong `drizzle/`, trả `{ db, close }`; `src/fixtures.ts` (xuất lại từ testing) có builder: `makeSchool`, `makeStaff(role)`, `makeSubject`, `makeYear`, `makeClass`, `makeStudent`, `enroll`, `assign`, `makeQuestion` (+ options), `makeExam` (kèm exam_questions/options), `assignExamToClass`, `makeAttempt`; mỗi builder nhận override, trả bản ghi đã chèn; hai lần gọi tạo hai trường độc lập (phục vụ test cô lập).
- [ ] `src/password.ts` (`@quiq/db/password`): `hashPassword(plain)` / `verifyPassword(plain, hash)` dùng `scrypt` của `node:crypto` (salt ngẫu nhiên 16 byte, tham số ghi trong chuỗi băm `scrypt$N$r$p$salt$hash`, so sánh `timingSafeEqual`); `needsRehash`.
- [ ] `scripts/seed-superadmin.ts` + script `seed:superadmin`: tạo admin tổng ghi thẳng DB (FR-005), mật khẩu đọc từ biến môi trường `SUPERADMIN_PASSWORD` hoặc nhắc nhập (không nhận qua tham số dòng lệnh), yêu cầu >= 12 ký tự, idempotent (đã tồn tại thì báo, không đổi mật khẩu), có hàm `seedSuperAdmin(db, opts)` để test. **Không có route web nào tạo admin tổng** (ghi lại để L3-01 và L8-01 kiểm).
- [ ] `docs/SUPABASE_SETUP.md`: cách lấy `DATABASE_URL_STAGING` (direct host có thể chỉ IPv6, nếu máy không có IPv6 thì dùng pooler Supavisor; pooler transaction-mode phải tắt prepared statements), biến `.env.local`, tạo bucket, chạy migration lên staging, quy tắc `staging_db` khác `prod_db`, tuyệt đối không `db push`/reset/seed dữ liệu giữa môi trường.
- [ ] Test PASS (PGlite): migration chạy sạch từ trống; mọi bảng có RLS bật (`pg_class.relrowsecurity`); trùng mã học sinh trong cùng trường bị từ chối, khác trường được phép; trùng `exam_code` bị từ chối; hai attempt `in_progress` cùng học sinh bị từ chối; hai phiên học sinh active cùng học sinh bị từ chối; đổi `subject_id` giáo viên bị trigger chặn; CHECK vai trò/trường/môn của `staff_accounts`; FK ghép chéo trường bị chặn; `hashPassword/verifyPassword` đúng và sai; `seedSuperAdmin` idempotent.
- [ ] **Nếu có `DATABASE_URL_STAGING`** trong `.env.local`: chạy `migrate --check` rồi `migrate` lên **staging** và xác nhận bảng + RLS tồn tại, ghi kết quả vào báo cáo. **Nếu không có**: phần này ghi `Blocked` (task vẫn hoàn thành bằng PGlite). Không bao giờ chạy lên môi trường prod.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Migration artifact đã inspect: chỉ CREATE, không DROP/đổi kiểu (không `HIGH_RISK_MIGRATION`); migration + `meta` đã commit
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/db/drizzle.config.ts`
- `packages/db/src/index.ts` (thay stub)
- `packages/db/src/client.ts`
- `packages/db/src/migrate.ts`
- `packages/db/src/password.ts`
- `packages/db/src/testing.ts`
- `packages/db/src/fixtures.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/src/schema/enums.ts`
- `packages/db/src/schema/system.ts`
- `packages/db/src/schema/school.ts`
- `packages/db/src/schema/bank.ts`
- `packages/db/src/schema/exam.ts`
- `packages/db/src/schema/attempt.ts`
- `packages/db/drizzle/0000_init.sql`
- `packages/db/drizzle/0001_hardening.sql`
- `packages/db/drizzle/meta/_journal.json`
- `packages/db/drizzle/meta/0000_snapshot.json`
- `packages/db/drizzle/meta/0001_snapshot.json`
- `packages/db/scripts/seed-superadmin.ts`
- `packages/db/src/schema.test.ts`
- `packages/db/src/constraints.test.ts`
- `packages/db/src/password.test.ts`
- `packages/db/src/seed.test.ts`
- `docs/SUPABASE_SETUP.md`

## Notes
- **Risk:** đỏ (schema/migration, nền tảng cho tenant isolation và BR-004; reviewer STRICT). `HIGH_RISK_MIGRATION`: **không** (chỉ CREATE TABLE/INDEX/TRIGGER, không có dữ liệu cũ).
- Đối chiếu cột với bảng ở đầu AC từng FR: FR-016 (PII nullable + `anonymized_at` + `code_voided`), FR-014/C-04/C-06 (snapshot 3 cột trong `exam_classes`), FR-043 (`takeover_logs.student_code`), FR-045 (`last_heartbeat_at`, `attempt_no`), FR-039 (`exam_options.is_correct` sửa được trên bản sao), BR-018 (`enrollments` giữ lịch sử, mỗi năm một dòng), C-09 (mã vô hiệu không cấp lại nhờ giữ hàng + unique).
- Tên mã học sinh/mã bài thi so sánh không phân biệt hoa thường: ứng dụng chuẩn hóa chữ hoa trước khi lưu, DB vẫn có unique trên `lower(...)` để chặn trùng.
- Đáp án đúng (`is_correct`) chỉ tồn tại ở `question_options`/`exam_options`; không có cột nào khác lưu đáp án đúng cho học sinh.
- PGlite không có role `anon`/`authenticated`/extension Supabase; mọi câu lệnh phụ thuộc chúng phải bọc kiểm tra. Kiểm RLS bằng anon key thật nằm ở L8-02 (staging).
- Kiểu `Database` phải là kiểu cơ sở chung (`PgDatabase<...>`) để module api viết một lần chạy được trên postgres-js (staging) và PGlite (test).
- Chạy migration lên staging cần xác nhận đó là project staging (đọc biến tên `DATABASE_URL_STAGING`), nêu rõ trong báo cáo.
