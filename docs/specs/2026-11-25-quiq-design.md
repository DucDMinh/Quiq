# Design: Quiq — hệ thống thi trắc nghiệm trực tuyến nhiều trường

Date: 2026-11-25
Status: Draft → chờ chủ dự án duyệt
Nguồn: `SPECIFICATIONS.md` (v1.0.0, gồm Clarifications C-01…C-13) ← `docs/BRD.md`

## Overview

Web thi trắc nghiệm dùng chung cho nhiều trường. Monorepo pnpm gồm Next.js (giao diện tiếng Việt, chỉ máy tính), Koa.js (API, tự xác thực, tự đo thời gian và gián đoạn), Postgres của Supabase (dữ liệu + ảnh). Trình duyệt chỉ nói chuyện với Koa; đáp án đúng không bao giờ rời máy chủ khi đang thi.

## Problem Statement

Thi giấy tốn công chấm, khó thi từ xa, khó chống gian lận. Cần: ra đề từ ngân hàng riêng của giáo viên, phát đề/thu bài theo lớp, đồng hồ riêng từng học sinh, chống gian lận, chấm tự động thang 10, tra cứu điểm — với dữ liệu mỗi trường tách riêng và dữ liệu cá nhân học sinh được bảo vệ chặt.

## Approaches đã cân nhắc (các quyết định lớn)

| Chủ đề | Đã chọn | Phương án bị loại và lý do |
|---|---|---|
| Nền dữ liệu | Supabase Postgres (C-01) | Firestore + Firebase Storage: Storage nay bắt buộc gói Blaze, trái ràng buộc free-only. Postgres còn cho ràng buộc duy nhất/khóa ở tầng DB (mã theo trường, một bài một lúc). |
| Truy cập dữ liệu | Chỉ qua Koa, khóa service-role ở máy chủ (C-11) | Supabase Auth + RLS từ trình duyệt: lệch BRD (Koa tự xác thực) và khó giữ đáp án ở server. RLS vẫn bật, không policy cho anon/authenticated, làm lớp phòng thủ thêm. |
| ORM/migration | Drizzle + drizzle-kit | Prisma (nặng hơn, cần generate); SQL thuần (thiếu kiểu). |
| Realtime | SSE từ Koa cho giáo viên; heartbeat HTTP 5 giây cho học sinh (C-12) | WebSocket (phức tạp chưa cần); Supabase Realtime (phụ thuộc hạn mức free, vẫn phải tự làm heartbeat). |
| Test | Vitest + PGlite (Postgres in-process) cho unit/integration; Playwright smoke cho luồng thi | Test trên DB Supabase staging: chậm, đụng dữ liệu thật, vướng khi chạy song song nhiều worktree. |
| Phiên | Token ngẫu nhiên đục lưu hash trong DB, cookie HttpOnly | JWT: khó thu hồi tức thì, mà đẩy máy (FR-043) cần thu hồi phiên ngay. |

## Architecture

```
Trình duyệt (Next.js, tiếng Việt, desktop)
      │  same-origin /api/*  (Next rewrite → Koa; cookie HttpOnly)
      ▼
Koa API (apps/api)  ── Drizzle ──►  Postgres (Supabase)   [RLS bật, không policy public]
  ├─ auth / session / rate-limit
  ├─ tenant guard (mọi truy vấn buộc có schoolId)
  ├─ exam engine (draw, shuffle, attempt state machine, chấm điểm)
  ├─ sweeper (setInterval 10s): phát hiện gián đoạn, hết giờ
  ├─ SSE hub (in-process) → màn theo dõi giáo viên
  └─ media proxy  ──────────►  Supabase Storage (bucket riêng tư)
```

