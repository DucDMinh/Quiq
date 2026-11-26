import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { oneOf } from "./helpers";
import { examClasses, examQuestions } from "./exam";
import { schools } from "./org";
import { students } from "./people";

export const ATTEMPT_STATUSES = ["waiting", "in_progress", "submitted", "interrupted"] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

// Phiên của học sinh: token đục lưu hash. Một học sinh chỉ có một phiên còn hiệu lực (đăng nhập máy 2 thì máy 1 bị thu hồi).
export const studentSessions = pgTable(
  "student_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    tokenHash: text("token_hash").notNull().unique(),
    studentId: uuid("student_id").notNull(),
    examClassId: uuid("exam_class_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("student_sessions_one_active_key").on(t.studentId).where(sql`${t.revokedAt} is null`),
    foreignKey({
      name: "student_sessions_student_fk",
      columns: [t.schoolId, t.studentId],
      foreignColumns: [students.schoolId, students.id],
    }),
    foreignKey({
      name: "student_sessions_exam_class_fk",
      columns: [t.schoolId, t.examClassId],
      foreignColumns: [examClasses.schoolId, examClasses.id],
    }),
  ],
).enableRLS();

// Học sinh đang ở phòng chờ: last_seen_at mới (<= 15 giây) nghĩa là "đang chờ".
export const waitingPresence = pgTable(
  "waiting_presence",
  {
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    examClassId: uuid("exam_class_id").notNull(),
    studentId: uuid("student_id").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "waiting_presence_pkey", columns: [t.examClassId, t.studentId] }),
    foreignKey({
      name: "waiting_presence_student_fk",
      columns: [t.schoolId, t.studentId],
      foreignColumns: [students.schoolId, students.id],
    }),
    foreignKey({
      name: "waiting_presence_exam_class_fk",
      columns: [t.schoolId, t.examClassId],
      foreignColumns: [examClasses.schoolId, examClasses.id],
    }),
  ],
).enableRLS();

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    examClassId: uuid("exam_class_id").notNull(),
    studentId: uuid("student_id").notNull(),
    attemptNo: integer("attempt_no").notNull(),
    status: text("status", { enum: ATTEMPT_STATUSES }).notNull().default("waiting"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    // Hạn chót tính theo giờ máy chủ: started_at + thời lượng bài thi.
    endsAt: timestamp("ends_at", { withTimezone: true }),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    endReason: text("end_reason"),
    score: numeric("score", { precision: 4, scale: 2, mode: "number" }),
    // Thứ tự trộn riêng của lần làm: danh sách id exam_questions, và id exam_questions -> danh sách id exam_options.
    questionOrder: jsonb("question_order").$type<string[]>(),
    optionOrders: jsonb("option_orders").$type<Record<string, string[]>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("attempts_exam_class_student_no_key").on(t.examClassId, t.studentId, t.attemptNo),
    unique("attempts_school_id_id_key").on(t.schoolId, t.id),
    // BR-004: mỗi học sinh tối đa một lần làm đang diễn ra, do DB đảm bảo chứ không phụ thuộc code ứng dụng.
    uniqueIndex("attempts_one_in_progress_key").on(t.studentId).where(sql`${t.status} = 'in_progress'`),
    index("attempts_exam_class_status_idx").on(t.examClassId, t.status),
    foreignKey({
      name: "attempts_student_fk",
      columns: [t.schoolId, t.studentId],
      foreignColumns: [students.schoolId, students.id],
    }),
    foreignKey({
      name: "attempts_exam_class_fk",
      columns: [t.schoolId, t.examClassId],
      foreignColumns: [examClasses.schoolId, examClasses.id],
    }),
    check("attempts_status_check", oneOf(t.status, ATTEMPT_STATUSES)),
    check("attempts_no_check", sql`${t.attemptNo} >= 1`),
    check(
      "attempts_in_progress_times_check",
      sql`${t.status} <> 'in_progress' or (${t.startedAt} is not null and ${t.endsAt} is not null)`,
    ),
    check("attempts_submitted_time_check", sql`${t.status} <> 'submitted' or ${t.submittedAt} is not null`),
    check("attempts_score_check", sql`${t.score} is null or (${t.score} >= 0 and ${t.score} <= 10)`),
  ],
).enableRLS();

export const attemptAnswers = pgTable(
  "attempt_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    attemptId: uuid("attempt_id").notNull(),
    examQuestionId: uuid("exam_question_id").notNull(),
    // Id các exam_options học sinh đã chọn (tập rỗng = bỏ trống).
    selectedOptionIds: uuid("selected_option_ids")
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("attempt_answers_attempt_question_key").on(t.attemptId, t.examQuestionId),
    foreignKey({
      name: "attempt_answers_attempt_fk",
      columns: [t.schoolId, t.attemptId],
      foreignColumns: [attempts.schoolId, attempts.id],
    }),
    foreignKey({
      name: "attempt_answers_question_fk",
      columns: [t.schoolId, t.examQuestionId],
      foreignColumns: [examQuestions.schoolId, examQuestions.id],
    }),
  ],
).enableRLS();
