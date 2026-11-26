import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { DIFFICULTIES, type Difficulty } from "./bank";
import { oneOf } from "./helpers";
import { schools, staffAccounts, subjects } from "./org";
import { classes } from "./people";

export const EXAM_CLASS_STATUSES = ["draft", "dispatched", "closed"] as const;
export type ExamClassStatus = (typeof EXAM_CLASS_STATUSES)[number];

/** Cấu hình rút đề giáo viên chọn: tổng số câu và số câu mỗi mức khó. */
export interface DrawConfig {
  total: number;
  easy: number;
  medium: number;
  hard: number;
}

export const exams = pgTable(
  "exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    // Mã bài thi duy nhất toàn hệ thống (học sinh nhập mã mà không biết trường).
    code: text("code").notNull().unique("exams_code_key"),
    title: text("title").notNull(),
    teacherId: uuid("teacher_id").notNull(),
    subjectId: uuid("subject_id").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    drawConfig: jsonb("draw_config").$type<DrawConfig>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("exams_school_id_id_key").on(t.schoolId, t.id),
    foreignKey({
      name: "exams_teacher_fk",
      columns: [t.schoolId, t.teacherId],
      foreignColumns: [staffAccounts.schoolId, staffAccounts.id],
    }),
    foreignKey({
      name: "exams_subject_fk",
      columns: [t.schoolId, t.subjectId],
      foreignColumns: [subjects.schoolId, subjects.id],
    }),
    check("exams_duration_check", sql`${t.durationMinutes} > 0`),
  ],
).enableRLS();

// Bản SAO nội dung câu hỏi lúc ra đề: sửa/xóa ngân hàng sau đó không làm vỡ đề đã ra (BR-002).
// source_question_id chỉ để truy vết, cố ý không có khóa ngoại vì câu gốc có thể bị xóa.
export const examQuestions = pgTable(
  "exam_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    examId: uuid("exam_id").notNull(),
    sourceQuestionId: uuid("source_question_id"),
    content: text("content").notNull(),
    difficulty: text("difficulty", { enum: DIFFICULTIES }).$type<Difficulty>().notNull(),
    multiSelect: boolean("multi_select").notNull().default(false),
    position: integer("position").notNull(),
  },
  (t) => [
    unique("exam_questions_exam_position_key").on(t.examId, t.position),
    unique("exam_questions_school_id_id_key").on(t.schoolId, t.id),
    foreignKey({
      name: "exam_questions_exam_fk",
      columns: [t.schoolId, t.examId],
      foreignColumns: [exams.schoolId, exams.id],
    }),
    check("exam_questions_difficulty_check", oneOf(t.difficulty, DIFFICULTIES)),
  ],
).enableRLS();

export const examOptions = pgTable(
  "exam_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    examQuestionId: uuid("exam_question_id").notNull(),
    content: text("content").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    position: integer("position").notNull(),
  },
  (t) => [
    unique("exam_options_question_position_key").on(t.examQuestionId, t.position),
    foreignKey({
      name: "exam_options_question_fk",
      columns: [t.schoolId, t.examQuestionId],
      foreignColumns: [examQuestions.schoolId, examQuestions.id],
    }),
  ],
).enableRLS();

// Trạng thái của một bài thi trong một lớp. Snapshot thiết lập được chụp lúc phát đề (C-04, C-06).
export const examClasses = pgTable(
  "exam_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    examId: uuid("exam_id").notNull(),
    classId: uuid("class_id").notNull(),
    status: text("status", { enum: EXAM_CLASS_STATUSES }).notNull().default("draft"),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    maxAttemptsSnap: integer("max_attempts_snap"),
    warnLimitSnap: integer("warn_limit_snap"),
    interruptSecsSnap: integer("interrupt_secs_snap"),
    // Hai cột công bố độc lập nhau; để trống cho các layer sau điền.
    answersPublishedAt: timestamp("answers_published_at", { withTimezone: true }),
    scoresPublishedAt: timestamp("scores_published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("exam_classes_exam_class_key").on(t.examId, t.classId),
    unique("exam_classes_school_id_id_key").on(t.schoolId, t.id),
    foreignKey({
      name: "exam_classes_exam_fk",
      columns: [t.schoolId, t.examId],
      foreignColumns: [exams.schoolId, exams.id],
    }),
    foreignKey({
      name: "exam_classes_class_fk",
      columns: [t.schoolId, t.classId],
      foreignColumns: [classes.schoolId, classes.id],
    }),
    check("exam_classes_status_check", oneOf(t.status, EXAM_CLASS_STATUSES)),
    // Đã phát đề thì bắt buộc có thời điểm phát và đủ ba snapshot; đã thu bài thì có thời điểm thu.
    check(
      "exam_classes_dispatch_check",
      sql`${t.status} = 'draft' or (
        ${t.dispatchedAt} is not null
        and ${t.maxAttemptsSnap} is not null
        and ${t.warnLimitSnap} is not null
        and ${t.interruptSecsSnap} is not null
        and (${t.status} <> 'closed' or ${t.closedAt} is not null)
      )`,
    ),
  ],
).enableRLS();
