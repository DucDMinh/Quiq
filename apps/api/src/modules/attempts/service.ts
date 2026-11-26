import {
  attemptAnswers,
  attempts,
  examClasses,
  examOptions,
  examQuestions,
  exams,
  students,
  type DatabaseLike,
} from "@quiq/db";
import { presentAttempt } from "@quiq/engine";
import { ATTEMPT_END_REASONS } from "@quiq/shared/student";
import type {
  AttemptEndReason,
  AttemptResultView,
  ExamPaperView,
  PaperQuestion,
  SaveAnswerBody,
  SaveAnswerResult,
} from "@quiq/shared/student";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";
import { studentError } from "../student/errors";
import type { StudentSession } from "../student/student-session";
import {
  expireDueAttempts,
  finalizeAttempt,
  isPastGrace,
  loadSavedAnswers,
  scoreSavedAnswers,
  submitReason,
  type AttemptRow,
} from "./finalize";
import { validateSelection } from "./selection";
import { startAttemptRow } from "./start";

/** Lần làm phải thuộc đúng học sinh và lớp thi của phiên; không thì 404 (không lộ sự tồn tại). */
export async function loadOwnedAttempt(
  db: DatabaseLike,
  session: StudentSession,
  attemptId: string,
) {
  const [attempt] = await db
    .select()
    .from(attempts)
    .where(
      and(
        eq(attempts.id, attemptId),
        eq(attempts.studentId, session.studentId),
        eq(attempts.examClassId, session.examClassId),
      ),
    );
  if (!attempt) throw new AppError("NOT_FOUND");
  return attempt;
}

