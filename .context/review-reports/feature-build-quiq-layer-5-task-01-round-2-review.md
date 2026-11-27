Agent: reviewer

# Review: build-quiq layer-5-task-01, round 2
Công bố đáp án / Công bố bảng điểm theo lớp + học sinh "Xem đáp án" (sửa R1 theo quyết định user)

- Worktree: `E:/Quiq/.worktrees/layer-5__task-01` (branch `wt/layer-5__task-01`), thay đổi chưa commit
- Review level: **STRICT**
- Reason: lộ đáp án đúng, khóa hàng/transaction mới (race, deadlock), đổi shared DTO `ExamClassState` (roster + SSE), phân quyền + cô lập trường.
- Quyết định user (R1): "Công bố đáp án" chỉ khi MỌI lớp của bài đã thu bài xong (lớp `draft` cũng chặn); "Công bố bảng điểm" giữ theo lớp.

## Blast radius
- `apps/api/src/modules/class-control/service.ts`: `loadOwnedExamClass` (dùng bởi dispatch, close, publish, roster, stream) có thêm `otherClassesOpen` = 2 query phụ mỗi lần gọi; transaction mới `publishAnswersWhenExamFinished` khóa FOR UPDATE mọi `exam_classes` của bài.
- `apps/api/src/modules/attempts/answers.ts`: kiểm phòng thủ thêm.
- Shared: `ExamClassState.otherClassesOpen`, lỗi `OTHER_CLASSES_NOT_CLOSED` (409).
- Web: `publish-actions.tsx` khóa riêng nút đáp án + gợi ý; fixtures test cập nhật field mới.

