import { EngineError, type AttemptShuffle, type Rng } from "./types";

const UINT32_RANGE = 2 ** 32;

/**
 * Rng mặc định: số nguyên đồng đều trong [0, maxExclusive) từ Web Crypto (không dùng Math.random).
 * Rejection sampling để tránh thiên lệch modulo.
 */
export const cryptoRng: Rng = (maxExclusive) => {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
    throw new EngineError("invalid_input", `maxExclusive không hợp lệ: ${maxExclusive}`);
  }
  const acceptLimit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
  const buffer = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buffer);
    const value = buffer[0] ?? 0;
    if (value < acceptLimit) return value % maxExclusive;
  }
};

function pickIndex(rng: Rng, maxExclusive: number): number {
  const index = rng(maxExclusive);
  if (!Number.isInteger(index) || index < 0 || index >= maxExclusive) {
    throw new EngineError("invalid_input", `rng trả giá trị ngoài [0, ${maxExclusive}): ${index}`);
  }
  return index;
}

/** Fisher-Yates trên bản sao; không đổi mảng gốc. */
export function shuffled<T>(items: readonly T[], rng: Rng = cryptoRng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = pickIndex(rng, i + 1);
    const atI = result[i] as T;
    result[i] = result[j] as T;
    result[j] = atI;
  }
  return result;
}

interface HasOptions {
  id: string;
  options: readonly { id: string }[];
}

/** Thứ tự câu và thứ tự đáp án A-D riêng cho một lần làm (FR-036). Lưu theo id nên chấm luôn theo đáp án gốc. */
export function shuffleAttempt(questions: readonly HasOptions[], rng: Rng = cryptoRng): AttemptShuffle {
  const questionOrder = shuffled(
    questions.map((q) => q.id),
    rng,
  );
  const optionOrders: Record<string, string[]> = {};
  for (const question of questions) {
    optionOrders[question.id] = shuffled(
      question.options.map((o) => o.id),
      rng,
    );
  }
  return { questionOrder, optionOrders };
}

function orderedBy<T extends { id: string }>(items: readonly T[], orderedIds: readonly string[], what: string): T[] {
  // Cùng độ dài + không trùng + mọi id đều tồn tại (kiểm bên dưới) => đúng là một hoán vị của items.
  if (items.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length) {
    throw new EngineError("invalid_input", `Thứ tự ${what} không khớp số phần tử hoặc có id trùng`);
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  return orderedIds.map((id) => {
    const item = byId.get(id);
    if (!item) throw new EngineError("invalid_input", `Thứ tự ${what} tham chiếu id không tồn tại: ${id}`);
    return item;
  });
}

/** Sắp câu hỏi và đáp án theo thứ tự đã trộn để hiển thị cho học sinh. */
export function presentAttempt<Q extends HasOptions>(
  questions: readonly Q[],
  shuffle: AttemptShuffle,
): Array<Omit<Q, "options"> & { options: Array<Q["options"][number]> }> {
  return orderedBy(questions, shuffle.questionOrder, "câu hỏi").map((question) => {
    const optionOrder = Object.hasOwn(shuffle.optionOrders, question.id) ? shuffle.optionOrders[question.id] : undefined;
    if (!optionOrder) throw new EngineError("invalid_input", `Thiếu thứ tự đáp án cho câu ${question.id}`);
    return { ...question, options: orderedBy(question.options, optionOrder, "đáp án") };
  });
}

/** Ánh xạ vị trí học sinh bấm (0 = A) về id đáp án gốc. */
export function resolveDisplayedChoices(
  shuffle: AttemptShuffle,
  questionId: string,
  displayedPositions: readonly number[],
): string[] {
  const optionOrder = Object.hasOwn(shuffle.optionOrders, questionId) ? shuffle.optionOrders[questionId] : undefined;
  if (!optionOrder) throw new EngineError("invalid_input", `Không có thứ tự đáp án cho câu ${questionId}`);
  return displayedPositions.map((position) => {
    const optionId = Number.isInteger(position) ? optionOrder[position] : undefined;
    if (optionId === undefined) throw new EngineError("invalid_input", `Vị trí đáp án ngoài phạm vi: ${position}`);
    return optionId;
  });
}
