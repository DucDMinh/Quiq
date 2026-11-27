import {
  academicYears,
  attempts,
  classes,
  enrollments,
  examClasses,
  type AttemptStatus,
  type DatabaseLike,
} from "@quiq/db";
import { eq } from "drizzle-orm";
import { createDispatchedExam, createExamFixture, type ExamFixture } from "../student/test-fixtures";

// Dữ liệu dựng sẵn CHỈ cho test của module lookup: lớp đã công bố bảng điểm, attempt điểm cố định, năm học trước.

export async function publishScores(db: DatabaseLike, examClassId: string) {
  await db
    .update(examClasses)
    .set({ scoresPublishedAt: new Date("2026-01-02T00:00:00Z") })
    .where(eq(examClasses.id, examClassId));
}

export interface AttemptSpec {
  schoolId: string;
  examClassId: string;
  studentId: string;
  attemptNo: number;
  status: AttemptStatus;
  score: number | null;
}

const SUBMITTED_AT = new Date("2026-01-01T00:15:00Z");

/** Attempt viết tay với điểm cố định; bài đã nộp cần có thời điểm nộp (CHECK attempts_submitted_time_check). */
export async function insertAttempt(db: DatabaseLike, spec: AttemptSpec) {
  const finished = spec.status === "submitted" ? { startedAt: SUBMITTED_AT, submittedAt: SUBMITTED_AT } : {};
  await db.insert(attempts).values({ ...spec, ...finished });
}

/** Bài thi đã thu bài + công bố bảng điểm cho lớp 10A1 của fixture (năm học hiện tại 2026-2027). */
export async function publishedFixture(db: DatabaseLike, options: { schoolStatus?: "active" | "locked" } = {}) {
  const fixture = await createExamFixture(db, { classStatus: "closed", ...options });
  await publishScores(db, fixture.examClassId);
  return fixture;
}

export function attemptOf(fixture: ExamFixture, code: keyof ExamFixture["studentIds"], attemptNo: number) {
  return {
    schoolId: fixture.schoolId,
    examClassId: fixture.examClassId,
    studentId: fixture.studentIds[code],
    attemptNo,
  };
}

/** Năm học trước (không phải hiện tại) có lớp 9A1 với HS001, bài thi đã công bố, điểm 7. */
export async function addPreviousYear(db: DatabaseLike, fixture: ExamFixture) {
  const [year] = await db
    .insert(academicYears)
    .values({
      schoolId: fixture.schoolId,
      name: "2025-2026",
      startsOn: "2025-09-05",
      endsOn: "2026-05-31",
      isCurrent: false,
    })
    .returning();
  const [oldClass] = await db
    .insert(classes)
    .values({ schoolId: fixture.schoolId, academicYearId: year!.id, name: "9A1" })
    .returning();
  await db
    .insert(enrollments)
    .values({ schoolId: fixture.schoolId, studentId: fixture.studentIds.HS001, classId: oldClass!.id });
  const oldExam = await createDispatchedExam(db, { ...fixture, classId: oldClass!.id, status: "closed" });
  await publishScores(db, oldExam.examClassId);
  await insertAttempt(db, {
    schoolId: fixture.schoolId,
    examClassId: oldExam.examClassId,
    studentId: fixture.studentIds.HS001,
    attemptNo: 1,
    status: "submitted",
    score: 7,
  });
  return { yearId: year!.id, examCode: oldExam.examCode };
}
