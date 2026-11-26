import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "db",
    environment: "node",
    include: ["src/**/*.test.ts"],
    // PGlite khởi động WASM và áp dụng cả migration nên lần đầu có thể chậm.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
