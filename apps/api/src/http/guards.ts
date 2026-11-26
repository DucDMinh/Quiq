/**
 * Guard dùng chung cho route của cán bộ, theo thứ tự: authenticate → requireRole → requireTenant → handler.
 *
 *   router.get("/questions/:id", ...staffGuard(deps, ["teacher"]), async (ctx) => {
 *     const schoolId = tenantSchoolId(ctx); // luôn lấy từ phiên, KHÔNG từ body/query/params
 *     // truy vấn phải lọc theo schoolId: id của trường khác đơn giản là không tìm thấy → 404
 *   });
 */
import { AUTH_ERRORS, type AuthErrorCode } from "@quiq/shared/auth";
import type { StaffRole } from "@quiq/db";
import type { Context, Middleware } from "koa";
import { extendSession, findActiveSession } from "../modules/auth/service";
import type { AppDeps } from "./deps";
import { AppError } from "./errors";
import {
  clearSessionCookie,
  hashSessionToken,
  readSessionToken,
  requireSessionConfig,
  setSessionCookie,
} from "./session-cookie";

/** Cán bộ của request hiện tại, do `authenticate` gắn vào `ctx.state.staff`. */
export interface StaffContext {
  sessionId: string;
  staffId: string;
  role: StaffRole;
  /** null với admin tổng. */
  schoolId: string | null;
}

export function authError(code: AuthErrorCode): AppError {
  return new AppError(code, AUTH_ERRORS[code]);
}

/**
 * Đọc cookie phiên, kiểm phiên còn hiệu lực + tài khoản còn hoạt động + trường không bị khóa,
 * rồi gia hạn trượt 8 giờ (DB và cookie). Thiếu/hết hạn/bị thu hồi → 401.
 */
export function authenticate(deps: AppDeps): Middleware {
  return async (ctx, next) => {
    const config = requireSessionConfig(deps);
    const token = readSessionToken(ctx);
    if (!token) throw new AppError("UNAUTHENTICATED");

    const now = deps.clock.now();
    const session = await findActiveSession(deps.db, hashSessionToken(token, config.secret), now);
    if (!session || !session.staffActive) {
      clearSessionCookie(ctx, config);
      throw new AppError("UNAUTHENTICATED");
    }
    if (session.schoolLocked) throw authError("SCHOOL_LOCKED");

    await extendSession(deps.db, session.sessionId, now);
    setSessionCookie(ctx, token, config);
    const staff: StaffContext = {
      sessionId: session.sessionId,
      staffId: session.staffId,
      role: session.role,
      schoolId: session.schoolId,
    };
    ctx.state.staff = staff;
    await next();
  };
}

export function currentStaff(ctx: Context): StaffContext {
  const staff = ctx.state.staff as StaffContext | undefined;
  // Lỗi lập trình (quên authenticate trước): thành 500, không lặng lẽ cho qua.
  if (!staff) throw new Error("currentStaff() gọi trước authenticate().");
  return staff;
}

/** Sai vai trò → 403. */
export function requireRole(...roles: StaffRole[]): Middleware {
  return async (ctx, next) => {
    if (!roles.includes(currentStaff(ctx).role)) throw new AppError("FORBIDDEN");
    await next();
  };
}

/** Route dữ liệu của trường: phiên phải gắn với một trường (admin tổng không có) → nếu không, 403. */
export function requireTenant(): Middleware {
  return async (ctx, next) => {
    if (currentStaff(ctx).schoolId === null) throw new AppError("FORBIDDEN");
    await next();
  };
}

/** schoolId của phiên; dùng cho mọi truy vấn dữ liệu trường. */
export function tenantSchoolId(ctx: Context): string {
  const schoolId = currentStaff(ctx).schoolId;
  if (schoolId === null) throw new Error("tenantSchoolId() gọi cho route không có requireTenant().");
  return schoolId;
}

/** Tài nguyên đã nạp theo id mà thuộc trường khác (hoặc không có) → 404, không lộ sự tồn tại. */
export function assertSameSchool(ctx: Context, resourceSchoolId: string | null | undefined): void {
  if (!resourceSchoolId || resourceSchoolId !== tenantSchoolId(ctx)) throw new AppError("NOT_FOUND");
}

/** Bộ guard đầy đủ cho route dữ liệu trường: `router.get(path, ...staffGuard(deps, ["teacher"]), handler)`. */
export function staffGuard(deps: AppDeps, roles: StaffRole[]): Middleware[] {
  return [authenticate(deps), requireRole(...roles), requireTenant()];
}
