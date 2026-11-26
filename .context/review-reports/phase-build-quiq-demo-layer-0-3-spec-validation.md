Agent: spec-validator

# Phase review (bước 5g): build-quiq, demo Layer 0-3 (round 1)

- Chế độ: Phase review (gộp Layer 0, 1, 2, 3 vì 5g đã bị bỏ qua ở cuối Layer 1 và 2)
- Repo: `E:\Quiq`, branch `staging`, HEAD `976e78b`
- Ngày: 2026-11-26
- Verdict: **PASS** (0 Missing, 0 conflict HIGH chưa ghi gap). Phase review: **COMPLETE cho phạm vi demo**, có 6 mục Partial, phần còn thiếu của mỗi mục đã được dời có chủ đích sang layer sau.

## 1. Phạm vi

Nguồn intent:
- `SPECIFICATIONS.md` v1.0.0: FR, BR, C-01..C-13
- `docs/specs/2026-11-25-quiq-design.md`
- `tasks/build-quiq/_layer-plan.md` (§3 các tính năng dời sau, §4 độ phủ)
- AC trong các task file L2-02, L3-01, L3-02

Nguồn as-built (đã đọc):
- `apps/api/src/modules/{student,attempts,exams,class-control,questions,auth}`, `apps/api/src/http/{guards,session-cookie}.ts`
- `packages/engine/src/{grade,attempt-state}.ts`, `packages/db/src/schema/{attempt,exam}.ts`
- `packages/shared/src/{student,exams,questions}`
- Web: `apps/web/src/features/student/{use-exam-attempt.ts,result-view.tsx}`
- `docs/API_SPEC.md`, `docs/ERD.md`, `docs/changes/TECHNICAL_REQUIREMENT_GAPS.md`
- Journal `.context/runs/start-quiq-layer-3-task-02.md`: E2E API thật 30/30 PASS, test 33 file 417/417

Không sửa source, spec hay docs. Chỉ ghi report này.

## 2. Độ phủ FR/BR (các mục `_layer-plan.md` §4 gán cho Layer 0-3)

