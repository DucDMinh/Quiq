import {
  academicYears,
  attempts,
  classes,
  examClasses,
  exams,
  schools,
  staffAccounts,
  students,
  subjects,
} from "./schema";
import type { TestDb } from "./testing";

// Dữ liệu dựng sẵn cho test của gói db (không xuất ra ngoài gói).

let labelCounter = 0;
export const nextLabel = () => `t${++labelCounter}`;

/** Một trường đầy đủ: môn, giáo viên, năm học hiện tại, lớp 10A1, học sinh HS001. */
export async function createTenant(db: TestDb) {
  const label = nextLabel();
  const [school] = await db.insert(schools).values({ name: `Trường ${label}` }).returning();
  const schoolId = school!.id;
  const [subject] = await db.insert(subjects).values({ schoolId, name: "Toán" }).returning();
  const [teacher] = await db
    .insert(staffAccounts)
    .values({
      schoolId,
      role: "teacher",
      username: `gv.${label}`,
      passwordHash: "x",
      displayName: "Giáo viên",
      subjectId: subject!.id,
    })
    .returning();
  const [year] = await db
    .insert(academicYears)
    .values({ schoolId, name: "2026-2027", startsOn: "2026-09-05", endsOn: "2027-05-31", isCurrent: true })
    .returning();
  const [klass] = await db
    .insert(classes)
    .values({ schoolId, academicYearId: year!.id, name: "10A1" })
    .returning();
  const [student] = await db.insert(students).values({ schoolId, code: "HS001" }).returning();
  return {
    schoolId,
    subjectId: subject!.id,
    teacherId: teacher!.id,
    teacherUsername: teacher!.username,
    yearId: year!.id,
    classId: klass!.id,
    studentId: student!.id,
  };
}

export type Tenant = Awaited<ReturnType<typeof createTenant>>;

/** Bài thi + lớp đã phát đề (đủ snapshot) cho lớp của `tenant`. */
export async function createDispatchedExamClass(db: TestDb, tenant: Tenant, code: string) {
  const [exam] = await db
    .insert(exams)
    .values({
      schoolId: tenant.schoolId,
      code,
      title: "Bài thi",
      teacherId: tenant.teacherId,
      subjectId: tenant.subjectId,
      durationMinutes: 15,
      drawConfig: { total: 1, easy: 1, medium: 0, hard: 0 },
    })
    .returning();
  const [examClass] = await db
    .insert(examClasses)
    .values({
      schoolId: tenant.schoolId,
      examId: exam!.id,
      classId: tenant.classId,
      status: "dispatched",
      dispatchedAt: new Date(),
      maxAttemptsSnap: 3,
      warnLimitSnap: 2,
      interruptSecsSnap: 60,
    })
    .returning();
  return { examId: exam!.id, examClassId: examClass!.id };
}

/** Một lần làm đã bị gián đoạn của học sinh `tenant.studentId` (không đụng chỉ mục in_progress). */
export async function createInterruptedAttempt(db: TestDb, tenant: Tenant, examClassId: string) {
  const [attempt] = await db
    .insert(attempts)
    .values({
      schoolId: tenant.schoolId,
      examClassId,
      studentId: tenant.studentId,
      attemptNo: 1,
      status: "interrupted",
    })
    .returning();
  return attempt!.id;
}
