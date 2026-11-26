import {
  attemptAnswers,
  attempts,
  examClasses,
  examOptions,
  examQuestions,
  type DatabaseLike,
} from "@quiq/db";
import {
  isExpired,
  scoreAttempt,
  type AttemptScore,
  type EngineOption,
  type EngineQuestion,
} from "@quiq/engine";
import type { AttemptEndReason } from "@quiq/shared/student";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";
import { revokeStudentSessions } from "../student/student-session";

/** Dung sai cho lần lưu/nộp cuối đến muộn vì mạng: sau `ends_at + 3 giây` mới coi là hết giờ. */
export const ANSWER_GRACE_SECONDS = 3;

export type AttemptRow = typeof attempts.$inferSelect;

/** Đáp án gốc (có is_correct) của đề: CHỈ dùng để chấm, không bao giờ đi vào response. */
async function loadAnswerKey(db: DatabaseLike, examClassId: string): Promise<EngineQuestion[]> {
  const [examClass] = await db
    .select({ examId: examClasses.examId })
    .from(examClasses)
    .where(eq(examClasses.id, examClassId));
  if (!examClass) throw new AppError("NOT_FOUND");

  const questionRows = await db
    .select({ id: examQuestions.id })
    .from(examQuestions)
    .where(eq(examQuestions.examId, examClass.examId))
    .orderBy(asc(examQuestions.position));
  const optionRows = await db
    .select({
      id: examOptions.id,
      questionId: examOptions.examQuestionId,
      isCorrect: examOptions.isCorrect,
    })
    .from(examOptions)
    .where(
      inArray(
        examOptions.examQuestionId,
        questionRows.map((q) => q.id),
      ),
    );

  const byQuestion = new Map<string, EngineOption[]>();
  for (const option of optionRows) {
    const list = byQuestion.get(option.questionId) ?? [];
    list.push({ id: option.id, isCorrect: option.isCorrect });
    byQuestion.set(option.questionId, list);
  }
  return questionRows.map((q) => ({ id: q.id, options: byQuestion.get(q.id) ?? [] }));
}

/** questionId -> id đáp án đã lưu của một lần làm. */
export async function loadSavedAnswers(
  db: DatabaseLike,
  attemptId: string,
): Promise<Record<string, string[]>> {
  const rows = await db
    .select({
      questionId: attemptAnswers.examQuestionId,
      optionIds: attemptAnswers.selectedOptionIds,
    })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));
  return Object.fromEntries(rows.map((row) => [row.questionId, row.optionIds]));
}

/** Chấm theo engine trên các câu đã lưu: đúng một phần = sai, bỏ trống = sai (FR-051). */
export async function scoreSavedAnswers(
  db: DatabaseLike,
  attempt: AttemptRow,
): Promise<AttemptScore> {
  const answerKey = await loadAnswerKey(db, attempt.examClassId);
  return scoreAttempt(answerKey, await loadSavedAnswers(db, attempt.id));
}

/**
 * MỘT chỗ duy nhất kết thúc một lần làm (nộp, hết giờ, về sau: vi phạm, thu bài).
 * Idempotent: attempt đã kết thúc thì trả nguyên bản ghi, không chấm lại.
 * Khóa hàng attempt (FOR UPDATE) để lần lưu đáp án đang chạy xong hẳn trước khi chấm.
 */
export async function finalizeAttempt(
  deps: AppDeps,
  attemptId: string,
  reason: AttemptEndReason,
): Promise<AttemptRow> {
  const now = deps.clock.now();
  let ended = false;
  const row = await deps.db.transaction(async (tx) => {
    const [attempt] = await tx
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .for("update");
    if (!attempt) throw new AppError("NOT_FOUND");
    if (attempt.status !== "in_progress") return attempt;

    const { score } = await scoreSavedAnswers(tx, attempt);
    const [finished] = await tx
      .update(attempts)
      .set({ status: "submitted", submittedAt: now, endReason: reason, score })
      .where(and(eq(attempts.id, attempt.id), eq(attempts.status, "in_progress")))
      .returning();
    // Nhả mã học sinh: bài thi sau của học sinh không bị coi nhầm là đổi máy.
    await revokeStudentSessions(tx, attempt.studentId, attempt.examClassId, now);
    ended = finished !== undefined;
    return finished ?? attempt;
  });
  // Báo phòng thi SAU khi commit, và chỉ khi lần gọi này thật sự kết thúc bài (nộp, hết giờ, thu bài).
  if (ended) deps.realtime?.publish(row.examClassId);
  return row;
}

/** Lý do khi học sinh tự nộp: sau `ends_at` (kể cả trong dung sai) là hết giờ. */
export function submitReason(attempt: AttemptRow, now: Date): AttemptEndReason {
  return attempt.endsAt && now.getTime() > attempt.endsAt.getTime() ? "timeout" : "submitted";
}

export function isPastGrace(attempt: AttemptRow, now: Date): boolean {
  return attempt.endsAt !== null && isExpired(attempt.endsAt, now, ANSWER_GRACE_SECONDS);
}

/**
 * Hết giờ kiểm lười khi có request (sweeper nền là tính năng sau): lần làm đang diễn ra của học sinh
 * đã quá `ends_at + 3 giây` thì tự nộp bằng các câu đã lưu.
 */
export async function expireDueAttempts(deps: AppDeps, studentId: string): Promise<void> {
  const running = await deps.db
    .select()
    .from(attempts)
    .where(and(eq(attempts.studentId, studentId), eq(attempts.status, "in_progress")));
  const now = deps.clock.now();
  for (const attempt of running) {
    if (isPastGrace(attempt, now)) await finalizeAttempt(deps, attempt.id, "timeout");
  }
}