| FR/BR | Trạng thái | Bằng chứng | Ghi chú |
|---|---|---|---|
| FR-020 tạo câu hỏi, môn của giáo viên | Covered | `questions/service.ts:141-159` (subjectId lấy từ `loadTeacherScope`, :26-34); `questionInputSchema` không nhận subjectId (`shared/questions/schemas.ts:26-40`) | Chưa có ảnh: Deferred L15 (FR-021) |
| FR-022 một hoặc nhiều đáp án đúng | Covered | `shared/questions/schemas.ts:41-49` (≥ 1 đúng; `multiSelect=false` thì đúng 1) | |
| FR-023 mức khó | Covered | `DIFFICULTIES` easy, medium, hard (`schemas.ts:12`) | |
| FR-024 ngân hàng riêng giáo viên | Covered | `ownedBy` = school + teacher (`questions/service.ts:37-41`); giáo viên khác hoặc trường khác trả 404 | Admin trường xem: G-08 → L16 |
| FR-030 rút đề + sao chép + thiếu câu báo lỗi | Covered | `exams/create.ts:122-131` (rút rồi sao chép trong một transaction), `:30-37` (422 `INSUFFICIENT_QUESTIONS` kèm `{difficulty, have, need}`); E2E tạo đề YAH2B8 | |
| FR-031 số phút | Covered | `exams.durationMinutes` + check > 0 (`schema/exam.ts:42,58`); `computeEndsAt` | |
| FR-032 gán lớp, mã duy nhất, link, chặn lớp khác | Covered | `create.ts:21-28` (chỉ lớp trong phân công, năm hiện tại); `exams_code_key` + retry (`create.ts:133-187`); `examLink` | |
| FR-033 phòng chờ + phát đề theo lớp | Covered | `class-control/service.ts:91-122`; `derivePhase` (`student/service.ts:190-203`); E2E "chưa phát đề → 409" | |
| FR-034 thu bài | **Partial** | Đã có: đóng lớp, thu hồi mọi phiên, finalize bài đang làm (`class-control/service.ts:162-184`); E2E finalized=1 | Nhánh "đang gián đoạn → điểm cao nhất" chưa làm (chưa có trạng thái `interrupted`): Deferred L7 |
| FR-035 theo dõi trạng thái | **Partial** | Roster polling 4 trạng thái (`class-control/service.ts:193-279`) | SSE: Deferred L4 (đúng kế hoạch). Xem M-1 |
| FR-036 trộn câu + đáp án, chấm theo gốc | Covered | `shuffleAttempt` khi bắt đầu (`attempts/start.ts:95-108`); chấm theo id exam_options (`finalize.ts:28-85`) | |
| FR-040 vào bằng mã/link + mã học sinh, kiểm trường + lớp | Covered | `student/service.ts:27-74,103-148`; một thông điệp chung `STUDENT_NOT_ALLOWED` (`shared/student/errors.ts:7-10`) | |
| FR-041 đồng hồ giờ máy chủ, hết giờ tự nộp | **Partial** | `ends_at` từ `deps.clock` (`start.ts:94-106`); hết giờ kiểm lười (`finalize.ts:132-141`), dung sai 3 giây | Sweeper nền: Deferred L6. Xem M-1 |
| FR-042 nhảy câu, sửa tới lúc nộp | Covered | Lưu kiểu upsert theo câu (`attempts/service.ts:155-195`) | |
| FR-046 điểm ngay sau khi hoàn thành, kể cả thu bài (C-07) | Covered | `buildResult` cho mọi attempt `submitted` (`attempts/service.ts:202-219`); phiên chỉ-xem sau thu bài (`student-session.ts:168-175`); E2E "kết quả endReason closed" | Ẩn điểm lần gián đoạn: Deferred L7 |
| FR-047 nút Xem đáp án | **Partial** (đúng kế hoạch) | Thông báo "Giáo viên chưa công bố đáp án" hiện ở client, không gọi API (`result-view.tsx:81-84`) | Bản đầy đủ: Deferred L5 |
| FR-050 điểm thang 10, làm tròn 2 chữ số | Covered | `roundScore` làm tròn nửa lên bằng số nguyên (`engine/grade.ts:24-33`); cột `numeric(4,2)` + check 0..10 (`schema/attempt.ts:97,126`) | |
| FR-051 sai không trừ, bỏ trống sai, đúng một phần sai | Covered | `isQuestionCorrect` (`engine/grade.ts:7-17`) | |
| FR-014 snapshot lúc phát đề (C-04, C-06) | **Partial** | Phát đề chụp `max_attempts`, `warn_limit`, `interrupt_secs` (`class-control/service.ts:99-119`); DB check `exam_classes_dispatch_check` | Màn chỉnh thiết lập: Deferred L11 |
| FR-002 tài khoản cán bộ | **Partial** | Mới có đăng nhập (`auth/routes.ts`) | Tạo tài khoản, đặt lại mật khẩu: Deferred L8/L12 |
| BR-012 không tự đăng ký | Covered | Không có route đăng ký nào (`auth/routes.ts:63-76`) | |
| BR-001 bài đã nộp không sửa được | Covered | Lưu đáp án từ chối khi không còn `in_progress` (`attempts/service.ts:175-177`); nộp lại không đổi gì (`finalize.ts:105`) | |
| BR-002 bản sao đề, không xóa đề đã có người thi | Covered | `copyDrawnQuestions` (`create.ts:76-119`), `source_question_id` không có FK (`schema/exam.ts:62-72`); `delete.ts:23-44` trả 409 `EXAM_HAS_ATTEMPTS` | |
| BR-003 mã duy nhất | Covered | `exams_code_key` toàn hệ thống; mã học sinh unique theo trường (theo `docs/ERD.md`, chưa đọc `people.ts`) | |
| BR-006 phát/thu theo lớp | Covered | `class-control/service.ts`; bắt đầu khóa hàng lớp `FOR UPDATE` (`start.ts:64-92`) | |
| BR-007 đồng hồ tính từ lúc bắt đầu | Covered | `startedAt` / `endsAt` (`start.ts:104-106`) | |
| BR-008 thang chấm | Covered | Như FR-050, FR-051 | |
| BR-014 học sinh đúng lớp | Covered | Join `enrollments` ↔ `exam_classes.classId` (`student/service.ts:65-72`) | Xem L-1 |

