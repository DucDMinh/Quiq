import { and, eq, inArray } from "drizzle-orm";
import type { DatabaseLike } from "../client";
import {
  examClasses,
  examOptions,
  examQuestions,
  exams,
  questionOptions,
  questions,
  type Difficulty,
  type DrawConfig,
  type schools,
} from "../schema";
import { buildDemoQuestionBank } from "./question-bank";

export const DEMO_EXAM_CODE = "DEMO01";
const DEMO_DRAW: DrawConfig = { total: 10, easy: 4, medium: 3, hard: 3 };

export interface DemoContext {
  schoolId: string;
  subjectId: string;
  teacherId: string;
  classId: string;
}

type QuestionRow = typeof questions.$inferSelect;

/** Chọn câu cho bài mẫu: mỗi mức lấy 1 câu nhiều đáp án (đứng đầu mức) rồi tới các câu một đáp án. */
async function pickExamQuestions(tx: DatabaseLike, context: DemoContext): Promise<QuestionRow[]> {
  const bank = buildDemoQuestionBank();
  const rows = await tx
    .select()
    .from(questions)
    .where(and(eq(questions.teacherId, context.teacherId), inArray(questions.content, bank.map((q) => q.content))));
  const byContent = new Map(rows.map((row) => [row.content, row]));
  const levels: Difficulty[] = ["easy", "medium", "hard"];
  return levels.flatMap((level) =>
    bank
      .filter((spec) => spec.difficulty === level)
      .slice(0, DEMO_DRAW[level])
      .map((spec) => byContent.get(spec.content)!),
  );
}

/**
 * Sao chép nội dung câu hỏi + đáp án (kể cả is_correct) từ ngân hàng vào đề: sửa ngân hàng sau này
 * không làm đổi đề đã ra (BR-002).
 */
async function copyQuestionsIntoExam(tx: DatabaseLike, context: DemoContext, examId: string): Promise<void> {
  const picked = await pickExamQuestions(tx, context);
  const sourceOptions = await tx
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, picked.map((q) => q.id)));
  for (const [index, source] of picked.entries()) {
    const [copy] = await tx
      .insert(examQuestions)
      .values({
        schoolId: context.schoolId,
        examId,
        sourceQuestionId: source.id,
        content: source.content,
        difficulty: source.difficulty,
        multiSelect: source.multiSelect,
        position: index + 1,
      })
      .returning({ id: examQuestions.id });
    await tx.insert(examOptions).values(
      sourceOptions
        .filter((option) => option.questionId === source.id)
        .map((option) => ({
          schoolId: context.schoolId,
          examQuestionId: copy!.id,
          content: option.content,
          isCorrect: option.isCorrect,
          position: option.position,
        })),
    );
  }
}

/** Phát đề cho lớp và chụp snapshot thiết lập của trường (C-04, C-06). */
async function dispatchToClass(
  tx: DatabaseLike,
  context: DemoContext,
  examId: string,
  school: typeof schools.$inferSelect,
  now: Date,
): Promise<void> {
  await tx.insert(examClasses).values({
    schoolId: context.schoolId,
    examId,
    classId: context.classId,
    status: "dispatched",
    dispatchedAt: now,
    maxAttemptsSnap: school.maxAttempts,
    warnLimitSnap: school.warnLimit,
    interruptSecsSnap: school.interruptSecs,
  });
}

/** Tạo bài DEMO01 (10 câu, 15 phút) đã phát cho lớp demo; đã có thì giữ nguyên. */
export async function ensureDemoExam(
  tx: DatabaseLike,
  context: DemoContext,
  school: typeof schools.$inferSelect,
  now: Date,
): Promise<void> {
  const [existing] = await tx.select({ id: exams.id }).from(exams).where(eq(exams.code, DEMO_EXAM_CODE));
  if (existing) return;

  const [exam] = await tx
    .insert(exams)
    .values({
      schoolId: context.schoolId,
      code: DEMO_EXAM_CODE,
      title: "Kiểm tra Toán mẫu",
      teacherId: context.teacherId,
      subjectId: context.subjectId,
      durationMinutes: 15,
      drawConfig: DEMO_DRAW,
    })
    .returning({ id: exams.id });
  await copyQuestionsIntoExam(tx, context, exam!.id);
  await dispatchToClass(tx, context, exam!.id, school, now);
}
