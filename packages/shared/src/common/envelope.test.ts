import { describe, expect, it } from "vitest";
import { z } from "zod";
import { COMMON_ERRORS, apiFailureSchema, apiResponseSchema } from "./index";
import type { ApiResponse } from "./index";

describe("envelope", () => {
  const healthSchema = apiResponseSchema(z.object({ status: z.string() }));

  it("chấp nhận phản hồi thành công", () => {
    const body: ApiResponse<{ status: string }> = { success: true, data: { status: "ok" } };
    expect(healthSchema.parse(body)).toEqual(body);
  });

  it("chấp nhận phản hồi lỗi có code, error và details", () => {
    const body = {
      success: false,
      code: "VALIDATION",
      error: "Dữ liệu không hợp lệ.",
      details: [{ path: "name", message: "Bắt buộc" }],
    };
    expect(apiFailureSchema.parse(body)).toEqual(body);
    expect(healthSchema.parse(body)).toEqual(body);
  });

  it("từ chối phản hồi thành công thiếu data hoặc sai kiểu", () => {
    expect(healthSchema.safeParse({ success: true }).success).toBe(false);
    expect(healthSchema.safeParse({ success: true, data: { status: 1 } }).success).toBe(false);
    expect(healthSchema.safeParse({ ok: true }).success).toBe(false);
  });
});

describe("COMMON_ERRORS", () => {
  it("mọi lỗi có mã HTTP 4xx/5xx và thông báo tiếng Việt không rỗng", () => {
    for (const [code, definition] of Object.entries(COMMON_ERRORS)) {
      expect(definition.status, code).toBeGreaterThanOrEqual(400);
      expect(definition.status, code).toBeLessThan(600);
      expect(definition.message.trim().length, code).toBeGreaterThan(0);
    }
  });

  it("có các mã chung mà design doc yêu cầu", () => {
    const statusByCode = Object.fromEntries(
      Object.entries(COMMON_ERRORS).map(([code, definition]) => [code, definition.status]),
    );
    expect(statusByCode).toMatchObject({
      BAD_REQUEST: 400,
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      VALIDATION: 422,
      RATE_LIMITED: 429,
      INTERNAL: 500,
    });
  });
});