Tổng các mục §4: **22 Covered, 6 Partial, 0 Missing**. Phần còn thiếu của cả 6 mục Partial đều có layer đích ở `_layer-plan.md` §3.

### Mục ngoài §4 có đụng tới trong demo (kiểm chéo)

| FR/BR | Trạng thái | Bằng chứng / ghi chú |
|---|---|---|
| FR-001 trường bị khóa | Partial / Deferred L12 | Chặn đăng nhập cán bộ (`guards.ts:52`) và chặn vào thi (`student/service.ts:108`). Tạo, khóa trường: L12 |
| FR-043 / BR-004 một mã một bài, đổi máy | Partial / Deferred L7 | DB bảo đảm một `in_progress` mỗi học sinh (`schema/attempt.ts:107`) và một phiên hiệu lực (`:40`). Luồng takeover lệch C-03/C-13, đã ghi ở G-04 |
| BR-005 số lần làm | Partial / Deferred L7 | `canStartAttempt` xét `max_attempts` snapshot (`start.ts:85-92`). Chưa có trạng thái gián đoạn nên thực tế chỉ làm được một lần. Khớp BR-005 ("hoàn thành thì không làm lại"), không mâu thuẫn |
| BR-015 cô lập trường | Covered ở mức code / Deferred L17 (quét tự động) | `staffGuard`, với `requireTenant` chặn admin tổng (`guards.ts:83-105`); mọi truy vấn lọc `schoolId` từ phiên; FK ghép theo `school_id` ở DB. Bài test quét toàn router chưa có (L17) |
| BR-017 môn cố định | Covered | Môn lấy từ `staff_accounts.subjectId` (`exams/service.ts:52-59`, `questions/service.ts:26-34`), không nhận từ client. Xem L-3 |
| NFR / C-11: đáp án chỉ ở máy chủ | Covered | `loadPaperQuestions` không chọn `is_correct` (`attempts/service.ts:58-94`); `AttemptResultView` không có câu đã chọn hay đáp án đúng. `ExamDetailView` có `isCorrect` nhưng chỉ trả cho giáo viên chủ đề |

## 3. Conflicts intent ↔ as-built

**HIGH: 0.**

### MEDIUM (1, chưa có trong gap register)

**M-1. Hết giờ kiểm lười chưa áp dụng cho roster và thu bài.**
- `getRoster` (`class-control/service.ts:235-279`) không gọi `expireDueAttempts`. Học sinh đã quá `ends_at` mà đóng trình duyệt vẫn hiện "Đang làm" trên roster đến khi giáo viên thu bài.
- `finalizeRunningAttempts` (`:124-132`) gán `endReason="closed"` cho cả attempt đã quá hạn. Theo FR-041 đây phải là `timeout`. Lý do sai hiện ở trang kết quả "Lý do kết thúc".
- Điểm không sai, vì không lưu được đáp án sau `ends_at + 3s`.
- Layer-plan §6 đã chấp nhận rủi ro "hết giờ kiểm lười", nhưng chưa nêu hai hệ quả trên.
- Đề xuất: ghi gap mới, đích Layer 6 (sweeper).

### LOW (4)

**L-1. BR-014 / BR-018: ghi danh chưa lọc theo năm học.**
`findEligibleStudent` (`student/service.ts:65-71`) và roster (`class-control/service.ts:241-252`) dựa vào `enrollments` mà không xét năm học. Lớp hiện gắn năm (`classes.academic_year_id`), nên chưa sai trong demo. Cần soát lại khi có lên lớp ở L9.

**L-2. Tên trạng thái attempt lệch design doc.**
Design doc dùng trạng thái `completed`, as-built dùng `submitted` + `end_reason`. `docs/ERD.md` đã ghi đúng as-built. Design doc là intent, không sửa; chỉ cần ghi chú.

**L-3. Hai cách lọc ngân hàng khác nhau.**
Danh sách và KPI câu hỏi lọc theo school + teacher (`questions/service.ts:37-38,79-91`). Rút đề và `bank-counts` lọc thêm `subject_id` (`exams/service.ts:86-104`). Với BR-017 (môn cố định) hai cách cho cùng kết quả. Nếu dữ liệu lệch, ví dụ seed sai môn, thì KPI ngân hàng sẽ khác số câu rút được.

