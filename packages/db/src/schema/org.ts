import { sql } from "drizzle-orm";
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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { oneOf } from "./helpers";

export const SCHOOL_STATUSES = ["active", "locked"] as const;
export const STAFF_ROLES = ["super_admin", "school_admin", "teacher"] as const;

export type SchoolStatus = (typeof SCHOOL_STATUSES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const schools = pgTable(
  "schools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    status: text("status", { enum: SCHOOL_STATUSES }).notNull().default("active"),
    // Thiết lập mặc định của trường; mỗi lớp chụp lại giá trị này lúc phát đề (exam_classes.*_snap).
    maxAttempts: integer("max_attempts").notNull().default(3),
    warnLimit: integer("warn_limit").notNull().default(2),
    interruptSecs: integer("interrupt_secs").notNull().default(60),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("schools_status_check", oneOf(t.status, SCHOOL_STATUSES)),
    check("schools_max_attempts_check", sql`${t.maxAttempts} >= 1`),
    check("schools_warn_limit_check", sql`${t.warnLimit} >= 0`),
    check("schools_interrupt_secs_check", sql`${t.interruptSecs} >= 1`),
  ],
).enableRLS();

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("subjects_school_name_key").on(t.schoolId, t.name),
    // Đích của khóa ngoại phức hợp (school_id, id): DB tự chặn liên kết chéo trường.
    unique("subjects_school_id_id_key").on(t.schoolId, t.id),
  ],
).enableRLS();

export const staffAccounts = pgTable(
  "staff_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // null khi là super_admin (không thuộc trường nào).
    schoolId: uuid("school_id").references(() => schools.id),
    role: text("role", { enum: STAFF_ROLES }).notNull(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    // Chỉ giáo viên: môn cố định, không đổi (FR-017).
    subjectId: uuid("subject_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Đăng nhập chỉ bằng username nên duy nhất toàn hệ thống, không phân biệt hoa thường.
    uniqueIndex("staff_accounts_username_key").on(sql`lower(${t.username})`),
    unique("staff_accounts_school_id_id_key").on(t.schoolId, t.id),
    foreignKey({
      name: "staff_accounts_subject_fk",
      columns: [t.schoolId, t.subjectId],
      foreignColumns: [subjects.schoolId, subjects.id],
    }),
    check("staff_accounts_role_check", oneOf(t.role, STAFF_ROLES)),
    check(
      "staff_accounts_scope_check",
      sql`(${t.role} = 'super_admin' and ${t.schoolId} is null and ${t.subjectId} is null)
        or (${t.role} = 'school_admin' and ${t.schoolId} is not null and ${t.subjectId} is null)
        or (${t.role} = 'teacher' and ${t.schoolId} is not null and ${t.subjectId} is not null)`,
    ),
  ],
).enableRLS();

// Phiên của cán bộ: chỉ lưu hash của token đục; hết hạn trượt 8 giờ do tầng auth cập nhật expires_at.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    staffId: uuid("staff_id")
      .notNull()
      .references(() => staffAccounts.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_staff_id_idx").on(t.staffId)],
).enableRLS();
