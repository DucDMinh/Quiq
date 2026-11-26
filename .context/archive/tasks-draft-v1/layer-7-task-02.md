# Task 02: UI học sinh: làm bài và trang kết quả

## Layer
7

## Type
build

## Description
Màn **làm bài** `/thi/[code]/lam-bai` (FR-036, 041, 042, 044, 045) và **trang kết quả** `/thi/[code]/ket-qua` (FR-046, FR-047, C-07): Exam shell toàn màn hình, đồng hồ theo `ends_at` của máy chủ, ô đáp án chữ cái A-D, lưu từng câu + hàng đợi khi mất mạng, heartbeat 5 giây, bắt vi phạm (rời tab, thoát toàn màn hình), cảnh báo, tự nộp, các màn bị đẩy máy / gián đoạn / mất mạng / hết giờ, và trang điểm với nút "Xem đáp án".

## Dependencies
- layer-6-task-03 (toàn bộ `/api/student/attempts/*`, `/result`, `/solution`, `/api/student/media/:id`)
- layer-2-task-02 (api-client, `PortalShell`)
- layer-1-task-02 (primitive UI, `ViewportGuard keepMounted`)
- layer-1-task-03 (hằng số heartbeat, enum vi phạm, nhãn lý do kết thúc)

## Acceptance Criteria
- [ ] Task UI: đã đọc `skills/react-nodejs/design-tokens.md` + `.context/design-spec.md` §5.2, §5.3, §6.1 đến §6.4, §11; một hệ thiết kế; **không em-dash**; không hiện mã FR; chỉ desktop; ô đáp án dùng token `--answer-a..d` với huy hiệu chữ cái (không hình học), ô C chữ `--quiq-amber-ink`; mọi số/điểm/đồng hồ `font-mono tabular-nums`.
- [ ] **Exam shell**: topbar teal (tên bài, "Thí sinh: tên (mã) · Lần làm k/N", badge "Cảnh báo n/M" đỏ khi n >= 1, đồng hồ pill `mm:ss`, nút "Nộp bài (đã trả lời/tổng)"); thân 2 cột (câu hỏi | danh sách câu 310px, lưới 5 cột: hiện tại viền đậm, đã trả lời nền teal, chưa trả lời trắng, đánh dấu cờ). Khung ảnh `question-media-frame` giữ chỗ trước khi tải (không giật), ảnh tải qua `/api/student/media/:id` có `alt`.
- [ ] **Đồng hồ** (FR-041): chỉ đếm lùi từ `endsAt` với độ lệch `serverNow`; còn <= 120 giây nền hồng đậm; thông báo đọc màn hình (`aria-live`) chỉ ở mốc 5 phút, 1 phút, 30 giây (không đọc từng giây); toast ở mốc 5 phút và 1 phút; hết giờ -> dialog không đóng được "Hết giờ. Bài của bạn đang được nộp…" rồi chuyển trang kết quả (lý do "Hết giờ").
- [ ] **Chọn đáp án** (FR-042): chọn là lưu ngay (`PUT .../answers/:id`); đổi/bỏ chọn và nhảy giữa các câu tới lúc nộp; chọn 1 đáp án thì làm mờ ô còn lại, **câu nhiều đáp án không làm mờ** (D-5); đã chọn có dấu tick + viền trắng 3px; phím 1-4 hoặc A-D chọn, mũi tên trái/phải chuyển câu; "Đánh dấu xem lại" chỉ lưu ở trình duyệt; badge "Chọn 1 đáp án đúng"/"Chọn nhiều đáp án đúng" theo `multiAnswer` của payload (không suy ra đáp án).
- [ ] **Hàng đợi đáp án** (`answer-queue.ts`): lưu thất bại -> đánh dấu chấm vàng cạnh ô + banner vàng "Mất kết nối. Đang thử lại, bài làm vẫn được giữ trong máy này", giữ hàng đợi theo thứ tự, gửi lại khi có mạng (qua heartbeat `pending` và PUT), khi nối lại hiện banner xanh 3 giây "Đã kết nối lại"; đồng hồ vẫn chạy. Có test (mất mạng, thứ tự, trùng câu giữ lần cuối).
- [ ] **Heartbeat** mỗi 5 giây kèm `pending`; phản hồi `finished` -> điều hướng kết quả; 401 `SESSION_KICKED` -> màn toàn trang "Mã của bạn vừa được dùng ở thiết bị khác" ("Bài làm ở máy này đã dừng và được chấm theo các câu bạn đã chọn. Nếu đó không phải bạn, hãy báo giáo viên.", nút "Về trang vào thi", không hiện điểm) trong <= 5 giây.
- [ ] **Chống gian lận** (FR-044): bắt `visibilitychange`, `fullscreenchange`, `blur` -> `POST .../violations` (client chỉ gửi loại, không gửi số đếm); phản hồi `warn` -> dialog **bắt buộc xác nhận (không đóng bằng Esc)** "Cảnh báo n/M: bạn vừa rời khỏi trang thi hoặc thoát toàn màn hình. Thêm 1 lần nữa, bài sẽ tự nộp." (dòng cuối đổi theo n), nút "Quay lại làm bài" bật lại toàn màn hình; `autoSubmitted` -> màn "Bài đã được tự nộp do vi phạm quy chế thi" rồi sang kết quả với lý do; chống đếm trùng nhiều sự kiện cùng một lần rời (gộp trong cửa sổ ngắn). Không khóa chuột phải/dán. Màn thu nhỏ < 1024px đang thi: lớp phủ cảnh báo, **không unmount** (`keepMounted`), đồng hồ không dừng.
- [ ] **Nộp bài**: nút "Nộp bài" mở dialog xác nhận nêu số câu chưa trả lời và số câu đánh dấu; xác nhận -> `POST .../submit` -> chuyển kết quả.
- [ ] **Gián đoạn**: attempt trả `interrupted` (tải lại sau khi quá ngưỡng) -> màn "Lần làm này đã bị gián đoạn": "Bài đã được chấm theo các câu bạn đã chọn (bạn không xem điểm lần này)", "Bạn còn k lượt", nút "Về phòng chờ" (còn lượt và chưa thu bài) hoặc "Thoát"; **không hiển thị điểm**. Tải lại trong ngưỡng thì làm tiếp đúng bài cũ (đáp án đã chọn được khôi phục).
- [ ] **Trang kết quả** `/thi/[code]/ket-qua?a=<attemptId>` (860px): hero "Đã hoàn thành bài thi", tên (mã), "Lý do kết thúc: Đã nộp bài / Hết giờ / Vi phạm quy chế / Giáo viên thu bài · Lượt #k", khối điểm nền `--quiq-brand-dark` nhãn `--on-brand-dark-label` với **điểm lớn mono 2 chữ số thập phân** và "Đúng a/b câu (thang 10)"; điểm hiện ngay cả khi bị tự nộp do thu bài (C-07); ghi chú "Đóng trang này thì không có nơi khác để xem lại đáp án"; nút **"Xem đáp án" luôn hiện**: bấm khi chưa công bố -> alert danger "Giáo viên chưa công bố đáp án" tại chỗ và không lộ gì; đã công bố -> khối "Đề thi và đáp án đúng" (từng câu có ảnh, 4 đáp án dạng mini, đáp án đúng badge "Đúng" + viền xanh, **không hiển thị câu đã chọn**); nút "Thoát về cổng chính". Không có đường vào xem đáp án nào khác.
- [ ] Test PASS (Vitest + Testing Library, đồng hồ giả): đồng hồ + mốc thông báo, hàng đợi, vi phạm (cả auto-submit), kicked, interrupted, phím tắt, mờ ô theo loại câu, trang kết quả (hiện điểm, chưa/đã công bố), không có `is_correct` trong state client, không em-dash.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/web/src/app/thi/[code]/lam-bai/page.tsx`
- `apps/web/src/app/thi/[code]/ket-qua/page.tsx`
- `apps/web/src/features/exam-taking/exam-shell.tsx`
- `apps/web/src/features/exam-taking/question-card.tsx`
- `apps/web/src/features/exam-taking/answer-option.tsx`
- `apps/web/src/features/exam-taking/question-nav.tsx`
- `apps/web/src/features/exam-taking/exam-clock.tsx`
- `apps/web/src/features/exam-taking/submit-dialog.tsx`
- `apps/web/src/features/exam-taking/violation-dialog.tsx`
- `apps/web/src/features/exam-taking/timeout-dialog.tsx`
- `apps/web/src/features/exam-taking/interrupted-screen.tsx`
- `apps/web/src/features/exam-taking/kicked-screen.tsx`
- `apps/web/src/features/exam-taking/offline-banner.tsx`
- `apps/web/src/features/exam-taking/answer-queue.ts`
- `apps/web/src/features/exam-taking/use-exam-session.ts`
- `apps/web/src/features/exam-taking/use-integrity-guard.ts`
- `apps/web/src/features/exam-taking/exam-taking-api.ts`
- `apps/web/src/features/exam-result/result-hero.tsx`
- `apps/web/src/features/exam-result/solution-view.tsx`
- `apps/web/src/features/exam-result/result-api.ts`
- `apps/web/src/features/exam-taking/answer-queue.test.ts`
- `apps/web/src/features/exam-taking/exam-clock.test.tsx`
- `apps/web/src/features/exam-taking/exam-session.test.tsx`
- `apps/web/src/features/exam-taking/integrity-guard.test.tsx`
- `apps/web/src/features/exam-result/exam-result.test.tsx`

## Notes
- **Risk:** đỏ (chống gian lận, thời gian, mất mạng, không lộ đáp án; reviewer STRICT: a11y, hành vi khi mất mạng/đồng hồ, kiểm quét em-dash, kiểm state client không chứa đáp án đúng).
- Màn này là trải nghiệm quan trọng nhất; ưu tiên tính đúng của trạng thái hơn hiệu ứng. Motion chỉ phản hồi trạng thái, tôn trọng `prefers-reduced-motion`.
- `kicked-screen.tsx` ở đây độc lập với bản của L7-01 (khác thư mục).
- Giờ máy chủ là nguồn sự thật: client không bao giờ tự quyết hết giờ ngoài việc hiển thị; server là bên nộp/chấm.
- Prototype `index.html` chỉ tham khảo bố cục (grep `answer`, `exam`); bỏ các nút giả lập "Rời tab", "Gián đoạn >60 giây" (D-2).
