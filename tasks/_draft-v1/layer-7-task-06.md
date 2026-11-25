# Task 06: Admin trường: kho dữ liệu chỉ đọc

## Layer
7

## Type
build

## Description
Admin trường **xem (không sửa)** câu hỏi, đề thi và điểm của giáo viên trong trường mình (FR-015, BR-015). Gồm DTO `@quiq/shared/repository`, module api `repository` (chỉ route `GET`), trang `/quan-tri/kho-du-lieu` với 3 tab: Ngân hàng câu hỏi, Đề thi và bài thi, Bảng điểm tổng hợp; lọc theo giáo viên; banner "Chỉ xem" cố định.

## Dependencies
- layer-3-task-06 (câu hỏi, ảnh, `GET /api/media/:id` cho admin cùng trường)
- layer-4-task-01 (bài thi, bản sao đề)
- layer-5-task-01 (điểm chính thức, attempt)
- layer-3-task-02 (giáo viên), layer-3-task-03 (lớp, năm), layer-3-task-04 (học sinh)
- layer-1-task-05 (`officialScore`)
- layer-2-task-01 / layer-2-task-02 (guard, AppShell, api-client)
- layer-1-task-02 (primitive UI, tabs, data-table)

## Acceptance Criteria
- [ ] `GET /api/school/repository/questions?teacherId=&difficulty=&q=&page=`: câu hỏi của mọi giáo viên **cùng trường** (nội dung, mức khó, đáp án + đáp án đúng, ảnh dạng `mediaId`, giáo viên sở hữu); `GET /api/school/repository/exams?teacherId=&yearId=` (bài thi: mã, cấu hình, lớp, số lượt thi) và `GET /api/school/repository/exams/:id` (bản sao đề đầy đủ); `GET /api/school/repository/scores?examId=&classId=` (bảng điểm tổng hợp: mã, họ tên, số lần, điểm chính thức; đúng quy ước năm trước C-05 và học sinh đã xóa dữ liệu như L7-04).
- [ ] **Chỉ đọc**: module không có route `POST/PUT/PATCH/DELETE`; test quét `listRoutes` khẳng định mọi route có tiền tố `/api/school/repository` là `GET`, và thử gọi ghi trả 404/405 (BR-015, FR-015).
- [ ] Chỉ `school_admin`; dữ liệu trường khác -> 404 (id đề/giáo viên ở trường khác không tồn tại với admin này); giáo viên và admin tổng -> 403; mọi route khai metadata (`scope: 'school'`, `roles: ['school_admin']`, `params` entity `teacher`/`exam`/`class`).
- [ ] Không lộ thông tin cá nhân vượt quyền: phản hồi bảng điểm không có ngày sinh/quê quán/địa chỉ/người giám hộ (phần thông tin cá nhân học sinh đã có ở L3-04), schema `strict`.
- [ ] Web `/quan-tri/kho-du-lieu`: 3 tab (Ngân hàng câu hỏi · Đề thi và bài thi · Bảng điểm tổng hợp), lọc theo giáo viên, **banner "Chỉ xem" cố định**, không có bất kỳ nút sửa/xóa/thêm nào; ảnh câu hỏi hiển thị qua `/api/media/:id`; xem chi tiết đề (bản sao + đáp án đúng); empty và error có hướng dẫn.
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §8 (Kho dữ liệu chỉ đọc) và §3; không em-dash; chỉ desktop; đủ loading/empty/error.
- [ ] Test PASS (PGlite + web): từng AC; admin trường A không đọc được dữ liệu trường B ở mọi route; không có nút ghi trong UI (test render).

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/repository/index.ts`
- `packages/shared/src/repository/schemas.ts`
- `packages/shared/src/repository/errors.ts`
- `apps/api/src/modules/repository/routes.ts`
- `apps/api/src/modules/repository/service.ts`
- `apps/api/src/modules/repository/repository.test.ts`
- `apps/api/src/modules/repository/read-only.test.ts`
- `apps/web/src/app/quan-tri/kho-du-lieu/page.tsx`
- `apps/web/src/features/repository/repository-tabs.tsx`
- `apps/web/src/features/repository/questions-tab.tsx`
- `apps/web/src/features/repository/exams-tab.tsx`
- `apps/web/src/features/repository/scores-tab.tsx`
- `apps/web/src/features/repository/teacher-filter.tsx`
- `apps/web/src/features/repository/read-only-banner.tsx`
- `apps/web/src/features/repository/repository-api.ts`
- `apps/web/src/features/repository/repository.test.tsx`

## Notes
- **Risk:** đỏ (quyền đọc xuyên giáo viên, tenant; reviewer STRICT: chắc chắn không có đường ghi).
- Tên route tách khỏi `/api/teacher/*` để L8-01 quét phân biệt rõ ranh giới quyền.
- Điểm tổng hợp dùng cùng quy tắc "điểm chính thức" với L7-04; nếu cần dùng chung hàm thì import từ `student-core` (L5-01), không sao chép logic chấm.
- Phân trang bắt buộc cho câu hỏi/bài thi (25/trang) để tránh tải toàn bộ.
