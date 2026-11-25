# Task 06: Storage adapter (Supabase Storage riêng tư, kiểm ảnh, bản giả cho test)

## Layer
1

## Type
build

## Description
Thư viện nội bộ của api (không có route) cho lưu ảnh câu hỏi: giao diện `ObjectStorage`, cài đặt Supabase Storage qua **REST bằng `fetch`** (bucket riêng tư, khóa service-role chỉ ở máy chủ; không thêm dependency), cài đặt in-memory dùng cho test của mọi task sau, **kiểm ảnh bằng magic bytes** (<= 2 MB, jpeg/png/webp), và hàm dựng đường dẫn an toàn. Tách khỏi L3-06 để rủi ro cấu hình Supabase lộ sớm.

## Dependencies
- layer-0-task-01 (workspace, `@quiq/api`)

## Acceptance Criteria
- [ ] `ObjectStorage` có: `put(path, bytes, mime)`, `get(path) -> { bytes, mime, size } | null`, `copy(from, to)`, `remove(path)`, `exists(path)`, `ensureBucket()`. Lỗi mạng/HTTP được bọc thành `StorageError` (mã nội bộ, không lộ khóa/URL đầy đủ ra thông báo).
- [ ] `createSupabaseStorage({ url, serviceRoleKey, bucket, fetchImpl? })` gọi đúng REST của Supabase Storage (`/storage/v1/object/<bucket>/<path>` cho put/get/remove, `/storage/v1/object/copy`, `/storage/v1/bucket` cho tạo bucket **private**), header `Authorization: Bearer <service-role>`; có test bằng `fetchImpl` giả kiểm URL, method, header, body, và xử lý 404/409/5xx.
- [ ] `createMemoryStorage()` cài đặt cùng interface (Map trong bộ nhớ), dùng làm mặc định cho `createTestApp` ở L2-01; test: put/get/copy/remove/exists, copy file không tồn tại ném `StorageError`.
- [ ] `createStorageFromEnv(env)`: đọc `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET` (mặc định `quiq-media`); thiếu biến thì trả storage báo lỗi rõ ràng khi dùng (không crash lúc khởi động) để dev local chưa có Supabase vẫn chạy phần còn lại.
- [ ] `validateImage(bytes, declaredMime)`: từ chối > 2 MB (`2 * 1024 * 1024`), từ chối khi magic bytes không phải JPEG (`FF D8 FF`), PNG (`89 50 4E 47 0D 0A 1A 0A`) hay WebP (`RIFF....WEBP`); trả `{ mime, ext }` chuẩn hóa; **khai báo mime lệch magic bytes bị từ chối**; SVG, GIF, HTML đổi đuôi ảnh bị từ chối. Test từng định dạng + file giả mạo + file rỗng + đúng 2 MB và 2 MB + 1 byte.
- [ ] `paths.ts`: `questionMediaPath(schoolId, teacherId, mediaId, ext)`, `examMediaPath(schoolId, examId, mediaId, ext)` chỉ nhận uuid hợp lệ và đuôi trong danh sách cho phép (chặn `..`, `/`, ký tự lạ); đường dẫn luôn có tiền tố `schoolId` để tách tenant ở tầng lưu trữ.
- [ ] Script `apps/api/scripts/ensure-storage-bucket.ts`: tạo bucket riêng tư nếu chưa có (idempotent) và in kết quả; **nếu chưa có `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` trong `.env.local`: ghi `Blocked`**, không giả lập thành công.
- [ ] Test tích hợp tùy chọn `supabase-storage.integration.test.ts` chạy khi đủ biến môi trường staging (put -> get -> copy -> remove một ảnh 1x1 trong thư mục `__test__/<random>`, dọn sau cùng); thiếu biến thì `skip` có lý do, không fail.
- [ ] Không có `console.log` lộ khóa; không có khóa nào xuất hiện trong thông báo lỗi hay trong test snapshot.

## DoD (Definition of Done)
- [ ] Code written (chỉ trong scope)
- [ ] Tests added + pass
- [ ] Check commands pass (theo `.context/project-config.md`)
- [ ] Reviewer độc lập PASS
- [ ] committed

## Files to Create/Modify
- `apps/api/src/lib/storage/types.ts`
- `apps/api/src/lib/storage/supabase-storage.ts`
- `apps/api/src/lib/storage/memory-storage.ts`
- `apps/api/src/lib/storage/from-env.ts`
- `apps/api/src/lib/storage/image-validation.ts`
- `apps/api/src/lib/storage/paths.ts`
- `apps/api/src/lib/storage/index.ts`
- `apps/api/src/lib/storage/image-validation.test.ts`
- `apps/api/src/lib/storage/memory-storage.test.ts`
- `apps/api/src/lib/storage/supabase-storage.test.ts`
- `apps/api/src/lib/storage/supabase-storage.integration.test.ts`
- `apps/api/scripts/ensure-storage-bucket.ts`

## Notes
- **Risk:** đỏ (bảo mật tải lên file: magic bytes, chặn path traversal, bucket riêng tư; reviewer STRICT, checklist `skills/security`). Không có migration.
- Chỉ thao tác trong thư mục mới `apps/api/src/lib/storage/` và `apps/api/scripts/`; **không** sửa `apps/api/package.json`, `core/deps.ts` (L1-01 và L2-01 sở hữu). L2-01 sẽ gắn `storage` vào `AppDeps`.
- Không import `@quiq/shared` (cùng layer); hằng 2 MB khai cục bộ và có test ghi chú phải khớp `MEDIA_MAX_BYTES` của shared (L3-06 kiểm).
- Gói free Supabase Storage: 1 GB (C-10); hạn mức file tối đa của bucket nên đặt >= 2 MB khi tạo bucket.
- Đường dẫn Storage có ký tự tiếng Việt/khoảng trắng gây lỗi; vì vậy chỉ dùng uuid + đuôi cố định.
