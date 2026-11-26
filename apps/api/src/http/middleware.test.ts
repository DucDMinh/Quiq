import { apiFailureSchema } from "@quiq/shared/common";
import type { ApiResponse } from "@quiq/shared/common";
import Koa from "koa";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "./errors";
import { errorMiddleware } from "./middleware";
import { ok } from "./response";

function appThatDoes(handler: (ctx: Koa.Context) => void): Koa {
  const app = new Koa();
  app.silent = true;
  app.use(errorMiddleware());
  app.use((ctx) => handler(ctx));
  return app;
}

describe("ok()", () => {
  it("bọc dữ liệu vào envelope thành công, mặc định 200 và nhận status tùy chọn", async () => {
    const app = appThatDoes((ctx) => ok(ctx, { id: 7 }, 201));
    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(201);
    expect(res.body as ApiResponse<{ id: number }>).toEqual({ success: true, data: { id: 7 } });
  });
});

describe("errorMiddleware", () => {
  it("AppError mã chung: lấy status và thông báo từ danh mục tiếng Việt", async () => {
    const app = appThatDoes(() => {
      throw new AppError("CONFLICT", { details: [{ path: "code", message: "Mã đã tồn tại" }] });
    });
    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(409);
    const body = apiFailureSchema.parse(res.body);
    expect(body.code).toBe("CONFLICT");
    expect(body.error).toMatch(/\S/);
    expect(body.details).toEqual([{ path: "code", message: "Mã đã tồn tại" }]);
  });

  it("AppError mã riêng của domain: dùng status và message được truyền vào", async () => {
    const app = appThatDoes(() => {
      throw new AppError("EXAM_CLOSED", { status: 409, message: "Bài thi đã đóng." });
    });
    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, code: "EXAM_CLOSED", error: "Bài thi đã đóng." });
  });

  it("ZodError thành 422 VALIDATION với details theo từng trường", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const app = appThatDoes(() => {
      schema.parse({ name: "" });
    });
    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(422);
    const body = apiFailureSchema.parse(res.body);
    expect(body.code).toBe("VALIDATION");
    expect(body.details).toEqual([{ path: "name", message: expect.any(String) }]);
  });

  it("route không tồn tại (không ai trả lời) thành 404 NOT_FOUND dạng envelope", async () => {
    const app = new Koa();
    app.use(errorMiddleware());
    const res = await request(app.callback()).get("/khong-co");
    expect(res.status).toBe(404);
    expect(apiFailureSchema.parse(res.body).code).toBe("NOT_FOUND");
  });

  it("lỗi bất ngờ thành 500 INTERNAL và không lộ nội dung lỗi", async () => {
    const app = appThatDoes(() => {
      throw new Error("mật khẩu DB là hunter2");
    });
    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(500);
    expect(apiFailureSchema.parse(res.body).code).toBe("INTERNAL");
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
  });
});
