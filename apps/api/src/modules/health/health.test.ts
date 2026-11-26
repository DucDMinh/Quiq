import type { DatabaseLike } from "@quiq/db";
import type { ApiResponse } from "@quiq/shared/common";
import request from "supertest";
import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { systemClock } from "../../http/deps";
import { createTestApp, type TestApp } from "../../testing/test-app";

const DB_DOWN_MESSAGE = "Không kết nối được cơ sở dữ liệu.";

describe("GET /api/health", () => {
  let testApp: TestApp | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    await testApp?.close().catch(() => undefined);
    testApp = undefined;
  });

  it("trả envelope thành công { status: 'ok' }", async () => {
    testApp = await createTestApp();
    const res = await request(testApp.app.callback()).get("/api/health");

    const body = res.body as ApiResponse<{ status: string }>;
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, data: { status: "ok" } });
  });

  it("/health/db trả ok khi cơ sở dữ liệu sống", async () => {
    testApp = await createTestApp();
    const res = await request(testApp.app.callback()).get("/api/health/db");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok", db: "up" } });
  });

  it("/health/db trả 503 thông điệp chung khi PGlite đã đóng", async () => {
    testApp = await createTestApp();
    await testApp.close();

    const res = await request(testApp.app.callback()).get("/api/health/db");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      code: "DB_UNAVAILABLE",
      error: DB_DOWN_MESSAGE,
    });
  });

  it("/health/db không lộ chuỗi kết nối hay mật khẩu trong body lẫn log", async () => {
    const connectionString = "postgres://quiq_admin:Sup3rSecretPw@db.abc.supabase.co:5432/postgres";
    const failingDb = {
      execute: () =>
        Promise.reject(
          Object.assign(new Error(`connect to ${connectionString} failed`), { code: "ECONNREFUSED" }),
        ),
    } as unknown as DatabaseLike;
    const logged = (["error", "warn", "log", "info"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );

    const app = await createApp({ deps: { db: failingDb, clock: systemClock } });
    const res = await request(app.callback()).get("/api/health/db");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ success: false, code: "DB_UNAVAILABLE", error: DB_DOWN_MESSAGE });

    const logText = logged.map((spy) => inspect(spy.mock.calls, { depth: 6 })).join("\n");
    expect(logText).toContain("ECONNREFUSED"); // vẫn có đủ manh mối để chẩn đoán
    for (const secret of ["Sup3rSecretPw", "quiq_admin", "supabase.co", "postgres://"]) {
      expect(JSON.stringify(res.body)).not.toContain(secret);
      expect(logText).not.toContain(secret);
    }
  });
});
