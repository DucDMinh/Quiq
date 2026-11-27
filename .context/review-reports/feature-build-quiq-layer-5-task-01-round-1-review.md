Agent: reviewer

# Review: build-quiq layer-5-task-01, round 1
Công bố đáp án / Công bố bảng điểm theo lớp + học sinh "Xem đáp án"

- Worktree: `E:/Quiq/.worktrees/layer-5__task-01` (branch `wt/layer-5__task-01`, base `layer-5-integration`), thay đổi chưa commit
- Review level: **STRICT**
- Reason: lộ đáp án đúng (dữ liệu nhạy cảm nhất của hệ thống thi), phân quyền giáo viên/học sinh, cô lập trường, đổi shared DTO `ExamClassState` (roster, SSE, các màn class-control/exams), route mới công khai cho phiên học sinh.

## Blast radius
- API: `POST /api/teacher/exams/:examId/classes/:classId/publish-answers|publish-scores` (mới), `GET /api/student/attempts/:id/answers` (mới); `loadOwnedExamClass`/`toClassState` dùng chung bởi dispatch/close/roster/stream nên mọi payload `ExamClassState` có thêm 2 field.
- Shared: `packages/shared/src/exams/{schemas,errors}.ts` (`ExamClassState`, `PublishKind`, `CLASS_NOT_CLOSED`), `packages/shared/src/student/{schemas,errors}.ts` (`AttemptAnswersView`, `ANSWERS_NOT_PUBLISHED`).
- Web: class-control (control-panel, publish-actions mới, use-roster), student result-view + answers-view mới, student-api.
- Data: chỉ ghi `exam_classes.answers_published_at` / `scores_published_at` (đã có cột, không migration).

## Verify commands + result (lệnh trong `.context/project-config.md`, chạy trong worktree)
| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS (engine, db, shared, api, web) |
| `pnpm lint` | PASS (eslint không lỗi) |
| `pnpm test` | PASS, 41 files / 454 tests (API chạy trên PGlite thật đã migrate, không skip) |
| `pnpm build` | PASS (next build) |

## Kiểm theo yêu cầu orchestrator
| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| Payload cũ không mang cờ đúng | OK | Grep `isCorrect` trong api/shared: ngoài `answers.ts` mới, chỉ teacher-side (exams/questions) và `finalize.ts` (chấm, nội bộ). `loadPaperQuestions` (`attempts/service.ts:58`) không chọn `is_correct`. Test `answers.test.ts:165-173` khẳng định result/state/roster sau công bố không có key `*correct*`. Stream dùng chung roster (không đọc lại `stream.ts`, xem Residual). |
| Route mới lọc school_id | OK | publish: `loadOwnedExamClass` lọc `examClasses.schoolId`, `exams.schoolId`, `exams.teacherId` (`class-control/service.ts:34-41`). answers: `loadOwnedAttempt` lọc studentId + examClassId của phiên, thêm `examClasses.schoolId = session.schoolId` (`attempts/answers.ts:62`). Test 404 giáo viên khác/trường khác, học sinh khác/trường khác. |
| Idempotent + race | OK | UPDATE có điều kiện `status='closed' AND <mốc> IS NULL` (`service.ts:219-221`): bấm lại hoặc 2 request đồng thời giữ mốc đầu. Check-then-update `hasRunningAttempt` không có TOCTOU thực tế vì lớp `closed` không Bắt đầu thêm được (start khóa FOR UPDATE, kiểm `dispatched`). |
| Realtime chỉ phát khi có ghi | OK | `if (updated.length > 0) deps.realtime?.publish(...)` (`service.ts:221`), test spy `publish.test.ts:127-139`. Phát sau khi UPDATE đã commit (không bọc transaction). |
| Test thật sự khẳng định AC | OK | 409 `CLASS_NOT_CLOSED` + DB không đổi (draft, dispatched, closed còn bài đang làm); mốc giữ khi bấm lại (clock advance); BR-010 độc lập 2 chiều; `/answers` chưa công bố không chứa id/nội dung câu/đáp án; attempt chưa xong 409; C-07 (`endReason: closed`) xem được; thứ tự câu/đáp án khớp paper của attempt; cờ đúng khớp DB; key set chính xác + id đáp án đã chọn xuất hiện đúng 1 lần (không có trường lựa chọn). Web: nút khóa, dialog, badge, alert, khối đáp án, 2 lần bấm gọi 2 lần API, không có `answer-tick`/"Đã chọn"/`aria-pressed`. |
| Dialog nói không hủy được | OK | `publish-actions.tsx:123` "Không thể hủy công bố sau khi xác nhận." (test `publish-actions.test.tsx:74,80`). |
| Không em-dash | OK | Grep `—` trên các file thay đổi: 0 kết quả. |
| `/answers` không trả lựa chọn, không trả nội dung khi chưa công bố | OK | Kiểm `answersPublishedAt` trước khi đọc câu (`answers.ts:64` trước `:67`); không select bảng answers. |

