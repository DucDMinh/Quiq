# Task 02: Tra cứu điểm công khai `/tra-cuu`

## Layer
5

## Type
build (feature sau demo, user chốt trong chat 2026-11-27)

## Description
Theo FR-064, BR-013, C-09, design doc `docs/specs/2026-11-25-quiq-design.md` dòng 100 và `.context/design-spec.md` §4.3.

Học sinh (không đăng nhập) chọn trường, nhập mã học sinh, chọn năm học (mặc định năm hiện tại) → bảng điểm theo môn: Môn học · Bài thi · Mã bài thi · Điểm chính thức.

**Quyết định user chốt 2026-11-27:** bài thi của lớp học sinh **đã công bố bảng điểm** mà học sinh **không có bài làm nào đã chấm** → hiện **điểm 0** (0,00). Điểm 0 chỉ tính lúc trả kết quả, **không** ghi bản ghi attempt nào vào DB.

API (module mới `apps/api/src/modules/lookup/`, không cần đăng nhập, không cần migration):
- `GET /api/lookup/schools`: danh sách trường (id, tên) cho ô chọn, **gồm cả trường bị khóa** (C-09). Không trả thông tin khác.
- `GET /api/lookup/schools/:schoolId/years`: năm học của trường (id, tên, `isCurrent`).
- `POST /api/lookup` body `{ schoolId, studentCode, academicYearId? }` (thiếu năm → năm `isCurrent`):
  - Tìm học sinh theo `schoolId` + mã (so chữ hoa như luồng vào thi), **loại `codeVoided = true`** (FR-016/C-09).
  - Chỉ lấy `exam_classes` có `scores_published_at` khác null, thuộc lớp mà học sinh được ghi danh, và lớp đó thuộc năm học được chọn. **Năm học lấy qua `exam_class → class → academic_year`**, không lọc năm qua `enrollments` (gap G-13).
  - Điểm chính thức = `officialScore` của engine (`@quiq/engine`) trên các attempt đã chấm của học sinh trong exam_class đó; không có attempt đã chấm → 0.
  - Response **không có PII**: không họ tên, ngày sinh, lớp-thông tin cá nhân, người giám hộ; chỉ môn, tên bài, mã bài thi, điểm. Không trả id nội bộ của học sinh.
  - Mã sai / mã vô hiệu / không có bài nào đã công bố → **cùng một response** (danh sách rỗng), không phân biệt được (chống dò mã).
  - Trường bị khóa vẫn tra cứu được (C-09): **không** dùng guard/kiểm trạng thái trường của luồng cán bộ/vào thi.
  - Học sinh thuộc trường A không xem được dữ liệu trường B: `schoolId` + mã cùng xác định học sinh; mọi truy vấn lọc `school_id`.
- **Rate-limit theo IP** (và theo `schoolId` nếu gọn) cho `POST /api/lookup`, đặt trong chính module lookup (vd `lookup/rate-limit.ts`); **không** sửa `modules/auth/*`. Vượt ngưỡng → 429 + `Retry-After`. Bộ nhớ có trần số khóa như limiter đăng nhập.
- Validate input bằng zod trong `packages/shared/src/lookup/` (domain mới, tự export qua `"./*"`).

Web:
- Route `apps/web/src/app/tra-cuu/page.tsx` + feature mới `apps/web/src/features/lookup/`: Portal shell, thẻ lọc 3 ô một hàng (Trường: select có tìm kiếm; Mã học sinh; Năm học mặc định năm hiện tại) + nút "Tra cứu"; bảng kết quả, điểm dạng mono 2 chữ số thập phân (vi-VN).
- States: empty "Chưa có bài thi nào được công bố bảng điểm" (dùng chung cho mã sai/vô hiệu); loading skeleton; error + thử lại; 429 → thông báo thử lại sau.
- Trang tra cứu **vẫn hiển thị trên màn < 1024px** (ngoại lệ trong design-spec dòng 31).
- `apps/web/src/app/page.tsx`: thêm link tới `/tra-cuu` (chỉ thêm link, không đổi phần kiểm health).
- **Không** có link từ tra cứu sang "Xem đáp án" (FR-047: chỉ xem tại trang kết quả).

