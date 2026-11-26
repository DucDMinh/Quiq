import { describe, expect, it } from "vitest";
import { assertSeedAllowed, supabaseProjectRef } from "./guard";

// Chuỗi giả: ref và mật khẩu đều là dữ liệu bịa cho test.
const POOLER_HOST = "aws-0-ap-southeast-1.pooler.supabase.com";
const sessionPooler = (ref: string) => `postgresql://postgres.${ref}:pw@${POOLER_HOST}:5432/postgres`;
const transactionPooler = (ref: string) => `postgresql://postgres.${ref}:pw@${POOLER_HOST}:6543/postgres`;
const directHost = (ref: string) => `postgresql://postgres:pw@db.${ref}.supabase.co:5432/postgres`;

describe("supabaseProjectRef", () => {
  it("suy ra ref từ user dạng postgres.<ref> của pooler (cả hai cổng)", () => {
    expect(supabaseProjectRef(sessionPooler("abcdefghij"))).toBe("abcdefghij");
    expect(supabaseProjectRef(transactionPooler("abcdefghij"))).toBe("abcdefghij");
  });

  it("suy ra ref từ host db.<ref>.supabase.co của kết nối trực tiếp", () => {
    expect(supabaseProjectRef(directHost("abcdefghij"))).toBe("abcdefghij");
  });

  it("không phân biệt hoa thường và bỏ qua tham số truy vấn", () => {
    expect(supabaseProjectRef(`${sessionPooler("AbCdEfGhIj")}?sslmode=require`)).toBe("abcdefghij");
  });

  it.each([
    ["host tự đặt", "postgresql://app:pw@db.internal.example.com:5432/app"],
    ["localhost", "postgresql://postgres:pw@localhost:5432/postgres"],
    ["user pooler không có ref", `postgresql://postgres:pw@${POOLER_HOST}:5432/postgres`],
    ["chuỗi rác", "không phải URL"],
    ["chuỗi rỗng", ""],
  ])("trả null khi không suy ra được ref: %s", (_label, url) => {
    expect(supabaseProjectRef(url)).toBeNull();
  });
});

describe("assertSeedAllowed: so sánh project ref", () => {
  it("từ chối khi prod khai bằng pooler còn chuỗi đang dùng là direct host của CÙNG project", () => {
    expect(() =>
      assertSeedAllowed({ DATABASE_URL_PROD: sessionPooler("prodref0001") }, directHost("prodref0001")),
    ).toThrow(/DATABASE_URL_PROD/);
  });

  it("từ chối chiều ngược lại: prod khai direct, chuỗi đang dùng là pooler của cùng project", () => {
    expect(() =>
      assertSeedAllowed({ DATABASE_URL_PROD: directHost("prodref0001") }, transactionPooler("prodref0001")),
    ).toThrow(/DATABASE_URL_PROD/);
  });

  it("cho phép khi hai project khác nhau, kể cả khác dạng URL", () => {
    expect(() =>
      assertSeedAllowed({ DATABASE_URL_PROD: sessionPooler("prodref0001") }, directHost("stagingref1")),
    ).not.toThrow();
    expect(() =>
      assertSeedAllowed({ DATABASE_URL_PROD: directHost("prodref0001") }, sessionPooler("stagingref1")),
    ).not.toThrow();
  });

  it("từ chối khi không chắc chắn: cả hai biến cùng có nhưng không suy ra được ref của một bên", () => {
    const custom = "postgresql://app:pw@db.internal.example.com:5432/app";
    expect(() => assertSeedAllowed({ DATABASE_URL_PROD: sessionPooler("prodref0001") }, custom)).toThrow(
      /không xác định được/,
    );
    expect(() => assertSeedAllowed({ DATABASE_URL_PROD: custom }, sessionPooler("stagingref1"))).toThrow(
      /không xác định được/,
    );
    expect(() => assertSeedAllowed({ DATABASE_URL_PROD: "rác" }, sessionPooler("stagingref1"))).toThrow(
      /không xác định được/,
    );
  });

  it("máy local chắc chắn không phải production nên vẫn được seed", () => {
    expect(() =>
      assertSeedAllowed(
        { DATABASE_URL_PROD: sessionPooler("prodref0001") },
        "postgresql://postgres:pw@localhost:5432/quiq_dev",
      ),
    ).not.toThrow();
  });

  it("không có DATABASE_URL_PROD thì không có gì để so", () => {
    expect(() => assertSeedAllowed({}, "postgresql://app:pw@db.internal.example.com:5432/app")).not.toThrow();
    expect(() => assertSeedAllowed({ DATABASE_URL_PROD: "  " }, directHost("stagingref1"))).not.toThrow();
  });
});
