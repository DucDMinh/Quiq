import {
  academicYears,
  assignments,
  attempts,
  classes,
  examClasses,
  examOptions,
  examQuestions,
  exams,
  questions,
  staffAccounts,
  type DatabaseLike,
} from "@quiq/db";
import {
  EXAM_ERRORS,
  examLink,
  type AssignableClass,
  type BankCounts,
  type ExamClassSummary,
  type ExamDetailView,
  type ExamErrorCode,
  type ExamListItem,
  type ExamQuestionView,
} from "@quiq/shared/exams";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Context } from "koa";
import { AppError } from "../../http/errors";
import { currentStaff, tenantSchoolId } from "../../http/guards";

/** Giáo viên đang thao tác: mọi truy vấn lọc theo cả trường lẫn chủ sở hữu (khác → 404). */
export interface TeacherScope {
  schoolId: string;
  teacherId: string;
}

export function teacherScope(ctx: Context): TeacherScope {
  return { schoolId: tenantSchoolId(ctx), teacherId: currentStaff(ctx).staffId };
}

export function examError(
  code: ExamErrorCode,
  options: { message?: string; details?: unknown } = {},
): AppError {
  const definition = EXAM_ERRORS[code];
  return new AppError(code, {
    status: definition.status,
    message: options.message ?? definition.message,
    details: options.details,
  });
}

export async function teacherSubjectId(db: DatabaseLike, scope: TeacherScope): Promise<string> {
  const [row] = await db
    .select({ subjectId: staffAccounts.subjectId })
    .from(staffAccounts)
    .where(and(eq(staffAccounts.id, scope.teacherId), eq(staffAccounts.schoolId, scope.schoolId)));
  if (!row?.subjectId) throw new AppError("FORBIDDEN");
  return row.subjectId;
}

/** Lớp trong phân công của giáo viên, năm học hiện tại (FR-032). */
export async function listAssignableClasses(
  db: DatabaseLike,
  scope: TeacherScope,
): Promise<AssignableClass[]> {
  return db
    .select({
      classId: classes.id,
      className: classes.name,
      academicYearName: academicYears.name,
    })
    .from(assignments)
    .innerJoin(classes, eq(classes.id, assignments.classId))
    .innerJoin(academicYears, eq(academicYears.id, classes.academicYearId))
    .where(
      and(
        eq(assignments.teacherId, scope.teacherId),
        eq(assignments.schoolId, scope.schoolId),
        eq(academicYears.isCurrent, true),
      ),
    )
    .orderBy(asc(classes.name));
}

/** Ngân hàng để rút đề = câu của chính giáo viên trong môn cố định của họ. */
export function bankFilter(scope: TeacherScope, subjectId: string) {
  return and(
    eq(questions.schoolId, scope.schoolId),
    eq(questions.teacherId, scope.teacherId),
    eq(questions.subjectId, subjectId),
  );
}

export async function countBank(db: DatabaseLike, scope: TeacherScope): Promise<BankCounts> {
  const subjectId = await teacherSubjectId(db, scope);
  const rows = await db
    .select({ difficulty: questions.difficulty, total: count() })
    .from(questions)
    .where(bankFilter(scope, subjectId))
    .groupBy(questions.difficulty);
  const counts: BankCounts = { easy: 0, medium: 0, hard: 0 };
  for (const row of rows) counts[row.difficulty] = row.total;
  return counts;
}

async function loadSummaries(
  db: DatabaseLike,
  scope: TeacherScope,
  examId?: string,
): Promise<ExamListItem[]> {
  const examRows = await db
    .select()
    .from(exams)
    .where(
      and(
        eq(exams.schoolId, scope.schoolId),
        eq(exams.teacherId, scope.teacherId),
        examId ? eq(exams.id, examId) : undefined,
      ),
    )
    .orderBy(desc(exams.createdAt));
  if (examRows.length === 0) return [];
  const examIds = examRows.map((row) => row.id);

  const classRows = await db
    .select({
      examId: examClasses.examId,
      classId: examClasses.classId,
      className: classes.name,
      status: examClasses.status,
    })
    .from(examClasses)
    .innerJoin(classes, eq(classes.id, examClasses.classId))
    .where(inArray(examClasses.examId, examIds))
    .orderBy(asc(classes.name));
  const attemptRows = await db
    .select({ examId: examClasses.examId, total: count() })
    .from(attempts)
    .innerJoin(examClasses, eq(examClasses.id, attempts.examClassId))
    .where(inArray(examClasses.examId, examIds))
    .groupBy(examClasses.examId);

  const classesByExam = new Map<string, ExamClassSummary[]>();
  for (const { examId: id, ...summary } of classRows) {
    const list = classesByExam.get(id) ?? [];
    list.push(summary);
    classesByExam.set(id, list);
  }
  const attemptsByExam = new Map(attemptRows.map((row) => [row.examId, row.total]));

  return examRows.map((row) => ({
    id: row.id,
    code: row.code,
    link: examLink(row.code),
    title: row.title,
    durationMinutes: row.durationMinutes,
    drawConfig: row.drawConfig,
    classes: classesByExam.get(row.id) ?? [],
    attemptCount: attemptsByExam.get(row.id) ?? 0,
    createdAt: row.createdAt.toISOString(),
  }));
}

export function listExams(db: DatabaseLike, scope: TeacherScope): Promise<ExamListItem[]> {
  return loadSummaries(db, scope);
}

/** Bài thi của giáo viên này; không có / của người khác / trường khác đều 404. */
export async function getExamSummary(
  db: DatabaseLike,
  scope: TeacherScope,
  examId: string,
): Promise<ExamListItem> {
  const [summary] = await loadSummaries(db, scope, examId);
  if (!summary) throw new AppError("NOT_FOUND");
  return summary;
}

export async function getExamDetail(
  db: DatabaseLike,
  scope: TeacherScope,
  examId: string,
): Promise<ExamDetailView> {
  const summary = await getExamSummary(db, scope, examId);
  const questionRows = await db
    .select()
    .from(examQuestions)
    .where(and(eq(examQuestions.examId, examId), eq(examQuestions.schoolId, scope.schoolId)))
    .orderBy(asc(examQuestions.position));
  const optionRows =
    questionRows.length === 0
      ? []
      : await db
          .select()
          .from(examOptions)
          .where(
            inArray(
              examOptions.examQuestionId,
              questionRows.map((q) => q.id),
            ),
          )
          .orderBy(asc(examOptions.position));

  const byQuestion = new Map<string, ExamQuestionView["options"]>();
  for (const option of optionRows) {
    const list = byQuestion.get(option.examQuestionId) ?? [];
    list.push({
      id: option.id,
      content: option.content,
      isCorrect: option.isCorrect,
      position: option.position,
    });
    byQuestion.set(option.examQuestionId, list);
  }
  const questionViews: ExamQuestionView[] = questionRows.map((q) => ({
    id: q.id,
    content: q.content,
    difficulty: q.difficulty,
    multiSelect: q.multiSelect,
    position: q.position,
    options: byQuestion.get(q.id) ?? [],
  }));
  return { ...summary, questions: questionViews };
}
