import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { schools, staffAccounts } from "./org";

export const academicYears = pgTable(
  "academic_years",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    name: text("name").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("academic_years_school_name_key").on(t.schoolId, t.name),
    unique("academic_years_school_id_id_key").on(t.schoolId, t.id),
    // Mỗi trường tối đa một năm học hiện tại.
    uniqueIndex("academic_years_one_current_key").on(t.schoolId).where(sql`${t.isCurrent}`),
    check("academic_years_dates_check", sql`${t.endsOn} > ${t.startsOn}`),
  ],
).enableRLS();

export const classes = pgTable(
  "classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    academicYearId: uuid("academic_year_id").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("classes_school_year_name_key").on(t.schoolId, t.academicYearId, t.name),
    unique("classes_school_id_id_key").on(t.schoolId, t.id),
    foreignKey({
      name: "classes_year_fk",
      columns: [t.schoolId, t.academicYearId],
      foreignColumns: [academicYears.schoolId, academicYears.id],
    }),
  ],
).enableRLS();

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    code: text("code").notNull(),
    // Thông tin cá nhân đều nullable để "xóa dữ liệu cá nhân" chỉ cần đặt null, giữ hàng và mã (FR-016, C-09).
    fullName: text("full_name"),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    hometown: text("hometown"),
    address: text("address"),
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
    // Mã bị vô hiệu thì không bao giờ cấp lại; hàng vẫn giữ để UNIQUE(school_id, code) chặn tái sử dụng.
    codeVoided: boolean("code_voided").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("students_school_code_key").on(t.schoolId, t.code),
    unique("students_school_id_id_key").on(t.schoolId, t.id),
    check("students_anonymized_voids_code_check", sql`${t.anonymizedAt} is null or ${t.codeVoided}`),
  ],
).enableRLS();

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    studentId: uuid("student_id").notNull(),
    classId: uuid("class_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("enrollments_student_class_key").on(t.studentId, t.classId),
    foreignKey({
      name: "enrollments_student_fk",
      columns: [t.schoolId, t.studentId],
      foreignColumns: [students.schoolId, students.id],
    }),
    foreignKey({
      name: "enrollments_class_fk",
      columns: [t.schoolId, t.classId],
      foreignColumns: [classes.schoolId, classes.id],
    }),
  ],
).enableRLS();

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    teacherId: uuid("teacher_id").notNull(),
    classId: uuid("class_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("assignments_teacher_class_key").on(t.teacherId, t.classId),
    foreignKey({
      name: "assignments_teacher_fk",
      columns: [t.schoolId, t.teacherId],
      foreignColumns: [staffAccounts.schoolId, staffAccounts.id],
    }),
    foreignKey({
      name: "assignments_class_fk",
      columns: [t.schoolId, t.classId],
      foreignColumns: [classes.schoolId, classes.id],
    }),
  ],
).enableRLS();