## Lệch khai báo của builder (đánh giá: hợp lệ, không phải finding)
- `publish-actions.tsx` (+test) tách khỏi `control-panel.tsx`: giữ control-panel gọn, trace về task.
- `use-roster.ts` thêm `classControlApi.publish`: API client cần thiết, 2 dòng.
- Fixture `exams.test.tsx` / `class-control.test.tsx` thêm 2 field null: bắt buộc do đổi type `ExamClassState`.
- `ANSWERS_NOT_PUBLISHED` = 409: task cho phép 403/409.
- `/answers` gọi `expireDueAttempts`: nhất quán với `/result`, `/paper`, `/state` (cùng pattern ở `attempts/service.ts:137,149,241`).
- Chặn lớp `closed` còn attempt `in_progress`: chặt hơn task, đúng tinh thần "đã thu bài xong"; có test + UI gợi ý "Thu bài lại".
- Không có ảnh: schema chưa có cột ảnh, ngoài scope.
- Test ResultView đổi `status` → `alert`: theo yêu cầu task ("alert ... tại chỗ").
- Enum attempt có `interrupted` nhưng API không set giá trị này ở đâu (grep `"interrupted"` chỉ thấy ở roster.ts đọc), nên `submitted` là trạng thái kết thúc duy nhất; `answers.ts:56` đúng.

## Findings

### [MAJOR] R1. Rò đáp án chéo lớp cùng bài (residual builder đã nêu, đang chờ user quyết)
- Vị trí: `apps/api/src/modules/attempts/answers.ts:58-67` (chỉ kiểm `answersPublishedAt` của lớp của attempt) và `apps/api/src/modules/class-control/service.ts:209-213` (chỉ kiểm lớp đang công bố).
- Bằng chứng: `apps/api/src/modules/exams/create.ts:127-128` tạo nhiều `exam_classes` cho cùng một `exam`; câu hỏi/đáp án thuộc `exam` (`loadAnswerKeyQuestions` theo `examId`), các lớp chỉ khác thứ tự trộn. Lớp A thu bài + công bố đáp án trong khi lớp B cùng bài đang `dispatched` (hoặc còn `draft`, phát sau) → học sinh A xem toàn bộ đáp án đúng và chuyền cho B. Đây chính là mối đe dọa mà quyết định "chỉ công bố khi đã thu bài" của user nhằm chặn, nên mức độ thực tế là MAJOR (bảo mật nội dung thi), không phải NIT.
- Theo chỉ đạo orchestrator: **không tính là lỗi của builder** (implementation đúng task như đang viết), nhưng phải được user quyết trước khi merge/close-out.
- Cách sửa gọn nhất (đề xuất): kiểm tại lúc đọc trong `getAttemptAnswers`, ngay trước `loadAnswerKeyQuestions`: thêm 1 query `exists exam_classes where exam_id = examClass.examId and status = 'dispatched'` → nếu có thì trả `ANSWERS_NOT_PUBLISHED` (hoặc mã riêng, vd `EXAM_STILL_RUNNING`), không trả nội dung. Ưu điểm so với chặn lúc công bố: tự mở khi lớp anh em thu bài xong, và vẫn che nếu lớp `draft` được phát sau khi đã công bố. Kèm 1 test API: 2 lớp cùng bài, A closed + published, B dispatched → A nhận lỗi không nội dung; B close → A xem được.
- Lỗ còn lại sau cách sửa trên: học sinh đã xem đáp án TRƯỚC khi lớp `draft` anh em được phát. Đóng hẳn cần chặn phát đề lớp anh em sau khi đã công bố đáp án (hoặc cảnh báo giáo viên ở dialog phát đề). Đây là quyết định sản phẩm, cần user chọn.
- Bảng điểm (`publish-scores`) không lộ đáp án nên không cần kiểm lớp anh em.

