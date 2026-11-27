Agent: reviewer

# Review: build-quiq layer-5-task-02 (Tra cứu điểm công khai `/tra-cuu`), round 1

- Worktree: `E:/Quiq/.worktrees/layer-5__task-02` (branch `wt/layer-5__task-02`, base `layer-5-integration`). Thay đổi chưa commit.
- Task file: `tasks/build-quiq/layer-5-task-02.md`

## Review level
STRICT

## Reason
Endpoint công khai, không đăng nhập, đọc dữ liệu học sinh. Phải kiểm chống dò mã, PII, cô lập trường (tenant isolation) và rate-limit. AGENTS.md § Reviewer rules bắt buộc STRICT cho loại thay đổi này.

## Blast radius
- API mới: `GET /api/lookup/schools`, `GET /api/lookup/schools/:schoolId/years`, `POST /api/lookup` (module `apps/api/src/modules/lookup/*`, module loader tự nạp). Không sửa module cũ, không có migration.
- Shared mới: `packages/shared/src/lookup/*`. Chỉ import `normalizeStudentCode` của `student/schemas`, không sửa file đó.
- Web mới: `apps/web/src/app/tra-cuu/page.tsx`, `apps/web/src/features/lookup/*`. `apps/web/src/app/page.tsx` chỉ thêm 1 link. Dùng lại `PortalFrame`/`LoadError` (import, không sửa) và `MIN_WIDTH_EXEMPT_PATHS` có sẵn (`/tra-cuu`).
- Dữ liệu: chỉ đọc, không ghi DB.

## Verify commands + result
Lệnh lấy từ `.context/project-config.md`, chạy trong worktree.

| Lệnh | Kết quả |
|---|---|
| `pnpm test` | PASS: 40 file, 465 test |
| `pnpm typecheck` | PASS (db, engine, shared, api, web) |
| `pnpm lint` | PASS (eslint không báo lỗi) |
| `pnpm build` | PASS (`/tra-cuu` prerender static) |

## Kiểm theo yêu cầu STRICT

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Mọi bước lọc `school_id` | OK | `service.ts:32` (years), `:47` (resolveYearId), `:62` (students), `:91` classes, `:100` enrollments, `:103` exams, `:104` subjects, `:105` exam_classes, `:120` attempts. Năm học của trường khác trả rỗng (test `lookup.test.ts:175`). |
| Ghi danh đúng lớp của exam_class | OK | `service.ts:97-101` join `enrollments.classId = examClasses.classId` + `studentId`. |
| Năm học qua exam_class -> class -> academic_year | OK | `service.ts:92`. Không lọc năm qua enrollments (đúng G-13). Test 2 năm học `lookup.test.ts:162`. |
| `codeVoided` | OK | `service.ts:64`. Test mã vô hiệu có điểm 10 vẫn trả rỗng (`lookup.test.ts:210`). |
| `anonymizedAt` | OK | CHECK `students_anonymized_voids_code_check` (`packages/db/src/schema/people.ts:83`): đã ẩn danh thì bắt buộc `codeVoided`, nên filter `codeVoided` đã loại các học sinh này. |
| Không lộ đáp án / attempt id / student id / PII | OK | Response chỉ có `{ items: [{ subjectName, examTitle, examCode, score }] }` (`service.ts:159-166`). Test khẳng định đúng tập key và body không chứa studentId, họ tên, tên lớp (`lookup.test.ts:224`). `GET /lookup/schools` chỉ trả id + name (`:268`). |
| Chống dò mã: response giống hệt | OK | Mã không tồn tại, mã vô hiệu, chưa công bố, trường không tồn tại, năm không thuộc trường: tất cả trả `EMPTY_RESULT`. Test so sánh body (`lookup.test.ts:207`, `:262`). Lượt được tính trước khi parse body (`routes.ts:35-36`, test `:309`). |
| Trường bị khóa (C-09) | OK | Không dùng guard trạng thái trường. Test trường `locked` (`lookup.test.ts:240`). |
| Cô lập 2 trường cùng mã | OK | Test `lookup.test.ts:251`. |
| Điểm chính thức + điểm 0 không ghi DB | OK | `officialScore(...) ?? 0` (`service.ts:164`), chỉ tính attempt `submitted` có score. Test nhiều attempt và test điểm 0 có kiểm bảng attempts không thêm hàng (`lookup.test.ts:80`, `:94`). |
| Zod validate | OK | `schemas.ts:9-17`, params `:schoolId` uuid (`routes.ts:30`). Không có mass assignment. |
| SQL injection | OK | Drizzle bind tham số, kể cả `sql\`upper(${students.code}) = ${studentCode}\`` (cùng mẫu với `modules/student/service.ts:62`). |
| Rate-limit 429 + Retry-After, trần khóa | OK về code, FAIL về hiệu lực production (M1) | `rate-limit.ts`: 30 lượt/60s, trần 10.000 khóa. Test đồng hồ giả (`lookup.test.ts:296`, `:315`, `:330`). |

