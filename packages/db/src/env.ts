import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Thư mục chứa các migration do drizzle-kit sinh (versioned, đã commit). */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

/**
 * Nạp `.env.local` ở thư mục gốc repo cho các script CLI (migrate, seed).
 * Biến đã có sẵn trong shell được ưu tiên (process.loadEnvFile không ghi đè).
 */
export function loadLocalEnvFile(): void {
  const envFile = fileURLToPath(new URL("../../../.env.local", import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}
