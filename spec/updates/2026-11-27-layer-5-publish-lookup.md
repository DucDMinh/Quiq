# Spec Update - 2026-11-27 layer-5-publish-lookup

**spec_version:** 1.0.0 -> 1.0.0 (không bump)
**Trigger:** feature-update (Layer 5, `layer-5-task-01`: công bố đáp án / bảng điểm theo lớp + học sinh "Xem đáp án"; `layer-5-task-02`: tra cứu điểm công khai `/tra-cuu`. Merge `5710ada`, `03597e9`, `a4d49bc`; close-out `e401a2f`)
**Requirements:** không đổi nội dung SPECIFICATIONS.md. FR-037, FR-038, FR-046, FR-047, FR-064, BR-010, BR-013, C-07, C-09 đã có sẵn trong spec v1.0.0. Layer 5 hiện thực đúng các requirement đó.
**Ảnh hưởng:** api.class-control (publish-answers, publish-scores, state lớp có mốc công bố), api.attempts (`GET /student/attempts/:id/answers`), api.lookup (mới: schools, years, tra cứu), shared.exams / shared.student / shared.lookup, web.class-control (nút, dialog, badge), web.student (Xem đáp án), web.lookup (`/tra-cuu`, link từ trang chủ).
**Scope sinh:** `spec/test-scope/current.json` (scopeVersion 3, risk high)

## Lý do không bump version

- FR-037, FR-038 (công bố hai nút theo lớp), FR-046/047 (xem đáp án), FR-064 (tra cứu), BR-010, BR-013, C-07, C-09 đã nằm trong spec từ v1.0.0. Scope v1 chỉ ghi các mục này ở mức "deferred" tới Layer 5.
- Bốn quyết định user chốt ngày 2026-11-27 được ghi như **clarification của user**, không sửa `SPECIFICATIONS.md` (intent doc chỉ đổi qua Change Request + user duyệt):
  1. Công bố (đáp án và bảng điểm) chỉ sau khi lớp đã thu bài; server chặn 409 `CLASS_NOT_CLOSED`.
  2. Công bố là một chiều, không có hủy; bấm lại giữ mốc thời gian đầu tiên (idempotent).
  3. Công bố đáp án chờ mọi lớp của bài đã thu bài: 409 `OTHER_CLASSES_NOT_CLOSED`; `/answers` trả 409 `ANSWERS_NOT_PUBLISHED` khi còn lớp chưa xong.
  4. Tra cứu: bài của lớp đã công bố bảng điểm mà học sinh không có bài đã chấm nào thì điểm là 0. Điểm 0 chỉ tính lúc trả, không ghi attempt vào DB.
- Nếu chủ dự án muốn quy tắc 0 điểm và chốt "đáp án chờ mọi lớp" thành requirement chính thức trong SPECIFICATIONS.md, đó là thay đổi ngữ nghĩa (MINOR, 1.1.0) và phải đi qua Change Request riêng.

## Mới / đổi cần test

**Endpoint mới (6):**
- `POST /api/teacher/exams/:examId/classes/:classId/publish-answers`: chỉ sau thu bài (409 `CLASS_NOT_CLOSED`); còn lớp khác của bài chưa thu bài (kể cả nháp) → 409 `OTHER_CLASSES_NOT_CLOSED`; còn attempt `in_progress` → 409 `CLASS_NOT_CLOSED`; bấm lại giữ mốc đầu; trả `ExamClassState`.
- `POST /api/teacher/exams/:examId/classes/:classId/publish-scores`: chỉ cần lớp mình đã thu bài (409 `CLASS_NOT_CLOSED`); một chiều, idempotent. Hai thao tác độc lập (BR-010).
- `GET /api/student/attempts/:id/answers`: chỉ-xem trở lên; attempt phải đã hoàn thành (409 `ATTEMPT_NOT_FINISHED`, gồm cả kết thúc do thu bài `closed`, C-07); lớp chưa công bố đáp án → 409 `ANSWERS_NOT_PUBLISHED`, không trả nội dung. Đã công bố → đúng bộ câu và thứ tự của attempt, có `isCorrect` từng phương án, **không có** trường lựa chọn của học sinh.
- `GET /api/lookup/schools`: danh sách trường (id, tên), gồm cả trường bị khóa; không trả thông tin khác.
- `GET /api/lookup/schools/:schoolId/years`: năm học (id, tên, `isCurrent`), mới nhất trước; id không phải uuid → 422.
- `POST /api/lookup` `{ schoolId, studentCode, academicYearId? }`: không đăng nhập. Chỉ bài của lớp có `scores_published_at`; không PII, không id nội bộ; mã sai / mã vô hiệu (`codeVoided`) / trường không có / chưa có bài công bố → **cùng một body** `{ items: [] }`; trường bị khóa vẫn tra được (C-09); rate-limit 30 lượt / 60 giây theo IP, vượt → 429 + `Retry-After`. Thực chất toàn cục vì sau Next rewrite mọi request cùng IP (G-01).