## Đánh giá các residual builder nêu

1. **app.proxy tắt, nên sau rewrite Next limit 30/phút thành toàn cục.** Đúng, và là **MAJOR** (M1). Lý do: diff thêm một endpoint công khai mới. Sau proxy, limiter của nó thực chất là 30 lượt/phút cho cả hệ thống. Một script gửi 30 request/phút là chặn tra cứu của mọi học sinh, lặp lại được. Một lớp 40 học sinh cùng tra ngay sau khi công bố cũng đã bị 429. Gốc là G-01 (`app.ts`), nhưng hậu quả DoS trên endpoint công khai là phơi nhiễm mới do diff này tạo ra. Hướng xử lý ở mục Findings.
2. **Chênh lệch thời gian giữa mã đúng và mã sai.** Mã đúng chạy thêm 1-3 truy vấn. Về lý thuyết đo được, nhưng rate-limit giới hạn tốc độ thử và jitter mạng lớn hơn chênh lệch. Mã dạng `HS001` vốn đoán được nên lớp bảo vệ thật là rate-limit (phụ thuộc M1). **MINOR, chấp nhận**, ghi residual.
3. **Học sinh ở 2 lớp cùng năm cùng bài thì ra 2 dòng.** Chỉ xảy ra khi cùng một exam giao cho 2 lớp và học sinh ghi danh cả hai (`enrollments` unique theo cặp student/class). Mỗi dòng là một exam_class riêng có điểm riêng, nên không sai dữ liệu. Web đã dùng key kèm index. **NIT, chấp nhận.**
4. **Lỗi tải năm học thì hiện "Chưa có năm học".** Xem m2. Vẫn tra được vì máy chủ tự dùng năm hiện tại. **MINOR.**
5. **Không tự nộp bài quá giờ.** Attempt còn `in_progress` sau giờ được tính 0. Đây là hành vi của luồng thi/thu bài, lookup chỉ phản ánh dữ liệu. **NIT, ngoài scope.**
6. **Collation sắp xếp.** Sắp theo collation của DB, tiếng Việt có thể xếp chưa đúng thứ tự từ điển. **NIT.**

## Findings

### [CRITICAL]
Không có.

