import { and, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseLike } from "../client";
import { hashPassword } from "../security/password";
import {
  academicYears,
  assignments,
  attemptAnswers,
  attempts,
  classes,
  enrollments,
  examClasses,
  exams,
  questionOptions,
  questions,
  schools,
  staffAccounts,
  studentSessions,
  students,
  subjects,
  waitingPresence,
  type StaffRole,
} from "../schema";
import { DEMO_EXAM_CODE, ensureDemoExam, type DemoContext } from "./demo-exam";
import { buildDemoQuestionBank } from "./question-bank";

// Giữ các tên đã xuất từ trước để nơi khác (run.ts, test) không phải đổi đường dẫn import.
export { DEMO_EXAM_CODE } from "./demo-exam";
export { assertSeedAllowed } from "./guard";

/**
 * Mật khẩu dùng chung cho các tài khoản cán bộ mẫu. Đây là mật khẩu demo CÔNG KHAI chỉ cho môi trường dev;
 * seed từ chối chạy ở production nên nó không bao giờ tồn tại trong dữ liệu thật.
 */
export const DEMO_PASSWORD = "Quiq@Demo2026";
export const DEMO_SCHOOL_NAME = "Trường THPT Demo";

const DEMO_CLASS_NAME = "10A1";
const DEMO_STUDENTS = [
  { code: "HS001", fullName: "Nguyễn Văn An", dateOfBirth: "2010-03-12", guardianName: "Nguyễn Văn Bình", guardianPhone: "0900000001" },
  { code: "HS002", fullName: "Trần Thị Bích", dateOfBirth: "2010-07-25", guardianName: "Trần Văn Cường", guardianPhone: "0900000002" },
  { code: "HS003", fullName: "Lê Minh Châu", dateOfBirth: "2010-01-08", guardianName: "Lê Thị Dung", guardianPhone: "0900000003" },
  { code: "HS004", fullName: "Phạm Quốc Dũng", dateOfBirth: "2010-11-30", guardianName: "Phạm Thị Hà", guardianPhone: "0900000004" },
  { code: "HS005", fullName: "Hoàng Thu Hà", dateOfBirth: "2010-05-17", guardianName: "Hoàng Văn Khoa", guardianPhone: "0900000005" },
];

/** Năm học hiện tại theo lịch Việt Nam: bắt đầu từ tháng 9, nên từ tháng 8 trở đi tính là năm học mới. */
function currentAcademicYear(now: Date): { name: string; startsOn: string; endsOn: string } {
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return { name: `${startYear}-${startYear + 1}`, startsOn: `${startYear}-09-05`, endsOn: `${startYear + 1}-05-31` };
}

export interface SeedSummary {
  schoolId: string;
  examCode: string;
}

export async function seedDemo(db: DatabaseLike, options: { now?: Date } = {}): Promise<SeedSummary> {
  const now = options.now ?? new Date();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return db.transaction(async (tx) => {
    const school = await findOrCreateSchool(tx);
    const [subject] = await findOrCreate(
      tx.select().from(subjects).where(and(eq(subjects.schoolId, school.id), eq(subjects.name, "Toán"))),
      () => tx.insert(subjects).values({ schoolId: school.id, name: "Toán" }).returning(),
    );
    await ensureStaff(tx, { username: "superadmin", role: "super_admin", displayName: "Admin tổng", passwordHash });
    await ensureStaff(tx, {
      username: "admin.demo",
      role: "school_admin",
      displayName: "Admin trường Demo",
      schoolId: school.id,
      passwordHash,
    });
    const teacher = await ensureStaff(tx, {
      username: "gv.toan",
      role: "teacher",
      displayName: "Giáo viên Toán",
      schoolId: school.id,
      subjectId: subject!.id,
      passwordHash,
    });
    const klass = await ensureClassWithStudents(tx, school.id, now);
    await ensureAssignment(tx, school.id, teacher.id, klass.id);
    const context: DemoContext = { schoolId: school.id, subjectId: subject!.id, teacherId: teacher.id, classId: klass.id };
    await ensureQuestionBank(tx, context);
    await ensureDemoExam(tx, context, school, now);
    return { schoolId: school.id, examCode: DEMO_EXAM_CODE };
  });
}

/** Trả hàng có sẵn, nếu chưa có thì tạo mới. */
async function findOrCreate<Row>(existing: PromiseLike<Row[]>, create: () => PromiseLike<Row[]>): Promise<Row[]> {
  const found = await existing;
  return found.length > 0 ? found : create();
}

async function findOrCreateSchool(tx: DatabaseLike) {
  const [school] = await findOrCreate(tx.select().from(schools).where(eq(schools.name, DEMO_SCHOOL_NAME)), () =>
    tx.insert(schools).values({ name: DEMO_SCHOOL_NAME }).returning(),
  );
  return school!;
}

