# Layer plan: build-quiq

Nguồn: `SPECIFICATIONS.md` v1.0.0 (Clarifications C-01..C-13 ghi đè BRD), `docs/specs/2026-11-25-quiq-design.md`, `.context/design-spec.md`, `skills/react-nodejs/design-tokens.md`, `.context/project-config.md`.
Slug: `build-quiq`. Tổng: **9 layer (0..8), 30 task**. Mỗi layer kết thúc bằng human checkpoint (Rule #2 của `.agent/graph.md`).
Layer-plan diagram: **skipped (archify chưa cài, cần tải gói ngoài)**.

## 1. Bảng layer

| Layer | Tên | Task | Chạy song song? |
|---|---|---|---|
| 0 | Scaffold | 01 workspace + manifest mọi package + verify commands | không (1 task) |
| 1 | Foundations | 01 api skeleton · 02 web skeleton + spike SSE · 03 shared base · 04 DB (schema đủ + migration đầu + PGlite + seed) · 05 exam engine · 06 storage adapter | cả 6 song song (file rời nhau) |
| 2 | Auth | 01 staff auth + session + guard (api) · 02 đăng nhập + app shell + route guard (web) | song song |
| 3 | Quản trị + ngân hàng câu hỏi (lát cắt dọc) | 01 admin tổng · 02 môn + giáo viên · 03 năm học + lớp + lên lớp · 04 học sinh + nhập file + xóa PII · 05 phân công + quy chế · 06 ngân hàng câu hỏi + ảnh | cả 6 song song |
| 4 | Bài thi + xem học sinh | 01 bài thi (rút đề, sao chép, mã + link, gán lớp) · 02 giáo viên xem học sinh lớp phụ trách | song song |
| 5 | Student runtime core (không HTTP) | 01 phiên học sinh + vòng đời attempt + chấm + sweeper + chấm lại | không (1 task) |
| 6 | API vận hành thi | 01 điều khiển lớp (phát đề, thu bài, công bố) · 02 học sinh vào thi + phòng chờ · 03 API làm bài (start, lưu, heartbeat, vi phạm, nộp, kết quả, xem đáp án, ảnh) | cả 3 song song |
| 7 | UI vận hành + kết quả | 01 UI vào thi + phòng chờ · 02 UI làm bài + kết quả · 03 phòng thi giáo viên (SSE) · 04 kết quả giáo viên · 05 tra cứu điểm · 06 kho chỉ đọc admin trường | cả 6 song song |
| 8 | Polish | 01 quét cô lập + bảo mật · 02 Playwright smoke · 03 reconcile tài liệu as-built | song song |

## 2. Quan hệ phụ thuộc (chỉ trỏ tới layer nhỏ hơn)

```
L0-01
 └─► L1-01 L1-02 L1-03 L1-04 L1-05 L1-06           (mọi L1 chỉ phụ thuộc L0-01)
       L2-01 ◄─ L1-01, L1-03, L1-04
       L2-02 ◄─ L1-02, L1-03
         L3-01..L3-06 ◄─ L2-01 + L2-02 (+ L1-04, L1-03; L3-06 thêm L1-06)
           L4-01 ◄─ L3-02, L3-03, L3-05, L3-06 (+ L1-05, L1-06)
           L4-02 ◄─ L3-03, L3-04, L3-05
             L5-01 ◄─ L1-05, L1-04, L2-01, L4-01
               L6-01 ◄─ L5-01, L4-01 · L6-02 ◄─ L5-01, L3-04 · L6-03 ◄─ L5-01, L4-01
                 L7-01 ◄─ L6-02, L6-03 · L7-02 ◄─ L6-03, L6-02 · L7-03 ◄─ L6-01, L5-01
                 L7-04 ◄─ L5-01, L4-01, L3-03/04/05 · L7-05 ◄─ L5-01, L6-01 · L7-06 ◄─ L3-02..L3-06, L4-01
                   L8-01 ◄─ tất cả api · L8-02 ◄─ tất cả · L8-03 ◄─ tất cả
```

## 3. Thay đổi so với kế hoạch đề xuất (và lý do)

| # | Thay đổi | Lý do |
|---|---|---|
| A1 | **Thêm L1-06 "storage adapter"** (api lib, không route) | Tách hạ tầng Supabase Storage khỏi L3-06 (task vốn quá lớn); lộ rủi ro tiền đề (bucket, khóa) sớm. Dùng REST thuần nên không thêm dependency. |
| A2 | **Thêm hai package mới `packages/db` (`@quiq/db`) và `packages/engine` (`@quiq/engine`)** | Schema + migration chỉ do L1-04 sở hữu; nếu đặt trong `apps/api` thì L1-04 trùng `apps/api/package.json` với L1-01. Engine thuần hàm cũng vậy (trùng với L1-03 nếu nằm trong shared). Engine tự khai kiểu cục bộ (cấu trúc tương thích với enum của shared). |
| A3 | **L0-01 tạo MỌI manifest** (4 package + 2 app) với danh sách dependency đầy đủ, vitest config, tsconfig, stub `src/index.ts`; chạy `pnpm install` một lần và sở hữu `pnpm-lock.yaml` | `pnpm add` ở task song song sẽ cùng sửa `pnpm-lock.yaml` + `package.json` (dispatcher chỉ tránh trùng file khai báo; merge sẽ conflict). Task sau KHÔNG sửa manifest; nếu bắt buộc thêm dependency thì khai `pnpm-lock.yaml` + `package.json` trong Files của task đó (chấp nhận bị tách wave). |
| A4 | **Barrel/registry không dùng chung**: `packages/shared` dùng subpath exports `./*` -> `src/*/index.ts` (mỗi domain một thư mục, mỗi domain tự có `errors.ts`); api module loader tự quét `modules/*/routes.ts`; web menu liệt kê mọi route từ L2-02 | Tránh mọi file đăng ký chung bị nhiều task L3/L7 cùng sửa. |
| A5 | **Spike SSE (L1-02) tự chứa**: dùng server SSE tạm viết riêng trong `apps/web/scripts/`, không đợi hub của L1-01 | Hub nằm ở L1-01 cùng layer, không được phụ thuộc. |
| A6 | **L5 và L6 được tổ chức lại**: L5-01 = "student runtime core" (phiên học sinh, vòng đời attempt, chấm điểm lưu DB, sweeper, chấm lại) **không có route**; L6 = 3 task HTTP (điều khiển lớp, vào thi + phòng chờ, API làm bài) | Đề xuất ban đầu để thu bài (L5-01) và đẩy máy (L5-02) cần `finalizeAttempt` của L6-01 (đảo ngược dependency). Gom mọi logic kết thúc attempt (thu bài, đẩy máy, vi phạm, hết giờ, gián đoạn, chấm lại) vào core ở L5 để các task L6/L7 chỉ gọi xuống layer thấp hơn. |
| A7 | **Trang "Phòng thi" giáo viên được tạo ở L6-01 (nút điều khiển)**, L7-03 mở rộng thêm bảng trực tiếp; trang vào thi/phòng chờ (UI) chuyển sang L7-01, nút "Bắt đầu" cũng nối ở L7-01 | UI cần API đã có ở layer thấp hơn; design-spec §9.3 đặt nút điều khiển cùng màn với bảng trực tiếp. |
| A8 | L7 có **6 task** (tách UI vào thi + phòng chờ khỏi UI làm bài/kết quả) | Giữ task nhỏ, file rời nhau. |
| A9 | **Mọi route khai báo metadata** (`roles`, `scope`, `params` kèm tên entity) từ L1-01 | Điều kiện để L8-01 quét cô lập tự động; nếu không L8-01 chỉ còn là review tay. |
| A10 | `docs/ERD.md`, `docs/API_SPEC.md`, `docs/PERMISSION.md` chỉ được sửa ở L8-03; L1-04 viết hướng dẫn kết nối ở file mới `docs/SUPABASE_SETUP.md` | Tránh trùng file giữa task song song và giữa các layer. |

## 4. Quy ước chung (mọi task phải tuân theo)

### 4.1 Backend (`apps/api`)
- Mỗi module một thư mục `apps/api/src/modules/<tên>/` gồm `routes.ts` (default export `defineModule(...)` từ L1-01), `service.ts`, `<tên>.test.ts`. Loader tự quét `modules/*/routes.ts`; **không task nào sửa file đăng ký chung**.
- Mọi route phải khai báo metadata: `{ roles: Role[] | 'public' | 'student', scope: 'platform' | 'school' | 'student' | 'public', params: { <tên param>: <entity> }, summary }`. Entity thuộc: `school, account, subject, teacher, year, class, student, assignment, question, media, exam, examClass, attempt`. L8-01 dùng metadata này để quét cô lập tự động.
- Response luôn qua `ok()/fail()`; lỗi nghiệp vụ ném `AppError` mang `{ status, code, message }` (cấu trúc khớp danh mục lỗi trong `@quiq/shared`). Truy cập chéo trường trả **404** (không lộ tồn tại). Mọi truy vấn của vai trò thuộc trường phải lọc theo `schoolId` lấy từ phiên.
- Test: Vitest + PGlite (`@quiq/db/testing`), gọi app qua HTTP in-process. Có test từ chối chéo trường cho mọi route mới.
- Không sửa schema/migration (chỉ L1-04). Cần cột/bảng mới thì ghi vào task đó mục "cần change" và dừng, không tự sửa.

### 4.2 Shared (`packages/shared`)
- Subpath exports: `@quiq/shared` (= `common`), `@quiq/shared/<domain>`. Mỗi domain một thư mục `src/<domain>/{index.ts,schemas.ts,errors.ts}`; đăng ký lỗi qua `defineErrors(...)` của `common` với tiền tố mã riêng. Không sửa `src/common/*` sau L1-03 (trừ khi chính task đó khai).
- Domain và chủ sở hữu: `common, realtime, auth` (L1-03, hợp đồng chung của hai task L2) · `platform` (L3-01) · `subjects, teachers` (L3-02) · `academic` (L3-03) · `students` (L3-04) · `assignments` (L3-05) · `questions, media` (L3-06) · `exams` (L4-01) · `teacher-students` (L4-02) · `class-control` (L6-01) · `student-entry` (L6-02) · `student-exam` (L6-03) · `monitor` (L7-03) · `results` (L7-04) · `lookup` (L7-05) · `repository` (L7-06).

### 4.3 Frontend (`apps/web`)
- Trang ở `apps/web/src/app/<route>/page.tsx`; thành phần theo tính năng ở `apps/web/src/features/<module>/`. Primitive UI ở `apps/web/src/components/ui/*` (L1-02). Gọi API qua `apps/web/src/lib/api-client.ts` (L2-02) với `/api/*` cùng origin.
- Mọi task UI: đọc `skills/react-nodejs/design-tokens.md` và đúng mục tương ứng của `.context/design-spec.md`; một hệ thiết kế (Tailwind + Radix/shadcn); **không em-dash** (`—`) trong chữ giao diện; không hiện mã FR-xxx trong giao diện; tiếng Việt có dấu; chỉ desktop (>= 1024px); đủ trạng thái loading (skeleton), empty (có câu hướng dẫn), error (gần chỗ lỗi + nút thử lại); prototype `index.html` chỉ tham khảo bố cục (grep đoạn, không đọc cả file, không sao chép em-dash/tên thương hiệu cũ).

### 4.4 Hợp đồng route web (menu sidebar liệt kê đủ từ L2-02)

| Vai trò | Menu | Route | Task sở hữu trang |
|---|---|---|---|
| Admin tổng | Thống kê tổng hợp · Quản lý trường học · Tài khoản Admin trường | `/admin-tong` (redirect), `/admin-tong/thong-ke`, `/admin-tong/truong`, `/admin-tong/tai-khoan` | L3-01 (trang), L2-02 (redirect) |
| Admin trường | Môn học · Giáo viên · Năm học & Lớp · Học sinh · Phân công & Quy chế · Kho dữ liệu chỉ đọc | `/quan-tri` (redirect), `/quan-tri/mon-hoc`, `/quan-tri/giao-vien`, `/quan-tri/lop`, `/quan-tri/hoc-sinh`, `/quan-tri/phan-cong`, `/quan-tri/kho-du-lieu` | L3-02 (mon-hoc, giao-vien), L3-03 (lop), L3-04 (hoc-sinh), L3-05 (phan-cong), L7-06 (kho-du-lieu) |
| Giáo viên | Ngân hàng câu hỏi · Bài thi · Phòng thi · Kết quả · Học sinh lớp phụ trách | `/giao-vien` (redirect), `/giao-vien/ngan-hang`, `/giao-vien/bai-thi`, `/giao-vien/bai-thi/[id]` (xem đề), `/giao-vien/phong-thi`, `/giao-vien/ket-qua`, `/giao-vien/ket-qua/bai-lam/[attemptId]`, `/giao-vien/hoc-sinh` | L3-06, L4-01, L6-01 rồi L7-03, L7-04, L4-02 |
| Công khai | Đăng nhập · Vào thi · Tra cứu | `/dang-nhap` (L2-02), `/thi`, `/thi/[code]`, `/thi/[code]/phong-cho` (L7-01), `/thi/[code]/lam-bai`, `/thi/[code]/ket-qua` (L7-02), `/tra-cuu` (L7-05) | như cột trái |

Redirect đích: `/admin-tong` -> `/admin-tong/thong-ke`; `/quan-tri` -> `/quan-tri/mon-hoc`; `/giao-vien` -> `/giao-vien/ngan-hang`. Route chưa có trang (đến khi layer sau hoàn thành) hiện 404 chung; không tạo trang giữ chỗ.

### 4.5 Tiền tố API và module

| Module (`apps/api/src/modules/...`) | Prefix | Vai trò | Task |
|---|---|---|---|
| `auth` | `/api/auth/login`, `/logout`, `/me` | công khai / mọi vai trò cán bộ | L2-01 |
| `platform` | `/api/platform/schools`, `/school-admins`, `/stats` | super_admin | L3-01 |
| `subjects`, `teachers` | `/api/school/subjects`, `/api/school/teachers` | school_admin | L3-02 |
| `academic` | `/api/school/years`, `/classes`, `/promotions` | school_admin | L3-03 |
| `students` | `/api/school/students` (+ `/import`, `/import-template`, `/:id/anonymize`, `/:id/history`) | school_admin | L3-04 |
| `assignments` | `/api/school/assignments`, `/api/school/settings` | school_admin | L3-05 |
| `questions`, `media` | `/api/teacher/questions` (+ `/stats`), `/api/media` | teacher; media đọc: teacher chủ + school_admin cùng trường | L3-06 |
| `exams` | `/api/teacher/exams`, `/api/teacher/exams/classes` | teacher | L4-01 |
| `teacher-students` | `/api/teacher/students` | teacher | L4-02 |
| `student-core` (không routes) | (không có) | nội bộ | L5-01 |
| `class-control` | `/api/teacher/exams/:examId/classes`, `/:classId/{dispatch,close,publish-answers,publish-scores}` | teacher | L6-01 |
| `student-entry` | `/api/student/enter`, `/waiting-room`, `/leave` | student/public | L6-02 |
| `student-exam` | `/api/student/attempts` (+ `/:id/...`), `/api/student/media/:id` | student | L6-03 |
| `monitor` | `/api/teacher/exams/:examId/classes/:classId/roster`, `/stream` (SSE) | teacher | L7-03 |
| `results` | `/api/teacher/results/...`, `/api/teacher/exams/:examId/regrade` | teacher | L7-04 |
| `lookup` | `/api/lookup`, `/api/lookup/schools` | public | L7-05 |
| `repository` | `/api/school/repository/{questions,exams,scores}` | school_admin | L7-06 |

### 4.6 Cookie, realtime, hằng số
- Cookie cán bộ `quiq_session`, học sinh `quiq_stu` (HttpOnly, SameSite=Lax, Secure khi `NODE_ENV=production`). Phiên cán bộ trượt 8 giờ.
- Kênh SSE: `exam:<examId>:class:<classId>`. Sự kiện (định nghĩa ở `@quiq/shared/realtime`, L1-03): `roster.snapshot`, `student.waiting`, `student.started`, `student.submitted`, `student.interrupted`, `student.violation`, `class.status`. Bên phát (core/entry/class-control) gọi `deps.sse.publish(channel, event)`; chỉ L7-03 mở endpoint stream.
- Hằng số: heartbeat 5 giây, sweeper 10 giây, dung sai nộp trễ 3 giây, presence phòng chờ hợp lệ 15 giây (L1-03).
- Mã lỗi/thông báo tiếng Việt: danh mục `common` (L1-03) + `errors.ts` từng domain.

### 4.7 Kết nối cơ sở dữ liệu
`DATABASE_URL_STAGING` có thể chỉ có host IPv6 (direct). Nếu máy dev không có IPv6 thì dùng pooler Supavisor; pooler transaction-mode phải tắt prepared statements (`postgres(url, { prepare: false })`). Test luôn dùng PGlite, không cần mạng.

## 5. Tiền đề người dùng (làm TRƯỚC khi loop chạy)

1. **Commit đầu vào còn untracked/modified** (worktree tạo từ HEAD sẽ KHÔNG thấy chúng; graph không tự commit): `.context/design-spec.md`, `skills/react-nodejs/design-tokens.md` (đang modified), `index.html`, `tools/`, `docs/DESIGN.md`, toàn bộ `tasks/build-quiq/`, `.context/runs/*`. Nếu không, builder UI không có tokens/design-spec và `tools/progress-write.mjs` không tồn tại trong worktree. Nhớ rằng `tools/` còn nằm ngoài git, loop/dispatcher phải xử lý trước wave đầu của Layer 1.
2. **Node 22 + pnpm** (khuyên dùng corepack) trên máy chạy builder; L0-01 cần mạng để `pnpm install`.
3. **Project Supabase staging** (để L1-04 kiểm kết nối, L1-06 kiểm bucket, L8-02 kiểm RLS): điền `.env.local` các biến `DATABASE_URL_STAGING`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (sinh ngẫu nhiên >= 32 byte). Thiếu thì: phần kiểm kết nối cloud của L1-04, L1-06, L8-02 ghi **Blocked** (task vẫn xong bằng PGlite/fake storage).
4. Quyết định cho phần "gỡ phân công": L3-05 chọn chặn khi đã có bài thi gắn (xem task); nếu không đồng ý hãy sửa trước khi chạy L3.

## 6. Rủi ro / Blocked tiềm ẩn

| Rủi ro | Task | Giảm thiểu |
|---|---|---|
| SSE bị Next rewrite buffer / timeout proxy / nén | L1-02 (spike), L7-03 | Spike ghi kết quả vào `docs/specs/2026-11-25-sse-spike.md`; phương án dự phòng: route handler stream trong Next hoặc kết nối trực tiếp Koa chỉ cho SSE. |
| Migration đầu thiếu cột khiến phải `/change` giữa chừng | L1-04 | AC liệt kê đầy đủ cột theo từng FR; reviewer STRICT đối chiếu bảng FR. Mọi task sau cấm sửa schema. |
| PGlite khác Supabase (role `anon`/`authenticated` không tồn tại, extension) | L1-04, L8-02 | Câu lệnh RLS/revoke bọc kiểm tra role; kiểm RLS thật chạy ở smoke staging. |
| Lệch múi giờ/giờ máy chủ, đồng hồ giả trong test sweeper | L5-01 | Mọi chỗ dùng `Clock` tiêm được (L1-01). |
| Nhiều worktree cùng chạy PGlite/`next build` nặng máy | L3, L7 | Dispatcher có thể giới hạn số task mỗi wave; không ảnh hưởng đúng đắn. |
| Trùng `apps/api/src/server.ts` giữa các layer sau (L2-01 nối DB, L5-01 nối sweeper) | L2-01, L5-01 | Khác layer nên tuần tự; L7-03 không sửa file này (SSE nằm trong module). |
| Thông số thiết kế chưa chốt: danh sách thư viện UI cuối | L1-02 | Chốt theo design-spec §0 (Tailwind + Radix/shadcn, TanStack Table, react-hook-form, zod, date-fns, Tabler Icons). |
| Gỡ phân công khi đã có bài thi; quyền xem ảnh đề của giáo viên khác | L3-05, L3-06 | Quyết định mặc định ghi trong task; đổi qua `/change`. |
