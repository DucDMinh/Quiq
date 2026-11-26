import { describe, expect, it } from "vitest";
import { enterBodySchema, normalizeExamCode, normalizeStudentCode } from "./index";

describe("chuẩn hóa mã", () => {
  it("mã bài thi: bỏ khoảng trắng, chữ hoa, lấy mã từ link dán vào", () => {
    expect(normalizeExamCode("  de mo01 ")).toBe("DEMO01");
    expect(normalizeExamCode("http://localhost:3000/thi/demo01/phong-cho?x=1")).toBe("DEMO01");
    expect(normalizeExamCode("/thi/Demo01")).toBe("DEMO01");
    expect(normalizeExamCode("%E0%A4%A")).toBe("%E0%A4%A");
  });

  it("mã học sinh: trim + chữ hoa; body rỗng sau chuẩn hóa bị từ chối", () => {
    expect(normalizeStudentCode("  hs001 ")).toBe("HS001");
    expect(enterBodySchema.parse({ examCode: " demo01", studentCode: "hs001 " })).toEqual({
      examCode: "DEMO01",
      studentCode: "HS001",
    });
    expect(enterBodySchema.safeParse({ examCode: "   ", studentCode: "HS001" }).success).toBe(
      false,
    );
  });
});
