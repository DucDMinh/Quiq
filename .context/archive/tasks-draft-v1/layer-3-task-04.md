# Task 04: Admin trường: học sinh, nhập file, xóa dữ liệu cá nhân

## Layer
3

## Type
build

## Description
Lát cắt dọc cho **học sinh** (FR-011, FR-016, FR-017, BR-003, BR-016): danh sách + tìm kiếm, thêm/sửa, **nhập `.xlsx`/`.csv` theo kiểu cả file hoặc không**, tải file mẫu, lịch sử lớp, và **xóa dữ liệu cá nhân** (giữ điểm, mã bị vô hiệu không cấp lại, C-09). Gồm DTO `@quiq/shared/students`, module api `students`, trang `/quan-tri/hoc-sinh`.

## Dependencies
- layer-2-task-01 (guard, `writeAudit`, `createTestApp`, ngoại lệ multipart cho upload)
- layer-2-task-02 (AppShell, api-client + `apiDownload`, `useResource`)
- layer-1-task-04 (bảng `students`, `enrollments`, `classes`, `student_sessions`, fixtures)
- layer-1-task-03 (zod nền, `defineErrors`, phân trang)
- layer-1-task-02 (primitive UI, data-table)

## Acceptance Criteria
- [ ] FR-017: `GET /api/school/students?yearId=&classId=&q=&page=` (phân trang 25, tìm theo mã/họ tên không dấu) trả **đầy đủ** thông tin kể cả người giám hộ; chỉ `school_admin`; học sinh trường khác -> 404.
- [ ] FR-011, BR-003: `POST /api/school/students` (mã, họ tên, lớp, ngày sinh, quê quán, SĐT người giám hộ, địa chỉ, tên người giám hộ) và `PATCH /api/school/students/:id`; mã chuẩn hóa chữ hoa, duy nhất trong trường (trùng -> 409 `STUDENT_CODE_TAKEN`, **kể cả mã đã bị vô hiệu**, thông điệp trung tính); hai trường được trùng mã; sửa lớp trong cùng năm cập nhật ghi danh năm đó (lịch sử vẫn đọc được).
- [ ] FR-011 **nhập file**: `POST /api/school/students/import?yearId=&dryRun=` nhận `.xlsx` hoặc `.csv` (UTF-8 có/không BOM) tối đa 5 MB và 5.000 dòng, cột theo tiêu đề tiếng Việt (mã, họ tên, lớp, ngày sinh, quê quán, SĐT người giám hộ, địa chỉ, tên người giám hộ; không phụ thuộc thứ tự cột); ngày sinh nhận `dd/mm/yyyy`, ISO và số ngày của Excel. **Cả file hoặc không**: nếu có bất kỳ dòng lỗi (thiếu trường, định dạng, mã trùng trong file, mã đã có trong trường hoặc đã vô hiệu, lớp không có trong năm đích) thì không ghi gì và trả danh sách lỗi theo số dòng + cột; `dryRun=true` trả bản xem trước + lỗi; thành công ghi trong một transaction (học sinh + ghi danh). Giá trị bắt đầu bằng `=`,`+`,`-`,`@` được lưu như chuỗi thường (không thực thi công thức).
- [ ] `GET /api/school/students/import-template` trả file `.xlsx` mẫu (tiêu đề đúng, một dòng ví dụ rõ ràng là giả) tải được qua `apiDownload`.
- [ ] BR-018: `GET /api/school/students/:id/history` trả danh sách (năm học, lớp) theo thứ tự thời gian từ bảng `enrollments`.
- [ ] FR-016, C-09, BR-016: `POST /api/school/students/:id/anonymize { confirmCode }` (phải khớp mã học sinh) xóa **họ tên, ngày sinh, quê quán, địa chỉ, tên + SĐT người giám hộ**, đặt `anonymized_at`, `code_voided = true`, giữ hàng, ghi danh và mọi điểm/bài làm (gắn `anon_ref`); thu hồi phiên học sinh đang hoạt động; ghi audit (không chứa PII); gọi lần hai -> 409 `ALREADY_ANONYMIZED`; sau đó tạo học sinh mới với mã cũ vẫn bị 409; học sinh đã xóa không còn trong bảng điểm kèm tên (chỉ mã nội bộ/mã vô hiệu theo quy ước ghi ở L7-04).
- [ ] Mọi route khai metadata (`scope: 'school'`, `roles: ['school_admin']`, `params` entity `student`/`class`); upload multipart có giới hạn kích thước ở tầng stream (hủy khi vượt) và kiểm đuôi + chữ ký file (zip cho xlsx); thư viện parse không chạy macro/không tải tài nguyên ngoài.
- [ ] Web `/quan-tri/hoc-sinh`: bảng (Mã, Họ tên, Lớp, Ngày sinh & Quê quán, Địa chỉ, Người giám hộ, Thao tác: Lịch sử lớp, Sửa, **Xóa dữ liệu cá nhân**), lọc năm/lớp + tìm kiếm, dialog thêm/sửa, **dialog nhập file** (tải mẫu, chọn `.xlsx/.csv`, xem trước + lỗi theo số dòng, nút "Nhập" chỉ bật khi file không lỗi), dialog xóa dữ liệu nêu rõ: xóa những gì, giữ điểm, **mã không dùng lại**, bắt gõ mã học sinh để xác nhận; học sinh đã xóa hiện nhãn "Đã xóa dữ liệu cá nhân".
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §8 (Học sinh) và §3; không em-dash; chỉ desktop; đủ loading/empty/error.
- [ ] Test PASS (PGlite + web): từng AC trên, gồm file lỗi một dòng làm hỏng cả file, mã trùng khác trường, mã vô hiệu không cấp lại, cô lập chéo trường, CSV có BOM, công thức Excel.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/students/index.ts`
- `packages/shared/src/students/schemas.ts`
- `packages/shared/src/students/errors.ts`
- `apps/api/src/modules/students/routes.ts`
- `apps/api/src/modules/students/service.ts`
- `apps/api/src/modules/students/import-parser.ts`
- `apps/api/src/modules/students/import-service.ts`
- `apps/api/src/modules/students/template.ts`
- `apps/api/src/modules/students/anonymize.ts`
- `apps/api/src/modules/students/students.test.ts`
- `apps/api/src/modules/students/import.test.ts`
- `apps/api/src/modules/students/anonymize.test.ts`
- `apps/web/src/app/quan-tri/hoc-sinh/page.tsx`
- `apps/web/src/features/students/students-table.tsx`
- `apps/web/src/features/students/student-dialog.tsx`
- `apps/web/src/features/students/import-dialog.tsx`
- `apps/web/src/features/students/anonymize-dialog.tsx`
- `apps/web/src/features/students/history-dialog.tsx`
- `apps/web/src/features/students/students-api.ts`
- `apps/web/src/features/students/students.test.tsx`

## Notes
- **Risk:** đỏ (dữ liệu cá nhân của trẻ em, xóa dữ liệu, upload file; reviewer STRICT, checklist `skills/security` + quyền riêng tư). Không migration; cột đã đủ ở L1-04 (nếu thiếu: "cần change").
- Cơ chế: thư viện `exceljs` đọc cả xlsx lẫn csv; nội dung ô lấy dạng giá trị, không đánh giá công thức.
- Ngày sinh/quê quán/địa chỉ chỉ admin trường xem; giáo viên chỉ thấy tập con ở L4-02 (BR-016).
- Nhật ký audit chỉ ghi `student_id` và hành động, không ghi họ tên/PII.
- Xóa dữ liệu khi học sinh đang có attempt `in_progress`: phiên bị thu hồi, attempt sẽ được sweeper (L5-01) xử lý như gián đoạn; ghi nhận trong test mức tối thiểu là không lỗi.
