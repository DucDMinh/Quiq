import type { Middleware } from "koa";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { fail } from "./response";

function httpStatusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    }));
    return new AppError("VALIDATION", { details });
  }
  // Lỗi từ koa-bodyparser (JSON hỏng, body quá lớn) mang sẵn status 4xx.
  const status = httpStatusOf(error);
  if (status === 413) return new AppError("PAYLOAD_TOO_LARGE");
  if (status !== undefined && status >= 400 && status < 500) return new AppError("BAD_REQUEST");
  return new AppError("INTERNAL");
}

export function errorMiddleware(): Middleware {
  return async (ctx, next) => {
    try {
      await next();
      if (ctx.status === 404 && ctx.body == null) fail(ctx, new AppError("NOT_FOUND"));
    } catch (error) {
      const appError = toAppError(error);
      // Chỉ lỗi bất ngờ mới ghi log; thông báo gửi về client luôn là câu chung, không lộ chi tiết.
      if (appError.status >= 500) ctx.app.emit("error", error, ctx);
      fail(ctx, appError);
    }
  };
}
