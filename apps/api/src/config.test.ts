import { describe, expect, it } from "vitest";
import { loadConfig, SESSION_SECRET_MIN_LENGTH } from "./config";

const VALID_SECRET = "a".repeat(SESSION_SECRET_MIN_LENGTH);

describe("loadConfig", () => {
  it("đọc cổng và SESSION_SECRET; cookie Secure chỉ khi production", () => {
    expect(loadConfig({ SESSION_SECRET: VALID_SECRET, API_PORT: "4100" })).toEqual({
      port: 4100,
      session: { secret: VALID_SECRET, secureCookie: false },
    });
    expect(loadConfig({ SESSION_SECRET: VALID_SECRET, NODE_ENV: "production" }).session.secureCookie).toBe(true);
  });

  it.each([
    ["thiếu", {}],
    ["rỗng", { SESSION_SECRET: "" }],
    ["chỉ khoảng trắng", { SESSION_SECRET: "   " }],
  ])("SESSION_SECRET %s: dừng với thông điệp nêu tên biến", (_label, env) => {
    expect(() => loadConfig(env)).toThrow(/Thiếu SESSION_SECRET/);
  });

  it("SESSION_SECRET quá ngắn: báo lỗi nhưng không in giá trị", () => {
    const shortSecret = "ngan-qua-XYZ";
    let message = "";
    try {
      loadConfig({ SESSION_SECRET: shortSecret });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/SESSION_SECRET quá ngắn/);
    expect(message).not.toContain(shortSecret);
  });
});
