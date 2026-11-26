import { STAFF_SESSION_TTL_MS } from "@quiq/shared/auth";
import type { Context } from "koa";
import { createHmac, randomBytes } from "node:crypto";
import type { AppDeps, SessionConfig } from "./deps";

export const STAFF_SESSION_COOKIE = "quiq_session";

/** Token đục 32 byte ngẫu nhiên; chỉ nằm trong cookie, DB giữ HMAC của nó. */
export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** HMAC-SHA256 theo SESSION_SECRET: có quyền ghi DB mà không có khóa thì cũng không tự tạo được phiên hợp lệ. */
export function hashSessionToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("base64url");
}

/** Thiếu cấu hình phiên thì ném lỗi thường (thành 500), không bao giờ rơi về khóa mặc định. */
export function requireSessionConfig(deps: AppDeps): SessionConfig {
  if (!deps.session?.secret) throw new Error("Thiếu cấu hình phiên (SESSION_SECRET) trong deps.session.");
  return deps.session;
}

export function readSessionToken(ctx: Context): string | undefined {
  return ctx.cookies.get(STAFF_SESSION_COOKIE) || undefined;
}

function applySecureFlag(ctx: Context, config: SessionConfig): void {
  // Next chuyển tiếp sang Koa bằng HTTP thường (TLS kết thúc ở phía trước), nên phải báo cho thư viện
  // cookies rằng kết nối gốc là an toàn; nếu không nó từ chối gửi cookie Secure.
  if (config.secureCookie) ctx.cookies.secure = true;
}

/** Ghi (hoặc gia hạn) cookie phiên; Max-Age khớp hạn trượt phía máy chủ. */
export function setSessionCookie(ctx: Context, token: string, config: SessionConfig): void {
  applySecureFlag(ctx, config);
  ctx.cookies.set(STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookie,
    path: "/",
    maxAge: STAFF_SESSION_TTL_MS,
    overwrite: true,
  });
}

export function clearSessionCookie(ctx: Context, config: SessionConfig): void {
  applySecureFlag(ctx, config);
  ctx.cookies.set(STAFF_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: config.secureCookie,
    path: "/",
    maxAge: 0,
    overwrite: true,
  });
}
