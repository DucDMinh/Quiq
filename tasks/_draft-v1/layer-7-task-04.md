# Task 04: Giáo viên: kết quả, thống kê câu sai, sửa đáp án và chấm lại, xuất Excel, chi tiết bài làm

## Layer
7

## Type
build

## Description
Báo cáo kết quả của giáo viên (FR-039, 060, 061, 062, 063/C-05, 065, BR-001, BR-011): bảng điểm lớp (mọi lần làm, điểm chính thức), thống kê câu sai nhiều, **sửa đáp án đúng trên bản sao đề + chấm lại tự động**, **xuất `.xlsx`** (điểm chính thức + số lần làm), trang chi tiết bài làm với **nhật ký vi phạm + nhật ký đẩy máy**. Gồm DTO `@quiq/shared/results`, module api `results`, trang `/giao-vien/ket-qua` và `/giao-vien/ket-qua/bai-lam/[attemptId]`.

## Dependencies
- layer-5-task-01 (`rescoreExam`, `getOfficialScore`, dữ liệu attempt/vi phạm/đẩy máy)
- layer-4-task-01 (bản sao đề, `exam_options`)
- layer-4-task-02 (quy ước quyền xem học sinh theo phân công)
- layer-3-task-05 (`teacherAssignments`)
- layer-3-task-04 (học sinh đã xóa dữ liệu cá nhân)
- layer-1-task-05 (`officialScore`)
- layer-2-task-01 / layer-2-task-02 (guard, api-client, `apiDownload`)
- layer-1-task-02 (primitive UI, tabs, data-table)

