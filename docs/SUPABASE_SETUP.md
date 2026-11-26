# Thiết lập Supabase cho Quiq

Tài liệu này hướng dẫn nối `packages/db` với Postgres của Supabase, áp dụng migration và nạp dữ liệu mẫu.
Không có khóa hay mật khẩu thật nào được ghi vào repo: mọi giá trị bí mật nằm trong `.env.local` ở thư mục gốc (git bỏ qua file này).

## 1. Biến môi trường

Điền vào `.env.local` (mẫu tên biến ở `.env.local.example`):

| Biến | Dùng cho |
|---|---|
| `DATABASE_URL_STAGING` | Chuỗi kết nối Postgres của project staging. Client và các script ưu tiên biến này. |
| `DATABASE_URL` | Dự phòng khi không có `DATABASE_URL_STAGING` (pipeline deploy dùng). |
| `DATABASE_URL_PROD` | Chuỗi của production. Chỉ dùng làm hàng rào: seed từ chối chạy nếu chuỗi đang dùng trùng chuỗi này. Phải khác `DATABASE_URL_STAGING`. |
| `DATABASE_PREPARE` | Đặt `false` để tắt prepared statement (xem mục 2). Thường không cần: cổng 6543 tự được nhận diện. |
| `SESSION_SECRET` | Bí mật phiên của Koa (không thuộc `packages/db`). |

Lấy chuỗi kết nối: Supabase Dashboard, nút **Connect**, chọn tab **Session pooler**, sao chép chuỗi, thay `[YOUR-PASSWORD]` bằng mật khẩu database (khác với các khóa API), dán vào `DATABASE_URL_STAGING`.
Mật khẩu có ký tự đặc biệt (`@`, `:`, `/`, `#`, `?`) phải được mã hóa phần trăm trong chuỗi (ví dụ `@` thành `%40`).

## 2. Chọn đúng kiểu kết nối (IPv4 và IPv6)

| Kiểu | Máy chủ / cổng | Dùng khi |
|---|---|---|
| Direct connection | `db.<ref>.supabase.co:5432` | **Chỉ có địa chỉ IPv6** (trừ khi bật add-on IPv4). Mạng nhà dùng IPv4 sẽ lỗi `ENOTFOUND` hoặc timeout. |
| **Session pooler** | `aws-0-<region>.pooler.supabase.com:5432` (user dạng `postgres.<ref>`) | **Khuyến nghị cho dev trên mạng IPv4.** Hỗ trợ IPv4, giữ nguyên hành vi như kết nối trực tiếp (prepared statement, transaction nhiều câu lệnh). |
| Transaction pooler | cùng máy chủ, cổng `6543` | Máy chủ serverless, nhiều kết nối ngắn. Mỗi truy vấn có thể rơi vào một kết nối khác nhau nên **không dùng được prepared statement**: client tự đặt `prepare: false` khi cổng là `6543` (hoặc khi `DATABASE_PREPARE=false`). |

Client luôn bật SSL (`ssl: "require"`) với máy không phải localhost, vì Supabase từ chối kết nối không mã hóa.

Xử lý lỗi thường gặp:

- `ENOTFOUND` hoặc `ETIMEDOUT` với host `db.<ref>.supabase.co`: bạn đang dùng direct connection trên mạng IPv4, chuyển sang Session pooler.
- `Tenant or user not found`: user phải có dạng `postgres.<ref>` (kèm mã project) khi dùng pooler.
- `password authentication failed`: sai mật khẩu database, hoặc chưa mã hóa ký tự đặc biệt.
- `prepared statement "..." does not exist` hoặc `already exists`: đang ở transaction pooler mà `prepare` chưa tắt, đặt `DATABASE_PREPARE=false`.

## 3. Lệnh

Chạy từ thư mục gốc repo:

```bash
pnpm --filter @quiq/db db:generate        # sinh migration mới từ schema (drizzle-kit generate)
pnpm --filter @quiq/db db:migrate         # áp dụng migration đã commit vào DATABASE_URL_STAGING
pnpm --filter @quiq/db db:seed:demo       # nạp dữ liệu mẫu (idempotent)
pnpm --filter @quiq/db db:seed:demo -- --reset-attempts   # xóa bài làm, mở lại bài DEMO01 để thử lại
```

Tuyệt đối không dùng `drizzle-kit push` hay reset database: schema chỉ đổi qua migration versioned đã commit.
Quy ước: **ai cần cột/bảng mới thì viết migration mới trong chính task của mình** (`db:generate`), không sửa `0000_init.sql` hay `0001_lock_down_public_roles.sql`.

### Migration hiện có

| File | Nội dung | Rủi ro |
|---|---|---|
| `0000_init.sql` | Tạo 19 bảng, khóa duy nhất, khóa ngoại phức hợp theo `school_id`, CHECK, chỉ mục từng phần, bật RLS trên mọi bảng. | Chỉ `CREATE`, **không** `HIGH_RISK_MIGRATION`. |
| `0001_lock_down_public_roles.sql` | Thu hồi quyền bảng của `anon` và `authenticated` (có kiểm tra vai trò tồn tại). | Chỉ `REVOKE`, **không** `HIGH_RISK_MIGRATION`. |

