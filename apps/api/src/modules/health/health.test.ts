import type { ApiResponse } from "@quiq/shared/common";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app";

describe("GET /api/health", () => {
  it("trả envelope thành công { status: 'ok' }", async () => {
    const app = await createApp();
    const res = await request(app.callback()).get("/api/health");

    const body = res.body as ApiResponse<{ status: string }>;
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, data: { status: "ok" } });
  });
});
