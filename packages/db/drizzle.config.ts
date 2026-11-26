import { defineConfig } from "drizzle-kit";

// Chỉ dùng để SINH migration (db:generate). Việc áp dụng migration do src/migrate.ts làm,
// để dùng chung cách kết nối (ssl, prepare:false) với client của ứng dụng.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
});