## Dependencies
- layer-1-task-01 (schema trường/năm học/lớp/học sinh/ghi danh, seed)
- layer-1-task-02 (`officialScore` trong engine)
- layer-2-task-02 (attempt đã chấm)
- Độc lập file với layer-5-task-01 (chạy song song). Thử tay trọn luồng cần cả task 01 (nút công bố); test tự động tự ghi `scores_published_at` trong DB test.

## Acceptance Criteria
- [ ] Chỉ trả bài của lớp đã công bố bảng điểm; lớp chưa công bố không xuất hiện (test).
- [ ] Điểm chính thức = cao nhất trong các attempt đã chấm (test nhiều attempt bằng dữ liệu tay); không có attempt đã chấm → 0.
- [ ] Lọc đúng năm học qua class của exam_class; mặc định năm hiện tại; chọn năm trước được (test 2 năm học).
- [ ] Mã không tồn tại, mã `codeVoided`, mã đúng nhưng chưa có bài công bố → response giống hệt nhau (test so sánh body).
- [ ] Response không có trường PII nào (test khẳng định key); không trả id nội bộ học sinh.
- [ ] Trường bị khóa vẫn tra cứu được (test).
- [ ] Cô lập: mã học sinh trùng nhau ở 2 trường → chỉ ra điểm của trường được chọn (test).
- [ ] Rate-limit: vượt ngưỡng → 429 + `Retry-After` (test với đồng hồ giả); input sai → 400 theo envelope lỗi chung.
- [ ] Web: chọn trường/năm, tra cứu, hiện bảng; empty/loading/error/429 (test web); hiển thị được dưới 1024px; không em-dash.
- [ ] Toàn bộ test cũ xanh.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS (STRICT: endpoint công khai trên dữ liệu học sinh, chống dò mã, PII, cô lập trường)
- [ ] committed

## Files to Create/Modify
- `apps/api/src/modules/lookup/routes.ts`, `service.ts`, `rate-limit.ts`, `lookup.test.ts` (module loader tự nạp `modules/*/routes.ts`)
- `packages/shared/src/lookup/index.ts`, `schemas.ts`, `errors.ts` (nếu cần)
- `apps/web/src/app/tra-cuu/page.tsx`, `apps/web/src/features/lookup/*` (+ test web)
- `apps/web/src/app/page.tsx` (chỉ thêm link)

## Notes
- Đọc trước: `SPECIFICATIONS.md` FR-064, BR-013, FR-016, C-09; `.context/design-spec.md` §4.3 và dòng 31; `docs/specs/2026-11-25-quiq-design.md` dòng 94, 100; `docs/API_SPEC.md`; gap G-13 ở `docs/changes/TECHNICAL_REQUIREMENT_GAPS.md`.
- Điểm 0 cho bài không làm là quyết định của user (spec không nói); ghi vào Doc-Impact để Layer 13 (bảng điểm giáo viên) xử lý nhất quán.
- Chấm lại (Layer 14) tự phản ánh vì tra cứu đọc điểm hiện tại.
- Risk: cao (endpoint công khai). Reviewer STRICT.
- Close-out: endpoint mới vào `docs/API_SPEC.md` (`Doc-Impact` không được `none`).
- Ngoài scope, **KHÔNG** sửa: `modules/class-control/*`, `modules/attempts/*`, `modules/auth/*`, `packages/shared/src/student/*`, `packages/shared/src/exams/*`, `features/student/*`, `features/class-control/*` (thuộc task 01 / ngoài scope). Cần dùng lại hàm của module khác thì import, không sửa.
