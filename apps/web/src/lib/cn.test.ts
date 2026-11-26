import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("gộp class điều kiện và bỏ giá trị falsy", () => {
    const disabled = false as boolean;
    expect(cn("a", disabled && "b", undefined, "c")).toBe("a c");
  });

  it("cỡ chữ tùy biến (text-score, text-control, text-badge) không bị gộp nhầm với màu chữ", () => {
    expect(cn("text-score", "text-ink")).toBe("text-score text-ink");
    expect(cn("text-ink", "text-score")).toBe("text-ink text-score");
    expect(cn("text-control", "text-on-brand")).toBe("text-control text-on-brand");
    expect(cn("text-badge", "text-danger-text")).toBe("text-badge text-danger-text");
  });

  it("hai cỡ chữ thì class sau thắng, kể cả cỡ tùy biến", () => {
    expect(cn("text-control", "text-sm")).toBe("text-sm");
    expect(cn("text-sm", "text-score")).toBe("text-score");
  });

  it("hai màu chữ hoặc nền tùy biến thì class sau thắng", () => {
    expect(cn("text-ink", "text-on-brand")).toBe("text-on-brand");
    expect(cn("bg-quiq-rose", "bg-answer-a")).toBe("bg-answer-a");
    expect(cn("border-line", "border-quiq-red")).toBe("border-quiq-red");
  });

  it("đổ bóng tùy biến: shadow-card và shadow-selected thay thế shadow chuẩn, không đụng màu", () => {
    expect(cn("shadow-card", "shadow-lg")).toBe("shadow-lg");
    expect(cn("shadow-lg", "shadow-selected")).toBe("shadow-selected");
    expect(cn("shadow-card", "shadow-quiq-rose")).toBe("shadow-card shadow-quiq-rose");
  });

  it("độ rộng viền theo token không xóa màu viền cùng cạnh", () => {
    expect(cn("border-b-brand-dark", "border-b-(length:--lip-width)")).toBe(
      "border-b-brand-dark border-b-(length:--lip-width)",
    );
    expect(cn("border-b-(length:--lip-width)", "border-b-(length:--lip-width-sm)")).toBe(
      "border-b-(length:--lip-width-sm)",
    );
  });

  it("font-display và font-bold cùng tồn tại; hai font family thì class sau thắng", () => {
    expect(cn("font-display", "font-bold")).toBe("font-display font-bold");
    expect(cn("font-sans", "font-display")).toBe("font-display");
  });
});
