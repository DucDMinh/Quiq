import { examClasses, examQuestions, type DatabaseLike } from "@quiq/db";
import type { SaveAnswerBody } from "@quiq/shared/student";
import { and, eq } from "drizzle-orm";
import { studentError } from "../student/errors";
import type { AttemptRow } from "./finalize";

/**
 * Kiểm một lựa chọn trước khi lưu. DB chưa ràng buộc attempt_answers với đề của attempt,
 * nên API phải tự kiểm: câu thuộc đúng đề của lần làm, mọi đáp án thuộc đúng câu đó, không trùng,
 * câu chọn 1 thì tối đa 1 đáp án. Trả danh sách đáp án để lưu.
 */
export async function validateSelection(
  tx: DatabaseLike,
  attempt: AttemptRow,
  body: SaveAnswerBody,
): Promise<string[]> {
  const inThisAttempt = attempt.questionOrder?.includes(body.questionId) ?? false;
  const [question] = await tx
    .select({ multiSelect: examQuestions.multiSelect })
    .from(examQuestions)
    .innerJoin(examClasses, eq(examClasses.examId, examQuestions.examId))
    .where(and(eq(examQuestions.id, body.questionId), eq(examClasses.id, attempt.examClassId)));
  if (!inThisAttempt || !question) throw studentError("INVALID_ANSWER");

  const allowed = new Set(attempt.optionOrders?.[body.questionId] ?? []);
  const unique = new Set(body.optionIds);
  const belongs = body.optionIds.every((id) => allowed.has(id));
  if (!belongs || unique.size !== body.optionIds.length) throw studentError("INVALID_ANSWER");
  if (!question.multiSelect && body.optionIds.length > 1) throw studentError("INVALID_ANSWER");
  return body.optionIds;
}