**L-4. FR-047 chưa có API.**
Chỉ có thông báo ở client. Đúng kế hoạch demo; bản thật ở L5 phải kiểm `answers_published_at` phía server.

### Các điểm brief yêu cầu soi, kết quả

- **Takeover/đổi máy (C-03, C-13):** đã có G-04 (a) và (b). Thêm G-07 (race), G-09.
- **Thang điểm, làm tròn:** khớp FR-050, FR-051. Không có conflict.
- **Một lần làm trong demo so với `max_attempts`:** không mâu thuẫn (xem BR-005 ở trên).
- **Đáp án chỉ ở máy chủ:** khớp.
- **BR-015:** khớp ở mức code; còn thiếu bài test quét tự động (L17).
- **BR-002:** khớp.
- **BR-014:** khớp; xem L-1.
- **BR-017:** khớp; xem L-3.

## 4. Lệch docs as-built

| Doc | Chỗ lệch | Mức |
|---|---|---|
| `docs/API_SPEC.md` | Đã soát: endpoint student, attempts, questions, exams, class-control, auth, health; mã lỗi trong `shared/{student,exams}/errors.ts`; cookie `quiq_session` (HMAC, Secure theo `NODE_ENV=production`, `config.ts:39`) và `quiq_stu` (SHA-256, `ctx.secure`). **Khớp code.** Chỉ còn: `POST /student/attempts` trả 409 `EXAM_CLOSED` từ tầng phiên mới được nêu ở đoạn "Quyền phiên", chưa có trong cột lỗi của bảng | LOW |
| `docs/ERD.md` | (a) Header ghi "sau Layer 2". Layer 3 không đổi schema nên nội dung vẫn đúng, nhưng nên ghi "đã soát sau Layer 3". (b) Câu "`exam_questions` ... không trỏ ngược ngân hàng": thực tế có cột `source_question_id` để truy vết, chỉ không có FK (`schema/exam.ts:62-72`). (c) Chưa nêu `answers_published_at` / `scores_published_at` (đã có cột, chưa dùng) | LOW |
| `docs/DESIGN.md` | **Chưa kiểm** (xem Residual) | n/a |

## 5. Đề xuất cho gap register

1. **Thêm G-12 (MINOR, Layer 6):** M-1, roster hiện "Đang làm" sau `ends_at` và thu bài ghi `endReason=closed` cho bài đã quá hạn. Hướng xử lý: gọi kiểm hết giờ trong roster và close, hoặc chờ sweeper; finalize bài quá hạn với lý do `timeout`.
2. **Thêm G-13 (NIT, Layer 9):** L-1, ghi danh ↔ năm học khi có lên lớp.
3. **G-06:** ghi `resolved`, đúng commit 68aa3ce. Phần "TTL vẫn chưa có" nên tách thành gap riêng (MINOR, L17) để không mất dấu.
4. **G-04:** mức MINOR (intent lệch) chấp nhận được cho demo vì đã có đích L7. Nên ghi rõ trong mô tả hậu quả với demo: học sinh mất cookie giữa giờ bị khóa tới khi hết giờ hoặc tới khi giáo viên thu bài.
5. **G-01..G-03, G-05, G-07..G-11:** khớp code đã đọc; mức và đích hợp lý. Không thấy mục nào đã sửa mà vẫn để `open`.

## 6. Gợi ý test-scope (cho spec-publisher, trigger `initial-build`)

Luồng ưu tiên cao (risk high):
1. **Học sinh trọn vẹn:**
   - `POST /api/student/enter` → `GET /api/student/state` (polling) → `POST /api/student/attempts` → `PUT /api/student/attempts/:id/answers` → `POST .../submit` → `GET .../result`
   - Payload đề không có `is_correct`; điểm 2 chữ số; đúng một phần = sai.
2. **Hết giờ (lười):** request sau `ends_at + 3s` tự nộp, trả 409 `ATTEMPT_ENDED`; kết quả `endReason=timeout`.
3. **Từ chối vào thi:**
   - mã học sinh sai, lớp khác hoặc trường khác: cùng 404 `STUDENT_NOT_ALLOWED`
   - trường khóa: 403 `SCHOOL_LOCKED`
   - lớp chưa phát đề: vào được phòng chờ, Bắt đầu trả 409 `EXAM_NOT_DISPATCHED`
   - vào từ máy khác khi đang làm: 409 `ATTEMPT_IN_PROGRESS` (hành vi tạm, G-04)
