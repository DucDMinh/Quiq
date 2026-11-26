import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Khớp `paths` "@/*" trong tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    name: "web",
    environment: "jsdom",
    // globals để testing-library tự cleanup sau mỗi test; test vẫn import tường minh từ vitest.
    globals: true,
    css: false,
    // Polyfill jsdom cho Radix + matcher jest-dom dùng chung cho mọi test web.
    setupFiles: ["./vitest.setup.ts"],
  },
});
