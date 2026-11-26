import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("chấp nhận đúng mật khẩu và từ chối mật khẩu sai", async () => {
    const stored = await hashPassword("Mat-khau-dung-1");
    expect(await verifyPassword("Mat-khau-dung-1", stored)).toBe(true);
    expect(await verifyPassword("Mat-khau-sai", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("dùng salt ngẫu nhiên: cùng mật khẩu cho hai chuỗi hash khác nhau, cả hai đều verify được", async () => {
    const first = await hashPassword("trung-mat-khau");
    const second = await hashPassword("trung-mat-khau");
    expect(first).not.toBe(second);
    expect(await verifyPassword("trung-mat-khau", first)).toBe(true);
    expect(await verifyPassword("trung-mat-khau", second)).toBe(true);
  });

  it("không chứa mật khẩu gốc và ghi rõ thuật toán + tham số", async () => {
    const stored = await hashPassword("bi-mat-12345");
    expect(stored).not.toContain("bi-mat-12345");
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
  });

  it("hỗ trợ mật khẩu Unicode", async () => {
    const stored = await hashPassword("Mật-khẩu-tiếng-Việt-ệ");
    expect(await verifyPassword("Mật-khẩu-tiếng-Việt-ệ", stored)).toBe(true);
    expect(await verifyPassword("Mat-khau-tieng-Viet-e", stored)).toBe(false);
  });

  it.each([
    ["chuỗi rỗng", ""],
    ["không phải scrypt", "bcrypt$16384$8$1$c2FsdA$aGFzaA"],
    ["thiếu phần", "scrypt$16384$8$1$c2FsdA"],
    ["tham số không phải số", "scrypt$abc$8$1$c2FsdA$aGFzaA"],
    ["N không phải lũy thừa của 2", "scrypt$16385$8$1$c2FsdA$aGFzaA"],
    ["N quá lớn (chống cạn bộ nhớ)", "scrypt$1073741824$8$1$c2FsdA$aGFzaA"],
    ["salt rỗng", "scrypt$16384$8$1$$aGFzaA"],
    ["hash rỗng", "scrypt$16384$8$1$c2FsdA$"],
    ["N = 1 (lũy thừa của 2 nhưng scrypt từ chối)", "scrypt$1$8$1$c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2g"],
    ["N = 0", "scrypt$0$8$1$c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2g"],
    ["N âm", "scrypt$-2$8$1$c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2g"],
    ["r = 0", "scrypt$16384$0$1$c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2g"],
    ["p quá lớn", "scrypt$16384$8$9999$c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2g"],
    ["độ dài khóa quá ngắn", "scrypt$16384$8$1$c2FsdA$aGFzaA"],
    ["độ dài khóa cực lớn (chống cạn bộ nhớ)", `scrypt$16384$8$1$c2FsdA$${"A".repeat(400_000)}`],
    ["salt cực lớn", `scrypt$16384$8$1$${"A".repeat(400_000)}$aGFzaGhhc2hoYXNoaGFzaGhhc2g`],
    ["chuỗi rác toàn dấu phân cách", "$$$$$$"],
    ["chuỗi rác có ký tự điều khiển", "\u0000\u0000$\u0001$\u0002"],
    ["chuỗi rác Unicode", "💥".repeat(50)],
    ["scrypt$ lặp lại", "scrypt$scrypt$scrypt$scrypt$scrypt$scrypt"],
  ])("trả false (không ném lỗi) khi hash đã lưu sai định dạng: %s", async (_label, stored) => {
    expect(await verifyPassword("bat-ky", stored)).toBe(false);
  });

  it("từ chối khi hash đã lưu bị sửa một ký tự", async () => {
    const stored = await hashPassword("nguyen-ban");
    const lastChar = stored.at(-1) === "A" ? "B" : "A";
    expect(await verifyPassword("nguyen-ban", stored.slice(0, -1) + lastChar)).toBe(false);
  });
});
