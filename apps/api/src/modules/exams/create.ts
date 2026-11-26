import { examClasses, examOptions, examQuestions, exams, questionOptions, questions, type DatabaseLike } from "@quiq/db";
import { drawQuestions, type DrawError } from "@quiq/engine";
import { insufficientQuestionsMessage, type CreateExamInput, type ExamListItem } from "@quiq/shared/exams";
import { asc, inArray, sql } from "drizzle-orm";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";
import { isUniqueViolation } from "../student/errors";
import { randomExamCode, type ExamCodeGenerator } from "./exam-code";
import {
  bankFilter,
  examError,
  getExamSummary,
  listAssignableClasses,
  teacherSubjectId,
  type TeacherScope,
} from "./service";

const MAX_CODE_TRIES = 8;
const EXAM_CODE_CONSTRAINT = "exams_code_key";

async function assertAssignableClasses(
  db: DatabaseLike,
  scope: TeacherScope,
  classIds: string[],
): Promise<void> {
  const allowed = new Set((await listAssignableClasses(db, scope)).map((c) => c.classId));
  if (classIds.some((id) => !allowed.has(id))) throw examError("CLASS_NOT_ASSIGNED");
}

function drawErrorToAppError(error: DrawError): AppError {
  if (error.code === "invalid_config") return examError("INVALID_DRAW_CONFIG");
  const { difficulty, have, need } = error;
  return examError("INSUFFICIENT_QUESTIONS", {
    message: insufficientQuestionsMessage(difficulty, have, need),
    details: { difficulty, have, need },
  });
}

async function loadBank(tx: DatabaseLike, scope: TeacherScope, subjectId: string) {
  return tx
    .select({
      id: questions.id,
      content: questions.content,
      difficulty: questions.difficulty,
      multiSelect: questions.multiSelect,
    })
    .from(questions)
    .where(bankFilter(scope, subjectId));
}

type DrawnQuestion = Awaited<ReturnType<typeof loadBank>>[number];

interface NewExam {
  scope: TeacherScope;
  subjectId: string;
  code: string;
  input: CreateExamInput;
}

async function insertExamRow(tx: DatabaseLike, exam: NewExam): Promise<string> {
  const [row] = await tx
    .insert(exams)
    .values({
      schoolId: exam.scope.schoolId,
      code: exam.code,
      title: exam.input.title,
      teacherId: exam.scope.teacherId,
      subjectId: exam.subjectId,
      durationMinutes: exam.input.durationMinutes,
      drawConfig: exam.input.drawConfig,
    })
    .returning({ id: exams.id });
  return row!.id;
}

/** Bản sao câu + đáp án tách khỏi ngân hàng: sửa/xóa câu gốc sau đó không đổi đề (BR-002). */
async function copyDrawnQuestions(
  tx: DatabaseLike,
  schoolId: string,
  examId: string,
  drawn: DrawnQuestion[],
): Promise<void> {
  const copied = await tx
    .insert(examQuestions)
    .values(
      drawn.map((q, index) => ({
        schoolId,
        examId,
        sourceQuestionId: q.id,
        content: q.content,
        difficulty: q.difficulty,
        multiSelect: q.multiSelect,
        position: index + 1,
      })),
    )
    .returning({ id: examQuestions.id, sourceQuestionId: examQuestions.sourceQuestionId });
  const copyIdBySource = new Map(copied.map((row) => [row.sourceQuestionId, row.id]));

  const sourceOptions = await tx
    .select()
    .from(questionOptions)
    .where(
      inArray(
        questionOptions.questionId,
        drawn.map((q) => q.id),
      ),
    )
    .orderBy(asc(questionOptions.position));
  if (sourceOptions.length === 0) return;
  await tx.insert(examOptions).values(
    sourceOptions.map((option) => ({
      schoolId,
      examQuestionId: copyIdBySource.get(option.questionId)!,
      content: option.content,
      isCorrect: option.isCorrect,
      position: option.position,
    })),
  );
}

/** Rút + sao chép trong CÙNG transaction: thiếu câu thì ném trước khi ghi gì; lỗi sau đó rollback cả đề. */
async function insertExamWithCopies(tx: DatabaseLike, exam: NewExam): Promise<string> {
  const drawn = drawQuestions(await loadBank(tx, exam.scope, exam.subjectId), exam.input.drawConfig);
  if (!drawn.ok) throw drawErrorToAppError(drawn.error);
  const examId = await insertExamRow(tx, exam);
  await copyDrawnQuestions(tx, exam.scope.schoolId, examId, drawn.questions);
  await tx
    .insert(examClasses)
    .values(exam.input.classIds.map((classId) => ({ schoolId: exam.scope.schoolId, examId, classId })));
  return examId;
}

/** So bằng upper() như lúc học sinh tra mã, để không sinh mã chỉ khác hoa thường với mã cũ. */
async function isCodeTaken(db: DatabaseLike, code: string): Promise<boolean> {
  const rows = await db
    .select({ id: exams.id })
    .from(exams)
    .where(sql`upper(${exams.code}) = ${code.toUpperCase()}`)
    .limit(1);
  return rows.length > 0;
}

/** Chỉ vi phạm `exams_code_key` mới đáng thử mã khác; vi phạm duy nhất nào khác là lỗi thật, ném nguyên. */
function isExamCodeViolation(error: unknown): boolean {
  if (!isUniqueViolation(error)) return false;
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 4; depth++) {
    const fields = current as { constraint?: unknown; constraint_name?: unknown };
    if (
      fields.constraint === EXAM_CODE_CONSTRAINT ||
      fields.constraint_name === EXAM_CODE_CONSTRAINT ||
      current.message.includes(EXAM_CODE_CONSTRAINT)
    )
      return true;
    current = current.cause;
  }
  return false;
}

/**
 * Tạo bài thi (FR-030 đến 032). Mã trùng: thử mã khác. Vi phạm duy nhất làm hỏng transaction nên retry
 * bọc NGOÀI transaction, mỗi lần là một transaction mới.
 */
export async function createExam(
  deps: AppDeps,
  scope: TeacherScope,
  input: CreateExamInput,
  generateCode: ExamCodeGenerator = randomExamCode,
): Promise<ExamListItem> {
  const subjectId = await teacherSubjectId(deps.db, scope);
  await assertAssignableClasses(deps.db, scope, input.classIds);

  for (let tries = 0; tries < MAX_CODE_TRIES; tries++) {
    const code = generateCode();
    if (await isCodeTaken(deps.db, code)) continue;
    try {
      const examId = await deps.db.transaction((tx) =>
        insertExamWithCopies(tx, { scope, subjectId, code, input }),
      );
      return getExamSummary(deps.db, scope, examId);
    } catch (error) {
      if (isExamCodeViolation(error)) continue;
      throw error;
    }
  }
  throw new AppError("INTERNAL", { message: "Chưa tạo được mã bài thi, vui lòng thử lại." });
}
