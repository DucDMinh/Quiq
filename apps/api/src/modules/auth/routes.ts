import { AUTH_ERRORS, loginRequestSchema } from "@quiq/shared/auth";
import type { Context } from "koa";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";
import { authenticate, authError, currentStaff } from "../../http/guards";
import { ok } from "../../http/response";
import {
  clearSessionCookie,
  hashSessionToken,
  newSessionToken,
  readSessionToken,
  requireSessionConfig,
  setSessionCookie,
} from "../../http/session-cookie";
import type { RegisterRoutes } from "../loader";
import { createLoginRateLimiter, loginRateLimitKey, type LoginRateLimiter } from "./rate-limit";
import { createSession, loadStaffMe, prepareLoginTiming, revokeSession, verifyLogin } from "./service";

/** Giữ chỗ một lượt thử (đồng bộ, trước mọi `await`); đang bị chặn thì ném 429. */
function acquireAttemptOrThrow(ctx: Context, limiter: LoginRateLimiter, key: string): void {
  const retryAfter = limiter.tryAcquire(key);
  if (retryAfter === 0) return;
  ctx.set("Retry-After", String(retryAfter));
  throw new AppError("LOGIN_THROTTLED", {
    ...AUTH_ERRORS.LOGIN_THROTTLED,
    details: { retryAfterSeconds: retryAfter },
  });
}

// Body chứa mật khẩu: không bao giờ ghi log body, không đưa vào lỗi hay response.
async function handleLogin(ctx: Context, deps: AppDeps, limiter: LoginRateLimiter): Promise<void> {
  const config = requireSessionConfig(deps);
  const credentials = loginRequestSchema.parse(ctx.request.body ?? {});
  const key = loginRateLimitKey(ctx.ip, credentials.username);
  // Đang bị chặn thì từ chối cả khi mật khẩu đúng, để 429 không thành công cụ dò mật khẩu.
  // Lượt thử được tính TRƯỚC khi kiểm mật khẩu: sai thì lượt đó giữ nguyên là một lần sai.
  acquireAttemptOrThrow(ctx, limiter, key);

  const outcome = await verifyLogin(deps.db, credentials);
  if (outcome.kind === "invalid") throw authError("INVALID_CREDENTIALS");
  limiter.reset(key);
  if (outcome.kind === "school_locked") throw authError("SCHOOL_LOCKED");

  // Đăng nhập lại trên trình duyệt đang có phiên cũ: thu hồi phiên cũ để token cũ không sống tiếp.
  const previousToken = readSessionToken(ctx);
  const now = deps.clock.now();
  if (previousToken) await revokeSession(deps.db, hashSessionToken(previousToken, config.secret), now);

  const token = newSessionToken();
  await createSession(deps.db, outcome.staffId, hashSessionToken(token, config.secret), now);
  setSessionCookie(ctx, token, config);
  ok(ctx, await loadStaffMe(deps.db, outcome.staffId));
}

async function handleLogout(ctx: Context, deps: AppDeps): Promise<void> {
  const config = requireSessionConfig(deps);
  const token = readSessionToken(ctx);
  if (token) await revokeSession(deps.db, hashSessionToken(token, config.secret), deps.clock.now());
  clearSessionCookie(ctx, config);
  ok(ctx, { loggedOut: true });
}

const registerAuthRoutes: RegisterRoutes = async (router, deps) => {
  const limiter = createLoginRateLimiter(deps.clock);
  // Tính sẵn hash giả để ngay request đầu tiên với tên không tồn tại cũng chỉ tốn một lần scrypt.
  await prepareLoginTiming();

  router.post("/auth/login", (ctx) => handleLogin(ctx, deps, limiter));
  // Không cần phiên hợp lệ: đăng xuất lặp lại hay với cookie đã hết hạn vẫn trả thành công.
  router.post("/auth/logout", (ctx) => handleLogout(ctx, deps));
  router.get("/auth/me", authenticate(deps), async (ctx) => {
    const me = await loadStaffMe(deps.db, currentStaff(ctx).staffId);
    if (!me) throw new AppError("UNAUTHENTICATED");
    ok(ctx, me);
  });
};

export default registerAuthRoutes;