### Admin tổng

Admin tổng chỉ được tạo bằng cách ghi thẳng DB (FR-005), không có API nào tạo:

```bash
SUPERADMIN_USERNAME=<tên> SUPERADMIN_PASSWORD=<ít nhất 12 ký tự> pnpm --filter @quiq/db db:seed:superadmin
```

Mật khẩu đi qua biến môi trường (không qua tham số dòng lệnh) và không bao giờ được in ra. Script này dùng được cả trên production vì đó là mục đích của nó; chạy lại với cùng tên đăng nhập thì không ghi đè mật khẩu.

## 4. Dữ liệu mẫu (`db:seed:demo`)

Chỉ dành cho dev/staging.

> **Cảnh báo bảo mật:** seed tạo tài khoản `superadmin` (quyền cao nhất) cùng hai tài khoản cán bộ khác với **mật khẩu demo công khai** ghi ngay bên dưới và trong mã nguồn. Chỉ seed vào môi trường dev/staging **không truy cập được từ Internet công khai** và không chứa người dùng thật. Không seed lên bất kỳ môi trường nào có người dùng thật. Nếu staging được mở ra công khai, hãy xóa hoặc đổi mật khẩu các tài khoản demo trước đó.

Mật khẩu của **mọi** tài khoản cán bộ mẫu là một hằng số demo công khai (không phải bí mật):

```
DEMO_PASSWORD = Quiq@Demo2026
```

| Tài khoản | Vai trò |
|---|---|
| `superadmin` | Admin tổng |
| `admin.demo` | Admin trường "Trường THPT Demo" |
| `gv.toan` | Giáo viên Toán |

Ngoài ra: năm học hiện tại, lớp `10A1` có 5 học sinh `HS001` đến `HS005` (học sinh không có mật khẩu, vào thi bằng mã), phân công `gv.toan` vào `10A1`, ngân hàng 30 câu Toán (10 dễ, 10 trung bình, 10 khó, mỗi mức có 2 câu nhiều đáp án đúng) và bài thi mẫu **`DEMO01`** (10 câu, 15 phút) đã `dispatched` cho `10A1` với snapshot 3 lượt / 2 cảnh báo / 60 giây.

Seed chạy trong một transaction và tìm-hoặc-tạo theo khóa tự nhiên nên chạy lại không nhân đôi dữ liệu.

Hàng rào an toàn (kiểm tra trước khi mở kết nối): seed **từ chối chạy** khi
- `NODE_ENV=production`;
- chuỗi kết nối trỏ tới cùng máy chủ, cổng, database và user với `DATABASE_URL_PROD`;
- chuỗi kết nối thuộc cùng **project Supabase** với `DATABASE_URL_PROD` dù đi đường khác (ví dụ prod khai bằng Session pooler, còn chuỗi đang dùng là direct host `db.<ref>.supabase.co`). Project ref suy ra từ user `postgres.<ref>` của pooler hoặc từ host `db.<ref>.supabase.co`;
- không chắc chắn: có `DATABASE_URL_PROD` mà không suy ra được project ref của một trong hai chuỗi (trừ khi chuỗi đang dùng trỏ về `localhost`).

## 5. Bảo mật

- RLS bật trên **mọi** bảng và không có policy nào; `0001` thu hồi luôn quyền bảng của `anon`/`authenticated`. Trình duyệt không bao giờ gọi Supabase trực tiếp (C-11); Koa truy cập bằng vai trò máy chủ (bỏ qua RLS) nên phải tự kiểm tra tenant ở mỗi truy vấn.
- Khóa service-role (`SUPABASE_SERVICE_ROLE_KEY`) chỉ nằm ở máy chủ `apps/api`, không bao giờ đưa xuống trình duyệt hay vào tiền tố `NEXT_PUBLIC_`.
- DB chặn liên kết chéo trường bằng khóa ngoại phức hợp `(school_id, id)`: ví dụ không thể ghi danh học sinh trường A vào lớp trường B dù code ứng dụng sai.
- Không dán chuỗi kết nối hay khóa vào chat, issue hay commit. Nếu lộ, đổi mật khẩu database trong Supabase Dashboard.

## 6. Kiểm thử không cần Supabase

`@quiq/db/testing` xuất `createTestDb()`: Postgres trong bộ nhớ (PGlite) đã áp dụng **đúng các file migration thật**, không dùng `push`:

```ts
import { createTestDb } from "@quiq/db/testing";

const { db, close } = await createTestDb();
```

PGlite không có hai vai trò `anon`/`authenticated`; truyền `createTestDb({ withSupabaseRoles: true })` để tạo chúng (kèm quyền mặc định giống Supabase) khi cần kiểm tra việc thu hồi quyền.
Kiểm tra rằng khóa `anon` không đọc được bảng nào qua API công khai cần project Supabase thật, làm ở smoke test trên staging.
