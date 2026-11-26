import { cryptoRng, shuffled } from "./shuffle";
import type { BankQuestion, Difficulty, DrawConfig, DrawResult, Rng } from "./types";

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

/**
 * Rút ngẫu nhiên đúng số câu theo từng mức (FR-030). Thiếu câu ở BẤT KỲ mức nào thì không rút gì,
 * trả lỗi có dữ liệu để tầng api dịch sang thông báo tiếng Việt.
 */
export function drawQuestions<Q extends BankQuestion>(
  bank: readonly Q[],
  config: DrawConfig,
  rng: Rng = cryptoRng,
): DrawResult<Q> {
  const counts = [config.total, config.easy, config.medium, config.hard];
  if (counts.some((n) => !Number.isInteger(n) || n < 0)) {
    return { ok: false, error: { code: "invalid_config", reason: "not_integer_or_negative" } };
  }
  if (config.total === 0) {
    return { ok: false, error: { code: "invalid_config", reason: "empty" } };
  }
  if (config.easy + config.medium + config.hard !== config.total) {
    return { ok: false, error: { code: "invalid_config", reason: "sum_mismatch" } };
  }

  for (const difficulty of DIFFICULTIES) {
    const have = bank.filter((q) => q.difficulty === difficulty).length;
    const need = config[difficulty];
    if (have < need) {
      return { ok: false, error: { code: "insufficient_questions", difficulty, have, need } };
    }
  }

  const questions = DIFFICULTIES.flatMap((difficulty) =>
    shuffled(
      bank.filter((q) => q.difficulty === difficulty),
      rng,
    ).slice(0, config[difficulty]),
  );
  return { ok: true, questions };
}