- **apps/web** Next.js (App Router, TypeScript). **apps/api** Koa (TypeScript). **packages/shared**: schema zod, kiểu DTO, hằng số (trạng thái, mã lỗi tiếng Việt) dùng chung hai phía.
- Giả định một tiến trình Koa (chạy local, 3–4 người thi). Event bus và sweeper chạy trong tiến trình; nếu sau này scale ngang thì chuyển sang Postgres LISTEN/NOTIFY — ghi nhận, chưa làm (Scalability: off).
- UI: Tailwind làm nền; chủ dự án muốn kết hợp nhiều thư viện (đề xuất: shadcn/Radix cho form/dialog, TanStack Table cho bảng điểm, react-hook-form + zod). Danh sách thư viện cuối cùng chốt ở bước `/design` và ghi vào design tokens.

## Components

### Xác thực và phân quyền
- Admin tổng/admin trường/giáo viên: username + mật khẩu, băm bằng `scrypt` của `node:crypto` (không phụ thuộc thư viện native). Giới hạn đăng nhập sai theo IP + tên đăng nhập. Phiên: bảng `sessions` (hash token, vai trò, user, school), hết hạn trượt 8 giờ, thu hồi được.
- Admin tổng chỉ tạo bằng script `seed:superadmin` ghi thẳng DB (FR-005); không có API tạo.
- Guard theo thứ tự: authenticate → role → **tenant** (schoolId lấy từ phiên, không từ request) → ownership/phân công → handler (zod validate trước).
- Admin tổng chỉ gọi nhóm endpoint quản lý trường/tài khoản admin trường và thống kê bằng truy vấn đếm tổng hợp; không có route nào trả bản ghi dữ liệu riêng của trường (FR-004). Có test chặn ở cấp router.
- Học sinh: không tài khoản. Nhập mã bài thi (hoặc link) rồi mã học sinh → cookie `quiq_stu` (token đục, bảng `student_sessions`).

### Dữ liệu (tóm tắt thực thể — chi tiết ở migration, `docs/ERD.md` sẽ trỏ tới schema)
Mọi bảng nghiệp vụ có `school_id`. Khóa duy nhất: `(school_id, student_code)`; `exam_code` duy nhất toàn hệ thống.

| Nhóm | Bảng |
|---|---|
| Hệ thống | `schools(status, settings: max_attempts, warn_limit, interrupt_secs)`, `staff_accounts(role)`, `sessions`, `audit_log` |
| Trường | `subjects`, `teachers(subject_id cố định)`, `academic_years`, `classes(year_id)`, `students(PII nullable, anonymized_at, code_voided)`, `enrollments(student_id, class_id)`, `assignments(teacher_id, class_id)` |
| Ngân hàng | `questions(teacher_id, subject_id, difficulty)`, `question_options`, `media(owner, storage_path)` |
| Bài thi | `exams(code, teacher_id, duration, draw_config, created)`, `exam_questions` (bản sao), `exam_options` (bản sao, `is_correct`), `exam_classes(status, dispatched_at, closed_at, answers_published_at, scores_published_at, **snapshot** max_attempts/warn_limit/interrupt_secs)` |
| Làm bài | `student_sessions`, `waiting_presence`, `attempts`, `attempt_answers`, `violation_logs`, `takeover_logs` |

- Ràng buộc tầng DB: chỉ một attempt `in_progress` cho mỗi học sinh (chỉ mục duy nhất từng phần) → BR-004 không phụ thuộc code ứng dụng.
- Học sinh bị xóa dữ liệu cá nhân (FR-016): xóa cột PII, giữ hàng và `student_code` với `code_voided = true` → mã không cấp lại (C-09), điểm vẫn gắn mã nội bộ ẩn danh.
- Ảnh: tải lên qua Koa (tối đa 2 MB, jpeg/png/webp, kiểm magic bytes) vào bucket riêng tư. Khi ra đề, **sao chép file** sang đường dẫn của đề để sửa/xóa ngân hàng không làm vỡ đề cũ (BR-002). Trình duyệt xem ảnh qua endpoint proxy của Koa có kiểm quyền, không có URL công khai.

## Data Flow

