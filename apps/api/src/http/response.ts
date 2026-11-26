import type { ApiFailure, ApiSuccess } from "@quiq/shared/common";
import type { Context } from "koa";
import type { AppError } from "./errors";

// Mọi response của API đi qua hai hàm này; không gán ctx.body tay trong route.
export function ok<T>(ctx: Context, data: T, status = 200): void {
  const body: ApiSuccess<T> = { success: true, data };
  ctx.status = status;
  ctx.body = body;
}

export function fail(ctx: Context, error: AppError): void {
  const body: ApiFailure = {
    success: false,
    code: error.code,
    error: error.message,
    details: error.details,
  };
  ctx.status = error.status;
  ctx.body = body;
}