## Acceptance Criteria
- [ ] FR-060, BR-011: mọi route chỉ cho `teacher`, chỉ **lớp trong phân công + bài thi thuộc môn/giáo viên của mình + đúng năm học của phân công** (qua `teacherAssignments`); khác -> 404; giáo viên dạy A,B,C năm 2025-2026 và E,F,G năm 2026-2027 xem lại A,B,C chỉ phần 2025-2026 (test).
- [ ] FR-061 bảng điểm: `GET /api/teacher/results/scoreboard?examId=&classId=` mỗi học sinh: mã, họ tên, số lần làm, **từng lần** (lần thứ, thời điểm, điểm, lý do kết thúc, cờ gián đoạn), điểm chính thức (cao nhất, `officialScore`), liên kết bài làm; giáo viên **thấy điểm cả lần gián đoạn**. Năm học trước: vẫn hiện họ tên + mã (C-05) và **không** có thông tin người giám hộ/ngày sinh/quê quán/địa chỉ; học sinh đã xóa dữ liệu cá nhân hiện nhãn "Đã xóa dữ liệu cá nhân" kèm mã nội bộ rút gọn, điểm vẫn có.
- [ ] FR-061 thống kê: `GET /api/teacher/results/wrong-stats?examId=&classId=` xếp câu theo tỷ lệ làm sai (số sai/số bài đã chấm, %, nội dung rút gọn) trên điểm các attempt đã chấm, định nghĩa ghi rõ trong response; bỏ trống tính là sai (BR-008).
- [ ] FR-062 xuất Excel: `GET /api/teacher/results/export?examId=&classId=` trả `.xlsx` gồm đúng dữ liệu bảng điểm đang xem: Mã, Họ tên, **Số lần làm**, **Điểm chính thức**; **không** chi tiết từng lần; tên file an toàn; ô bắt đầu bằng `=`,`+`,`-`,`@` được vô hiệu hóa công thức; test đọc lại file bằng `exceljs` và đối chiếu số liệu với `scoreboard`; năm cũ vẫn có họ tên + mã (C-05).
- [ ] FR-039, BR-001: `POST /api/teacher/exams/:examId/regrade-preview { examQuestionId, correctOptionIds }` trả số bài sẽ chấm lại; `PUT /api/teacher/exams/:examId/questions/:examQuestionId/correct-options { optionIds }` (ít nhất 1 đáp án đúng, thuộc câu đó) sửa `exam_options.is_correct` **trên bản sao của đề** (không đụng ngân hàng) rồi gọi `rescoreExam` **trong cùng transaction**, trả số bài đã chấm lại; **lựa chọn của học sinh không đổi**; điểm chính thức đổi theo; điểm đã công bố ở tra cứu tự cập nhật (kiểm bằng `getOfficialScore`); ghi audit; chỉ chủ bài thi.
- [ ] FR-065, FR-063: `GET /api/teacher/results/attempts/:attemptId` trả: học sinh (họ tên, mã), lần thứ, bắt đầu/kết thúc, lý do kết thúc, điểm (kể cả lần gián đoạn), từng câu (đúng/sai, đáp án đã chọn, đáp án đúng), **nhật ký vi phạm** (loại, thời điểm, số đếm), **nhật ký đẩy máy** của học sinh trong bài thi (thời điểm, mã học sinh); chỉ khi attempt thuộc lớp/phân công của giáo viên; chéo -> 404.
- [ ] Mọi route khai metadata (`scope: 'school'`, `roles: ['teacher']`, `params` entity `exam`/`class`/`attempt`); test cô lập chéo trường và chéo giáo viên; schema phản hồi `strict` (không `dateOfBirth`, `hometown`, `address`).
- [ ] Web `/giao-vien/ket-qua`: 3 ô lọc (Năm học phân công, Lớp, Bài thi) chỉ gồm lựa chọn hợp lệ theo phân công; 3 tab: **Bảng điểm cả lớp** (bảng + nút "Xuất Excel" `.xlsx`, mở rộng dòng xem các lần), **Thống kê câu hay sai** (thanh tỷ lệ kèm số %, không chỉ màu), **Sửa đáp án và chấm lại** (chọn câu, đổi đáp án đúng, dialog "Sẽ chấm lại n bài. Lựa chọn của học sinh không đổi" rồi toast kết quả); lớp năm trước chỉ điểm (tên + mã).
- [ ] Web `/giao-vien/ket-qua/bai-lam/[attemptId]`: tiêu đề tên học sinh + mã, các lần làm (tab/danh sách), mỗi lần: thời điểm, lý do kết thúc, điểm, câu đúng/sai, **nhật ký vi phạm** và **nhật ký đẩy máy** kèm thời điểm.
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §9.4, §9.5 và §3; không em-dash; chỉ desktop; đủ loading/empty/error.
- [ ] Test PASS (PGlite + web): từng AC; chấm lại đổi điểm chính thức và không đổi lựa chọn; xuất Excel khớp bảng; ranh giới phân công/năm.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/results/index.ts`
- `packages/shared/src/results/schemas.ts`
- `packages/shared/src/results/errors.ts`
- `apps/api/src/modules/results/routes.ts`
- `apps/api/src/modules/results/scope.ts`
- `apps/api/src/modules/results/scoreboard.ts`
- `apps/api/src/modules/results/wrong-stats.ts`
- `apps/api/src/modules/results/attempt-detail.ts`
- `apps/api/src/modules/results/export-xlsx.ts`
- `apps/api/src/modules/results/regrade.ts`
- `apps/api/src/modules/results/results.test.ts`
- `apps/api/src/modules/results/export.test.ts`
- `apps/api/src/modules/results/regrade.test.ts`
- `apps/web/src/app/giao-vien/ket-qua/page.tsx`
- `apps/web/src/app/giao-vien/ket-qua/bai-lam/[attemptId]/page.tsx`
- `apps/web/src/features/results/result-filters.tsx`
- `apps/web/src/features/results/scoreboard-table.tsx`
- `apps/web/src/features/results/wrong-stats.tsx`
- `apps/web/src/features/results/answer-key-editor.tsx`
- `apps/web/src/features/results/regrade-dialog.tsx`
- `apps/web/src/features/results/export-button.tsx`
- `apps/web/src/features/results/attempt-detail.tsx`
- `apps/web/src/features/results/violation-log.tsx`
- `apps/web/src/features/results/results-api.ts`
- `apps/web/src/features/results/results.test.tsx`

## Notes
- **Risk:** đỏ (điểm số chính thức, chấm lại hàng loạt, dữ liệu cá nhân, xuất file; reviewer STRICT, checklist `skills/security` + quyền riêng tư).
- Chấm lại dùng `rescoreExam` của L5-01; nếu thiếu tham số (vd chỉ chấm lại một câu) thì ghi "cần change" cho L5-01, không viết logic chấm song song ở đây.
- Sửa đáp án chỉ trên `exam_options` (bản sao); ngân hàng câu hỏi gốc không đổi (BR-002).
- Quy ước hiển thị học sinh đã xóa dữ liệu: dùng 6 ký tự đầu của `anon_ref`, không bao giờ in `student_code` đã vô hiệu nếu muốn ẩn danh hoàn toàn (mặc định ẩn mã, chỉ hiện mã nội bộ).
- Điểm các lần `interrupted` giáo viên thấy; học sinh không thấy (đã xử lý ở L6-03).