### Ra đề (FR-030)
Giáo viên cấu hình tổng/dễ/TB/khó → Koa đếm ngân hàng theo mức (thiếu mức nào → lỗi 422 tiếng Việt, không tạo đề) → rút ngẫu nhiên bằng `crypto` trong một transaction → sao chép câu, đáp án, ảnh vào `exam_questions/options` → tạo `exam_code` ngẫu nhiên (bỏ ký tự dễ nhầm) và link `/thi/<mã>`.

### Vòng đời một lớp trong bài thi
`assigned → dispatched (phát đề) → closed (thu bài)`. Phát đề chụp **snapshot** thiết lập của trường vào `exam_classes` (C-04). Công bố đáp án và công bố bảng điểm là hai cột thời gian độc lập, bấm tay.

### Vòng đời một lần làm (state machine)
```
(phòng chờ) ──Bắt đầu──► in_progress ──nộp / hết giờ / vi phạm quá ngưỡng / thu bài──► completed
                              │
                              └─ mất heartbeat > interrupt_secs, hoặc bị đẩy máy ──► interrupted (chấm ngay)
```
- **Bắt đầu**: kiểm lớp đã phát đề và chưa đóng, chưa có attempt `completed`, số attempt < `max_attempts` (đếm cả `interrupted`), không có attempt `in_progress` khác. Tạo attempt: `ends_at = now + duration` (giờ máy chủ), `question_order` và `option_order` ngẫu nhiên riêng, bộ câu giữ nguyên bộ đã rút (FR-045).
- **Heartbeat 5 giây** (kèm câu trả lời chưa lưu): cập nhật `last_heartbeat_at`, trả về trạng thái phiên. Phiên bị thu hồi → trả `kicked` → trình duyệt đăng xuất ngay (FR-043 trong thời gian ≤ 5 giây).
- **Lưu đáp án** mỗi lần chọn (PUT theo câu) để chấm đúng khi gián đoạn hoặc tự nộp.
- **Sweeper 10 giây**: attempt `in_progress` có `now > ends_at` → tự nộp, chấm; có `last_heartbeat_at < now - interrupt_secs` → `interrupted`, chấm, lượt đã tiêu. Khi học sinh vào lại, Koa cũng kiểm lười (lazy) cùng điều kiện.
- Học sinh **không thấy điểm** của attempt `interrupted` (giáo viên thấy). Đẩy máy khi học sinh mới chỉ ở **phòng chờ** (chưa có attempt) thì không tiêu hao lượt nào, chỉ ghi `takeover_logs`.
- **Quay lại trong ngưỡng** (C-13): còn cookie `quiq_stu` và attempt `in_progress` → làm tiếp, không mất lượt, đồng hồ không dừng.
- **Đổi máy** (C-13, C-02, C-03): nhập mã học sinh ở trình duyệt không có token trong khi đang có phiên → tạo phiên mới, thu hồi phiên cũ, attempt cũ → `interrupted` (mất 1 lượt, kể cả lượt cuối), ghi `takeover_logs`; máy mới vào **phòng chờ**, bấm "Bắt đầu làm bài" để làm lần mới.
- **Thu bài** (FR-034): attempt `in_progress` của lớp → `completed` (tự nộp, chấm); attempt `interrupted` giữ điểm cao nhất đã chấm; lớp `closed` không cho Bắt đầu nữa.
- **Vi phạm**: trình duyệt bắt `visibilitychange`/`fullscreenchange` và gửi `POST violation`; Koa tăng bộ đếm của attempt, ghi `violation_logs`, vượt `warn_limit` → tự nộp. Máy chủ là nơi đếm; client chỉ hiển thị cảnh báo.

### Chấm điểm (FR-050/051)
Đúng khi **tập đáp án chọn == tập đáp án đúng** (đúng một phần = sai, bỏ trống = sai). `score = round(đúng / tổng × 10, 2)`. Điểm chính thức = max các attempt đã chấm. **Chấm lại** (FR-039): giáo viên sửa đáp án đúng trên `exam_options` của đề → job chấm lại mọi attempt đã chấm của đề trong một transaction; lựa chọn của học sinh không đổi; điểm đã công bố tự cập nhật vì tra cứu đọc điểm hiện tại.

