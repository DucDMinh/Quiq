import { examClasses, examOptions, examQuestions, exams, type DatabaseLike } from "@quiq/db";
import { presentAttempt } from "@quiq/engine";
import type { AnswerKeyOption, AnswerKeyQuestion, AttemptAnswersView } from "@quiq/shared/student";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";
import { hasUnfinishedClass } from "../class-control/service";
import { studentError } from "../student/errors";
import type { StudentSession } from "../student/student-session";
import { expireDueAttempts } from "./finalize";
import { loadOwnedAttempt } from "./service";

/** Câu + đáp án KÈM cờ đúng của một đề. Chỉ gọi sau khi đã kiểm lớp công bố đáp án. */
async function loadAnswerKeyQuestions(db: DatabaseLike, examId: string): Promise<AnswerKeyQuestion[]> {
  const questionRows = await db
    .select({ id: examQuestions.id, content: examQuestions.content, multiSelect: examQuestions.multiSelect })
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position));
  const optionRows = await db
    .select({
      id: examOptions.id,
      content: examOptions.content,
      isCorrect: examOptions.isCorrect,
      questionId: examOptions.examQuestionId,
    })
    .from(examOptions)
    .where(
      inArray(
        examOptions.examQuestionId,
        questionRows.map((q) => q.id),
      ),
    )
    .orderBy(asc(examOptions.position));

  const byQuestion = new Map<string, AnswerKeyOption[]>();
  for (const option of optionRows) {
    const list = byQuestion.get(option.questionId) ?? [];
    list.push({ id: option.id, content: option.content, isCorrect: option.isCorrect });
    byQuestion.set(option.questionId, list);
  }
  return questionRows.map((q) => ({ ...q, options: byQuestion.get(q.id) ?? [] }));
}

/**
 * "Xem đáp án" (FR-047): đề + đáp án đúng của lần làm ĐÃ hoàn thành (mọi lý do kết thúc, kể cả thu bài, C-07),
 * theo đúng thứ tự câu/đáp án học sinh đã thấy. Lớp chưa công bố thì báo lỗi TRƯỚC khi đọc bất cứ câu nào.
 * Cố ý không đọc lựa chọn của học sinh.
 */
export async function getAttemptAnswers(
  deps: AppDeps,
  session: StudentSession,
  attemptId: string,
): Promise<AttemptAnswersView> {
  await expireDueAttempts(deps, session.studentId);
  const attempt = await loadOwnedAttempt(deps.db, session, attemptId);
  if (attempt.status !== "submitted") throw studentError("ATTEMPT_NOT_FINISHED");

  const [examClass] = await deps.db
    .select({ examId: exams.id, examTitle: exams.title, answersPublishedAt: examClasses.answersPublishedAt })
    .from(examClasses)
    .innerJoin(exams, eq(exams.id, examClasses.examId))
    .where(and(eq(examClasses.id, attempt.examClassId), eq(examClasses.schoolId, session.schoolId)));
  if (!examClass) throw new AppError("NOT_FOUND");
  if (!examClass.answersPublishedAt) throw studentError("ANSWERS_NOT_PUBLISHED");
  // Phòng thủ (R1): công bố đã đòi mọi lớp của bài thu bài xong, nhưng nếu một lớp khác lại đang mở (dữ liệu lệch,
  // lớp mới gán sau) thì che đáp án cho tới khi lớp đó thu bài xong.
  if (await hasUnfinishedClass(deps.db, examClass.examId)) throw studentError("ANSWERS_NOT_PUBLISHED");
  if (!attempt.questionOrder || !attempt.optionOrders) throw new AppError("INTERNAL");

  const questions = await loadAnswerKeyQuestions(deps.db, examClass.examId);
  return {
    attemptId: attempt.id,
    examTitle: examClass.examTitle,
    questions: presentAttempt(questions, {
      questionOrder: attempt.questionOrder,
      optionOrders: attempt.optionOrders,
    }),
  };
}
