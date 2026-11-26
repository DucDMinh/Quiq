import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { MIGRATIONS_FOLDER } from "./env";
import * as schema from "./schema";

export type TestDb = PgliteDatabase<typeof schema>;

export interface TestDbHandle {
  db: TestDb;
  /** Kết nối PGlite thô, để chạy SQL tùy ý (kiểm tra catalog, tạo vai trò...). */
  pg: PGlite;
  close: () => Promise<void>;
}

export interface CreateTestDbOptions {
  /**
   * Tạo trước hai vai trò anon/authenticated kèm quyền mặc định như Supabase,
   * để kiểm tra migration thu hồi quyền của chúng.
   */
  withSupabaseRoles?: boolean;
}

/**
 * Postgres trong bộ nhớ (PGlite) đã áp dụng ĐÚNG các migration thật trong `packages/db/migrations`
 * (không dùng `drizzle-kit push`), nên test chạy trên cùng schema và ràng buộc với Supabase.
 */
export async function createTestDb(options: CreateTestDbOptions = {}): Promise<TestDbHandle> {
  const pg = new PGlite();
  if (options.withSupabaseRoles) {
    await pg.exec(`
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE authenticated NOLOGIN;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    `);
  }
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, pg, close: () => pg.close() };
}
