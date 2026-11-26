import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "api",
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Mỗi createTestApp khởi động PGlite (WASM) + áp migration thật: 1-2 giây, lâu hơn khi nhiều project chạy song song.
    // Layer sau: tạo createTestApp một lần mỗi file ở beforeAll và dọn dữ liệu giữa các test, đừng tạo mỗi test.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
