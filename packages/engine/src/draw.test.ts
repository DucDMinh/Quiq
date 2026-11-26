import { describe, expect, it } from "vitest";
import { drawQuestions } from "./draw";
import { seededRng } from "./test-utils";
import type { BankQuestion, Difficulty } from "./types";

function makeBank(counts: Record<Difficulty, number>): BankQuestion[] {
  const bank: BankQuestion[] = [];
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    for (let i = 0; i < counts[difficulty]; i += 1) bank.push({ id: `${difficulty}-${i}`, difficulty });
  }
  return bank;
}

const countBy = (questions: BankQuestion[], difficulty: Difficulty) =>
  questions.filter((q) => q.difficulty === difficulty).length;

describe("drawQuestions", () => {
  it("rút đúng tổng và đúng từng mức, không trùng câu", () => {
    const bank = makeBank({ easy: 30, medium: 30, hard: 30 });
    const result = drawQuestions(bank, { total: 20, easy: 8, medium: 7, hard: 5 }, seededRng(1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions).toHaveLength(20);
    expect(countBy(result.questions, "easy")).toBe(8);
    expect(countBy(result.questions, "medium")).toBe(7);
    expect(countBy(result.questions, "hard")).toBe(5);
    expect(new Set(result.questions.map((q) => q.id)).size).toBe(20);
  });

  it("giữ nguyên các thuộc tính khác của câu hỏi (kiểu generic)", () => {
    const bank = makeBank({ easy: 3, medium: 0, hard: 0 }).map((q) => ({ ...q, content: `nd-${q.id}` }));
    const result = drawQuestions(bank, { total: 2, easy: 2, medium: 0, hard: 0 }, seededRng(1));
    expect(result.ok && result.questions.every((q) => q.content === `nd-${q.id}`)).toBe(true);
  });

  it("thiếu câu Khó -> lỗi có dữ liệu {difficulty:'hard', have:8, need:10}", () => {
    const bank = makeBank({ easy: 30, medium: 30, hard: 8 });
    const result = drawQuestions(bank, { total: 30, easy: 10, medium: 10, hard: 10 }, seededRng(1));
    expect(result).toEqual({
      ok: false,
      error: { code: "insufficient_questions", difficulty: "hard", have: 8, need: 10 },
    });
  });

  it("thiếu ở bất kỳ mức nào: dễ và trung bình cũng báo đúng mức", () => {
    const easyShort = drawQuestions(
      makeBank({ easy: 1, medium: 5, hard: 5 }),
      { total: 6, easy: 2, medium: 2, hard: 2 },
      seededRng(1),
    );
    expect(easyShort).toEqual({
      ok: false,
      error: { code: "insufficient_questions", difficulty: "easy", have: 1, need: 2 },
    });
    const mediumShort = drawQuestions(
      makeBank({ easy: 5, medium: 0, hard: 5 }),
      { total: 3, easy: 1, medium: 1, hard: 1 },
      seededRng(1),
    );
    expect(mediumShort).toEqual({
      ok: false,
      error: { code: "insufficient_questions", difficulty: "medium", have: 0, need: 1 },
    });
  });

  it("mức cần 0 câu thì không cần ngân hàng có câu mức đó", () => {
    const result = drawQuestions(
      makeBank({ easy: 5, medium: 0, hard: 0 }),
      { total: 5, easy: 5, medium: 0, hard: 0 },
      seededRng(1),
    );
    expect(result.ok).toBe(true);
  });

  it("đúng bằng số có sẵn: rút hết", () => {
    const bank = makeBank({ easy: 2, medium: 2, hard: 2 });
    const result = drawQuestions(bank, { total: 6, easy: 2, medium: 2, hard: 2 }, seededRng(9));
    expect(result.ok && new Set(result.questions.map((q) => q.id)).size).toBe(6);
  });

  it("easy+medium+hard !== total -> invalid_config", () => {
    const bank = makeBank({ easy: 10, medium: 10, hard: 10 });
    expect(drawQuestions(bank, { total: 10, easy: 3, medium: 3, hard: 3 }, seededRng(1))).toEqual({
      ok: false,
      error: { code: "invalid_config", reason: "sum_mismatch" },
    });
  });

  it("số âm / không nguyên -> invalid_config", () => {
    const bank = makeBank({ easy: 10, medium: 10, hard: 10 });
    expect(drawQuestions(bank, { total: 5, easy: 6, medium: -1, hard: 0 }, seededRng(1))).toEqual({
      ok: false,
      error: { code: "invalid_config", reason: "not_integer_or_negative" },
    });
    expect(drawQuestions(bank, { total: 2.5, easy: 2.5, medium: 0, hard: 0 }, seededRng(1)).ok).toBe(false);
  });

  it("tổng 0 -> invalid_config empty", () => {
    expect(drawQuestions([], { total: 0, easy: 0, medium: 0, hard: 0 }, seededRng(1))).toEqual({
      ok: false,
      error: { code: "invalid_config", reason: "empty" },
    });
  });

  it("cùng rng cùng kết quả; rng khác cho tập khác (chọn ngẫu nhiên thật)", () => {
    const bank = makeBank({ easy: 50, medium: 50, hard: 50 });
    const config = { total: 9, easy: 3, medium: 3, hard: 3 };
    const ids = (seed: number) => {
      const r = drawQuestions(bank, config, seededRng(seed));
      return r.ok ? r.questions.map((q) => q.id) : [];
    };
    expect(ids(1)).toEqual(ids(1));
    expect(ids(1)).not.toEqual(ids(2));
  });

  it("thống kê nhẹ: mọi câu của mức đều có cơ hội được chọn", () => {
    const bank = makeBank({ easy: 6, medium: 0, hard: 0 });
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) {
      const r = drawQuestions(bank, { total: 2, easy: 2, medium: 0, hard: 0 }, seededRng(seed));
      if (r.ok) r.questions.forEach((q) => seen.add(q.id));
    }
    expect(seen.size).toBe(6);
  });

  it("không đổi ngân hàng đầu vào", () => {
    const bank = makeBank({ easy: 5, medium: 5, hard: 5 });
    const snapshot = JSON.stringify(bank);
    drawQuestions(bank, { total: 3, easy: 1, medium: 1, hard: 1 }, seededRng(1));
    expect(JSON.stringify(bank)).toBe(snapshot);
  });
});
