import { describe, expect, it } from "vitest";
import { scoreAttempt } from "./grade";
import {
  cryptoRng,
  presentAttempt,
  resolveDisplayedChoices,
  shuffleAttempt,
  shuffled,
} from "./shuffle";
import { seededRng } from "./test-utils";
import { EngineError, type EngineQuestion } from "./types";

const makeQuestions = (count: number): EngineQuestion[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `q${i}`,
    options: ["A", "B", "C", "D"].map((letter, j) => ({
      id: `q${i}-${letter}`,
      isCorrect: j === i % 4,
    })),
  }));

describe("shuffled", () => {
  it("là hoán vị: đủ phần tử, không trùng, không đổi mảng gốc", () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffled(input, seededRng(1));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("mảng rỗng và 1 phần tử", () => {
    expect(shuffled([], seededRng(1))).toEqual([]);
    expect(shuffled([9], seededRng(1))).toEqual([9]);
  });
  it("rng luôn trả 0 cho kết quả xác định (xoay)", () => {
    expect(shuffled([1, 2, 3], () => 0)).toEqual([2, 3, 1]);
  });
  it("mọi chuỗi lựa chọn rng khả dĩ của n=3 sinh đủ 6 hoán vị, kể cả hoán vị đồng nhất", () => {
    const seen = new Set<string>();
    // Lượt 1 chọn trong [0,3), lượt 2 chọn trong [0,2): tổng 6 chuỗi, mỗi chuỗi một hoán vị khác nhau.
    for (let first = 0; first < 3; first += 1) {
      for (let second = 0; second < 2; second += 1) {
        const script = [first, second];
        const bounds: number[] = [];
        const out = shuffled(["a", "b", "c"], (maxExclusive) => {
          bounds.push(maxExclusive);
          return script[bounds.length - 1] ?? 0;
        });
        expect(bounds).toEqual([3, 2]);
        seen.add(out.join(""));
      }
    }
    expect([...seen].sort()).toEqual(["abc", "acb", "bac", "bca", "cab", "cba"]);
  });
  it("rng trả giá trị ngoài [0,n) bị từ chối", () => {
    expect(() => shuffled([1, 2, 3], () => 99)).toThrow();
  });
});

describe("cryptoRng", () => {
  it("trả số nguyên trong [0, n)", () => {
    for (let i = 0; i < 200; i += 1) {
      const value = cryptoRng(7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });
  it("n = 1 luôn trả 0", () => {
    expect(cryptoRng(1)).toBe(0);
  });
  it("n không hợp lệ ném lỗi", () => {
    expect(() => cryptoRng(0)).toThrow();
    expect(() => cryptoRng(1.5)).toThrow();
    expect(() => cryptoRng(2 ** 32 + 1)).toThrow();
  });
  it("phân bố nhẹ: mọi giá trị trong [0,4) đều xuất hiện", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 400; i += 1) seen.add(cryptoRng(4));
    expect(seen.size).toBe(4);
  });
});

describe("shuffleAttempt", () => {
  const questions = makeQuestions(10);

  it("questionOrder và optionOrders là hoán vị hợp lệ", () => {
    const result = shuffleAttempt(questions, seededRng(42));
    expect([...result.questionOrder].sort()).toEqual(questions.map((q) => q.id).sort());
    for (const q of questions) {
      const order = result.optionOrders[q.id];
      expect(order).toBeDefined();
      expect([...(order ?? [])].sort()).toEqual(q.options.map((o) => o.id).sort());
    }
  });
  it("cùng rng cùng kết quả", () => {
    expect(shuffleAttempt(questions, seededRng(7))).toEqual(shuffleAttempt(questions, seededRng(7)));
  });
  it("rng khác cho thứ tự khác", () => {
    const a = shuffleAttempt(questions, seededRng(1));
    const b = shuffleAttempt(questions, seededRng(2));
    expect(a.questionOrder).not.toEqual(b.questionOrder);
  });
  it("thống kê nhẹ: câu đầu tiên không luôn là cùng một câu", () => {
    const firsts = new Set<string | undefined>();
    for (let seed = 1; seed <= 40; seed += 1) {
      firsts.add(shuffleAttempt(questions, seededRng(seed)).questionOrder[0]);
    }
    expect(firsts.size).toBeGreaterThan(3);
  });
});

describe("presentAttempt + resolveDisplayedChoices", () => {
  const questions = makeQuestions(6);

  it("trình bày theo đúng thứ tự trộn", () => {
    const shuffle = shuffleAttempt(questions, seededRng(5));
    const presented = presentAttempt(questions, shuffle);
    expect(presented.map((q) => q.id)).toEqual(shuffle.questionOrder);
    for (const q of presented) {
      expect(q.options.map((o) => o.id)).toEqual(shuffle.optionOrders[q.id]);
    }
  });

  it("chọn theo vị trí hiển thị rồi ánh xạ về id gốc cho điểm giống chọn trực tiếp", () => {
    const shuffle = shuffleAttempt(questions, seededRng(11));
    const presented = presentAttempt(questions, shuffle);
    // Học sinh chọn đúng đáp án đúng ở vị trí nó đang hiển thị.
    const answers: Record<string, string[]> = {};
    for (const q of presented) {
      const position = q.options.findIndex((o) => o.isCorrect);
      answers[q.id] = resolveDisplayedChoices(shuffle, q.id, [position]);
    }
    expect(scoreAttempt(questions, answers)).toEqual({ correct: 6, total: 6, score: 10 });
  });

  it("chọn sai vị trí vẫn cho điểm sai sau khi ánh xạ", () => {
    const shuffle = shuffleAttempt(questions, seededRng(11));
    const presented = presentAttempt(questions, shuffle);
    const answers: Record<string, string[]> = {};
    for (const q of presented) {
      const position = q.options.findIndex((o) => !o.isCorrect);
      answers[q.id] = resolveDisplayedChoices(shuffle, q.id, [position]);
    }
    expect(scoreAttempt(questions, answers).correct).toBe(0);
  });

  it("vị trí ngoài phạm vi hoặc câu không tồn tại ném lỗi", () => {
    const shuffle = shuffleAttempt(questions, seededRng(3));
    expect(() => resolveDisplayedChoices(shuffle, "q0", [4])).toThrow();
    expect(() => resolveDisplayedChoices(shuffle, "q0", [-1])).toThrow();
    expect(() => resolveDisplayedChoices(shuffle, "nope", [0])).toThrow();
  });

  it("presentAttempt từ chối id trùng trong thứ tự câu dù độ dài khớp", () => {
    const shuffle = shuffleAttempt(questions, seededRng(3));
    shuffle.questionOrder = [...shuffle.questionOrder];
    shuffle.questionOrder[1] = shuffle.questionOrder[0] ?? "q0";
    expect(() => presentAttempt(questions, shuffle)).toThrow(EngineError);
  });

  it("presentAttempt từ chối id trùng trong thứ tự đáp án", () => {
    const shuffle = shuffleAttempt(questions, seededRng(3));
    const order = [...(shuffle.optionOrders["q0"] ?? [])];
    order[1] = order[0] ?? "";
    shuffle.optionOrders["q0"] = order;
    expect(() => presentAttempt(questions, shuffle)).toThrow(EngineError);
  });

  it("presentAttempt từ chối thứ tự tham chiếu câu không tồn tại", () => {
    const shuffle = shuffleAttempt(questions, seededRng(3));
    shuffle.questionOrder[0] = "ghost";
    expect(() => presentAttempt(questions, shuffle)).toThrow();
  });
});
