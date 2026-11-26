import { assignments, classes, questionOptions, questions, type DatabaseLike } from "@quiq/db";
import type { DifficultyLevel } from "@quiq/shared/exams";
import { eq } from "drizzle-orm";
import { insertSessionCookie, insertStaff, sessionExpiryAfter } from "../../testing/staff-fixtures";
import { TEST_SESSION_CONFIG, type TestApp } from "../../testing/test-app";
import { createExamFixture, type ExamFixture } from "../student/test-fixtures";

// Dữ liệu dựng sẵn CHỈ cho test của exams/class-control. Câu hỏi chèn thẳng vào bảng ngân hàng để không
// phụ thuộc API ngân hàng câu hỏi (task song song).

export type BankSpec = Record<DifficultyLevel, number>;

export interface TeacherFixture extends ExamFixture {
  /** Cookie phiên của giáo viên chủ (phân công 10A1 và 10A2). */
  cookie: string;
  /** Lớp cùng trường, năm hiện tại, KHÔNG thuộc phân công. */
  unassignedClassId: string;
  bankQuestionIds: string[];
}

export async function teacherCookie(testApp: TestApp, staffId: string): Promise<string> {
  return insertSessionCookie(
    testApp.db,
    staffId,
    TEST_SESSION_CONFIG.secret,
    sessionExpiryAfter(testApp.clock.now()),
  );
}

/** Mỗi câu 4 đáp án, đáp án vị trí 0 đúng, chọn một. */
export async function insertBankQuestions(
  db: DatabaseLike,
  owner: { schoolId: string; teacherId: string; subjectId: string },
  spec: BankSpec,
): Promise<string[]> {
  const ids: string[] = [];
  for (const difficulty of ["easy", "medium", "hard"] as const) {
    for (let index = 0; index < spec[difficulty]; index++) {
      const [question] = await db
        .insert(questions)
        .values({ ...owner, content: `Ngân hàng ${difficulty} ${index + 1}`, difficulty })
        .returning({ id: questions.id });
      await db.insert(questionOptions).values(
        [0, 1, 2, 3].map((position) => ({
          schoolId: owner.schoolId,
          questionId: question!.id,
          content: `Đáp án ${position + 1} (${difficulty} ${index + 1})`,
          isCorrect: position === 0,
          position,
        })),
      );
      ids.push(question!.id);
    }
  }
  return ids;
}

export async function createTeacherFixture(
  testApp: TestApp,
  bank: BankSpec = { easy: 6, medium: 4, hard: 2 },
): Promise<TeacherFixture> {
  const base = await createExamFixture(testApp.db);
  const [yearClass] = await testApp.db
    .select({ academicYearId: classes.academicYearId })
    .from(classes)
    .where(eq(classes.id, base.classId));
  const [unassigned] = await testApp.db
    .insert(classes)
    .values({ schoolId: base.schoolId, academicYearId: yearClass!.academicYearId, name: "10A9" })
    .returning({ id: classes.id });
  await testApp.db.insert(assignments).values([
    { schoolId: base.schoolId, teacherId: base.teacherId, classId: base.classId },
    { schoolId: base.schoolId, teacherId: base.teacherId, classId: base.otherClassId },
  ]);
  const bankQuestionIds = await insertBankQuestions(testApp.db, base, bank);
  return {
    ...base,
    cookie: await teacherCookie(testApp, base.teacherId),
    unassignedClassId: unassigned!.id,
    bankQuestionIds,
  };
}

/** Giáo viên khác cùng trường (cùng môn), có phân công cùng các lớp. */
export async function createOtherTeacher(testApp: TestApp, fixture: TeacherFixture) {
  const other = await insertStaff(testApp.db, {
    role: "teacher",
    school: { schoolId: fixture.schoolId, subjectId: fixture.subjectId },
  });
  await testApp.db.insert(assignments).values({
    schoolId: fixture.schoolId,
    teacherId: other.staffId,
    classId: fixture.classId,
  });
  return { staffId: other.staffId, cookie: await teacherCookie(testApp, other.staffId) };
}
