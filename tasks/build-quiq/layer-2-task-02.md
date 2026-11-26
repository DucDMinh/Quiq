# Task 02: Luồng học sinh thi trọn vẹn: vào thi, phòng chờ, làm bài, nộp, xem điểm (API + web)

## Layer
2

## Type
build (initial)

## Description
Lát cắt dọc cho học sinh. Sau task này, với bài thi mẫu `DEMO01` (đã phát đề trong seed) bạn mở `localhost:3000/thi`, nhập `DEMO01` + `HS001`, vào phòng chờ, bấm Bắt đầu, làm bài có đồng hồ, nộp và thấy điểm.

API (`apps/api/src/modules/student/` và `apps/api/src/modules/attempts/`):
- `POST /api/student/enter {examCode, studentCode}`: kiểm bài thi tồn tại, mã học sinh thuộc **đúng trường và lớp được gán** (FR-040, BR-014), trường không bị khóa; tạo `student_sessions` + cookie `quiq_stu` (HttpOnly; chỉ hash trong DB). Mã sai/vô hiệu/không thuộc lớp trả **cùng một thông điệp**.
- `GET /api/student/state` (client **polling 3 giây**): trả pha `waiting | can_start | in_progress | completed | closed`, thông tin bài (tên, số phút, số câu), và ghi `waiting_presence`.
- `POST /api/student/attempts` (Bắt đầu): dùng `canStartAttempt` + snapshot của `exam_classes`; demo cho **một lần làm**; tạo attempt `in_progress`, `ends_at = now + số phút` (**giờ máy chủ**), trộn thứ tự câu/đáp án bằng engine; trả đề **không chứa `is_correct`**.
- `PUT /api/student/attempts/:id/answers {questionId, optionIds}`: lưu ngay mỗi lần chọn; từ chối nếu quá `ends_at + 3s`; lựa chọn phải thuộc câu đó.
- `POST /api/student/attempts/:id/submit`: chấm bằng engine, lưu `score`, `status=submitted`; idempotent.
- `GET /api/student/attempts/:id/result`: điểm lần vừa làm (thang 10, 2 chữ số) + số câu đúng/tổng.
- **Hết giờ kiểm khi có request** (lazy): mọi lệnh sau `ends_at` tự nộp bài bằng các câu đã lưu rồi trả kết quả. (Sweeper chạy nền là tính năng sau.)
- `finalizeAttempt(attemptId, reason)` ở `apps/api/src/modules/attempts/finalize.ts`: một chỗ duy nhất kết thúc attempt (nộp, hết giờ, về sau thu bài) để L3-02 và các tính năng sau gọi lại.

Web (`apps/web/src/app/thi/...`, `apps/web/src/features/student/`), đúng `.context/design-spec.md` §4.1, §5.1 đến §5.3:
- `/thi` và `/thi/[code]`: nhập mã bài thi + mã học sinh.
- `/thi/[code]/phong-cho`: trạng thái theo pha, nút "Bắt đầu làm bài" bật khi giáo viên đã phát đề.
- `/thi/[code]/lam-bai`: Exam shell (topbar teal, đồng hồ đếm lùi từ `ends_at`, nút Nộp bài), thẻ câu hỏi, ô đáp án chữ cái A B C D (`AnswerTile`), danh sách câu, dialog xác nhận nộp nêu số câu chưa làm.
- `/thi/[code]/ket-qua`: khối điểm, "Lý do kết thúc", nút "Xem đáp án" **chưa có tính năng**: hiện thông báo "Giáo viên chưa công bố đáp án" (công bố là tính năng sau).

## Dependencies
- layer-1-task-01 (DB, seed `DEMO01`/`HS001`)
- layer-1-task-04 (điểm nối API: `deps.db`, `deps.clock`, `createTestApp()`)
- layer-1-task-02 (engine)
- layer-1-task-03 (thành phần UI, api-client)

