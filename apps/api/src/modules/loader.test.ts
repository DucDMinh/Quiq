import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app";

const fakeModule = (path: string, reply: string) => `
export default function register(router) {
  router.get(${JSON.stringify(path)}, (ctx) => {
    ctx.body = { reply: ${JSON.stringify(reply)} };
  });
}
`;

describe("module loader", () => {
  let modulesDir: string;

  beforeEach(async () => {
    modulesDir = await mkdtemp(join(tmpdir(), "quiq-modules-"));
  });

  afterEach(async () => {
    await rm(modulesDir, { recursive: true, force: true });
  });

  it("nạp module mẫu health từ thư mục modules thật", async () => {
    const app = await createApp();
    const res = await request(app.callback()).get("/api/health");
    expect(res.status).toBe(200);
  });

  it("thêm một thư mục module giả thì route xuất hiện, không cần sửa file nào khác", async () => {
    const before = await createApp({ modulesDir });
    const missing = await request(before.callback()).get("/api/ghost/ping");
    expect(missing.status).toBe(404);

    await mkdir(join(modulesDir, "ghost"));
    await writeFile(join(modulesDir, "ghost", "routes.ts"), fakeModule("/ghost/ping", "boo"));

    const after = await createApp({ modulesDir });
    const res = await request(after.callback()).get("/api/ghost/ping");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: "boo" });
  });

  it("bỏ qua file lẻ và thư mục không có routes.ts", async () => {
    await mkdir(join(modulesDir, "empty"));
    await writeFile(join(modulesDir, "README.txt"), "không phải module");

    const app = await createApp({ modulesDir });
    const res = await request(app.callback()).get("/api/empty");
    expect(res.status).toBe(404);
  });

  it("báo lỗi rõ tên module khi routes.ts không export default một hàm", async () => {
    await mkdir(join(modulesDir, "broken"));
    await writeFile(join(modulesDir, "broken", "routes.ts"), "export const nothing = 1;\n");

    await expect(createApp({ modulesDir })).rejects.toThrow(/broken/);
  });
});
