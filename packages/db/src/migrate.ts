import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./client";
import { loadLocalEnvFile, MIGRATIONS_FOLDER } from "./env";

// Áp dụng các migration đã sinh sẵn (versioned) vào database trong DATABASE_URL_STAGING / DATABASE_URL.
// Không bao giờ dùng `drizzle-kit push`: schema chỉ đổi qua migration đã commit.
async function main(): Promise<void> {
  loadLocalEnvFile();
  const { db, close } = createDb({ max: 1 });
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("[db] migration đã áp dụng xong.");
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("[db] migrate thất bại:", error instanceof Error ? error.message : error);
  process.exit(1);
});
