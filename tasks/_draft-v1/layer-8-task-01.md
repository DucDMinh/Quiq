# Task 01: Quét cô lập trường tự động, payload không lộ đáp án, review bảo mật và quyền riêng tư

## Layer
8

## Type
build

## Description
Lớp kiểm chứng bảo mật **tự động** trên toàn bộ api đã xây: (1) quét **mọi route** qua metadata của router để chứng minh người của trường A không đọc/ghi được dữ liệu trường B (404) và đúng vai trò mới gọi được; (2) chứng minh payload làm bài/phòng chờ/tra cứu **không chứa `is_correct`** hay thông tin cá nhân vượt quyền; (3) review bảo mật + quyền riêng tư theo `skills/security` và ghi báo cáo. Task này chỉ **thêm test và tài liệu**, không sửa module nghiệp vụ.

## Dependencies
- layer-7-task-01, layer-7-task-02, layer-7-task-03, layer-7-task-04, layer-7-task-05, layer-7-task-06 (toàn bộ tính năng)
- layer-6-task-01, layer-6-task-02, layer-6-task-03 (route vận hành thi)
- layer-5-task-01 (core runtime)
- layer-2-task-01 (guard, metadata route, `listRoutes`, `createTestApp`)
- layer-1-task-04 (fixtures hai trường)

## Acceptance Criteria
- [ ] **Quét metadata**: test dùng `listRoutes(app)` và khẳng định **mọi route** có `meta` đầy đủ (`roles`, `scope`, `params` với entity hợp lệ, `summary`); không có route nào thiếu guard (route không `public` mà gọi không đăng nhập đều trả 401; route `student` không phiên trả 401). Danh sách route công khai khớp danh sách cho phép đã duyệt: `/api/health`, `/api/auth/login`, `/api/student/exams/:code`, `/api/student/enter`, `/api/lookup*` (mỗi route công khai phải có rate-limit hoặc lý do ghi rõ).
- [ ] **Quét cô lập trường (BR-015)**: dựng hai trường A và B đầy đủ (tài khoản, môn, năm, lớp, học sinh, phân công, câu hỏi + ảnh, bài thi, `exam_classes`, attempt, nhật ký). Với **mỗi route** có tham số entity trong `meta.params`, gọi bằng tài khoản đúng vai trò của trường B với id thuộc trường A (bộ fixture ánh xạ entity -> id của trường A) và khẳng định **404** (không phải 200/403) và không có thay đổi dữ liệu ở trường A (đối chiếu trước/sau); với route không có tham số id (danh sách) khẳng định kết quả chỉ chứa dữ liệu của trường B. Thêm vai trò chéo: giáo viên A không thao tác trên câu/bài thi của giáo viên khác cùng trường (404); `school_admin` không dùng route `teacher` ghi dữ liệu; test **thất bại** nếu có route mới nào chưa được quét (đối chiếu số route đã quét với `listRoutes`).
- [ ] **FR-004**: `super_admin` gọi mọi route `scope: 'school'` đều bị 403; chỉ các route `scope: 'platform'` đã duyệt trả dữ liệu, và payload của chúng chỉ gồm số đếm + thông tin trường/tài khoản admin trường.
- [ ] **Không lộ đáp án**: chạy luồng đầy đủ (bắt đầu, tải đề, lưu, heartbeat, vi phạm, phòng chờ, kết quả khi chưa công bố) và duyệt đệ quy mọi JSON phản hồi của route học sinh để khẳng định không có khóa `is_correct`/`isCorrect`/`correct*` hay danh sách đáp án đúng, **trừ** `GET .../solution` sau khi đã công bố đáp án và attempt `completed`; kiểm cả ảnh (proxy không phát ảnh đề của lớp/bài thi khác).
- [ ] **Không lộ thông tin cá nhân**: duyệt phản hồi các route giáo viên khẳng định không có `dateOfBirth`/`hometown`/`address`; `guardian*` chỉ xuất hiện ở route admin trường và `teacher-students` năm hiện tại; `/api/lookup*` không có tên/SĐT/lớp; học sinh đã `anonymize` không còn PII ở bất kỳ phản hồi nào và mã vẫn không cấp lại được (C-09).
- [ ] **Giả mạo/lạm dụng**: `schoolId`, `teacherId`, `studentId` đưa vào body/query không làm đổi phạm vi (lấy từ phiên); CSRF (ghi không đúng `Content-Type`/`Origin` bị từ chối); cookie `quiq_session`/`quiq_stu` có `HttpOnly`, `SameSite=Lax`; phiên cán bộ không dùng được cho route học sinh và ngược lại; rate-limit đăng nhập/vào thi/tra cứu kích hoạt; thông điệp lỗi không lộ stack, tên bảng, hay đường dẫn Storage.
- [ ] **Upload**: ảnh giả mạo (đổi đuôi, SVG, vượt 2 MB, path traversal trong tên) bị từ chối; không có URL Storage công khai trong bất kỳ response nào.
- [ ] **Review bảo mật** `docs/SECURITY_REVIEW.md`: checklist theo `skills/security` (xác thực, phiên, phân quyền, tenant, IDOR, đầu vào, upload, rate-limit, bí mật/`.env`, log, phụ thuộc, headers), bảng phát hiện (mức, route/file, trạng thái); đối chiếu với **Privacy/Regulatory** của SPECIFICATIONS (phân quyền giới hạn, biện pháp bảo mật, quyền rút đồng ý bằng FR-016) và các **rủi ro đã được chủ dự án chấp nhận** (lộ mã bài thi, người ngoài biết mã học sinh) ghi rõ là chấp nhận. Phát hiện mức Cao/Nghiêm trọng làm test **đỏ có chủ đích hoặc được ghi Blocked** và đề xuất `/change`; **không** vá vào module của task khác trong task này.
- [ ] Test chạy trong `pnpm test` (PGlite, không cần mạng) dưới 60 giây.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/api/src/security/fixtures.ts`
- `apps/api/src/security/route-metadata.test.ts`
- `apps/api/src/security/tenant-isolation.sweep.test.ts`
- `apps/api/src/security/role-boundaries.test.ts`
- `apps/api/src/security/no-answer-leak.test.ts`
- `apps/api/src/security/privacy-payload.test.ts`
- `apps/api/src/security/abuse-and-csrf.test.ts`
- `apps/api/src/security/upload-hardening.test.ts`
- `docs/SECURITY_REVIEW.md`

## Notes
- **Risk:** đỏ (bảo mật và quyền riêng tư; reviewer STRICT, đối chiếu từng mục `skills/security`).
- Điều kiện thành công của việc quét: **mọi route mới sau này tự động bị quét** nhờ metadata; nếu một task sau thêm route mà thiếu `params` entity, test này đỏ.
- Phần kiểm RLS bằng anon key thật nằm ở L8-02 (cần project Supabase staging).
- Fixture hai trường nên dùng lại builder của `@quiq/db/testing`; không viết SQL tay ngoài việc đối chiếu trước/sau.
- Nếu một route cố tình không thể trả 404 (vd route công khai), phải nằm trong danh sách ngoại lệ có lý do trong test.
