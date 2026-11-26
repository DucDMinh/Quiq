# Task 01: UI học sinh: vào thi và phòng chờ

## Layer
7

## Type
build

## Description
Giao diện công khai của học sinh trước khi làm bài (FR-033, FR-040, FR-043, BR-004): trang vào thi `/thi` và `/thi/[code]` (nhập mã bài thi hoặc mở link, rồi mã học sinh), **phòng chờ** `/thi/[code]/phong-cho` với trạng thái lớp tự cập nhật, nút "Bắt đầu làm bài" (bật toàn màn hình rồi mới bắt đầu), "Rời phòng chờ", và màn hình bị đẩy máy khi còn ở phòng chờ.

## Dependencies
- layer-6-task-02 (`/api/student/exams/:code`, `/enter`, `/waiting-room`, `/leave`)
- layer-6-task-03 (`POST /api/student/attempts` để bắt đầu)
- layer-2-task-02 (`PortalShell`, api-client, `useResource`)
- layer-1-task-02 (primitive UI, `ViewportGuard`)
- layer-1-task-03 (`@quiq/shared/student-entry`, `student-exam` DTO/mã lỗi qua domain của L6)

## Acceptance Criteria
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §4.1, §5.1, §6.1; một hệ thiết kế; **không em-dash**, không hiện mã FR, tiếng Việt có dấu, chỉ desktop (< 1024px hiện thông báo "chỉ hỗ trợ máy tính"); đủ loading/empty/error.
- [ ] `/thi` (Portal shell, thẻ trung tâm <= 780px): 2 ô "Mã bài thi hoặc đường dẫn" và "Mã học sinh/sinh viên", nút "Vào phòng chờ" (primary, lg); mã bài thi không phân biệt hoa thường, bỏ khoảng trắng, **dán cả link vẫn nhận** (tách mã từ URL); Enter gửi form; "Đang kiểm tra…" khóa nút; lỗi dưới form đúng thông điệp server: "Không tìm thấy bài thi", "Mã học sinh không đúng hoặc không thuộc lớp được gán" (cùng một thông điệp cho mã sai/vô hiệu), "Trường đã bị khóa", "Bài thi chưa sẵn sàng", 429 "Bạn thử quá nhiều lần, thử lại sau X giây" (đếm ngược).
- [ ] `/thi/[code]`: ô mã bài thi đã điền và khóa (sau khi kiểm tra mã qua `/api/student/exams/:code`; sai mã -> thông báo "Không tìm thấy bài thi" + nút về `/thi`), con trỏ ở ô mã học sinh; thành công chuyển `/thi/[code]/phong-cho` (hoặc thẳng `/thi/[code]/lam-bai` nếu `resumeAttemptId`).
- [ ] `/thi/[code]/phong-cho`: thẻ hero 780px: badge môn + badge "Mã bài thi: XXXX"; tên bài; badge trạng thái lớp (Chưa phát đề / Đã phát đề / Đã thu bài); 2 ô thông tin (Thí sinh: họ tên, mã, lớp; Lượt thi: số phút, số câu, "Lượt sắp làm: n/N", "Cảnh báo tối đa: M"); alert theo trạng thái đúng văn bản design-spec §5.1 (chưa phát đề, đã phát đề, đã thu bài, hết lượt, đã hoàn thành kèm liên kết `/thi/[code]/ket-qua?a=<lastCompletedAttemptId>`); nút "Bắt đầu làm bài" (success, lg) khóa kèm lý do khi `canStart = false`; nút phụ "Rời phòng chờ" gọi `/leave`.
- [ ] Trạng thái **tự cập nhật** bằng cách gọi `/api/student/waiting-room` mỗi 5 giây (`HEARTBEAT_INTERVAL_MS`) không cần tải lại; khi lớp chuyển sang đã phát đề: nút bật + thông báo âm thầm (`aria-live="polite"`, không âm thanh); dừng polling khi tab ẩn lâu không cần (vẫn giữ presence theo chu kỳ); mất mạng hiện banner "Mất kết nối, đang thử lại" mà không văng khỏi trang.
- [ ] "Bắt đầu làm bài": gọi `requestFullscreen()` **ngay trong sự kiện click**; trình duyệt từ chối -> hiện hướng dẫn bật toàn màn hình và **không bắt đầu**; được -> `POST /api/student/attempts`, thành công chuyển `/thi/[code]/lam-bai`; lỗi nghiệp vụ hiển thị tại chỗ (hết lượt, đã thu bài...). Chống bấm đúp.
- [ ] Phòng chờ gặp 401 `SESSION_KICKED` -> màn toàn trang "Mã của bạn vừa được dùng ở thiết bị khác" (không tốn lượt vì mới ở phòng chờ; nêu "Nếu đó không phải bạn, hãy báo giáo viên"), nút "Về trang vào thi"; `SESSION_ENDED` -> về `/thi`.
- [ ] Không lưu mã học sinh trong URL/`localStorage`; cookie `quiq_stu` do server đặt.
- [ ] Test PASS (Vitest + Testing Library): tách mã từ link, validate form, từng trạng thái alert/nút, polling với đồng hồ giả, fullscreen từ chối không bắt đầu, kicked screen, không em-dash.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/web/src/app/thi/page.tsx`
- `apps/web/src/app/thi/[code]/page.tsx`
- `apps/web/src/app/thi/[code]/phong-cho/page.tsx`
- `apps/web/src/features/student-entry/enter-form.tsx`
- `apps/web/src/features/student-entry/parse-exam-code.ts`
- `apps/web/src/features/student-entry/waiting-room.tsx`
- `apps/web/src/features/student-entry/waiting-status.tsx`
- `apps/web/src/features/student-entry/use-waiting-room.ts`
- `apps/web/src/features/student-entry/start-attempt-button.tsx`
- `apps/web/src/features/student-entry/kicked-screen.tsx`
- `apps/web/src/features/student-entry/student-entry-api.ts`
- `apps/web/src/features/student-entry/student-entry.test.tsx`
- `apps/web/src/features/student-entry/parse-exam-code.test.ts`

## Notes
- **Risk:** đỏ (UI vào thi công khai, chống dò, toàn màn hình; reviewer STRICT: a11y, thông điệp trung tính, không lộ tồn tại mã).
- `kicked-screen.tsx` được viết riêng ở đây và ở L7-02 (khác thư mục) để hai task cùng layer không trùng file.
- Phòng chờ dùng cùng nhịp 5 giây với heartbeat thi để học sinh nhận biết bị đẩy máy trong <= 5 giây (FR-043).
- Tham khảo prototype `index.html` bằng grep (`phong-cho`, `waiting`) chỉ cho bố cục; bỏ "Học sinh mẫu", "Game PIN", em-dash.
- Toàn màn hình bắt buộc trước khi bắt đầu là yêu cầu chống gian lận; nếu trình duyệt không hỗ trợ, thông báo rõ và không cho thi.