## Acceptance Criteria
- [ ] Vào thi đúng → cookie `quiq_stu`; mã học sinh lớp khác/trường khác/sai → cùng một thông báo; lớp chưa phát đề vào được phòng chờ nhưng **không bắt đầu được**; lớp đã thu bài không bắt đầu được.
- [ ] Bắt đầu: đồng hồ theo giờ máy chủ; thứ tự câu và đáp án khác nhau giữa hai học sinh; **payload đề không bao giờ có `is_correct`** (test duyệt toàn bộ JSON); học sinh thứ hai đang `in_progress` không ảnh hưởng học sinh khác.
- [ ] Lưu đáp án mỗi lần chọn; nhảy giữa các câu và đổi đáp án đến lúc nộp (FR-042); câu chọn 1 làm mờ ô còn lại, câu chọn nhiều thì không.
- [ ] Nộp: điểm đúng theo engine (đúng một phần = sai, bỏ trống = sai, 2 chữ số thập phân); nộp lần hai không đổi điểm; sau nộp không làm lại được (demo một lần).
- [ ] Hết giờ: request sau `ends_at` tự nộp theo câu đã lưu; đồng hồ hiển thị khớp giờ server (có kiểm lệch đồng hồ client qua `serverNow` trong response).
- [ ] Một học sinh chỉ một attempt `in_progress` (DB từ chối hàng thứ hai); test race hai request Bắt đầu đồng thời → một thành công.
- [ ] Web đủ loading/empty/error; chỉ desktop; không em-dash; không chữ "Game PIN"; trang kết quả không hiện câu đã chọn hay đáp án đúng.
- [ ] Test API (PGlite) cho toàn bộ luồng + test web cho form vào thi, phòng chờ, làm bài (chọn, nộp, hết giờ giả).

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS (STRICT: payload đáp án, attempt, phiên học sinh)
- [ ] committed

## Files to Create/Modify
- `apps/api/src/modules/student/routes.ts`, `apps/api/src/modules/student/service.ts`, `apps/api/src/modules/student/student-session.ts`, `apps/api/src/modules/student/student.test.ts`
- `apps/api/src/modules/attempts/routes.ts`, `apps/api/src/modules/attempts/service.ts`, `apps/api/src/modules/attempts/finalize.ts`, `apps/api/src/modules/attempts/attempts.test.ts`
- `packages/shared/src/student/index.ts`, `packages/shared/src/student/schemas.ts`, `packages/shared/src/student/errors.ts`
- `apps/web/src/app/thi/page.tsx`, `apps/web/src/app/thi/[code]/page.tsx`, `apps/web/src/app/thi/[code]/phong-cho/page.tsx`, `apps/web/src/app/thi/[code]/lam-bai/page.tsx`, `apps/web/src/app/thi/[code]/ket-qua/page.tsx`
- `apps/web/src/features/student/enter-form.tsx`, `waiting-room.tsx`, `exam-view.tsx`, `question-nav.tsx`, `submit-dialog.tsx`, `result-view.tsx`, `use-student-state.ts`, `student.test.tsx`

## Notes
- Đọc trước: `.context/design-spec.md` §5 (học sinh), §3 (Exam shell, Đồng hồ thi), `docs/specs/2026-11-25-quiq-design.md` (Vòng đời một lần làm), `SPECIFICATIONS.md` FR-033, 036, 040 đến 042, 046, 047, 050, 051; C-03, C-07.
- **Chưa làm (tính năng sau, đừng làm ở đây):** heartbeat, sweeper nền, vi phạm rời tab/toàn màn hình, gián đoạn/làm lại, đẩy máy, SSE, công bố đáp án, ảnh, "Đánh dấu xem lại".
- Chỉ L2-02 sửa `apps/api/src/modules/student/`, `attempts/`; L2-01 sở hữu `auth/` và `http/guards.ts` (đừng sửa). Không đụng `server.ts`/`app.ts` (module loader tự nạp).
- Vi phạm quy tắc "đáp án chỉ ở máy chủ" là lỗi chặn: reviewer phải kiểm payload thật.
- Truy cập DB và thời gian qua `deps` (`routes.ts` nhận `(router, deps)`), test dùng `createTestApp()` với đồng hồ giả; `ends_at`, hết giờ, dung sai 3 giây đều tính theo `deps.clock.now()`.
- **Ghi nhận từ review Layer 1 (phải xử lý ở task này):** (1) `student_sessions` không hết hạn và chỉ mục cho phép MỘT phiên còn hiệu lực mỗi học sinh trên toàn hệ thống: phải thu hồi phiên học sinh khi nộp bài/hết giờ/thu bài (hoặc đặt TTL), nếu không bài thi sau sẽ bị coi nhầm là đổi máy; (2) chuẩn hóa mã bài thi và mã học sinh (trim, không phân biệt hoa thường theo cách thống nhất với DB) trước khi tra; (3) API phải kiểm câu thuộc đúng đề của attempt khi lưu đáp án (DB chưa ràng buộc `attempt_answers` cùng exam).
- Risk đỏ: attempt/payload đáp án/phiên học sinh → Reviewer STRICT.
