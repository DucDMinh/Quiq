import type { Difficulty } from "../schema";

export interface QuestionSpec {
  content: string;
  difficulty: Difficulty;
  options: { content: string; isCorrect: boolean }[];
}

/** Chọn 3 đáp án nhiễu khác nhau và khác đáp án đúng; thiếu thì bù bằng các số kế cận. */
function pickDistractors(correct: number, candidates: number[]): number[] {
  const picked = new Set<number>();
  for (const value of [...candidates, correct + 1, correct - 1, correct + 2, correct + 3]) {
    if (value !== correct) picked.add(value);
    if (picked.size === 3) break;
  }
  return [...picked];
}

/** Đặt đáp án đúng ở vị trí xoay vòng theo `index` để bộ mẫu không luôn đúng ở phương án A. */
function singleChoice(content: string, difficulty: Difficulty, index: number, correct: number, distractors: number[]): QuestionSpec {
  const wrong = pickDistractors(correct, distractors);
  const values = [...wrong];
  values.splice(index % 4, 0, correct);
  return {
    content,
    difficulty,
    options: values.map((value) => ({ content: String(value), isCorrect: value === correct })),
  };
}

function multiChoice(content: string, difficulty: Difficulty, options: [string, boolean][]): QuestionSpec {
  return { content, difficulty, options: options.map(([text, isCorrect]) => ({ content: text, isCorrect })) };
}

const EASY_COUNT = 8;

function easySingles(): QuestionSpec[] {
  return Array.from({ length: EASY_COUNT }, (_, i) => {
    const a = 3 + i;
    const b = 4 + (i % 5);
    return singleChoice(`Tính ${a} × ${b}.`, "easy", i, a * b, [a * b + a, a * b - b, a + b]);
  });
}

function mediumSingles(): QuestionSpec[] {
  return Array.from({ length: EASY_COUNT }, (_, i) => {
    const x = 2 + i;
    const a = 2 + (i % 4);
    const b = 3 + i;
    const c = a * x + b;
    return singleChoice(`Giải phương trình ${a}x + ${b} = ${c}. Giá trị của x là bao nhiêu?`, "medium", i + 1, x, [
      x + 1,
      x - 1,
      c - b,
    ]);
  });
}

function hardSingles(): QuestionSpec[] {
  return Array.from({ length: EASY_COUNT }, (_, i) => {
    const n = 3 + (i % 3);
    const k = 2 + (i % 3);
    const m = i + 1;
    const derivative = n * k ** (n - 1) + m;
    return singleChoice(`Cho f(x) = x^${n} + ${m}x. Tính f'(${k}).`, "hard", i + 2, derivative, [
      n * k ** (n - 1),
      k ** n + m * k,
      (n - 1) * k ** (n - 2) + m,
    ]);
  });
}

// Mỗi mức khó có 2 câu nhiều đáp án đúng, đặt đầu danh sách để bài thi mẫu chắc chắn rút được chúng.
function multiSelects(): QuestionSpec[] {
  return [
    multiChoice("Những số nào sau đây là số chẵn?", "easy", [["2", true], ["3", false], ["4", true], ["7", false]]),
    multiChoice("Những số nào sau đây là số nguyên tố?", "easy", [["2", true], ["9", false], ["11", true], ["15", false]]),
    multiChoice("Những phương trình nào sau đây có nghiệm x = 2?", "medium", [
      ["x + 3 = 5", true],
      ["2x = 8", false],
      ["x² = 4", true],
      ["3x − 1 = 7", false],
    ]),
    multiChoice("Những biểu thức nào sau đây có giá trị bằng 12?", "medium", [
      ["3 × 4", true],
      ["2 × 5", false],
      ["20 − 8", true],
      ["5 + 6", false],
    ]),
    multiChoice("Những hàm số nào sau đây có đạo hàm bằng 2x?", "hard", [
      ["x²", true],
      ["x² + 5", true],
      ["2x", false],
      ["x³", false],
    ]),
    multiChoice("Những giá trị nào sau đây là nghiệm của x² − 5x + 6 = 0?", "hard", [
      ["1", false],
      ["2", true],
      ["3", true],
      ["6", false],
    ]),
  ];
}

/**
 * Ngân hàng 30 câu Toán cố định (không ngẫu nhiên) để seed chạy lại cho kết quả giống hệt:
 * mỗi mức dễ/trung bình/khó có 10 câu, trong đó 2 câu nhiều đáp án đúng.
 * Thứ tự trả về: multi trước, rồi single, theo từng mức.
 */
export function buildDemoQuestionBank(): QuestionSpec[] {
  const multi = multiSelects();
  const singles = [easySingles(), mediumSingles(), hardSingles()];
  return (["easy", "medium", "hard"] as const).flatMap((level, i) => [
    ...multi.filter((q) => q.difficulty === level),
    ...(singles[i] ?? []),
  ]);
}
