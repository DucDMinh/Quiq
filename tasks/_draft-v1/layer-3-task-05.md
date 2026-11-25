# Task 05: Admin trường: phân công giáo viên-lớp và quy chế trường (3 ô)

## Layer
3

## Type
build

## Description
Lát cắt dọc cho **phân công** giáo viên với lớp theo năm học (FR-013, BR-011) và **quy chế thi toàn trường** gồm 3 thiết lập: số lần làm tối đa (mặc định 3), số lần cảnh báo (mặc định 2), ngưỡng gián đoạn giây (mặc định 60) (FR-014, C-04, C-06). Gồm DTO `@quiq/shared/assignments`, module api `assignments`, trang `/quan-tri/phan-cong`.

## Dependencies
- layer-2-task-01 (guard, `writeAudit`, `createTestApp`)
- layer-2-task-02 (AppShell, api-client, `useResource`)
- layer-1-task-04 (bảng `assignments`, `schools` (3 cột quy chế), `exam_classes` (snapshot), fixtures)
- layer-1-task-03 (zod nền, hằng giới hạn quy chế, `defineErrors`)
- layer-1-task-02 (primitive UI)

## Acceptance Criteria
- [ ] FR-014: `GET /api/school/settings` và `PUT /api/school/settings { maxAttempts, warnLimit, interruptSecs }` (chỉ `school_admin`, trường mình); giới hạn lấy từ `@quiq/shared` (vd `maxAttempts` 1..10, `warnLimit` 0..10, `interruptSecs` 15..600), vượt biên -> 400 `VALIDATION_FAILED`; mặc định 3/2/60.
- [ ] C-04, C-06: đổi quy chế **không làm đổi** các `exam_classes` đã có snapshot (test: tạo `exam_classes` đã phát đề với snapshot cũ, `PUT` quy chế mới, snapshot vẫn như cũ); chỉ lớp được phát đề sau đó (L6-01) lấy giá trị mới.
- [ ] FR-013: `POST /api/school/assignments { teacherId, classId }` (năm học suy ra từ lớp; **môn = môn cố định của giáo viên**, không nhận `subjectId`); giáo viên và lớp phải cùng trường (khác trường -> 404); trùng (giáo viên, lớp) -> 409 `ASSIGNMENT_EXISTS`; `GET /api/school/assignments?yearId=&teacherId=` (mặc định năm hiện tại) trả giáo viên, môn, lớp, năm.
- [ ] `DELETE /api/school/assignments/:id` ("Gỡ"): **chặn 409 `ASSIGNMENT_IN_USE`** nếu giáo viên đó đã có bài thi gán cho lớp đó (tồn tại `exam_classes`); nếu không chặn thì xóa (ghi audit). Quyết định mặc định này ghi trong task; đổi hành vi thì qua `/change`.
- [ ] Quyền xem của giáo viên bám theo phân công (FR-013, FR-060): cung cấp hàm dùng chung `teacherAssignments(db, schoolId, teacherId, { yearId? })` ở `apps/api/src/modules/assignments/scope.ts` để L4-01, L4-02, L7-04 import (có test: trả đúng các cặp lớp-năm của giáo viên, không lẫn trường).
- [ ] Mọi route khai metadata (`scope: 'school'`, `roles: ['school_admin']`, `params` entity `assignment`/`teacher`/`class`); chéo trường -> 404.
- [ ] Web `/quan-tri/phan-cong`: thẻ "Quy chế thi toàn trường" với **3 ô** (số lần làm tối đa, số lần cảnh báo gian lận, ngưỡng gián đoạn tính bằng giây) + ghi chú "Chỉ áp dụng cho lớp được phát đề sau khi lưu", nút Lưu (đang lưu khóa nút), thông báo thành công bằng toast; bảng phân công (Giáo viên, Môn, Lớp, Gỡ) lọc theo năm; dialog "Phân công" chọn giáo viên + lớp (môn hiện tự theo giáo viên); dialog Gỡ nêu hậu quả, hiển thị lỗi khi bị chặn.
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §8 (Phân công & Quy chế) và §3; không em-dash; chỉ desktop; đủ loading/empty/error.
- [ ] Test PASS (PGlite + web): từng AC, gồm cô lập chéo trường và snapshot không đổi.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `packages/shared/src/assignments/index.ts`
- `packages/shared/src/assignments/schemas.ts`
- `packages/shared/src/assignments/errors.ts`
- `apps/api/src/modules/assignments/routes.ts`
- `apps/api/src/modules/assignments/service.ts`
- `apps/api/src/modules/assignments/settings.ts`
- `apps/api/src/modules/assignments/scope.ts`
- `apps/api/src/modules/assignments/assignments.test.ts`
- `apps/api/src/modules/assignments/settings.test.ts`
- `apps/web/src/app/quan-tri/phan-cong/page.tsx`
- `apps/web/src/features/assignments/settings-card.tsx`
- `apps/web/src/features/assignments/assignments-table.tsx`
- `apps/web/src/features/assignments/assign-dialog.tsx`
- `apps/web/src/features/assignments/assignments-api.ts`
- `apps/web/src/features/assignments/assignments.test.tsx`

## Notes
- **Risk:** đỏ (nguồn phạm vi quyền xem của giáo viên và quy chế thi; reviewer STRICT). Không migration.
- Snapshot 3 giá trị vào `exam_classes` do L6-01 thực hiện khi phát đề; task này chỉ đảm bảo không làm đổi snapshot cũ.
- Hàm `teacherAssignments` là hợp đồng dùng chung; không đổi chữ ký sau task này.