4. **Giáo viên ra đề:**
   - `GET /api/teacher/exams/classes`, `GET /api/teacher/exams/bank-counts`, `POST /api/teacher/exams` (422 `INSUFFICIENT_QUESTIONS` không tạo hàng nào; 403 `CLASS_NOT_ASSIGNED`), `GET /api/teacher/exams`, `GET /api/teacher/exams/:id`
   - `DELETE /api/teacher/exams/:id` (409 `EXAM_HAS_ATTEMPTS`)
5. **Điều khiển lớp:**
   - `.../dispatch`: snapshot; phát lặp trả 409
   - `.../close`: thu hồi mọi phiên, finalize bài đang làm, gọi lại vẫn 200; học sinh đang làm lưu đáp án nhận 401 rồi sang trang kết quả `endReason=closed`; học sinh ở phòng chờ thấy phase `closed`
   - `.../roster`: 4 trạng thái, `bestScore`
6. **Ngân hàng câu hỏi:**
   - CRUD `/api/teacher/questions[/:id]`, lọc `difficulty`, trang 25 câu
   - validate 1 hoặc 5 đáp án, không có đáp án đúng, nội dung rỗng
   - sửa hoặc xóa câu không đổi đề đã ra (BR-002)
7. **Cô lập và quyền:**
   - giáo viên A sang tài nguyên của giáo viên B hoặc trường khác: 404
   - `super_admin` gọi route giáo viên: 403
   - học sinh A đọc, sửa, nộp attempt của B: 404
8. **Đăng nhập cán bộ:** `POST /api/auth/login` (401 chung, 429 lần thứ 6, 403 trường khóa), `GET /api/auth/me`, `POST /api/auth/logout`.
9. **Health:** `GET /api/health`, `GET /api/health/db`.

UI smoke (desktop): `/thi`, `/thi/[code]`, `/thi/[code]/phong-cho`, `/thi/[code]/lam-bai`, `/thi/[code]/ket-qua`, `/dang-nhap`, `/giao-vien/ngan-hang`, `/giao-vien/bai-thi`, `/giao-vien/phong-thi`.

Ngoài phạm vi test-scope (Deferred): SSE, heartbeat, gián đoạn, đổi máy, vi phạm, công bố, tra cứu, admin, ảnh, Excel.

## 7. Residual risk / chưa kiểm

- **Chưa kiểm:** `docs/DESIGN.md`; schema `people.ts` và `org.ts` (BR-003 mã học sinh unique theo trường lấy theo ERD); các file test cụ thể. Độ phủ test dựa trên journal (417/417, E2E 30/30) và các review report; nội dung từng review report chưa đọc.
- **Chưa kiểm:** UI web ngoài `use-exam-attempt.ts` và `result-view.tsx` (design-spec §4, §5, §9 do reviewer từng task kiểm); `engine/shuffle.ts`.
- **Chưa kiểm:** RLS và quyền `anon` trên Supabase (`0001_lock_down_public_roles.sql`), cần smoke trên staging.
- Dữ liệu E2E còn trên staging (bài YAH2B8) theo journal; nên dọn hoặc ghi chú trước khi bàn giao test.

## 8. Verdict

**PASS.** Theo quy tắc của brief, chỉ FAIL khi có mục Missing trong phạm vi demo hoặc conflict HIGH chưa ghi gap; ở đây không có cả hai.

Kết quả: 22 Covered, 6 Partial (phần còn lại đều đã dời có chủ đích), 0 Missing; conflict 0 HIGH, 1 MEDIUM, 4 LOW; 2 chỗ lệch docs mức LOW.

Hành động đề xuất (không chặn):
- Thêm G-12 và G-13 vào gap register.
- Tách phần TTL còn lại của G-06 thành gap riêng.
- Sửa nhỏ `docs/ERD.md` (header, `source_question_id`) và bổ sung `EXAM_CLOSED` vào bảng lỗi của `POST /student/attempts` trong `docs/API_SPEC.md`.
