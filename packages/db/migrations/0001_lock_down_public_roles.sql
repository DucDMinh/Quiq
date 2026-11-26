-- Siết quyền cho hai vai trò công khai của Supabase (anon, authenticated).
-- Trình duyệt không bao giờ gọi Supabase trực tiếp (C-11); mọi truy cập dữ liệu đi qua Koa bằng vai trò máy chủ.
-- RLS đã bật trên mọi bảng ở 0000 và không có policy nào, nên hai vai trò này vốn đã không đọc được gì;
-- bước này thu hồi luôn quyền bảng (phòng thủ hai lớp) và chặn quyền mặc định cho bảng tạo sau này.
-- Bọc kiểm tra vai trò tồn tại vì PGlite (test) và Postgres thường không có hai vai trò này.
-- Chỉ có REVOKE: không DROP, không đổi kiểu, không SET NOT NULL.
DO $$
DECLARE
  public_role text;
BEGIN
  FOREACH public_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = public_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', public_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', public_role);
    END IF;
  END LOOP;
END
$$;
