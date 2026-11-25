# Task 01: Cơ sở dữ liệu nền (Drizzle schema cho demo, migration đầu, kết nối Supabase, seed dữ liệu mẫu)

## Layer
1

## Type
build (initial)

## Description
`packages/db`: schema Drizzle cho **mọi bảng mà demo cần** (không phải toàn bộ hệ thống), một migration đầu versioned, client kết nối Postgres của Supabase, harness test PGlite, và script seed dữ liệu mẫu để Layer 2 và 3 chạy được ngay trên web.

Bảng nền (mỗi bảng nghiệp vụ có `school_id`; khóa duy nhất `(school_id, student_code)`; `exam_code` duy nhất toàn hệ thống):
- Tổ chức: `schools` (có `status`, `max_attempts` mặc định 3, `warn_limit` mặc định 2, `interrupt_secs` mặc định 60), `staff_accounts` (role: super_admin | school_admin | teacher; `school_id` null với super_admin; `subject_id` cố định cho teacher; password hash), `sessions` (cán bộ: token hash, hết hạn trượt 8 giờ, thu hồi được).
- Trường: `subjects`, `academic_years`, `classes` (thuộc năm học), `students` (cột thông tin cá nhân nullable, `anonymized_at`, `code_voided`), `enrollments` (học sinh-lớp), `assignments` (giáo viên-lớp).
- Ngân hàng: `questions` (teacher, subject, difficulty easy|medium|hard, `multi_select`), `question_options` (`is_correct`).
- Bài thi: `exams` (code, teacher, subject, duration_minutes, draw_config jsonb), `exam_questions` + `exam_options` (**bản sao nội dung**, có `is_correct`), `exam_classes` (status draft|dispatched|closed; `dispatched_at`, `closed_at`; snapshot `max_attempts_snap`, `warn_limit_snap`, `interrupt_secs_snap`; `answers_published_at`, `scores_published_at` để trống cho layer sau).
- Làm bài: `student_sessions` (token hash, student, exam_class, revoked_at), `waiting_presence` (exam_class, student, last_seen), `attempts` (exam_class, student, attempt_no, status waiting|in_progress|submitted|interrupted, started_at, ends_at, last_heartbeat_at, submitted_at, end_reason, score, question_order jsonb, option_orders jsonb), `attempt_answers` (attempt, exam_question, selected option ids).
- Chỉ mục duy nhất từng phần: mỗi học sinh tối đa **một** attempt `in_progress` (BR-004).
- RLS bật trên mọi bảng, không policy cho `anon`/`authenticated` (bọc kiểm tra role tồn tại để chạy được trên PGlite).

Các tính năng sau thêm bảng/cột bằng **migration riêng của chúng** (violation_logs, takeover_logs, media, ...), không đụng migration đầu.

## Dependencies
- layer-0-task-01 (khung monorepo, manifest và dependency đã cài)

## Acceptance Criteria
- [ ] `pnpm --filter @quiq/db db:generate` sinh `migrations/0000_*.sql`; `db:migrate` áp dụng được vào **Supabase staging** bằng `DATABASE_URL_STAGING` (nếu biến chưa có: ghi Blocked rõ ràng, phần còn lại vẫn xong bằng PGlite).
- [ ] Client chọn chuỗi kết nối theo `DATABASE_URL_STAGING` (hoặc `DATABASE_URL`); có tùy chọn `prepare: false` khi dùng pooler transaction-mode; có hướng dẫn trong `docs/SUPABASE_SETUP.md`: direct host có thể chỉ IPv6, mạng nhà IPv4 nên dùng Session pooler; không ghi khóa thật vào repo.
- [ ] Ràng buộc: `UNIQUE(school_id, code)` trên học sinh, `UNIQUE(code)` trên exams, chỉ mục từng phần một `in_progress` mỗi học sinh; test chứng minh vi phạm bị DB từ chối.
- [ ] Test PGlite áp dụng đúng migration thật (không schema push); harness xuất `createTestDb()` dùng được từ `@quiq/db/testing`.
- [ ] `hashPassword/verifyPassword` bằng `scrypt` của `node:crypto` (có salt, so sánh hằng thời gian) xuất từ `@quiq/db/security`; có test.
- [ ] Seed `pnpm --filter @quiq/db db:seed:demo`: 1 trường "Trường THPT Demo", 1 super_admin, 1 school_admin, 1 giáo viên Toán (`gv.toan`), năm học hiện tại, lớp `10A1` có 5 học sinh (`HS001` đến `HS005`), assignment giáo viên-lớp, 30 câu hỏi (dễ/TB/khó, có câu nhiều đáp án đúng), và **1 bài thi mẫu mã `DEMO01`** (10 câu, 15 phút) đã ở trạng thái `dispatched` cho lớp 10A1. Chạy lại không nhân đôi dữ liệu; có `--reset-attempts` xóa bài làm để thử lại. Mật khẩu dev in ra console, không hardcode vào log chạy production.
- [ ] Seed **từ chối chạy** khi `NODE_ENV=production` hoặc khi chuỗi kết nối trùng `DATABASE_URL_PROD`.
- [ ] Migration không có thao tác phá hoại (`DROP`, đổi kiểu, `SET NOT NULL` trên dữ liệu cũ): ghi rõ **không** `HIGH_RISK_MIGRATION` (migration đầu, chỉ `CREATE`).

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/db/drizzle.config.ts`, `packages/db/src/index.ts`, `packages/db/src/client.ts`
- `packages/db/src/schema/org.ts`, `packages/db/src/schema/people.ts`, `packages/db/src/schema/bank.ts`, `packages/db/src/schema/exam.ts`, `packages/db/src/schema/attempt.ts`, `packages/db/src/schema/index.ts`
- `packages/db/migrations/` (0000 do drizzle-kit sinh, kèm `meta/`)
- `packages/db/src/testing.ts`, `packages/db/src/security/password.ts`, `packages/db/src/security/password.test.ts`, `packages/db/src/schema.test.ts`
- `packages/db/src/seed/demo.ts`, `packages/db/src/seed/run.ts`, `packages/db/src/seed/superadmin.ts`
- `packages/db/package.json` (chỉ thêm script/exports, không thêm dependency), `docs/SUPABASE_SETUP.md`

## Notes
- **Tiền đề người dùng:** project Supabase staging và `DATABASE_URL_STAGING` + `SESSION_SECRET` trong `.env.local` (xem `_layer-plan.md`). Chưa cần `SUPABASE_URL` hay khóa service-role (chỉ dùng khi làm ảnh).
- Đọc trước: `docs/specs/2026-11-25-quiq-design.md` (bảng thực thể, state machine), `SPECIFICATIONS.md` § Clarifications.
- Cột snapshot nằm ở `exam_classes` để feature "quy chế trường" sau này chỉ cần điền, không cần migration phá hoại. Demo cho phép **một lần làm** mỗi học sinh dù cột có giá trị 3 (làm lại là feature sau).
- Học sinh xóa dữ liệu cá nhân (feature sau): cột PII nullable ngay từ đầu để khỏi migration đổi ràng buộc.
- Quy ước cho mọi task sau: **ai cần cột/bảng mới thì viết migration mới trong chính task đó**, không sửa 0000. Vì feature làm tuần tự nên không xung đột journal drizzle.
- Reviewer: STRICT (DB/schema/migration, ràng buộc isolation). Risk đỏ.
