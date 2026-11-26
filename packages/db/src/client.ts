import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

/** Kiểu chung cho mọi driver (postgres-js ở staging/prod, PGlite ở test) và cả transaction. */
export type DatabaseLike = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DbHandle {
  db: Db;
  /** Đóng pool kết nối (script và test phải gọi để tiến trình thoát). */
  close: () => Promise<void>;
}

export interface CreateDbOptions {
  /** Mặc định đọc từ `resolveDatabaseUrl()`. */
  url?: string;
  /**
   * Tắt prepared statement. Bắt buộc khi đi qua pooler chế độ transaction (cổng 6543 của Supabase)
   * vì mỗi truy vấn có thể rơi vào một kết nối khác nhau. Mặc định: tự bật khi cổng là 6543,
   * hoặc khi biến môi trường `DATABASE_PREPARE=false`.
   */
  prepare?: boolean;
  /** Số kết nối tối đa của pool. */
  max?: number;
}

/**
 * Chọn chuỗi kết nối: `DATABASE_URL_STAGING` trước, rồi `DATABASE_URL`.
 * `DATABASE_URL_PROD` cố ý KHÔNG nằm ở đây: production do pipeline deploy truyền vào `DATABASE_URL`,
 * không bao giờ được dùng nhầm khi chạy local.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL_STAGING?.trim() || env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Thiếu chuỗi kết nối cơ sở dữ liệu: đặt DATABASE_URL_STAGING (hoặc DATABASE_URL) trong .env.local. Xem docs/SUPABASE_SETUP.md.",
    );
  }
  return url;
}

function isLocalHost(url: URL): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
}

function shouldDisablePrepare(url: URL, env: NodeJS.ProcessEnv): boolean {
  if (env.DATABASE_PREPARE === "false") return true;
  return url.port === "6543";
}

export function createDb(options: CreateDbOptions = {}): DbHandle {
  const connectionString = options.url ?? resolveDatabaseUrl();
  const parsed = new URL(connectionString);
  const client = postgres(connectionString, {
    prepare: options.prepare ?? !shouldDisablePrepare(parsed, process.env),
    max: options.max ?? 10,
    // Supabase chỉ nhận kết nối mã hóa; máy local thì không cần.
    ssl: isLocalHost(parsed) ? false : "require",
    // Bỏ qua NOTICE của Postgres (vd. "relation already exists") cho đỡ ồn log.
    onnotice: () => {},
  });
  return { db: drizzle(client, { schema }), close: () => client.end({ timeout: 5 }) };
}