### Giáo viên theo dõi (FR-035)
SSE `GET /api/teacher/exams/:id/classes/:cid/stream`: gửi ảnh chụp trạng thái khi kết nối, rồi sự kiện khi học sinh vào phòng chờ, bắt đầu, nộp, gián đoạn. Trạng thái dẫn xuất: `chưa làm`, `đang chờ` (presence ≤ 15 giây), `đang làm`, `đã nộp`, kèm cờ `gián đoạn`. Reconnect tự động ở client.

### Tra cứu điểm (FR-064)
`POST /api/lookup {schoolId, studentCode, academicYear}` công khai → chỉ trả điểm chính thức của bài đã công bố bảng điểm, theo môn, không PII. Mã vô hiệu hoặc không tồn tại → cùng một thông báo. Giới hạn tốc độ theo IP và theo trường để chống dò mã hàng loạt. Trường bị khóa vẫn tra cứu được (C-09).

### Nhập học sinh và xuất Excel
- Nhập `.xlsx` bằng `exceljs`: kiểm từng dòng bằng zod, **hoặc cả file hoặc không** (all-or-nothing, báo lỗi theo số dòng; mã trùng trong trường → lỗi). Mẫu file tải được từ giao diện.
- Xuất bảng điểm: điểm chính thức + số lần làm; bảng và Excel năm cũ vẫn hiện họ tên + mã (C-05).

### Màn hình và route (tiếng Việt, desktop ≥ 1024px; nhỏ hơn hiện thông báo "chỉ hỗ trợ máy tính")
`/dang-nhap`, `/admin-tong/*`, `/quan-tri/*` (admin trường), `/giao-vien/*`, `/thi` (nhập mã bài thi), `/thi/[mã]` (nhập mã học sinh), `/thi/[mã]/phong-cho`, `/thi/[mã]/lam-bai`, `/thi/[mã]/ket-qua`, `/tra-cuu`.

## Error Handling

- Response chung `{ success, data | error, details }` qua helper `ok()/fail()`; thông báo lỗi tiếng Việt lấy từ `packages/shared`.
- 401 thiếu/hết phiên; 403 sai vai trò; **truy cập chéo trường trả 404** (không lộ sự tồn tại); 409 trùng mã; 422 thiếu câu để rút đề; 429 giới hạn tốc độ.
- Mất mạng trong lúc thi: client giữ hàng đợi đáp án chưa gửi, gửi lại khi có mạng; quá `interrupt_secs` → gián đoạn (theo spec). Nộp/Lưu sau `ends_at` + 3 giây dung sai bị từ chối, bài đã tự nộp.
- Học sinh bấm "Xem đáp án" khi chưa công bố → lỗi "Giáo viên chưa công bố đáp án", không lộ dữ liệu; đáp án đúng chỉ được trả sau khi `answers_published_at` có giá trị và attempt đã `completed`.
- Hai tab cùng một trình duyệt dùng chung cookie nên là cùng một phiên (không phải đổi máy); cả hai ghi vào cùng một attempt, lần ghi sau thắng. Rời sang tab khác vẫn tính là vi phạm theo FR-044. Trình duyệt hoặc máy khác (không có cookie) mới bị coi là đổi máy theo C-13.
- Sweeper lỗi một lượt không dừng tiến trình; ghi log, lượt sau chạy lại (idempotent theo trạng thái).
- Rủi ro đã được chủ dự án chấp nhận (Assumptions): lộ mã bài thi cho phép đẩy bạn ra; người ngoài lớp biết mã học sinh xem được điểm.

## Testing Strategy