### [MAJOR]
- **M1: rate-limit tra cứu công khai thực chất toàn cục trong topology deploy, nên DoS được.** `apps/api/src/modules/lookup/routes.ts:12` (`limiter.tryAcquire(ctx.ip)`). `app.ts` không bật `app.proxy` (gap G-01), nên mọi request qua Next rewrite có cùng `ctx.ip`. Test gọi thẳng Koa qua supertest nên không lộ lỗi.
  - Fix đề xuất (nhỏ, `app.ts` không nằm trong danh sách cấm của task): bật `app.proxy = true`, `proxyIpHeader = "x-forwarded-for"`, `maxIpsCount = 1`. Đảm bảo Next rewrite chuyển tiếp IP client. Chỉ tin header từ proxy tin cậy (Koa không được mở thẳng ra ngoài, hoặc cấu hình qua biến môi trường). Thêm test: 2 giá trị `X-Forwarded-For` khác nhau có bộ đếm riêng. Fix này đồng thời đóng G-01 cho limiter đăng nhập; cần chạy lại test auth.
  - Phương án thay thế (quyết định của primary/user, không phải của reviewer): chấp nhận rủi ro, gộp vào G-01 và chặn deploy production cho tới khi xử lý. Khi đó phải cập nhật dòng G-01 ở `docs/changes/TECHNICAL_REQUIREMENT_GAPS.md` thêm phạm vi `POST /api/lookup` và hậu quả DoS. Không được nới ngưỡng toàn cục để bù vì như vậy làm yếu chống dò mã.

### [MINOR]
- **m1: AC ghi "input sai → 400" nhưng code trả 422 VALIDATION.** `lookup.test.ts:283-293`. 422 là quy ước chung của middleware (`apps/api/src/http/middleware.ts:13-18`, `middleware.test.ts:50`), nên giữ 422 là đúng. Fix: sửa câu AC trong task file thành "422 VALIDATION theo envelope lỗi chung" và ghi rõ trong `docs/API_SPEC.md`.
- **m2: lỗi tải năm học bị nuốt.** `apps/web/src/features/lookup/use-lookup.ts:53` (`.catch(() => [])`) và `lookup-form.tsx:30` hiện "Chưa có năm học". Người dùng không chọn được năm trước và nhãn không đúng sự thật. Fix: giữ trạng thái lỗi cho years, placeholder "Không tải được năm học" kèm nút thử lại.
- **m3: kết quả cũ vẫn hiện khi đổi trường, mã hoặc năm.** `lookup-page.tsx:62-103` không reset `lookup.state` khi giá trị form đổi, nên bảng điểm cũ nằm dưới lựa chọn mới. Trên máy dùng chung dễ bị hiểu nhầm. Fix: reset về `idle` khi `schoolId`, `studentCode` hoặc `yearId` đổi.
- **m4: hàm vượt 50 dòng.** `apps/web/src/features/lookup/school-picker.tsx:27-120` (`SchoolPicker` khoảng 94 dòng). Fix: tách `handleKeyDown` thành hook `useComboboxKeys` và tách listbox thành component `SchoolOptions`.
- **m5: file test vượt 300 dòng.** `apps/api/src/modules/lookup/lookup.test.ts` có 341 dòng. Fix: tách theo describe, ví dụ `lookup.rate-limit.test.ts` (dòng 282-340) và đưa helper/fixture ra `lookup.test-fixtures.ts`.
- **m6: heading không fluid.** `lookup-page.tsx:44` dùng `text-3xl` cố định (đây là mục FAIL của Responsive gate). Fix: `text-[clamp(1.5rem,1.2rem+1.5vw,1.875rem)]` hoặc token fluid tương đương.
- **m7: không giới hạn theo schoolId.** Task ghi "nếu gọn". Lý do builder đưa ra hợp lý (khóa theo trường thì người lạ chặn được cả trường). Chấp nhận, ghi vào Doc-Impact.

### [NIT]
- Residual 3, 5, 6 ở trên.
- Không tạo `errors.ts`: task ghi "nếu cần", code dùng `COMMON_ERRORS.RATE_LIMITED`. Hợp lệ.
- Học sinh bị gỡ khỏi lớp (xóa enrollment) thì bài của lớp đó biến mất khỏi tra cứu dù đã có điểm. Ghi chú cho Layer 9 (lên lớp, lịch sử).

## Responsive Checklist Gate
Project có block `ui:`. Diff đụng UI, và `/tra-cuu` được miễn ngưỡng 1024px nên phải dùng được ở 375/768/1280. Không có browser nên xác minh bằng CSS math.

| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Không horizontal scroll ở document | OK | Dưới `lg` form là `grid-cols-1`. Từ `lg` là `grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]` (`lookup-form.tsx:48`), `minmax(0,…)` không ép min-content. Bảng `min-w-[560px]` nằm trong wrapper `overflow-auto` (`components/ui/table.tsx:15`). |
| Mobile-first media query | OK | Tailwind `lg:` là min-width |
| Grid không cố định số cột | OK | Dùng `minmax(0, fr)` |
| Container không fixed px | OK | `PortalFrame` có sẵn, diff không thêm width px |
| Font-size rem | OK | Class Tailwind dùng rem |
| Heading fluid `clamp()` | **FAIL** | `lookup-page.tsx:44` `text-3xl` cố định. `.context/design-spec.md` không có quy tắc nào bắt cỡ chữ cố định (grep `clamp\|text-3xl\|fluid`: 0 kết quả), nên không xếp N/A được. Mức độ thấp (1,875rem vừa 375px) nhưng gate yêu cầu: xem m6. |
| Media | N/A | Không có ảnh/video |
| Touch target ≥ 44px | Residual risk | Option trong listbox `min-h-11` (`school-picker.tsx:109`): OK. Chiều cao của `Input`/`Select`/`Button` không xác minh được (grep `h-9..h-12` trong `components/ui` không thấy class trên các component này). Builder cần nêu bằng chứng hoặc test. |
| Nav mobile | N/A | Trang không có nav riêng |
| Table scroll wrapper | OK | Wrapper `overflow-auto` |
| `100vh` | OK | Không dùng |
| prefers-reduced-motion | N/A | Không thêm animation mới |
| Không che lỗi bằng overflow:hidden | OK | Diff không thêm overflow-hidden |

Residual: chưa nhìn thực tế trên browser ở 375/768/1280. Riêng dropdown combobox (`absolute w-full`) trong Card ở 375px chưa được xem trực tiếp.

## Skill gates
| Gate | Kết quả |
|---|---|
| aislop | skip, `aislop` not installed (exit 127) |
| oxlint (anti-slop) | skip, oxlint not configured (không có `.oxlintrc*`). eslint PASS |
| ocr (open-code-review) | skip, ocr not installed |
| AI-readable | OK (dưới ngưỡng). Có 1 indicator: hàm vượt 50 dòng (m4). Tên rõ ràng, indirection ≤ 2, hằng số có tên, comment nói lý do chứ không mô tả code. `docs/API_SPEC.md` cập nhật ở close-out. |
| ai-friendly-web | N/A cho task này. llms.txt, robots, sitemap là việc deploy toàn site; ghi chú cho task devops |
| blitzstrike | skip, không có môi trường pentest được phép. Thay bằng review tay BOLA/IDOR, SQLi và enumeration (bảng trên) |

## Surgical diff
OK. Chỉ đụng file trong "Files to Create/Modify". `page.tsx` chỉ thêm link. Không sửa module bị cấm, chỉ import.

## Verdict
FAIL

- Chặn: **M1** (MAJOR, DoS rate-limit trên endpoint công khai) và Responsive gate mục heading (**m6**, FAIL).
- Để PASS round 2:
  - Fix M1 qua `app.ts` (proxy tin cậy + test), hoặc primary/user quyết định rõ chấp nhận rủi ro gộp vào G-01. Nếu chấp nhận rủi ro thì phải cập nhật gap register và chặn deploy production.
  - Fix m6.
  - Nêu bằng chứng touch target của Input/Select/Button.
  - Nên sửa thêm m2-m5 và sửa AC (m1) ở close-out.
- Phần cốt lõi đã đạt: lọc school_id, join ghi danh, năm học qua class, codeVoided/anonymizedAt, không PII, response rỗng giống hệt nhau, trường khóa vẫn tra được.
