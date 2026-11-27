import {
  academicYears,
  attempts,
  classes,
  enrollments,
  examClasses,
  exams,
  schools,
  students,
  subjects,
  type DatabaseLike,
} from "@quiq/db";
import { officialScore } from "@quiq/engine";
import type { LookupResult, LookupSchool, LookupYear } from "@quiq/shared/lookup";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

// Tra cứu công khai (FR-064, BR-013, C-09): KHÔNG kiểm trạng thái trường (trường bị khóa vẫn tra được),
// mọi truy vấn lọc theo school_id, và mọi trường hợp "không có gì để xem" trả cùng một kết quả rỗng.

const EMPTY_RESULT: LookupResult = { items: [] };

/** Danh sách trường cho ô chọn, gồm cả trường bị khóa. */
export async function listLookupSchools(db: DatabaseLike): Promise<LookupSchool[]> {
  return db.select({ id: schools.id, name: schools.name }).from(schools).orderBy(asc(schools.name));
}

/** Năm học của trường, mới nhất trước. Trường không tồn tại thì danh sách rỗng. */
export async function listLookupYears(db: DatabaseLike, schoolId: string): Promise<LookupYear[]> {
  return db
    .select({ id: academicYears.id, name: academicYears.name, isCurrent: academicYears.isCurrent })
    .from(academicYears)
    .where(eq(academicYears.schoolId, schoolId))
    .orderBy(desc(academicYears.startsOn));
}

/** Năm học được chọn (phải thuộc trường), hoặc năm hiện tại của trường khi không chọn. */
async function resolveYearId(
  db: DatabaseLike,
  schoolId: string,
  academicYearId: string | undefined,
): Promise<string | undefined> {
  const [year] = await db
    .select({ id: academicYears.id })
    .from(academicYears)
    .where(
      and(
        eq(academicYears.schoolId, schoolId),
        academicYearId ? eq(academicYears.id, academicYearId) : eq(academicYears.isCurrent, true),
      ),
    )
    .limit(1);
  return year?.id;
}

/** Mã đã chuẩn hóa chữ hoa; mã vô hiệu không tra được (FR-016). Trùng hơn một coi như không thấy. */
async function findStudentId(db: DatabaseLike, schoolId: string, studentCode: string) {
  const rows = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.schoolId, schoolId),
        sql`upper(${students.code}) = ${studentCode}`,
        eq(students.codeVoided, false),
      ),
    )
    .limit(2);
  return rows.length === 1 ? rows[0]?.id : undefined;
}

/**
 * Bài thi đã công bố bảng điểm của các lớp học sinh được ghi danh trong năm học đã chọn.
 * Năm học lấy qua exam_class -> class -> academic_year, không lọc năm qua enrollments (gap G-13).
 */
async function loadPublishedExamClasses(
  db: DatabaseLike,
  scope: { schoolId: string; studentId: string; yearId: string },
) {
  return db
    .select({
      examClassId: examClasses.id,
      subjectName: subjects.name,
      examTitle: exams.title,
      examCode: exams.code,
    })
    .from(examClasses)
    .innerJoin(
      classes,
      and(
        eq(classes.id, examClasses.classId),
        eq(classes.schoolId, scope.schoolId),
        eq(classes.academicYearId, scope.yearId),
      ),
    )
    .innerJoin(
      enrollments,
      and(
        eq(enrollments.classId, examClasses.classId),
        eq(enrollments.studentId, scope.studentId),
        eq(enrollments.schoolId, scope.schoolId),
      ),
    )
    .innerJoin(exams, and(eq(exams.id, examClasses.examId), eq(exams.schoolId, scope.schoolId)))
    .innerJoin(subjects, and(eq(subjects.id, exams.subjectId), eq(subjects.schoolId, scope.schoolId)))
    .where(and(eq(examClasses.schoolId, scope.schoolId), isNotNull(examClasses.scoresPublishedAt)))
    .orderBy(asc(subjects.name), asc(exams.title), asc(exams.code));
}

/** Điểm các lần đã chấm theo exam_class; cùng điều kiện "đã chấm" với bảng trạng thái lớp của giáo viên. */
async function loadGradedScores(
  db: DatabaseLike,
  scope: { schoolId: string; studentId: string },
  examClassIds: string[],
): Promise<Map<string, number[]>> {
  const rows = await db
    .select({ examClassId: attempts.examClassId, score: attempts.score })
    .from(attempts)
    .where(
      and(
        eq(attempts.schoolId, scope.schoolId),
        eq(attempts.studentId, scope.studentId),
        inArray(attempts.examClassId, examClassIds),
        eq(attempts.status, "submitted"),
        isNotNull(attempts.score),
      ),
    );
  const scores = new Map<string, number[]>();
  for (const row of rows) {
    if (row.score === null) continue;
    const list = scores.get(row.examClassId);
    if (list) list.push(row.score);
    else scores.set(row.examClassId, [row.score]);
  }
  return scores;
}

/**
 * Bảng điểm một năm học (FR-064). Không có lần nào đã chấm ở lớp đã công bố thì điểm 0
 * (quyết định của chủ dự án 2026-11-27): chỉ tính lúc trả kết quả, không ghi gì vào DB.
 */
export async function lookupScores(
  db: DatabaseLike,
  input: { schoolId: string; studentCode: string; academicYearId?: string },
): Promise<LookupResult> {
  const yearId = await resolveYearId(db, input.schoolId, input.academicYearId);
  if (!yearId) return EMPTY_RESULT;
  const studentId = await findStudentId(db, input.schoolId, input.studentCode);
  if (!studentId) return EMPTY_RESULT;

  const scope = { schoolId: input.schoolId, studentId, yearId };
  const published = await loadPublishedExamClasses(db, scope);
  if (published.length === 0) return EMPTY_RESULT;
  const scores = await loadGradedScores(
    db,
    scope,
    published.map((row) => row.examClassId),
  );

  return {
    items: published.map((row) => ({
      subjectName: row.subjectName,
      examTitle: row.examTitle,
      examCode: row.examCode,
      score: officialScore(scores.get(row.examClassId) ?? []) ?? 0,
    })),
  };
}