### [MINOR] M1. Test rò cờ đúng chưa phủ `/paper` và SSE stream sau công bố
- `apps/api/src/modules/attempts/answers.test.ts:165-173` chỉ kiểm result/state/roster. Bằng chứng tĩnh đủ an toàn (`loadPaperQuestions` không chọn `is_correct`, `attempts/service.ts:58`; stream dùng roster), nên không chặn. Đề xuất: thêm body của event SSE đầu tiên vào `expectNoAnswerKey` khi tiện.

### [MINOR] M2. Chưa có test công bố đồng thời
- Logic `IS NULL` có điều kiện là đúng; có thể thêm 1 test `Promise.all([publish, publish])` khẳng định cùng một mốc và realtime phát đúng 1 lần. Không chặn.

### [NIT] N1. `loadAnswerKeyQuestions` lặp cấu trúc với `loadPaperQuestions`
- `apps/api/src/modules/attempts/answers.ts:13-42`. Chấp nhận được: tách riêng đường đọc `is_correct` khỏi đường đọc đề là chủ đích bảo mật (comment ở cả hai nơi). Không cần sửa.

### [NIT] N2. `answers-view.tsx:40` dùng `grid-cols-2` cố định
- Chấp nhận vì AC ghi "chỉ desktop"; nếu sau này mở mobile cần `grid-cols-1` ở mốc nhỏ.

Close-out (không thuộc round này): `docs/API_SPEC.md` phải thêm 2 endpoint publish + `/answers` + field mới của `ExamClassState` (task ghi `Doc-Impact` không được `none`).

## Responsive Checklist Gate
Project có `ui:` (`responsive_breakpoints: [375, 768, 1280]`, `.context/project-config.md:139-140`) và diff đụng UI, nhưng AC task ghi rõ "chỉ desktop". Đánh giá ở 1280:
| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Layout (không scroll ngang, grid) | OK ở 1280 / N/A 375-768 (desktop-only) | Nút publish nằm trong `flex flex-wrap gap-3` (control-panel.tsx:155) nên tự xuống dòng; khối đáp án `flex-col`, option `min-w-0 flex-1 break-words`. `grid-cols-2` cố định (N2). |
| Typography/Spacing | OK | Dùng token Tailwind (`text-sm`, `text-base`, `text-xl`, `gap-*`), không px cứng mới. |
| Media | N/A | Không có ảnh/video (schema chưa có cột ảnh). |
| Touch/Interaction | N/A (desktop-only) | Dùng `Button`/`Badge` của design system. |
| Viewport/A11y | OK | Không dùng `100vh`, không thêm animation; đúng được đánh dấu bằng chữ "Đúng" + viền (không chỉ màu); khối có `section aria-labelledby`; lỗi dùng `Alert` role alert. |
Không có browser: chưa xác minh trực quan, ghi Residual.

## Skill gates
| Gate | Kết quả |
|---|---|
| aislop | skip, `aislop` not installed (exit 127) |
| oxlint (anti-slop) | skip, oxlint not configured (không có `.oxlintrc.json`); eslint PASS |
| ocr (open-code-review) | skip, ocr chạy nhưng LLM backend trả 429 quota, không có kết quả |
| AI-readable | OK: tên rõ (`publishClass`, `hasRunningAttempt`, `getAttemptAnswers`, `PUBLISHED_COLUMN`), mọi hàm < 50 dòng, file < 300 dòng, comment nêu WHY (FR/BR/C), không magic number; 0 indicator |
| ai-friendly-web | N/A (tính năng nội bộ sau đăng nhập/phiên thi) |
| blitzstrike | skip, không có môi trường pentest được phép |

## Residual risk
- R1 ở trên (chờ user quyết).
- Không đọc lại `apps/api/src/modules/class-control/stream.ts` (giới hạn tool đọc): giả định SSE gửi roster qua `getRoster`/`toClassState` như builder và test roster khẳng định; nếu stream có payload riêng thì cần kiểm thêm.
- Không có browser: badge/nút/dialog chưa xem trực quan; chỉ xác minh qua test DOM.

## Verdict
**PASS (implementation của builder đúng task như đang viết; mọi AC có test, 4 lệnh verify xanh)** **nhưng chưa được merge/close-out/commit-first cho tới khi user quyết R1 (MAJOR, rò đáp án chéo lớp cùng bài).** Nếu user chọn sửa → builder làm fix gọn ở `getAttemptAnswers` + 1 test như mô tả, reviewer chạy round 2. Nếu user chấp nhận rủi ro → ghi R1 vào gap register làm residual có chủ đích rồi mới close-out.
