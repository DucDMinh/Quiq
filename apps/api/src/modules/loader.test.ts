import type { DatabaseLike } from "@quiq/db";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";
import type { AppDeps } from "../http/deps";
import { createTestClock } from "../testing/test-clock";

const fakeModule = (path: string, reply: string) => `
export default function register(router) {
  router.get(${JSON.stringify(path)}, (ctx) => {
    ctx.body = { reply: ${JSON.stringify(reply)} };
  });
}
`;

// Module giả dùng cả hai phần của deps, để chứng minh loader truyền đúng đối tượng đã đưa vào createApp.
const depsAwareModule = `
export default function register(router, deps) {
  router.get("/spy", (ctx) => {
    ctx.body = { dbMarker: deps.db.marker, now: deps.clock.now().toISOString() };
  });
}
`;

// db giả chỉ để kiểm tra việc truyền tay; module thật dùng PGlite qua createTestApp.
const fakeDeps: AppDeps = {
  db: { marker: "fake-db" } as unknown as DatabaseLike,
  clock: createTestClock(new Date("2026-05-05T05:05:05.000Z")),
};

describe("module loader", () => {
  let modulesDir: string;

  beforeEach(async () => {
    modulesDir = await mkdtemp(join(tmpdir(), "quiq-modules-"));
  });

  afterEach(async () => {
    await rm(modulesDir, { recursive: true, force: true });
  });

  it("nạp module mẫu health từ thư mục modules thật", async () => {
    const app = await createApp({ deps: fakeDeps });
    const res = await request(app.callback()).get("/api/health");
    expect(res.status).toBe(200);
  });

  it("thêm một thư mục module giả thì route xuất hiện, không cần sửa file nào khác", async () => {
    const before = await createApp({ deps: fakeDeps, modulesDir });
    const missing = await request(before.callback()).get("/api/ghost/ping");
    expect(missing.status).toBe(404);

    await mkdir(join(modulesDir, "ghost"));
    await writeFile(join(modulesDir, "ghost", "routes.ts"), fakeModule("/ghost/ping", "boo"));

    const after = await createApp({ deps: fakeDeps, modulesDir });
    const res = await request(after.callback()).get("/api/ghost/ping");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "boo" });
  });

  it("module chỉ khai (router), không dùng deps, vẫn chạy", async () => {
    await mkdir(join(modulesDir, "legacy"));
    await writeFile(join(modulesDir, "legacy", "routes.ts"), fakeModule("/legacy/ping", "old"));

    const app = await createApp({ deps: fakeDeps, modulesDir });
    const res = await request(app.callback()).get("/api/legacy/ping");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "old" });
  });

  it("truyền đúng deps.db và deps.clock vào routes.ts của module", async () => {
    await mkdir(join(modulesDir, "spy"));
    await writeFile(join(modulesDir, "spy", "routes.ts"), depsAwareModule);

    const app = await createApp({ deps: fakeDeps, modulesDir });
    const res = await request(app.callback()).get("/api/spy");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ dbMarker: "fake-db", now: "2026-05-05T05:05:05.000Z" });
  });

  it("chờ register async xong rồi mới coi là nạp xong", async () => {
    await mkdir(join(modulesDir, "slow"));
    await writeFile(
      join(modulesDir, "slow", "routes.ts"),
      `export default async function register(router) {
  await new Promise((resolve) => setTimeout(resolve, 20));
  router.get("/slow", (ctx) => { ctx.body = { ready: true }; });
}
`,
    );

    const app = await createApp({ deps: fakeDeps, modulesDir });
    const res = await request(app.callback()).get("/api/slow");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ready: true });
  });

  it("register async ném lỗi thì createApp reject (không thành unhandled rejection)", async () => {
    await mkdir(join(modulesDir, "boom"));
    await writeFile(
      join(modulesDir, "boom", "routes.ts"),
      `export default async function register() { throw new Error("setup hỏng"); }\n`,
    );

    await expect(createApp({ deps: fakeDeps, modulesDir })).rejects.toThrow("setup hỏng");
  });

  it("bỏ qua file lẻ và thư mục không có routes.ts", async () => {
    await mkdir(join(modulesDir, "empty"));
    await writeFile(join(modulesDir, "README.txt"), "không phải module");

    const app = await createApp({ deps: fakeDeps, modulesDir });
    const res = await request(app.callback()).get("/api/empty");
    expect(res.status).toBe(404);
  });

  it("báo lỗi rõ tên module khi routes.ts không export default một hàm", async () => {
    await mkdir(join(modulesDir, "broken"));
    await writeFile(join(modulesDir, "broken", "routes.ts"), "export const nothing = 1;\n");

    await expect(createApp({ deps: fakeDeps, modulesDir })).rejects.toThrow(/broken/);
  });
});
