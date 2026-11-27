# Task 01: Công bố đáp án / Công bố bảng điểm theo lớp + học sinh "Xem đáp án"

## Layer
5

## Type
build (feature sau demo, user chốt trong chat 2026-11-27)

## Description
Theo FR-037, FR-038, FR-046, FR-047, BR-010, C-07, C-11 và `.context/design-spec.md` (§ trang kết quả học sinh, § phòng thi giáo viên).

**Quyết định user chốt 2026-11-27:**
- Hai nút **chỉ bấm được sau khi lớp đã thu bài** (`exam_classes.status = 'closed'`). Server chặn, không chỉ ẩn nút (tránh học sinh làm xong chuyền đáp án cho bạn đang thi).
- **Một chiều, không có hủy công bố.** Có dialog xác nhận trước khi công bố.
- Bấm lại khi đã công bố → idempotent (trả trạng thái hiện tại, không ghi đè mốc thời gian cũ).

API (không cần migration: cột `answers_published_at`, `scores_published_at` đã có):
- `POST /api/teacher/exams/:examId/classes/:classId/publish-answers` và `.../publish-scores`: quyền như dispatch/close (`staffGuard(["teacher"])`, chủ bài + trường, chéo → 404). Lớp chưa thu bài → 409 với mã lỗi riêng (vd `CLASS_NOT_CLOSED`). Trả `ExamClassState` có thêm `answersPublishedAt`, `scoresPublishedAt`. Phát tín hiệu realtime (`deps.realtime?.publish`) sau commit để bảng giáo viên khác đang mở cập nhật.
- `ExamClassState` (và roster/stream nếu đang trả state lớp) mang 2 mốc công bố để web hiện badge "Đã công bố".
- `GET /api/student/attempts/:id/answers`: phiên học sinh như `/result` (`loadOwnedAttempt`), attempt phải **đã hoàn thành** (`submitted`, mọi `endReason` kể cả `closed`, C-07). Lớp của attempt chưa công bố đáp án → 403/409 mã `ANSWERS_NOT_PUBLISHED`. Đã công bố → trả đề **đúng bộ câu của attempt** (theo `question_order` / `option_orders` của attempt) kèm cờ đáp án đúng cho từng phương án. **Tuyệt đối không trả lựa chọn của học sinh** (FR-047) và không trả gì khi chưa công bố.
- Trường bị khóa: giữ hành vi phiên học sinh hiện có (không mở rộng phạm vi).

Web:
- `features/class-control/control-panel.tsx`: thêm "Công bố đáp án" và "Công bố bảng điểm" (hai nút riêng). Bị khóa khi lớp chưa thu bài (kèm gợi ý "Thu bài trước khi công bố"). Bấm → dialog xác nhận nêu rõ không hủy được → gọi API → nút đổi thành badge "Đã công bố".
- `features/student/result-view.tsx`: nút "Xem đáp án" luôn hiện. Mỗi lần bấm gọi API thật (để thấy ngay khi giáo viên vừa công bố, không cần tải lại trang). Chưa công bố → alert "Giáo viên chưa công bố đáp án" tại chỗ. Đã công bố → khối "Đề thi và đáp án đúng": từng câu, 4 phương án, phương án đúng có badge "Đúng" + viền xanh. Không hiển thị câu đã chọn.
- Chỉ vào được từ trang kết quả, không thêm route hay đường vào nào khác.

## Dependencies
- layer-3-task-02 (class-control: dispatch/close, `loadOwnedExamClass`, `ExamClassState`)
- layer-4-task-01 (realtime hub, stream)
- layer-2-task-02 (attempt, `getResult`, trang kết quả)

## Acceptance Criteria
- [ ] Publish khi lớp `draft`/`dispatched` → 409 `CLASS_NOT_CLOSED`, DB không đổi; lớp `closed` → mốc được ghi, trả state mới; bấm lần 2 giữ nguyên mốc cũ.
- [ ] Giáo viên khác / trường khác → 404; chưa đăng nhập → 401; học sinh gọi route giáo viên → 401.
- [ ] Hai thao tác độc lập: công bố đáp án không công bố bảng điểm và ngược lại (BR-010).
- [ ] `/answers`: chưa công bố → lỗi `ANSWERS_NOT_PUBLISHED`, response **không chứa** nội dung câu hỏi/đáp án; attempt chưa hoàn thành → lỗi; attempt của học sinh khác → 404; đã công bố → đúng bộ câu của attempt, có cờ đúng/sai từng phương án, **không có** trường lựa chọn của học sinh (test khẳng định key không tồn tại).
- [ ] Attempt kết thúc do thu bài (`closed`) vẫn xem được đáp án khi đã công bố (C-07).
- [ ] Cô lập trường: không đọc được attempt/lớp của trường khác qua route mới.
- [ ] Web: nút bị khóa khi chưa thu bài; dialog xác nhận; sau công bố hiện badge; "Xem đáp án" hiện alert khi chưa công bố, hiện khối đáp án khi đã công bố, không hiển thị câu đã chọn (test web). Không em-dash, chỉ desktop.
- [ ] Toàn bộ test cũ xanh (luồng học sinh L2, class-control L3, SSE L4).

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS (STRICT: lộ đáp án đúng, phân quyền, cô lập trường)
- [ ] committed

## Files to Create/Modify
- `apps/api/src/modules/class-control/routes.ts`, `service.ts`, `class-control.test.ts` (+ file test mới `publish.test.ts` nếu cần)
- `apps/api/src/modules/attempts/routes.ts`, `service.ts` (hoặc file mới `answers.ts`), test mới `answers.test.ts`
- `packages/shared/src/exams/schemas.ts`, `errors.ts` (state lớp có mốc công bố, lỗi `CLASS_NOT_CLOSED`)
- `packages/shared/src/student/schemas.ts`, `errors.ts` (kiểu `AttemptAnswersView`, lỗi `ANSWERS_NOT_PUBLISHED`)
- `apps/web/src/features/class-control/control-panel.tsx`, `class-control.test.tsx` (+ `roster-table.tsx` chỉ nếu cần)
- `apps/web/src/features/student/result-view.tsx`, `student-api.ts`, `student.test.tsx` (+ component mới `answers-view.tsx`)

## Notes
- Đọc trước: `SPECIFICATIONS.md` FR-037/038/046/047, BR-010, C-07, C-11; `.context/design-spec.md` dòng 112-113 và 179-181; `docs/API_SPEC.md` (as-built).
- Đáp án đúng chỉ được rời server qua `/answers` sau khi công bố. Soát lại các payload cũ (paper, result, roster) không vô tình mang cờ đúng.
- Chấm lại (FR-039) là Layer 14; tra cứu điểm là task 02 cùng layer.
- Risk: cao (lộ đáp án, phân quyền). Reviewer STRICT.
- Close-out: endpoint mới vào `docs/API_SPEC.md` (`Doc-Impact` không được `none`).
- Ngoài scope, **KHÔNG** sửa: `apps/web/src/app/page.tsx`, `packages/shared/src/lookup/*`, `apps/api/src/modules/lookup/*`, `apps/api/src/modules/auth/*` (thuộc task 02 / ngoài scope)
