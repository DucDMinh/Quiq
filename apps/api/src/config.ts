import { z } from "zod";

const envSchema = z.object({
  // Web dùng PORT (Next.js tự đọc, mặc định 3000); API dùng API_PORT để hai bên không đụng nhau.
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const { API_PORT } = envSchema.parse(env);
  return { port: API_PORT };
}
