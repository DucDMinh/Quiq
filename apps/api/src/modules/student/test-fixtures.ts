import {
  academicYears,
  classes,
  enrollments,
  examClasses,
  examOptions,
  examQuestions,
  exams,
  schools,
  staffAccounts,
  students,
  subjects,
  type DatabaseLike,
  type ExamClassStatus,
} from "@quiq/db";

// Dữ liệu dựng sẵn CHỈ cho test của module student/attempts (gói db không xuất test-fixtures của nó).

let counter = 0;
const nextLabel = () => `${Date.now().toString(36)}${++counter}`.toUpperCase();

export const QUESTION_COUNT = 8;
export const EXAM_MINUTES = 15;

export interface FixtureQuestion {
  id: string;
  multiSelect: boolean;
  correctIds: string[];
  wrongIds: string[];
}

export interface ExamFixture {
  schoolId: string;
  teacherId: string;
  subjectId: string;
  examId: string;
  examCode: string;
  examClassId: string;
  classId: string;
  otherClassId: string;
  /** HS001, HS002 thuộc lớp được gán; HS003 thuộc lớp khác; HS009 đã vô hiệu (lớp được gán). */
  studentIds: Record<"HS001" | "HS002" | "HS003" | "HS009", string>;
  questions: FixtureQuestion[];
}

export interface ExamFixtureOptions {
  classStatus?: ExamClassStatus;
  schoolStatus?: "active" | "locked";
  maxAttempts?: number;
}

async function createSchoolWithClasses(
  db: DatabaseLike,
  label: string,
  schoolStatus: "active" | "locked",
) {
  const [school] = await db
    .insert(schools)
    .values({ name: `Trường ${label}`, status: schoolStatus })
    .returning();
  const schoolId = school!.id;
  const [subject] = await db.insert(subjects).values({ schoolId, name: "Toán" }).returning();
  const [teacher] = await db
    .insert(staffAccounts)
    .values({
      schoolId,
      role: "teacher",
      username: `gv.${label}`,
      passwordHash: "x",
      displayName: "GV",
      subjectId: subject!.id,
    })
    .returning();
  const [year] = await db
    .insert(academicYears)
    .values({
      schoolId,
      name: "2026-2027",
      startsOn: "2026-09-05",
      endsOn: "2027-05-31",
      isCurrent: true,
    })
    .returning();
  const [assigned, other] = await db
    .insert(classes)
    .values([
      { schoolId, academicYearId: year!.id, name: "10A1" },
      { schoolId, academicYearId: year!.id, name: "10A2" },
    ])
    .returning();
  return {
    schoolId,
    subjectId: subject!.id,
    teacherId: teacher!.id,
    classId: assigned!.id,
    otherClassId: other!.id,
  };
}

async function createStudents(
  db: DatabaseLike,
  schoolId: string,
  classId: string,
  otherClassId: string,
) {
  const rows = await db
    .insert(students)
    .values([
      { schoolId, code: "HS001", fullName: "Nguyễn Văn An" },
      { schoolId, code: "HS002", fullName: "Trần Thị Bích" },
      { schoolId, code: "HS003", fullName: "Lê Minh Châu" },
      { schoolId, code: "HS009", fullName: null, codeVoided: true },
    ])
    .returning();
  const ids = Object.fromEntries(
    rows.map((row) => [row.code, row.id]),
  ) as ExamFixture["studentIds"];
  await db.insert(enrollments).values([
    { schoolId, studentId: ids.HS001, classId },
    { schoolId, studentId: ids.HS002, classId },
    { schoolId, studentId: ids.HS003, classId: otherClassId },
    { schoolId, studentId: ids.HS009, classId },
  ]);
  return ids;
}

/** Câu thứ 0 và 4 chọn nhiều (2 đáp án đúng), còn lại chọn 1. Mỗi câu 4 đáp án. */
async function createQuestions(
  db: DatabaseLike,
  schoolId: string,
  examId: string,
): Promise<FixtureQuestion[]> {
  const created: FixtureQuestion[] = [];
  for (let index = 0; index < QUESTION_COUNT; index++) {
    const multiSelect = index % 4 === 0;
    const [question] = await db
      .insert(examQuestions)
      .values({
        schoolId,
        examId,
        content: `Câu hỏi ${index + 1}`,
        difficulty: "easy",
        multiSelect,
        position: index + 1,
      })
      .returning();
    const options = await db
      .insert(examOptions)
      .values(
        [0, 1, 2, 3].map((position) => ({
          schoolId,
          examQuestionId: question!.id,
          content: `Đáp án ${position + 1} của câu ${index + 1}`,
          isCorrect: position === 0 || (multiSelect && position === 1),
          position,
        })),
      )
      .returning();
    const correctIds: string[] = [];
    const wrongIds: string[] = [];
    for (const option of options) (option.isCorrect ? correctIds : wrongIds).push(option.id);
    created.push({ id: question!.id, multiSelect, correctIds, wrongIds });
  }
  return created;
}

/** Một trường, bài thi 8 câu (15 phút) được gán cho lớp 10A1, trạng thái lớp tùy chọn (mặc định đã phát đề). */
export async function createExamFixture(
  db: DatabaseLike,
  options: ExamFixtureOptions = {},
): Promise<ExamFixture> {
  const label = nextLabel();
  const base = await createSchoolWithClasses(db, label, options.schoolStatus ?? "active");
  const studentIds = await createStudents(db, base.schoolId, base.classId, base.otherClassId);
  const { examId, examCode, examClassId, questions } = await createDispatchedExam(db, {
    ...base,
    status: options.classStatus ?? "dispatched",
    maxAttempts: options.maxAttempts ?? 3,
  });
  return {
    schoolId: base.schoolId,
    teacherId: base.teacherId,
    subjectId: base.subjectId,
    examId,
    examCode,
    examClassId,
    classId: base.classId,
    otherClassId: base.otherClassId,
    studentIds,
    questions,
  };
}

interface ExamTarget {
  schoolId: string;
  teacherId: string;
  subjectId: string;
  classId: string;
  status?: ExamClassStatus;
  maxAttempts?: number;
}

/** Bài thi 8 câu gán cho `target.classId`; dùng thêm để có bài thi thứ hai cho cùng lớp. */
export async function createDispatchedExam(db: DatabaseLike, target: ExamTarget) {
  const examCode = `EX${nextLabel()}`;
  const [exam] = await db
    .insert(exams)
    .values({
      schoolId: target.schoolId,
      code: examCode,
      title: "Kiểm tra 15 phút",
      teacherId: target.teacherId,
      subjectId: target.subjectId,
      durationMinutes: EXAM_MINUTES,
      drawConfig: { total: QUESTION_COUNT, easy: QUESTION_COUNT, medium: 0, hard: 0 },
    })
    .returning();
  const questions = await createQuestions(db, target.schoolId, exam!.id);
  const status = target.status ?? "dispatched";
  const dispatched = status !== "draft";
  const [examClass] = await db
    .insert(examClasses)
    .values({
      schoolId: target.schoolId,
      examId: exam!.id,
      classId: target.classId,
      status,
      dispatchedAt: dispatched ? new Date("2026-01-01T00:00:00Z") : null,
      closedAt: status === "closed" ? new Date("2026-01-01T00:00:00Z") : null,
      maxAttemptsSnap: dispatched ? (target.maxAttempts ?? 3) : null,
      warnLimitSnap: dispatched ? 2 : null,
      interruptSecsSnap: dispatched ? 60 : null,
    })
    .returning();
  return { examId: exam!.id, examCode, examClassId: examClass!.id, questions };
}
