import { sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { createDb, type DatabaseLike } from "../client";
import { loadLocalEnvFile } from "../env";
import { hashPassword } from "../security/password";
import { staffAccounts } from "../schema";

const MIN_PASSWORD_LENGTH = 12;

export interface SuperAdminInput {
  username: string;
  password: string;
  displayName?: string;
}

/**
 * Tạo admin tổng bằng cách ghi thẳng DB (FR-005): hệ thống không có API nào tạo admin tổng.
 * Chạy lại với cùng username thì không làm gì (không ghi đè mật khẩu đang dùng).
 */
export async function ensureSuperAdmin(db: DatabaseLike, input: SuperAdminInput): Promise<{ created: boolean }> {
  const username = input.username.trim();
  if (username.length === 0) throw new Error("Tên đăng nhập admin tổng không được để trống.");
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Mật khẩu admin tổng phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
  }

  const [existing] = await db
    .select({ role: staffAccounts.role })
    .from(staffAccounts)
    .where(sql`lower(${staffAccounts.username}) = ${username.toLowerCase()}`);
  if (existing) {
    if (existing.role !== "super_admin") {
      throw new Error(`Tên đăng nhập "${username}" đã thuộc một tài khoản không phải admin tổng.`);
    }
    return { created: false };
  }

  await db.insert(staffAccounts).values({
    role: "super_admin",
    username,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName ?? "Admin tổng",
  });
  return { created: true };
}

// Chạy trực tiếp: SUPERADMIN_USERNAME=... SUPERADMIN_PASSWORD=... pnpm --filter @quiq/db db:seed:superadmin
// Mật khẩu đọc từ biến môi trường (không qua tham số dòng lệnh để khỏi lộ trong danh sách tiến trình) và không bao giờ được in ra.
async function main(): Promise<void> {
  loadLocalEnvFile();
  const username = process.env.SUPERADMIN_USERNAME;
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error("Cần đặt SUPERADMIN_USERNAME và SUPERADMIN_PASSWORD trong môi trường.");
  }
  const { db, close } = createDb({ max: 1 });
  try {
    const { created } = await ensureSuperAdmin(db, { username, password });
    console.log(created ? `[db] đã tạo admin tổng "${username}".` : `[db] admin tổng "${username}" đã tồn tại, giữ nguyên.`);
  } finally {
    await close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error("[db] seed admin tổng thất bại:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