interface StaffSeed {
  username: string;
  role: StaffRole;
  displayName: string;
  passwordHash: string;
  schoolId?: string;
  subjectId?: string;
}

async function ensureStaff(tx: DatabaseLike, seed: StaffSeed) {
  const [account] = await findOrCreate(
    // Khớp chỉ mục duy nhất lower(username): `SuperAdmin` tạo bằng seed:superadmin cũng được nhận ra là đã có.
    tx.select().from(staffAccounts).where(sql`lower(${staffAccounts.username}) = ${seed.username.toLowerCase()}`),
    () => tx.insert(staffAccounts).values(seed).returning(),
  );
  return account!;
}

async function ensureClassWithStudents(tx: DatabaseLike, schoolId: string, now: Date) {
  // Tìm năm học đang là hiện tại trước để chạy lại sau khi sang năm học mới không đẻ thêm lớp/ghi danh.
  const [year] = await findOrCreate(
    tx.select().from(academicYears).where(and(eq(academicYears.schoolId, schoolId), eq(academicYears.isCurrent, true))),
    () => tx.insert(academicYears).values({ schoolId, isCurrent: true, ...currentAcademicYear(now) }).returning(),
  );
  const [klass] = await findOrCreate(
    tx
      .select()
      .from(classes)
      .where(and(eq(classes.schoolId, schoolId), eq(classes.academicYearId, year!.id), eq(classes.name, DEMO_CLASS_NAME))),
    () => tx.insert(classes).values({ schoolId, academicYearId: year!.id, name: DEMO_CLASS_NAME }).returning(),
  );
  await tx
    .insert(students)
    .values(DEMO_STUDENTS.map((student) => ({ schoolId, ...student })))
    .onConflictDoNothing({ target: [students.schoolId, students.code] });
  const rows = await tx
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.schoolId, schoolId), inArray(students.code, DEMO_STUDENTS.map((s) => s.code))));
  await tx
    .insert(enrollments)
    .values(rows.map((row) => ({ schoolId, studentId: row.id, classId: klass!.id })))
    .onConflictDoNothing({ target: [enrollments.studentId, enrollments.classId] });
  return klass!;
}

async function ensureAssignment(tx: DatabaseLike, schoolId: string, teacherId: string, classId: string) {
  await tx
    .insert(assignments)
    .values({ schoolId, teacherId, classId })
    .onConflictDoNothing({ target: [assignments.teacherId, assignments.classId] });
}

async function ensureQuestionBank(tx: DatabaseLike, context: DemoContext) {
  const existing = await tx.$count(questions, eq(questions.teacherId, context.teacherId));
  if (existing > 0) return;
  for (const spec of buildDemoQuestionBank()) {
    const [question] = await tx
      .insert(questions)
      .values({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        subjectId: context.subjectId,
        content: spec.content,
        difficulty: spec.difficulty,
        multiSelect: spec.options.filter((option) => option.isCorrect).length > 1,
      })
      .returning({ id: questions.id });
    await tx.insert(questionOptions).values(
      spec.options.map((option, position) => ({
        schoolId: context.schoolId,
        questionId: question!.id,
        content: option.content,
        isCorrect: option.isCorrect,
        position,
      })),
    );
  }
}

/**
 * Xóa mọi bài làm, phiên học sinh và phòng chờ của trường demo, mở lại bài DEMO01 (về `dispatched`,
 * bỏ thu bài/công bố) để thử lại từ đầu. Chỉ chạm dữ liệu của trường demo.
 */
export async function resetDemoAttempts(db: DatabaseLike): Promise<{ attemptsDeleted: number }> {
  return db.transaction(async (tx) => {
    const [school] = await tx.select({ id: schools.id }).from(schools).where(eq(schools.name, DEMO_SCHOOL_NAME));
    if (!school) return { attemptsDeleted: 0 };
    const schoolId = school.id;

    await tx.delete(attemptAnswers).where(eq(attemptAnswers.schoolId, schoolId));
    const deleted = await tx.delete(attempts).where(eq(attempts.schoolId, schoolId)).returning({ id: attempts.id });
    await tx.delete(waitingPresence).where(eq(waitingPresence.schoolId, schoolId));
    await tx.delete(studentSessions).where(eq(studentSessions.schoolId, schoolId));

    const [exam] = await tx
      .select({ id: exams.id })
      .from(exams)
      .where(and(eq(exams.schoolId, schoolId), eq(exams.code, DEMO_EXAM_CODE)));
    if (exam) {
      await tx
        .update(examClasses)
        .set({ status: "dispatched", closedAt: null, answersPublishedAt: null, scoresPublishedAt: null })
        .where(eq(examClasses.examId, exam.id));
    }
    return { attemptsDeleted: deleted.length };
  });
}
