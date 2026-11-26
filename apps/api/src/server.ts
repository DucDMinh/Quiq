import { createDb, resolveDatabaseUrl } from "@quiq/db";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { systemClock } from "./http/deps";
import { createShutdown } from "./shutdown";

// Biến môi trường dev nằm ở .env.local của thư mục gốc repo; biến đã có sẵn trong shell được ưu tiên.
function loadLocalEnvFile(): void {
  const envFile = fileURLToPath(new URL("../../../.env.local", import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

// Biến rỗng trong shell vẫn được coi là "đã có" (loadEnvFile không ghi đè), nên thông điệp phải nói rõ.
// Không bao giờ in giá trị biến.
function resolveDatabaseUrlOrExplain(): string {
  try {
    return resolveDatabaseUrl();
  } catch {
    throw new Error(
      "Chưa có chuỗi kết nối cơ sở dữ liệu: DATABASE_URL_STAGING (hoặc DATABASE_URL) chưa được đặt hoặc đang rỗng. " +
        "Biến đang rỗng ngay trong shell cũng tính (shell được ưu tiên hơn .env.local). Xem docs/SUPABASE_SETUP.md.",
    );
  }
}

async function main(): Promise<void> {
  loadLocalEnvFile();
  // Thiếu SESSION_SECRET hay chuỗi kết nối thì dừng ngay, trước khi mở cổng.
  const config = loadConfig();
  const dbHandle = createDb({ url: resolveDatabaseUrlOrExplain() });
  const app = await createApp({ deps: { db: dbHandle.db, clock: systemClock, session: config.session } });

  const server = app.listen(config.port, () => {
    console.log(`[api] http://localhost:${config.port}/api/health  (kiểm tra DB: /api/health/db)`);
  });

  const shutdown = createShutdown({
    server,
    closeDb: dbHandle.close,
    exit: (code) => process.exit(code),
    logError: (error) => console.error(describeError(error)),
  });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

// Không in cả object lỗi: lỗi `new URL()` mang thuộc tính `input` chứa nguyên chuỗi kết nối.
function describeError(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exit(1);
});
