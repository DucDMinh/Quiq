import { z } from "zod";

/** Khóa ngắn hơn mức này coi như không an toàn. */
export const SESSION_SECRET_MIN_LENGTH = 32;

const envSchema = z.object({
  // Web dùng PORT (Next.js tự đọc, mặc định 3000); API dùng API_PORT để hai bên không đụng nhau.
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
});

/**
 * SESSION_SECRET bắt buộc: thiếu, rỗng hay quá ngắn thì dừng khởi động với thông điệp nêu tên biến.
 * Không bao giờ đưa giá trị biến vào thông điệp.
 */
function readSessionSecret(env: NodeJS.ProcessEnv): string {
  const secret = env.SESSION_SECRET?.trim() ?? "";
  if (secret === "") {
    throw new Error(
      "Thiếu SESSION_SECRET: biến chưa được đặt hoặc đang rỗng. Đặt một chuỗi ngẫu nhiên (ít nhất " +
        `${SESSION_SECRET_MIN_LENGTH} ký tự) trong .env.local. Biến rỗng ngay trong shell cũng tính (shell được ưu tiên hơn .env.local).`,
    );
  }
  if (secret.length < SESSION_SECRET_MIN_LENGTH) {
    throw new Error(
      `SESSION_SECRET quá ngắn: cần ít nhất ${SESSION_SECRET_MIN_LENGTH} ký tự ngẫu nhiên. ` +
        'Có thể tạo bằng: node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'base64url\'))"',
    );
  }
  return secret;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const { API_PORT } = envSchema.parse(env);
  return {
    port: API_PORT,
    session: {
      secret: readSessionSecret(env),
      // Production chạy sau proxy TLS: cookie phiên chỉ gửi qua HTTPS.
      secureCookie: env.NODE_ENV === "production",
    },
  };
}
