import {
  attempts,
  examClasses,
  examOptions,
  examQuestions,
  exams,
  studentSessions,
  waitingPresence,
} from "@quiq/db";
import { and, eq, inArray } from "drizzle-orm";
import type { AppDeps } from "../../http/deps";
import { examError, getExamSummary, type TeacherScope } from "./service";

/**
 * Xóa đề chưa ai làm (BR-002). Phiên/phòng chờ của học sinh mới chỉ vào phòng chờ cũng tham chiếu lớp
 * của đề (không có cascade) nên xóa theo thứ tự con trước cha trong một transaction.
 */
export async function deleteExam(
  deps: AppDeps,
  scope: TeacherScope,
  examId: string,
): Promise<void> {
  const summary = await getExamSummary(deps.db, scope, examId);
  if (summary.attemptCount > 0) throw examError("EXAM_HAS_ATTEMPTS");

  await deps.db.transaction(async (tx) => {
    // Khóa các hàng lớp như transaction Bắt đầu (attempts/start.ts): một lần Bắt đầu đang chạy xong trước
    // (đếm lại bên dưới thấy attempt, trả 409) hoặc chờ tới khi lớp đã bị xóa (không còn lớp để bắt đầu).
    await tx
      .select({ id: examClasses.id })
      .from(examClasses)
      .where(eq(examClasses.examId, examId))
      .for("update");
    const classIdsOfExam = tx
      .select({ id: examClasses.id })
      .from(examClasses)
      .where(eq(examClasses.examId, examId));
    const questionIdsOfExam = tx
      .select({ id: examQuestions.id })
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId));
    if ((await tx.$count(attempts, inArray(attempts.examClassId, classIdsOfExam))) > 0) {
      throw examError("EXAM_HAS_ATTEMPTS");
    }

    await tx.delete(waitingPresence).where(inArray(waitingPresence.examClassId, classIdsOfExam));
    await tx.delete(studentSessions).where(inArray(studentSessions.examClassId, classIdsOfExam));
    await tx.delete(examClasses).where(eq(examClasses.examId, examId));
    await tx.delete(examOptions).where(inArray(examOptions.examQuestionId, questionIdsOfExam));
    await tx.delete(examQuestions).where(eq(examQuestions.examId, examId));
    await tx.delete(exams).where(and(eq(exams.id, examId), eq(exams.schoolId, scope.schoolId)));
  });
}
