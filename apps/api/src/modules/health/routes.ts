import { sql } from "drizzle-orm";
import { AppError } from "../../http/errors";
import { fail, ok } from "../../http/response";
import type { RegisterRoutes } from "../loader";

// Thông điệp chung cho client; chi tiết lỗi driver (host, chuỗi kết nối) không bao giờ ra ngoài.
const DB_UNAVAILABLE = { status: 503, message: "Không kết nối được cơ sở dữ liệu." };

/**
 * Chỉ ghi tên + mã lỗi (vd. PostgresError(28P01), Error(ECONNREFUSED)) theo chuỗi `cause`,
 * vì `message` của driver có thể chứa host hoặc chính chuỗi kết nối.
 */
function describeDbError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 3; depth++) {
    const code = (current as { code?: unknown }).code;
    parts.push(typeof code === "string" ? `${current.name}(${code})` : current.name);
    current = current.cause;
  }
  return parts.join(" <- ") || "lỗi không xác định";
}

const registerHealthRoutes: RegisterRoutes = (router, deps) => {
  router.get("/health", (ctx) => ok(ctx, { status: "ok" }));

  // Để người dùng tự kiểm tra kết nối cơ sở dữ liệu (Supabase) từ trình duyệt.
  router.get("/health/db", async (ctx) => {
    try {
      await deps.db.execute(sql`select 1`);
    } catch (error) {
      console.error(`[api] /health/db: truy vấn kiểm tra thất bại: ${describeDbError(error)}`);
      fail(ctx, new AppError("DB_UNAVAILABLE", DB_UNAVAILABLE));
      return;
    }
    ok(ctx, { status: "ok", db: "up" });
  });
};

export default registerHealthRoutes;