## Verify commands + result (lệnh trong `.context/project-config.md`, chạy trong worktree)
| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm test` | PASS, 41 files / 460 tests (khớp khai báo builder) |
| `pnpm build` | PASS |

## Kiểm đặc biệt theo yêu cầu orchestrator

### 1. Race / deadlock (khóa FOR UPDATE nhiều hàng)
Liệt kê mọi chỗ khóa trong API (grep `.for(` / `transaction(`, bỏ test):
| Đường | Khóa trên `exam_classes` | Có thể tạo chu trình với publish? |
|---|---|---|
| `attempts/start.ts:67-79` Bắt đầu | FOR UPDATE **1 hàng** (lớp của phiên), rồi INSERT attempts | Không: giữ 1 hàng, publish không chờ khóa nào khác ngoài `exam_classes` |
| `class-control/service.ts:95-105,133-138` phát đề / thu bài | UPDATE autocommit **1 hàng** | Không |
| `attempts/finalize.ts:99-104`, `attempts/service.ts:169-175` | khóa hàng `attempts`, không đổi FK | Không (publish chỉ đọc `attempts`, không khóa) |
| `student/service.ts:132` vào phòng | INSERT `student_sessions` → FK KEY SHARE 1 hàng lớp | Không chu trình; chỉ chờ ngắn trong lúc publish giữ khóa |
| Hai lần publish-answers ở hai lớp khác nhau của cùng bài (2 tab) | cả hai khóa mọi hàng theo cùng `ORDER BY id` | Không: xếp hàng tuần tự, không deadlock |
| `exams/delete.ts:29-33` xóa đề (G-10) | FOR UPDATE **mọi hàng** của bài, **không ORDER BY** | **Có thể**: hai transaction khóa nhiều hàng cùng tập theo thứ tự có thể khác nhau |

Kết luận: thứ tự `ORDER BY id` ở publish (`service.ts:239-244`) đúng; chỉ đường xóa đề (G-10, đã có gap) có thể deadlock với publish. Điều kiện xảy ra rất hẹp: xóa đề đòi `attemptCount = 0` (`delete.ts:24,42`), publish đòi mọi lớp `closed`, nên chỉ một bài đã phát + thu mà không ai làm, và giáo viên xóa đề đúng lúc bấm công bố. Postgres phát hiện deadlock và hủy một bên (lỗi 500 cho một request), không hỏng dữ liệu. Không chặn; ghi m1.

Tính đúng của check-then-write: grep `update(examClasses)` trong `apps/api/src` (bỏ test) chỉ có 3 chỗ: `service.ts:96` (draft → dispatched), `:135` (dispatched → closed), `:225` (chỉ ghi mốc công bố). Không có đường nào mở lại lớp `closed`, nên `closed` là trạng thái cuối. Cộng với `draft` bị chặn và lớp đã đóng không Bắt đầu thêm được, khi `hasUnfinishedClass` thấy mọi lớp đã xong thì điều đó không đảo lại giữa lúc kiểm và lúc ghi. Khóa FOR UPDATE là phòng thủ thêm, không sai, chi phí thấp. Idempotent giữ nguyên nhờ UPDATE có điều kiện `IS NULL` (`markPublished`, `service.ts:222-230`).

### 2. Chi phí truy vấn thêm trong `loadOwnedExamClass`
- Thêm tối đa 2 query mỗi lần gọi (`service.ts:45`, `hasUnfinishedClass` `:186-206`): `exam_classes` theo `exam_id` (có index tiền tố của unique `exam_classes_exam_class_key (exam_id, class_id)`, `packages/db/src/schema/exam.ts:134`) + `attempts JOIN exam_classes` lọc `status='in_progress'` (index `attempts_exam_class_status_idx (exam_class_id, status)`, `attempt.ts:108`), cả hai `LIMIT 1`, số lớp mỗi bài nhỏ.
- Stream gọi `getRoster` tuần tự, gộp nhịp (`stream.ts:20,92,99,107-110`), nên không nhân lên theo sự kiện. dispatch/close gọi `loadOwnedExamClass` 2 lần nên tính thừa 4 query không cần.
- Chấp nhận được, không chặn; ghi m2 (tối ưu tùy chọn).

### 3. Test có thật sự bắt được rò đáp án
- `publish.test.ts:169-194`: A đóng, B đang thi → publish-answers 409 `OTHER_CLASSES_NOT_CLOSED`, DB không ghi, `otherClassesOpen=true`, publish-scores vẫn 200, học sinh A gọi `/answers` → 409 `ANSWERS_NOT_PUBLISHED`; B thu bài → công bố được, A xem được (200). Có khẳng định hai chiều (bị chặn rồi mở).
- `publish.test.ts:196-218`: lớp anh em `draft` bị chặn; lớp anh em `closed` còn attempt in_progress bị chặn; DB không đổi.
- `answers.test.ts:183-204`: kiểm phòng thủ ở `answers.ts:68` thật sự được kích hoạt (đặt lại lớp 10A2 `dispatched` bằng DB sau khi đã công bố → A nhận 409, `expectNoPaperContent` kiểm không có id/nội dung câu/đáp án); đề của học sinh lớp kia (`POST /attempts` và `GET /attempts/:id`) không có cờ đúng. Đóng M1 (phần `/paper`).
- `publish.test.ts:220-233`: hai lần công bố đồng thời → cùng mốc, realtime phát đúng 1 lần. Đóng M2. Lưu ý: PGlite một kết nối nên hai request thực tế tuần tự hóa ở DB; test chứng minh tính idempotent, không chứng minh hành vi khóa đa kết nối (Residual).
- Web `publish-actions.test.tsx:89-94`: `otherClassesOpen: true` → nút "Công bố đáp án" disabled, "Công bố bảng điểm" vẫn enabled, hiện gợi ý "Mọi lớp của bài phải thu bài trước khi công bố đáp án." Khớp quyết định user (bảng điểm giữ theo lớp).

### 4. `/correct/i` cho SSE có khớp field thật không
- `stream.test.ts:241` dùng `expect(event.data).not.toMatch(/correct/i)` trên chuỗi JSON thô của event (nếu `data` là object thì `toMatch` sẽ ném lỗi và test fail, nên đây là chuỗi). Regex không phân biệt hoa thường khớp `isCorrect` (field thật ở `packages/shared/src/student/schemas.ts:141`, `packages/db/src/schema/exam.ts:99`) và cả `is_correct`. Đúng và chặt hơn cần thiết (roster không có key nào chứa "correct"). Đóng M1 (phần SSE).
- `answers.test.ts` `expectNoAnswerKey` dùng `/correct/i` trên mọi key trừ đúng `correct` (đếm số câu đúng của result), cũng khớp `isCorrect`.

## Findings

Không còn CRITICAL/MAJOR. R1 (round 1) đã đóng theo đúng quyết định user: chặn ở lúc công bố (`service.ts:237-248`) + chặn phòng thủ ở lúc đọc (`answers.ts:66-68`), cả hai có test.

### [MINOR] m1. Khả năng deadlock với xóa đề (G-10)
- `apps/api/src/modules/exams/delete.ts:29-33` khóa mọi hàng lớp không `ORDER BY`, publish khóa theo `ORDER BY id`. Điều kiện rất hẹp (xem mục 1), Postgres tự phát hiện, không hỏng dữ liệu. Đề xuất: khi xử lý gap G-10, thêm `.orderBy(asc(examClasses.id))` ở `delete.ts` để mọi đường khóa nhiều hàng cùng thứ tự. Ngoài scope task này, không chặn.

### [MINOR] m2. `otherClassesOpen` tính ở mọi lần gọi `loadOwnedExamClass`
- `apps/api/src/modules/class-control/service.ts:45`. dispatch/close/publish (2 lần mỗi lệnh) và mọi lần roster đều chạy thêm 2 query, kể cả khi lớp chưa `closed` hoặc đáp án đã công bố (khi đó giá trị không dùng). Đề xuất tùy chọn: chỉ tính khi `status === 'closed' && answersPublishedAt === null`. Không chặn vì query có index và `LIMIT 1`.

### [MINOR] m3. `otherClassesOpen` trên bảng lớp A có thể cũ tới một nhịp refresh
- Thu bài lớp B chỉ `realtime.publish(<id lớp B>)` (`service.ts:173`), nên SSE của lớp A không được đánh thức; nút "Công bố đáp án" của A còn khóa tới nhịp refresh định kỳ hoặc khi giáo viên chuyển lớp. Server vẫn là nguồn sự thật (không có rủi ro rò), chỉ là UX. Đề xuất tùy chọn: sau khi thu bài, phát tín hiệu cho mọi lớp cùng bài.

### [NIT] n1. Kiểm "không lộ nội dung" yếu ở `publish.test.ts:188`
- `not.toContain("Ngân hàng")` chỉ dò một chuỗi. Đã có kiểm đầy đủ `expectNoPaperContent` ở `answers.test.ts:193-196`, nên chỉ là NIT.

### [NIT] n2. Mã lỗi khi chính lớp này bị lệch giữa chừng
- Trong transaction, `hasUnfinishedClass(tx, examId)` (`service.ts:245`) không loại trừ lớp hiện tại; nếu chính lớp này có attempt in_progress xuất hiện giữa lần kiểm `hasRunningAttempt` và transaction (thực tế không xảy ra vì lớp đã đóng) thì trả `OTHER_CLASSES_NOT_CLOSED` thay vì `CLASS_NOT_CLOSED`. Không ảnh hưởng an toàn.

Close-out (không thuộc round này): `docs/API_SPEC.md` thêm 2 endpoint publish, `/answers`, các field `answersPublishedAt`/`scoresPublishedAt`/`otherClassesOpen`, lỗi `CLASS_NOT_CLOSED`/`OTHER_CLASSES_NOT_CLOSED`/`ANSWERS_NOT_PUBLISHED`; gap G-10 ghi thêm ghi chú m1.

## Responsive Checklist Gate
Project có `ui:` (`responsive_breakpoints: [375, 768, 1280]`), diff đụng UI. Thay đổi UI round 2 chỉ là điều kiện `disabled` + gợi ý chữ trong `publish-actions.tsx`.
| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Layout | OK ở 1280 / N/A 375-768 (desktop-only theo AC) | Nút/gợi ý nằm trong `flex flex-wrap gap-3` của `ClassActions`, tự xuống dòng; không thêm container cố định. |
| Typography/Spacing | OK | Token Tailwind sẵn có, không px cứng mới. |
| Media | N/A | Không có ảnh/video. |
| Touch/Interaction | N/A (desktop-only theo AC) | Dùng `Button` design system. |
| Viewport/A11y | OK | Không `100vh`, không animation; nút khóa có gợi ý bằng chữ. |

## Skill gates
| Gate | Kết quả |
|---|---|
| aislop | skip, `aislop` not installed (đã xác nhận round 1, exit 127; không chạy lại theo Tool Loop Guard) |
| oxlint (anti-slop) | skip, oxlint not configured; eslint PASS |
| ocr (open-code-review) | skip, backend LLM hết quota 429 (round 1, retry sau ~5 giờ); không chạy lại |
| AI-readable | OK: tên rõ (`hasUnfinishedClass`, `markPublished`, `publishAnswersWhenExamFinished`), mọi hàm < 50 dòng, `service.ts` 272 dòng (< 300), comment nêu WHY (R1, thứ tự khóa); 0 indicator |
| ai-friendly-web | N/A (nội bộ) |
| blitzstrike | skip, không có môi trường pentest được phép |
| Em-dash | OK: grep `—` trên các file thay đổi: 0 |

## Residual risk
- Hành vi khóa đa kết nối (chờ khóa, deadlock với xóa đề) chỉ phân tích tĩnh; PGlite một kết nối nên test không chứng minh được.
- N/A cho 375/768 dựa duy nhất vào AC task ("chỉ desktop", task file dòng 40); `.context/project-config.md` khai báo 3 breakpoint và không có cờ desktop-only. Không chặn vì thay đổi UI round 2 chỉ là điều kiện `disabled` + chữ gợi ý trong `flex-wrap` sẵn có.
- Chưa xem UI bằng browser; chỉ xác minh qua test DOM.

## Verdict
**PASS.** R1 đã đóng đúng quyết định user, có test hai chiều cho chặn lúc công bố và chặn phòng thủ lúc đọc; web khóa riêng nút đáp án, bảng điểm vẫn bấm được (có test). M1/M2 round 1 đã đóng, 4 lệnh verify xanh (460/460). Các MINOR/NIT còn lại không chặn; m1 nên ghi vào gap G-10 khi close-out.