/** Câu và đáp án để HIỂN THỊ: chỉ chọn id + nội dung, không bao giờ chọn cột is_correct. */
export async function loadPaperQuestions(
  db: DatabaseLike,
  examId: string,
): Promise<PaperQuestion[]> {
  const questionRows = await db
    .select({
      id: examQuestions.id,
      content: examQuestions.content,
      multiSelect: examQuestions.multiSelect,
    })
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position));
  const optionRows = await db
    .select({
      id: examOptions.id,
      content: examOptions.content,
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

  const byQuestion = new Map<string, PaperQuestion["options"]>();
  for (const option of optionRows) {
    const list = byQuestion.get(option.questionId) ?? [];
    list.push({ id: option.id, content: option.content });
    byQuestion.set(option.questionId, list);
  }
  return questionRows.map((q) => ({ ...q, options: byQuestion.get(q.id) ?? [] }));
}

async function loadAttemptContext(db: DatabaseLike, attempt: AttemptRow) {
  const [row] = await db
    .select({
      examId: exams.id,
      examTitle: exams.title,
      examCode: exams.code,
      maxAttempts: examClasses.maxAttemptsSnap,
      studentCode: students.code,
      studentName: students.fullName,
    })
    .from(examClasses)
    .innerJoin(exams, eq(exams.id, examClasses.examId))
    .innerJoin(students, eq(students.id, attempt.studentId))
    .where(eq(examClasses.id, attempt.examClassId));
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

async function buildPaper(deps: AppDeps, attempt: AttemptRow): Promise<ExamPaperView> {
  if (!attempt.endsAt || !attempt.questionOrder || !attempt.optionOrders)
    throw new AppError("INTERNAL");
  const context = await loadAttemptContext(deps.db, attempt);
  const questions = await loadPaperQuestions(deps.db, context.examId);
  return {
    attemptId: attempt.id,
    attemptNo: attempt.attemptNo,
    maxAttempts: context.maxAttempts ?? 1,
    examTitle: context.examTitle,
    student: { code: context.studentCode, fullName: context.studentName },
    endsAt: attempt.endsAt.toISOString(),
    serverNow: deps.clock.now().toISOString(),
    questions: presentAttempt(questions, {
      questionOrder: attempt.questionOrder,
      optionOrders: attempt.optionOrders,
    }),
    answers: await loadSavedAnswers(deps.db, attempt.id),
  };
}

/** Bắt đầu làm bài: tạo attempt mới rồi trả đề đã trộn. */
export async function startAttempt(deps: AppDeps, session: StudentSession): Promise<ExamPaperView> {
  await expireDueAttempts(deps, session.studentId);
  const attempt = await startAttemptRow(deps, session, loadPaperQuestions);
  return buildPaper(deps, attempt);
}

/** Đề của lần làm đang diễn ra (mở lại trang làm bài). Đã kết thúc thì 409 để client sang trang kết quả. */
export async function getPaper(
  deps: AppDeps,
  session: StudentSession,
  attemptId: string,
): Promise<ExamPaperView> {
  await expireDueAttempts(deps, session.studentId);
  const attempt = await loadOwnedAttempt(deps.db, session, attemptId);
  if (attempt.status !== "in_progress") throw studentError("ATTEMPT_ENDED");
  return buildPaper(deps, attempt);
}

/** Lưu lựa chọn của một câu (ghi đè). Sau `ends_at + 3 giây` thì tự nộp và từ chối, không lưu. */
export async function saveAnswer(
  deps: AppDeps,
  session: StudentSession,
  attemptId: string,
  body: SaveAnswerBody,
): Promise<SaveAnswerResult> {
  const owned = await loadOwnedAttempt(deps.db, session, attemptId);
  const now = deps.clock.now();
  if (owned.status === "in_progress" && isPastGrace(owned, now)) {
    await finalizeAttempt(deps, owned.id, "timeout");
    throw studentError("ATTEMPT_ENDED");
  }

  const optionIds = await deps.db.transaction(async (tx) => {
    // Khóa hàng để lần nộp/chấm chạy song song chờ lần lưu này xong.
    const [attempt] = await tx
      .select()
      .from(attempts)
      .where(eq(attempts.id, owned.id))
      .for("update");
    if (!attempt || attempt.status !== "in_progress" || isPastGrace(attempt, now)) {
      throw studentError("ATTEMPT_ENDED");
    }
    const selection = await validateSelection(tx, attempt, body);
    await tx
      .insert(attemptAnswers)
      .values({
        schoolId: attempt.schoolId,
        attemptId: attempt.id,
        examQuestionId: body.questionId,
        selectedOptionIds: selection,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [attemptAnswers.attemptId, attemptAnswers.examQuestionId],
        set: { selectedOptionIds: selection, updatedAt: now },
      });
    return selection;
  });
  return { questionId: body.questionId, optionIds, serverNow: now.toISOString() };
}

// end_reason là text tự do trong DB; giá trị lạ (dữ liệu cũ/hỏng) hiển thị như nộp bài thường.
function toEndReason(value: string | null): AttemptEndReason {
  return ATTEMPT_END_REASONS.find((reason) => reason === value) ?? "submitted";
}

async function buildResult(deps: AppDeps, attempt: AttemptRow): Promise<AttemptResultView> {
  if (attempt.status !== "submitted" || attempt.score === null)
    throw studentError("ATTEMPT_NOT_FINISHED");
  const context = await loadAttemptContext(deps.db, attempt);
  const { correct, total } = await scoreSavedAnswers(deps.db, attempt);
  return {
    attemptId: attempt.id,
    attemptNo: attempt.attemptNo,
    maxAttempts: context.maxAttempts ?? 1,
    score: attempt.score,
    correct,
    total,
    endReason: toEndReason(attempt.endReason),
    examTitle: context.examTitle,
    examCode: context.examCode,
    student: { code: context.studentCode, fullName: context.studentName },
  };
}

/** Nộp bài; idempotent: nộp lần hai trả nguyên kết quả cũ. */
export async function submitAttempt(
  deps: AppDeps,
  session: StudentSession,
  attemptId: string,
): Promise<AttemptResultView> {
  const attempt = await loadOwnedAttempt(deps.db, session, attemptId);
  const finished =
    attempt.status === "in_progress"
      ? await finalizeAttempt(deps, attempt.id, submitReason(attempt, deps.clock.now()))
      : attempt;
  return buildResult(deps, finished);
}

export async function getResult(
  deps: AppDeps,
  session: StudentSession,
  attemptId: string,
): Promise<AttemptResultView> {
  await expireDueAttempts(deps, session.studentId);
  return buildResult(deps, await loadOwnedAttempt(deps.db, session, attemptId));
}
