import { createDb, resolveDatabaseUrl } from "../client";
import { loadLocalEnvFile } from "../env";
import { assertSeedAllowed, DEMO_EXAM_CODE, DEMO_PASSWORD, resetDemoAttempts, seedDemo } from "./demo";

// pnpm --filter @quiq/db db:seed:demo [--reset-attempts]
// Idempotent: chạy lại không nhân đôi dữ liệu. --reset-attempts xóa bài làm để thử lại bài DEMO01.
async function main(): Promise<void> {
  loadLocalEnvFile();
  const url = resolveDatabaseUrl();
  // Kiểm tra TRƯỚC khi mở kết nối: seed không bao giờ được chạm production.
  assertSeedAllowed(process.env, url);

  const { db, close } = createDb({ url, max: 1 });
  try {
    await seedDemo(db);
    console.log("[seed] dữ liệu mẫu đã sẵn sàng.");
    if (process.argv.includes("--reset-attempts")) {
      const { attemptsDeleted } = await resetDemoAttempts(db);
      console.log(`[seed] đã xóa ${attemptsDeleted} bài làm, mở lại bài ${DEMO_EXAM_CODE}.`);
    }
    // Mật khẩu demo công khai, chỉ in vì seed đã bị chặn ở production phía trên.
    console.log(`[seed] đăng nhập: superadmin / admin.demo / gv.toan, mật khẩu: ${DEMO_PASSWORD}`);
    console.log(`[seed] bài thi mẫu: mã ${DEMO_EXAM_CODE}; học sinh HS001 đến HS005 (lớp 10A1).`);
  } finally {
    await close();
  }
}

main().catch((error: unknown) => {
  console.error("[seed] thất bại:", error instanceof Error ? error.message : error);
  process.exit(1);
});
