import { defineConfig } from "vitest/config";

// Vitest 5 không còn đọc vitest.workspace.ts; mỗi thư mục dưới apps/ và packages/ là một project.
// Thư mục có vitest.config.ts thì dùng cấu hình riêng (web: jsdom ở L1-03).
export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
  },
});