**Đổi:**
- `ExamClassState` (trả bởi dispatch, close, roster, stream, publish) có thêm `answersPublishedAt`, `scoresPublishedAt` (ISO hoặc null) và `otherClassesOpen`.
- Đáp án đúng chỉ rời server qua `/answers` (học sinh) và `GET /api/teacher/exams/:id` (giáo viên chủ đề). Đề (`ExamPaperView`), kết quả (`AttemptResultView`), roster không mang cờ đúng/sai.
- Mã lỗi mới: `CLASS_NOT_CLOSED`, `OTHER_CLASSES_NOT_CLOSED` (409), `ANSWERS_NOT_PUBLISHED` (409).

**Web:**
- `/giao-vien/phong-thi`: nút "Công bố đáp án" và "Công bố bảng điểm" (hai nút riêng), khóa khi lớp chưa thu bài kèm gợi ý, dialog xác nhận nêu rõ không hủy được, sau công bố hiện badge "Đã công bố". Nút "Công bố đáp án" khóa khi còn lớp khác của bài chưa xong (server vẫn là chốt chặn).
- `/thi/[code]/ket-qua`: nút "Xem đáp án" luôn hiện; chưa công bố → thông báo "Giáo viên chưa công bố đáp án"; đã công bố → khối đề và đáp án đúng, không hiển thị câu đã chọn.
- `/tra-cuu` (mới): chọn trường, nhập mã, chọn năm (mặc định năm hiện tại); bảng điểm môn / bài thi / mã bài / điểm (2 chữ số thập phân). Trạng thái empty, loading, error, 429. Hiển thị được dưới 1024px (ngoại lệ trong design-spec). Không có link từ tra cứu sang đáp án (FR-047).
- `/` (trang chủ): thêm link tới `/tra-cuu`.

## Known issues

- **Mở rộng:** G-01 (MAJOR, chặn deploy production) nay gồm cả `POST /api/lookup`: rate-limit theo IP không hiệu lực sau Next rewrite. User chấp nhận rủi ro tới khi deploy sau reverse proxy thật.
- **Thêm ca:** G-10 (xóa đề đồng thời với công bố đáp án có thể deadlock, NIT).
- **Thêm mới:** G-18 (MINOR, sản phẩm: đáp án đã xem không thu hồi được nếu bài được gán thêm lớp; chưa xảy ra vì chưa có đường gán/mở lại lớp, Layer 14), G-19 (NIT: `otherClassesOpen` làm mới theo nhịp ~10 giây, server vẫn chặn 409), G-20 (NIT: tra cứu, thứ tự truy vấn mã sai/đúng, trùng dòng khi học sinh ở 2 lớp cùng bài, collation chưa chuẩn tiếng Việt, quy tắc điểm 0 chỉ tính lúc trả; Layer 13 phải dùng cùng quy tắc).
- Giữ nguyên: G-02, G-03, G-04, G-05, G-07, G-08, G-09, G-11, G-13, G-14, G-15, G-16, G-17, RESIDUAL-RLS.

## Vẫn chưa build (không phải bug)

Chấm lại và sửa đáp án (Layer 14); bảng điểm giáo viên, câu sai nhiều, xuất Excel (Layer 13); admin trường / tổng, ảnh câu hỏi, quyền riêng tư, cứng hóa như scope v2. Heartbeat và gián đoạn (Layer 6/7) vẫn chưa có.
