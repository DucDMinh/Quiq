import { EngineError, type AnswerSheet, type AttemptScore, type EngineQuestion } from "./types";

/**
 * Đúng khi tập đáp án chọn BẰNG tập đáp án đúng (FR-051, BR-008):
 * thiếu, thừa, id lạ hoặc bỏ trống đều là sai.
 */
export function isQuestionCorrect(correctIds: readonly string[], selectedIds: readonly string[]): boolean {
  const correct = new Set(correctIds);
  const selected = new Set(selectedIds);
  // Bỏ trống luôn sai, kể cả khi dữ liệu câu hỏi lỗi và không có đáp án đúng nào.
  if (selected.size === 0) return false;
  if (correct.size !== selected.size) return false;
  for (const id of selected) {
    if (!correct.has(id)) return false;
  }
  return true;
}

/**
 * round(correct / total * 10, 2) tính hoàn toàn bằng số nguyên, làm tròn half-up.
 * Không dùng Math.round(x * 100) / 100 vì 1.005 * 100 = 100.49999... làm sai điểm ở biên.
 * Công thức: hundredths = round(correct * 1000 / total) = floor((2000 * correct + total) / (2 * total)).
 */
export function roundScore(correct: number, total: number): number {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || correct < 0 || total < 0 || correct > total) {
    throw new EngineError("invalid_input", `Số câu đúng/tổng không hợp lệ: ${correct}/${total}`);
  }
  if (total === 0) {
    throw new EngineError("empty_exam", "Đề thi không có câu hỏi nào, không thể chấm điểm");
  }
  const hundredths = Math.floor((2000 * correct + total) / (2 * total));
  return hundredths / 100;
}

export function scoreAttempt(questions: readonly EngineQuestion[], answers: AnswerSheet): AttemptScore {
  let correct = 0;
  for (const question of questions) {
    const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
    // Object.hasOwn tránh đọc nhầm khóa kế thừa như "__proto__".
    const selectedIds = Object.hasOwn(answers, question.id) ? (answers[question.id] ?? []) : [];
    if (isQuestionCorrect(correctIds, selectedIds)) correct += 1;
  }
  const total = questions.length;
  return { correct, total, score: roundScore(correct, total) };
}

/** Điểm chính thức = cao nhất trong các lần đã chấm (BR-005). Chưa có lần nào được chấm -> null. */
export function officialScore(scores: readonly number[]): number | null {
  if (scores.length === 0) return null;
  return Math.max(...scores);
}
