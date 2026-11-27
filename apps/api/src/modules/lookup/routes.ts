import { COMMON_ERRORS } from "@quiq/shared/common";
import { lookupBodySchema, lookupSchoolParamsSchema } from "@quiq/shared/lookup";
import type { Context } from "koa";
import { AppError } from "../../http/errors";
import { ok } from "../../http/response";
import type { RegisterRoutes } from "../loader";
import { createLookupRateLimiter, type LookupRateLimiter } from "./rate-limit";
import { listLookupSchools, listLookupYears, lookupScores } from "./service";

/** Tính lượt TRƯỚC khi đọc body (input sai cũng tính) và trước mọi `await`; đang bị chặn thì ném 429. */
function acquireOrThrow(ctx: Context, limiter: LookupRateLimiter): void {
  const retryAfter = limiter.tryAcquire(ctx.ip);
  if (retryAfter === 0) return;
  ctx.set("Retry-After", String(retryAfter));
  throw new AppError("RATE_LIMITED", {
    ...COMMON_ERRORS.RATE_LIMITED,
    details: { retryAfterSeconds: retryAfter },
  });
}

// Công khai, không cần đăng nhập và cố ý không dùng guard trạng thái trường (C-09: trường khóa vẫn tra được).
const registerLookupRoutes: RegisterRoutes = (router, deps) => {
  const limiter = createLookupRateLimiter(deps.clock);

  router.get("/lookup/schools", async (ctx) => {
    ok(ctx, await listLookupSchools(deps.db));
  });

  router.get("/lookup/schools/:schoolId/years", async (ctx) => {
    const { schoolId } = lookupSchoolParamsSchema.parse(ctx.params);
    ok(ctx, await listLookupYears(deps.db, schoolId));
  });

  router.post("/lookup", async (ctx) => {
    acquireOrThrow(ctx, limiter);
    const input = lookupBodySchema.parse(ctx.request.body ?? {});
    ok(ctx, await lookupScores(deps.db, input));
  });
};

export default registerLookupRoutes;
