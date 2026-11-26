import { describe, expect, it } from "vitest";
import { isQuestionCorrect, officialScore, roundScore, scoreAttempt } from "./grade";
import { EngineError, type EngineQuestion } from "./types";

const single = (id: string, correct: string): EngineQuestion => ({
  id,
  options: ["a", "b", "c", "d"].map((o) => ({ id: `${id}-${o}`, isCorrect: `${id}-${o}` === correct })),
});

describe("isQuestionCorrect", () => {
  it("câu 1 đáp án: chọn đúng", () => {
    expect(isQuestionCorrect(["a"], ["a"])).toBe(true);
  });
  it("câu 1 đáp án: chọn sai", () => {
    expect(isQuestionCorrect(["a"], ["b"])).toBe(false);
  });
  it("câu nhiều đáp án: chọn đủ (thứ tự tùy ý) là đúng", () => {
    expect(isQuestionCorrect(["a", "c"], ["c", "a"])).toBe(true);
  });
  it("câu nhiều đáp án: thiếu là sai", () => {
    expect(isQuestionCorrect(["a", "c"], ["a"])).toBe(false);
  });
  it("câu nhiều đáp án: thừa là sai", () => {
    expect(isQuestionCorrect(["a", "c"], ["a", "c", "b"])).toBe(false);
  });
  it("bỏ trống là sai", () => {
    expect(isQuestionCorrect(["a"], [])).toBe(false);
  });
  it("chọn id không thuộc câu là sai, kể cả khi kèm đáp án đúng", () => {
    expect(isQuestionCorrect(["a"], ["zzz"])).toBe(false);
    expect(isQuestionCorrect(["a"], ["a", "zzz"])).toBe(false);
  });
  it("id chọn trùng lặp không làm sai tập", () => {
    expect(isQuestionCorrect(["a"], ["a", "a"])).toBe(true);
  });
  it("câu không có đáp án đúng: bỏ trống vẫn sai", () => {
    expect(isQuestionCorrect([], [])).toBe(false);
  });
});

describe("roundScore", () => {
  it("7/9 -> 7.78", () => {
    expect(roundScore(7, 9)).toBe(7.78);
  });
  it("biên làm tròn lên (half-up) không bị lỗi dấu phẩy động: 201/2000*10 = 1.005 -> 1.01", () => {
    expect(roundScore(201, 2000)).toBe(1.01);
  });
  it("biên half-up: 1/16*10 = 0.625 -> 0.63", () => {
    expect(roundScore(1, 16)).toBe(0.63);
  });
  it("ngay dưới biên làm tròn xuống: 1/3*10 = 3.333 -> 3.33", () => {
    expect(roundScore(1, 3)).toBe(3.33);
  });
  it("0 đúng -> 0 và tất cả đúng -> 10", () => {
    expect(roundScore(0, 7)).toBe(0);
    expect(roundScore(7, 7)).toBe(10);
  });
  it("2/3 -> 6.67", () => {
    expect(roundScore(2, 3)).toBe(6.67);
  });
  it("tổng 0 câu ném EngineError empty_exam", () => {
    expect(() => roundScore(0, 0)).toThrow(EngineError);
    try {
      roundScore(0, 0);
    } catch (e) {
      expect((e as EngineError).code).toBe("empty_exam");
    }
  });
  it("đầu vào không hợp lệ ném invalid_input", () => {
    expect(() => roundScore(-1, 5)).toThrow(EngineError);
    expect(() => roundScore(6, 5)).toThrow(EngineError);
    expect(() => roundScore(1.5, 5)).toThrow(EngineError);
  });
});

describe("scoreAttempt", () => {
  const questions = [single("q1", "q1-a"), single("q2", "q2-b"), single("q3", "q3-c")];

  it("đếm đúng, bỏ trống tính sai", () => {
    const result = scoreAttempt(questions, { q1: ["q1-a"], q2: ["q2-a"] });
    expect(result).toEqual({ correct: 1, total: 3, score: 3.33 });
  });
  it("tất cả đúng -> 10", () => {
    const result = scoreAttempt(questions, { q1: ["q1-a"], q2: ["q2-b"], q3: ["q3-c"] });
    expect(result).toEqual({ correct: 3, total: 3, score: 10 });
  });
  it("câu nhiều đáp án: chỉ đúng khi chọn đủ", () => {
    const multi: EngineQuestion = {
      id: "m",
      options: [
        { id: "m1", isCorrect: true },
        { id: "m2", isCorrect: true },
        { id: "m3", isCorrect: false },
      ],
    };
    expect(scoreAttempt([multi], { m: ["m1", "m2"] }).correct).toBe(1);
    expect(scoreAttempt([multi], { m: ["m1"] }).correct).toBe(0);
    expect(scoreAttempt([multi], { m: ["m1", "m2", "m3"] }).correct).toBe(0);
  });
  it("7/9 -> 7.78", () => {
    const nine = Array.from({ length: 9 }, (_, i) => single(`n${i}`, `n${i}-a`));
    const answers = Object.fromEntries(nine.slice(0, 7).map((q) => [q.id, [`${q.id}-a`]]));
    expect(scoreAttempt(nine, answers)).toEqual({ correct: 7, total: 9, score: 7.78 });
  });
  it("đáp án của câu không thuộc đề bị bỏ qua", () => {
    expect(scoreAttempt(questions, { ghost: ["x"] }).correct).toBe(0);
  });
  it("khóa đặc biệt như __proto__ không bị coi là đáp án", () => {
    const q = single("__proto__", "__proto__-a");
    expect(scoreAttempt([q], {}).correct).toBe(0);
  });
  it("answer sheet có khóa __proto__ thật (JSON.parse) được chấm đúng và không ô nhiễm prototype", () => {
    const protoQuestion: EngineQuestion = {
      id: "__proto__",
      options: [
        { id: "opt1", isCorrect: true },
        { id: "opt2", isCorrect: false },
      ],
    };
    const sheet = JSON.parse('{"__proto__":["opt1"]}') as Record<string, string[]>;
    expect(scoreAttempt([protoQuestion], sheet)).toEqual({ correct: 1, total: 1, score: 10 });
    expect(scoreAttempt([protoQuestion, single("other", "other-a")], sheet).correct).toBe(1);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(Object.keys(Object.prototype)).toEqual([]);
  });
  it("đề rỗng ném lỗi rõ ràng, không chia cho 0", () => {
    expect(() => scoreAttempt([], {})).toThrow(EngineError);
  });
});

describe("officialScore", () => {
  it("lấy điểm cao nhất", () => {
    expect(officialScore([3.33, 7.78, 5])).toBe(7.78);
  });
  it("một lần làm", () => {
    expect(officialScore([0])).toBe(0);
  });
  it("chưa có lần nào được chấm -> null", () => {
    expect(officialScore([])).toBeNull();
  });
});
