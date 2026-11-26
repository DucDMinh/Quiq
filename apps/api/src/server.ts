import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { loadConfig } from "./config";

// Biến môi trường dev nằm ở .env.local của thư mục gốc repo; biến đã có sẵn trong shell được ưu tiên.
function loadLocalEnvFile(): void {
  const envFile = fileURLToPath(new URL("../../../.env.local", import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

async function main(): Promise<void> {
  loadLocalEnvFile();
  const config = loadConfig();
  const app = await createApp();

  const server = app.listen(config.port, () => {
    console.log(`[api] http://localhost:${config.port}/api/health`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
