# Chạy Quiq trên máy local

## Yêu cầu

- Node 22 trở lên.
- pnpm 10. Nếu chưa có, bật qua corepack (đi kèm Node): `corepack enable`, rồi corepack tự dùng đúng phiên bản ghi trong `package.json` (`packageManager`).
- Mạng để `pnpm install` tải gói.

## Các lệnh

```bash
pnpm install   # cài toàn bộ dependency của monorepo
pnpm dev       # chạy web (http://localhost:3000) và API (http://localhost:4000) cùng lúc
```

Kiểm tra nhanh:

- `http://localhost:4000/api/health` trả `{"success":true,"data":{"status":"ok"}}`.
- `http://localhost:3000` hiện "Quiq" và dòng "API sống" (web gọi `/api/health` qua Next rewrite sang cổng 4000).

Các lệnh kiểm tra chất lượng (chạy ở thư mục gốc): `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Biến môi trường

Sao chép `.env.local.example` thành `.env.local` ở thư mục gốc repo rồi điền giá trị thật. File này đã nằm trong `.gitignore`, không commit.

- API tự đọc `.env.local` ở thư mục gốc khi khởi động; biến đã đặt sẵn trong shell được ưu tiên.
- Cổng: web dùng `PORT` (mặc định 3000), API dùng `API_PORT` (mặc định 4000). Nếu đổi cổng API, đặt thêm `API_ORIGIN` (ví dụ `http://localhost:4100`) hoặc cùng `API_PORT` cho web để rewrite trỏ đúng.
- `pnpm dev` chưa cần biến nào; `/api/health` không chạm cơ sở dữ liệu.