- **Unit (Vitest)**: chấm điểm (đúng/thiếu/thừa/bỏ trống/làm tròn), rút đề theo mức khó (đủ/thiếu), trộn câu và đáp án (hoán vị đúng, ánh xạ về đáp án gốc), máy trạng thái attempt, tính điểm chính thức.
- **Integration (Vitest + PGlite chạy migration thật)**: cô lập trường (người của trường A không đọc được B ở **mọi** route — test tự quét router), admin tổng không có route dữ liệu riêng, phạm vi giáo viên theo lớp/môn/năm, chỉ một attempt `in_progress` mỗi học sinh, đẩy máy + nhật ký, gián đoạn và hết giờ qua sweeper (đồng hồ giả), giới hạn số lần làm, snapshot theo lớp, thu bài, chấm lại, xóa dữ liệu cá nhân (mã không cấp lại), tra cứu chỉ bài đã công bố và không có PII.
- **E2E (Playwright, smoke)**: một luồng đầy đủ — giáo viên ra đề, phát đề, hai học sinh vào phòng chờ và làm bài, nộp, công bố, tra cứu. Chạy trên môi trường local với DB staging riêng, không chạy song song.
- **Bảo mật**: test xác nhận payload làm bài không chứa `is_correct` (PGlite). Việc "anon key không đọc được bảng nào" (RLS) cần vai trò Supabase nên kiểm ở smoke trên project staging, không chạy trên PGlite.
- Lệnh verify thật được điền vào `project-config.md` ở Layer 0 khi scaffold xong.

## Dự kiến chia layer (để `/graph` tinh chỉnh)

| Layer | Nội dung |
|---|---|
| 0 | Scaffold monorepo pnpm, Drizzle + migration nền, helper response/lỗi, auth + session + tenant guard, seed admin tổng, lệnh verify, test harness PGlite |
| 1 | Admin tổng (trường, admin trường, thống kê); admin trường (môn, giáo viên, năm học/lớp, học sinh + nhập file, phân công, thiết lập) |
| 2 | Ngân hàng câu hỏi + ảnh; tạo đề (rút ngẫu nhiên, sao chép), gán lớp, mã + link |
| 3 | Luồng học sinh: vào thi, phòng chờ, phát đề/thu bài, làm bài, heartbeat, sweeper, chống gian lận, đẩy máy, chấm điểm, trang kết quả |
| 4 | Giáo viên: theo dõi realtime, công bố đáp án/bảng điểm, báo cáo, chấm lại, xuất Excel, nhật ký vi phạm |
| 5 | Tra cứu điểm, xóa dữ liệu học sinh, giới hạn tốc độ, rà soát bảo mật/quyền riêng tư, e2e smoke |

## Out of Scope

Như `SPECIFICATIONS.md`: câu hỏi không phải trắc nghiệm; mobile; đăng nhập Google/tự đăng ký; tài khoản học sinh; ngôn ngữ khác; giáo viên dạy hai môn/đổi môn; thiết lập mở/đóng giờ. Làm sau: nhập câu hỏi từ Word, công thức toán, xác định học sinh "ra trường". Không làm ở giai đoạn này: scale ngang nhiều tiến trình Koa, deploy/CI-CD/monitoring (config = skip), cấp thêm lượt cho học sinh (C-02).

## Open Questions

1. UI: danh sách thư viện kết hợp cuối cùng — chốt ở `/design`.
2. Cách ghi nhận đồng ý của người giám hộ; cách xác định "ra trường" (BRD, hoãn có chủ ý).
3. Gói free Supabase (500 MB DB, 1 GB file, tự tạm dừng sau khoảng 1 tuần ít hoạt động, 2 project active) vs nhu cầu triển khai thật; cần host Koa miễn phí khi thi từ xa — chưa quyết, chưa làm ở giai đoạn này.
4. Nhập file học sinh theo kiểu "cả file hoặc không" là đề xuất của tôi (BRD không nêu) — đổi được nếu bạn muốn nhập phần dòng hợp lệ.
5. Heartbeat 5 giây và ngưỡng sweeper 10 giây là mặc định kỹ thuật, chỉnh bằng hằng số.
