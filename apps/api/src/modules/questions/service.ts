import { questionOptions, questions, staffAccounts, subjects, type DatabaseLike } from "@quiq/db";
import {
  QUESTION_PAGE_SIZE,
  type Question,
  type QuestionInput,
  type QuestionListQuery,
  type QuestionListResult,
  type QuestionStats,
} from "@quiq/shared/questions";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";

/** Phạm vi ngân hàng của giáo viên hiện tại: lấy từ phiên + DB, không bao giờ từ request. */
export interface TeacherScope {
  schoolId: string;
  teacherId: string;
  subjectId: string;
  subjectName: string;
}

type QuestionRow = typeof questions.$inferSelect;
type OptionRow = typeof questionOptions.$inferSelect;

/** Môn cố định của giáo viên (FR-020). DB bắt buộc giáo viên có môn, nên thiếu chỉ xảy ra khi phiên lệch trường. */
export async function loadTeacherScope(db: DatabaseLike, staffId: string, schoolId: string): Promise<TeacherScope> {
  const [row] = await db
    .select({ subjectId: subjects.id, subjectName: subjects.name })
    .from(staffAccounts)
    .innerJoin(subjects, and(eq(subjects.id, staffAccounts.subjectId), eq(subjects.schoolId, staffAccounts.schoolId)))
    .where(and(eq(staffAccounts.id, staffId), eq(staffAccounts.schoolId, schoolId)));
  if (!row) throw new AppError("FORBIDDEN");
  return { schoolId, teacherId: staffId, ...row };
}

// Mọi truy vấn câu hỏi đi qua điều kiện này: câu của giáo viên khác hoặc trường khác coi như không tồn tại (404).
const ownedBy = (scope: TeacherScope) =>
  and(eq(questions.schoolId, scope.schoolId), eq(questions.teacherId, scope.teacherId));

const ownedQuestion = (scope: TeacherScope, questionId: string) =>
  and(ownedBy(scope), eq(questions.id, questionId));

function toQuestion(row: QuestionRow, options: OptionRow[]): Question {
  return {
    id: row.id,
    content: row.content,
    difficulty: row.difficulty,
    multiSelect: row.multiSelect,
    options: options.map(({ id, content, isCorrect, position }) => ({ id, content, isCorrect, position })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function attachOptions(db: DatabaseLike, scope: TeacherScope, rows: QuestionRow[]): Promise<Question[]> {
  if (rows.length === 0) return [];
  const optionRows = await db
    .select()
    .from(questionOptions)
    .where(
      and(
        eq(questionOptions.schoolId, scope.schoolId),
        inArray(
          questionOptions.questionId,
          rows.map((row) => row.id),
        ),
      ),
    )
    .orderBy(asc(questionOptions.position));
  const optionsByQuestion = new Map<string, OptionRow[]>();
  for (const option of optionRows) {
    const list = optionsByQuestion.get(option.questionId) ?? [];
    list.push(option);
    optionsByQuestion.set(option.questionId, list);
  }
  return rows.map((row) => toQuestion(row, optionsByQuestion.get(row.id) ?? []));
}

async function countByDifficulty(db: DatabaseLike, scope: TeacherScope): Promise<QuestionStats> {
  const rows = await db
    .select({ difficulty: questions.difficulty, total: count() })
    .from(questions)
    .where(ownedBy(scope))
    .groupBy(questions.difficulty);
  const stats: QuestionStats = { total: 0, easy: 0, medium: 0, hard: 0 };
  for (const row of rows) {
    stats[row.difficulty] = row.total;
    stats.total += row.total;
  }
  return stats;
}

export async function listQuestions(
  db: DatabaseLike,
  scope: TeacherScope,
  query: QuestionListQuery,
): Promise<QuestionListResult> {
  const stats = await countByDifficulty(db, scope);
  const where = query.difficulty ? and(ownedBy(scope), eq(questions.difficulty, query.difficulty)) : ownedBy(scope);
  const rows = await db
    .select()
    .from(questions)
    .where(where)
    .orderBy(desc(questions.createdAt), desc(questions.id))
    .limit(QUESTION_PAGE_SIZE)
    .offset((query.page - 1) * QUESTION_PAGE_SIZE);
  return {
    subject: { id: scope.subjectId, name: scope.subjectName },
    stats,
    items: await attachOptions(db, scope, rows),
    total: query.difficulty ? stats[query.difficulty] : stats.total,
    page: query.page,
    pageSize: QUESTION_PAGE_SIZE,
  };
}

export async function getQuestion(db: DatabaseLike, scope: TeacherScope, questionId: string): Promise<Question> {
  const [row] = await db.select().from(questions).where(ownedQuestion(scope, questionId));
  if (!row) throw new AppError("NOT_FOUND");
  const [question] = await attachOptions(db, scope, [row]);
  return question!;
}

// Vị trí 0..n-1 theo thứ tự client gửi; school_id bắt buộc cho khóa ngoại ghép (school_id, question_id).
async function insertOptions(tx: DatabaseLike, scope: TeacherScope, questionId: string, input: QuestionInput) {
  return tx
    .insert(questionOptions)
    .values(
      input.options.map((option, position) => ({
        schoolId: scope.schoolId,
        questionId,
        content: option.content,
        isCorrect: option.isCorrect,
        position,
      })),
    )
    .returning();
}

// Nhận tx: mọi truy vấn trong transaction phải đi qua tx (PGlite chỉ có một kết nối, gọi db ngoài sẽ treo).
export async function createQuestion(deps: AppDeps, scope: TeacherScope, input: QuestionInput): Promise<Question> {
  const now = deps.clock.now();
  return deps.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(questions)
      .values({
        schoolId: scope.schoolId,
        teacherId: scope.teacherId,
        subjectId: scope.subjectId,
        content: input.content,
        difficulty: input.difficulty,
        multiSelect: input.multiSelect,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toQuestion(row!, await insertOptions(tx, scope, row!.id, input));
  });
}

/** Thay toàn bộ đáp án. Đề đã ra dùng bản sao (exam_questions), nên sửa ở đây không ảnh hưởng đề cũ (BR-002). */
export async function updateQuestion(
  deps: AppDeps,
  scope: TeacherScope,
  questionId: string,
  input: QuestionInput,
): Promise<Question> {
  const now = deps.clock.now();
  return deps.db.transaction(async (tx) => {
    const [row] = await tx
      .update(questions)
      .set({ content: input.content, difficulty: input.difficulty, multiSelect: input.multiSelect, updatedAt: now })
      .where(ownedQuestion(scope, questionId))
      .returning();
    if (!row) throw new AppError("NOT_FOUND");
    await tx
      .delete(questionOptions)
      .where(and(eq(questionOptions.schoolId, scope.schoolId), eq(questionOptions.questionId, questionId)));
    return toQuestion(row, await insertOptions(tx, scope, questionId, input));
  });
}

/** Đáp án xóa theo cascade; exam_questions.source_question_id không có khóa ngoại nên đề đã ra giữ nguyên. */
export async function deleteQuestion(db: DatabaseLike, scope: TeacherScope, questionId: string): Promise<void> {
  const deleted = await db.delete(questions).where(ownedQuestion(scope, questionId)).returning({ id: questions.id });
  if (deleted.length === 0) throw new AppError("NOT_FOUND");
}
