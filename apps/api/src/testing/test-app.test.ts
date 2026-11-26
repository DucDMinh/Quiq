import { sql } from "drizzle-orm";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, type CreateTestAppOptions, type TestApp } from "./test-app";
import { createTestClock } from "./test-clock";

describe("createTestClock", () => {
  it("set đặt lại thời điểm, advance cộng thêm mili giây", () => {
    const clock = createTestClock(new Date("2026-03-01T08:00:00.000Z"));
    expect(clock.now().toISOString()).toBe("2026-03-01T08:00:00.000Z");

    clock.advance(90_000);
    expect(clock.now().toISOString()).toBe("2026-03-01T08:01:30.000Z");

    clock.set(new Date("2027-01-01T00:00:00.000Z"));
    expect(clock.now().toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("now() trả bản sao: sửa Date trả về không làm lệch đồng hồ", () => {
    const clock = createTestClock(new Date("2026-03-01T08:00:00.000Z"));
    clock.now().setFullYear(1999);
    expect(clock.now().toISOString()).toBe("2026-03-01T08:00:00.000Z");
  });
});

describe("createTestApp", () => {
  const opened: TestApp[] = [];
  const open = async (options?: CreateTestAppOptions) => {
    const testApp = await createTestApp(options);
    opened.push(testApp);
    return testApp;
  };

  afterEach(async () => {
    // close() gọi lại trên PGlite đã đóng cũng không được làm vỡ test dọn dẹp.
    await Promise.all(opened.splice(0).map((testApp) => testApp.close().catch(() => undefined)));
  });

  it("chạy app trên PGlite đã migrate, health cũ vẫn đúng hợp đồng", async () => {
    const { app, db } = await open();

    const migrated = await db.execute(
      sql`select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
    );
    expect((migrated.rows[0] as { n: number }).n).toBeGreaterThan(0);

    const res = await request(app.callback()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: "ok" } });
  });

  it("hai lần gọi cho hai cơ sở dữ liệu độc lập", async () => {
    const first = await open();
    const second = await open();

    await first.db.execute(sql`create table probe_only_in_first (id int)`);

    await expect(first.db.execute(sql`select * from probe_only_in_first`)).resolves.toBeDefined();
    await expect(second.db.execute(sql`select * from probe_only_in_first`)).rejects.toThrow();
  });

  it("advance đổi deps.clock.now() mà route của module nhìn thấy", async () => {
    const modulesDir = await mkdtemp(join(tmpdir(), "quiq-clock-module-"));
    try {
      await mkdir(join(modulesDir, "clockprobe"));
      await writeFile(
        join(modulesDir, "clockprobe", "routes.ts"),
        `export default function register(router, deps) {
  router.get("/now", (ctx) => { ctx.body = { now: deps.clock.now().toISOString() }; });
}
`,
      );
      const { app, clock } = await open({ modulesDir });
      const readNow = async () =>
        ((await request(app.callback()).get("/api/now")).body as { now: string }).now;

      const before = await readNow();
      clock.advance(60_000);
      const after = await readNow();

      expect(new Date(after).getTime() - new Date(before).getTime()).toBe(60_000);
    } finally {
      await rm(modulesDir, { recursive: true, force: true });
    }
  });

  it("close() giải phóng kết nối: truy vấn sau đó thất bại", async () => {
    const { db, close } = await open();
    await close();

    await expect(db.execute(sql`select 1`)).rejects.toThrow();
  });
});
