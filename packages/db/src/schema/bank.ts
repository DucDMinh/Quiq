import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { oneOf } from "./helpers";
import { schools, staffAccounts, subjects } from "./org";

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    teacherId: uuid("teacher_id").notNull(),
    subjectId: uuid("subject_id").notNull(),
    content: text("content").notNull(),
    difficulty: text("difficulty", { enum: DIFFICULTIES }).notNull(),
    multiSelect: boolean("multi_select").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("questions_school_id_id_key").on(t.schoolId, t.id),
    index("questions_draw_idx").on(t.teacherId, t.subjectId, t.difficulty),
    foreignKey({
      name: "questions_teacher_fk",
      columns: [t.schoolId, t.teacherId],
      foreignColumns: [staffAccounts.schoolId, staffAccounts.id],
    }),
    foreignKey({
      name: "questions_subject_fk",
      columns: [t.schoolId, t.subjectId],
      foreignColumns: [subjects.schoolId, subjects.id],
    }),
    check("questions_difficulty_check", oneOf(t.difficulty, DIFFICULTIES)),
  ],
).enableRLS();

export const questionOptions = pgTable(
  "question_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    questionId: uuid("question_id").notNull(),
    content: text("content").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    position: integer("position").notNull(),
  },
  (t) => [
    unique("question_options_question_position_key").on(t.questionId, t.position),
    foreignKey({
      name: "question_options_question_fk",
      columns: [t.schoolId, t.questionId],
      foreignColumns: [questions.schoolId, questions.id],
    }).onDelete("cascade"),
  ],
).enableRLS();
