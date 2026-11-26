import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER } from "./env";
import {
  academicYears,
  assignments,
  attemptAnswers,
  attempts,
  classes,
  enrollments,
  examClasses,
  examOptions,
  examQuestions,
  questionOptions,
  questions,
  staffAccounts,
  studentSessions,
  students,
  waitingPresence,
} from "./schema";
import {
  createDispatchedExamClass as createDispatchedExamClassIn,
  createInterruptedAttempt,
  createTenant as createTenantIn,
  nextLabel,
  type Tenant,
} from "./test-fixtures";
import { createTestDb, type TestDbHandle } from "./testing";

// Mã lỗi SQLSTATE của Postgres: 23505 trùng khóa duy nhất, 23503 vi phạm khóa ngoại, 23514 vi phạm CHECK.
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const CHECK_VIOLATION = "23514";

/** Drizzle bọc lỗi của driver trong `cause`; lần theo chuỗi cause để lấy SQLSTATE. */
async function sqlState(operation: PromiseLike<unknown>): Promise<string | undefined> {
  try {
    await operation;
  } catch (error) {
    let current: unknown = error;
    while (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
      current = current.cause;
    }
    throw error;
  }
  return undefined;
}

let handle: TestDbHandle;

beforeAll(async () => {
  handle = await createTestDb({ withSupabaseRoles: true });
});
afterAll(async () => {
  await handle.close();
});

const createTenant = () => createTenantIn(handle.db);
const createDispatchedExamClass = (tenant: Tenant, code: string) =>
  createDispatchedExamClassIn(handle.db, tenant, code);

describe("ràng buộc duy nhất", () => {
  it("UNIQUE(school_id, code): trùng mã học sinh trong cùng trường bị DB từ chối", async () => {
    const tenant = await createTenant();
    const duplicate = handle.db.insert(students).values({ schoolId: tenant.schoolId, code: "HS001" });
    expect(await sqlState(duplicate)).toBe(UNIQUE_VIOLATION);
  });

  it("cùng mã học sinh ở hai trường khác nhau là hợp lệ", async () => {
    const first = await createTenant();
    const second = await createTenant();
    expect(first.schoolId).not.toBe(second.schoolId);
    const rows = await handle.db.select().from(students);
    expect(rows.filter((row) => row.code === "HS001").length).toBeGreaterThanOrEqual(2);
  });

  it("UNIQUE(code) trên exams: mã bài thi trùng bị từ chối kể cả khác trường", async () => {
    const first = await createTenant();
    const second = await createTenant();
    await createDispatchedExamClass(first, "UNIQ01");
    const duplicate = createDispatchedExamClass(second, "UNIQ01");
    expect(await sqlState(duplicate)).toBe(UNIQUE_VIOLATION);
  });

  it("username cán bộ duy nhất toàn hệ thống, không phân biệt hoa thường", async () => {
    const tenant = await createTenant();
    const other = await createTenant();
    const duplicate = handle.db.insert(staffAccounts).values({
      schoolId: other.schoolId,
      role: "school_admin",
      username: tenant.teacherUsername.toUpperCase(),
      passwordHash: "x",
      displayName: "Trùng tên",
    });
    expect(await sqlState(duplicate)).toBe(UNIQUE_VIOLATION);
  });

  it("mỗi trường chỉ có tối đa một năm học hiện tại", async () => {
    const tenant = await createTenant();
    const second = handle.db.insert(academicYears).values({
      schoolId: tenant.schoolId,
      name: "2027-2028",
      startsOn: "2027-09-05",
      endsOn: "2028-05-31",
      isCurrent: true,
    });
    expect(await sqlState(second)).toBe(UNIQUE_VIOLATION);
  });
});

describe("BR-004: một attempt in_progress mỗi học sinh", () => {
  const inProgress = (tenant: Awaited<ReturnType<typeof createTenant>>, examClassId: string, attemptNo: number) => ({
    schoolId: tenant.schoolId,
    examClassId,
    studentId: tenant.studentId,
    attemptNo,
    status: "in_progress" as const,
    startedAt: new Date(),
    endsAt: new Date(Date.now() + 15 * 60_000),
  });

  it("attempt in_progress thứ hai của cùng học sinh bị từ chối", async () => {
    const tenant = await createTenant();
    const { examClassId } = await createDispatchedExamClass(tenant, "BR004A");
    await handle.db.insert(attempts).values(inProgress(tenant, examClassId, 1));
    expect(await sqlState(handle.db.insert(attempts).values(inProgress(tenant, examClassId, 2)))).toBe(
      UNIQUE_VIOLATION,
    );
  });

  it("chỉ mục từng phần: attempt cũ đã nộp/gián đoạn không cản attempt in_progress mới", async () => {
    const tenant = await createTenant();
    const { examClassId } = await createDispatchedExamClass(tenant, "BR004B");
    await handle.db.insert(attempts).values([
      { schoolId: tenant.schoolId, examClassId, studentId: tenant.studentId, attemptNo: 1, status: "interrupted" },
      {
        schoolId: tenant.schoolId,
        examClassId,
        studentId: tenant.studentId,
        attemptNo: 2,
        status: "submitted",
        submittedAt: new Date(),
      },
    ]);
    await expect(handle.db.insert(attempts).values(inProgress(tenant, examClassId, 3))).resolves.toBeDefined();
  });

  it("học sinh khác vẫn có attempt in_progress của riêng mình", async () => {
    const tenant = await createTenant();
    const { examClassId } = await createDispatchedExamClass(tenant, "BR004C");
    const [other] = await handle.db.insert(students).values({ schoolId: tenant.schoolId, code: "HS002" }).returning();
    await handle.db.insert(attempts).values(inProgress(tenant, examClassId, 1));
    await expect(
      handle.db.insert(attempts).values({ ...inProgress(tenant, examClassId, 1), studentId: other!.id }),
    ).resolves.toBeDefined();
  });

  it("trùng (exam_class, student, attempt_no) bị từ chối", async () => {
    const tenant = await createTenant();
    const { examClassId } = await createDispatchedExamClass(tenant, "BR004D");
    const row = { schoolId: tenant.schoolId, examClassId, studentId: tenant.studentId, attemptNo: 1 };
    await handle.db.insert(attempts).values({ ...row, status: "interrupted" });
    expect(await sqlState(handle.db.insert(attempts).values({ ...row, status: "interrupted" }))).toBe(
      UNIQUE_VIOLATION,
    );
  });

  it("in_progress bắt buộc có started_at và ends_at", async () => {
    const tenant = await createTenant();
    const { examClassId } = await createDispatchedExamClass(tenant, "BR004E");
    const missingTimes = handle.db.insert(attempts).values({
      schoolId: tenant.schoolId,
      examClassId,
      studentId: tenant.studentId,
      attemptNo: 1,
      status: "in_progress",
    });
    expect(await sqlState(missingTimes)).toBe(CHECK_VIOLATION);
  });
});

describe("cô lập dữ liệu giữa các trường (khóa ngoại phức hợp school_id)", () => {
  it("không ghi danh học sinh của trường A vào lớp của trường B", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const crossEnrollment = handle.db
      .insert(enrollments)
      .values({ schoolId: a.schoolId, studentId: a.studentId, classId: b.classId });
    expect(await sqlState(crossEnrollment)).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("không phân công giáo viên trường A vào lớp trường B", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const cross = handle.db.insert(assignments).values({ schoolId: b.schoolId, teacherId: a.teacherId, classId: b.classId });
    expect(await sqlState(cross)).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("không phát đề của trường A cho lớp trường B", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const { examId } = await createDispatchedExamClass(a, "ISO001");
    const cross = handle.db.insert(examClasses).values({ schoolId: a.schoolId, examId, classId: b.classId });
    expect(await sqlState(cross)).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("không tạo bài làm nối học sinh trường A với đề của trường B", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const { examClassId } = await createDispatchedExamClass(b, "ISO002");
    const cross = handle.db
      .insert(attempts)
      .values({ schoolId: b.schoolId, examClassId, studentId: a.studentId, attemptNo: 1, status: "interrupted" });
    expect(await sqlState(cross)).toBe(FOREIGN_KEY_VIOLATION);
  });

  it("giáo viên không thể gắn với môn của trường khác", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const cross = handle.db.insert(staffAccounts).values({
      schoolId: a.schoolId,
      role: "teacher",
      username: `cross.${nextLabel()}`,
      passwordHash: "x",
      displayName: "GV chéo",
      subjectId: b.subjectId,
    });
    expect(await sqlState(cross)).toBe(FOREIGN_KEY_VIOLATION);
  });
});

// Mỗi trường có đủ chuỗi câu hỏi -> đề -> câu trong đề -> lớp phát đề -> lần làm. Mỗi ca dưới đây ghi một hàng mà
// school_id thuộc trường này nhưng khóa cha thuộc trường kia. Nếu khóa ngoại phức hợp bị đổi về khóa đơn cột
// (chỉ trỏ vào id) thì hàng vẫn được nhận và ca tương ứng sẽ FAIL, nên test thật sự khóa chặt cô lập.
describe("khóa ngoại phức hợp: liên kết chéo trường bị DB từ chối (23503)", () => {
  interface Graph {
    tenant: Tenant;
    examId: string;
    examClassId: string;
    questionId: string;
    examQuestionId: string;
    attemptId: string;
  }
  let a: Graph;
  let b: Graph;

  async function buildGraph(examCode: string): Promise<Graph> {
    const { db } = handle;
    const tenant = await createTenant();
    const { schoolId, teacherId, subjectId } = tenant;
    const { examId, examClassId } = await createDispatchedExamClass(tenant, examCode);
    const [question] = await db
      .insert(questions)
      .values({ schoolId, teacherId, subjectId, content: "Câu hỏi", difficulty: "easy" })
      .returning();
    const [examQuestion] = await db
      .insert(examQuestions)
      .values({ schoolId, examId, content: "Câu trong đề", difficulty: "easy", position: 1 })
      .returning();
    const attemptId = await createInterruptedAttempt(db, tenant, examClassId);
    return { tenant, examId, examClassId, questionId: question!.id, examQuestionId: examQuestion!.id, attemptId };
  }

  beforeAll(async () => {
    a = await buildGraph("FKA001");
    b = await buildGraph("FKB001");
  });

  it("đối chứng: cùng trường thì được ghi (các ca bên dưới fail vì chéo trường, không vì thiếu cột)", async () => {
    const { db } = handle;
    const { schoolId } = a.tenant;
    await expect(
      db.insert(questionOptions).values({ schoolId, questionId: a.questionId, content: "A", position: 0 }),
    ).resolves.toBeDefined();
    await expect(
      db.insert(examOptions).values({ schoolId, examQuestionId: a.examQuestionId, content: "A", position: 0 }),
    ).resolves.toBeDefined();
    await expect(
      db.insert(attemptAnswers).values({ schoolId, attemptId: a.attemptId, examQuestionId: a.examQuestionId }),
    ).resolves.toBeDefined();
    await expect(
      db
        .insert(studentSessions)
        .values({ schoolId, studentId: a.tenant.studentId, examClassId: a.examClassId, tokenHash: "fk-control" }),
    ).resolves.toBeDefined();
    await expect(
      db.insert(waitingPresence).values({ schoolId, studentId: a.tenant.studentId, examClassId: a.examClassId }),
    ).resolves.toBeDefined();
    // Thu hồi phiên đối chứng: nếu không, chỉ mục "một phiên còn hiệu lực" báo 23505 trước và che mất việc kiểm khóa ngoại.
    await db.update(studentSessions).set({ revokedAt: new Date() }).where(eq(studentSessions.tokenHash, "fk-control"));
  });

  const crossTenantInserts: [string, () => PromiseLike<unknown>][] = [
    [
      "questions.teacher: giáo viên trường A, câu hỏi trường B",
      () =>
        handle.db.insert(questions).values({
          schoolId: b.tenant.schoolId,
          teacherId: a.tenant.teacherId,
          subjectId: b.tenant.subjectId,
          content: "chéo",
          difficulty: "easy",
        }),
    ],
    [
      "questions.subject: môn trường A, câu hỏi trường B",
      () =>
        handle.db.insert(questions).values({
          schoolId: b.tenant.schoolId,
          teacherId: b.tenant.teacherId,
          subjectId: a.tenant.subjectId,
          content: "chéo",
          difficulty: "easy",
        }),
    ],
    [
      "classes.year: năm học trường A, lớp trường B",
      () =>
        handle.db
          .insert(classes)
          .values({ schoolId: b.tenant.schoolId, academicYearId: a.tenant.yearId, name: "10A9" }),
    ],
    [
      "question_options: câu hỏi trường A, đáp án trường B",
      () =>
        handle.db
          .insert(questionOptions)
          .values({ schoolId: b.tenant.schoolId, questionId: a.questionId, content: "chéo", position: 7 }),
    ],
    [
      "exam_questions: đề trường A, câu trong đề trường B",
      () =>
        handle.db
          .insert(examQuestions)
          .values({ schoolId: b.tenant.schoolId, examId: a.examId, content: "chéo", difficulty: "easy", position: 7 }),
    ],
    [
      "exam_options: câu trong đề trường A, đáp án trường B",
      () =>
        handle.db
          .insert(examOptions)
          .values({ schoolId: b.tenant.schoolId, examQuestionId: a.examQuestionId, content: "chéo", position: 7 }),
    ],
    [
      "attempt_answers.attempt: lần làm trường B, câu trả lời trường A",
      () =>
        handle.db
          .insert(attemptAnswers)
          .values({ schoolId: a.tenant.schoolId, attemptId: b.attemptId, examQuestionId: a.examQuestionId }),
    ],
    [
      "attempt_answers.exam_question: câu trong đề trường B, câu trả lời trường A",
      () =>
        handle.db
          .insert(attemptAnswers)
          .values({ schoolId: a.tenant.schoolId, attemptId: a.attemptId, examQuestionId: b.examQuestionId }),
    ],
    [
      "student_sessions.student: học sinh trường A, phiên trường B",
      () =>
        handle.db.insert(studentSessions).values({
          schoolId: b.tenant.schoolId,
          studentId: a.tenant.studentId,
          examClassId: b.examClassId,
          tokenHash: "fk-cross-1",
        }),
    ],
    [
      "student_sessions.exam_class: lớp phát đề trường A, phiên trường B",
      () =>
        handle.db.insert(studentSessions).values({
          schoolId: b.tenant.schoolId,
          studentId: b.tenant.studentId,
          examClassId: a.examClassId,
          tokenHash: "fk-cross-2",
        }),
    ],
    [
      "waiting_presence.student: học sinh trường A, phòng chờ trường B",
      () =>
        handle.db
          .insert(waitingPresence)
          .values({ schoolId: b.tenant.schoolId, studentId: a.tenant.studentId, examClassId: b.examClassId }),
    ],
    [
      "waiting_presence.exam_class: lớp phát đề trường A, phòng chờ trường B",
      () =>
        handle.db
          .insert(waitingPresence)
          .values({ schoolId: b.tenant.schoolId, studentId: b.tenant.studentId, examClassId: a.examClassId }),
    ],
    [
      "attempts.exam_class: lần làm ghi cho trường A nhưng gắn vào lớp phát đề của trường B",
      () =>
        handle.db.insert(attempts).values({
          schoolId: a.tenant.schoolId,
          examClassId: b.examClassId,
          studentId: a.tenant.studentId,
          attemptNo: 5,
          status: "interrupted",
        }),
    ],
    [
      "attempts.student: lần làm ghi cho trường B nhưng gắn học sinh trường A",
      () =>
        handle.db.insert(attempts).values({
          schoolId: b.tenant.schoolId,
          examClassId: b.examClassId,
          studentId: a.tenant.studentId,
          attemptNo: 6,
          status: "interrupted",
        }),
    ],
  ];

  it.each(crossTenantInserts)("%s", async (_label, insertRow) => {
    expect(await sqlState(insertRow())).toBe(FOREIGN_KEY_VIOLATION);
  });
});

describe("CHECK", () => {
  it("super_admin không thuộc trường; giáo viên bắt buộc có trường và môn", async () => {
    const tenant = await createTenant();
    const base = { passwordHash: "x", displayName: "Cán bộ" };
    const superAdminWithSchool = handle.db
      .insert(staffAccounts)
      .values({ ...base, role: "super_admin", username: `sa.${nextLabel()}`, schoolId: tenant.schoolId });
    expect(await sqlState(superAdminWithSchool)).toBe(CHECK_VIOLATION);

    const teacherWithoutSubject = handle.db
      .insert(staffAccounts)
      .values({ ...base, role: "teacher", username: `gv.${nextLabel()}`, schoolId: tenant.schoolId });
    expect(await sqlState(teacherWithoutSubject)).toBe(CHECK_VIOLATION);

    const schoolAdminWithoutSchool = handle.db
      .insert(staffAccounts)
      .values({ ...base, role: "school_admin", username: `ad.${nextLabel()}` });
    expect(await sqlState(schoolAdminWithoutSchool)).toBe(CHECK_VIOLATION);
  });

  it("lớp đã phát đề phải có thời điểm phát và đủ snapshot thiết lập", async () => {
    const tenant = await createTenant();
    const { examId } = await createDispatchedExamClass(tenant, "CHK001");
    const [secondClass] = await handle.db
      .insert(classes)
      .values({ schoolId: tenant.schoolId, academicYearId: tenant.yearId, name: "10A2" })
      .returning();
    const withoutSnapshot = handle.db
      .insert(examClasses)
      .values({ schoolId: tenant.schoolId, examId, classId: secondClass!.id, status: "dispatched" });
    expect(await sqlState(withoutSnapshot)).toBe(CHECK_VIOLATION);
  });

  it("trạng thái và độ khó ngoài danh sách bị từ chối", async () => {
    const tenant = await createTenant();
    const { examId } = await createDispatchedExamClass(tenant, "CHK002");
    const badDifficulty = handle.db.insert(examQuestions).values({
      schoolId: tenant.schoolId,
      examId,
      content: "?",
      difficulty: "impossible" as "easy",
      position: 1,
    });
    expect(await sqlState(badDifficulty)).toBe(CHECK_VIOLATION);
  });

  it("học sinh đã ẩn danh bắt buộc bị vô hiệu mã (mã không cấp lại)", async () => {
    const tenant = await createTenant();
    const anonymizedButReusable = handle.db
      .insert(students)
      .values({ schoolId: tenant.schoolId, code: "HS900", anonymizedAt: new Date(), codeVoided: false });
    expect(await sqlState(anonymizedButReusable)).toBe(CHECK_VIOLATION);
  });

  it("thông tin cá nhân của học sinh có thể để trống (xóa dữ liệu cá nhân chỉ cần đặt null)", async () => {
    const tenant = await createTenant();
    await expect(
      handle.db.insert(students).values({
        schoolId: tenant.schoolId,
        code: "HS901",
        fullName: null,
        dateOfBirth: null,
        anonymizedAt: new Date(),
        codeVoided: true,
      }),
    ).resolves.toBeDefined();
  });
});

describe("RLS và quyền của vai trò công khai Supabase", () => {
  it("mọi bảng nghiệp vụ trong public đều bật RLS và có đủ 19 bảng", async () => {
    const result = await handle.pg.query<{ relname: string; relrowsecurity: boolean }>(`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`);
    expect(result.rows).toHaveLength(19);
    expect(result.rows.filter((row) => !row.relrowsecurity)).toEqual([]);
  });

  it("không có policy nào được tạo (anon/authenticated không đọc được gì)", async () => {
    const result = await handle.pg.query<{ count: string }>(`SELECT count(*)::text AS count FROM pg_policies`);
    expect(result.rows[0]?.count).toBe("0");
  });

  it("anon và authenticated bị thu hồi quyền trên mọi bảng, kể cả quyền mặc định", async () => {
    const result = await handle.pg.query<{ role: string; relname: string; allowed: boolean }>(`
      SELECT r.rolname AS role, c.relname,
             has_table_privilege(r.rolname, c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS allowed
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN (SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')) r
      WHERE n.nspname = 'public' AND c.relkind = 'r'`);
    expect(result.rows).toHaveLength(19 * 2);
    expect(result.rows.filter((row) => row.allowed)).toEqual([]);
  });
});

describe("migration đầu chỉ có thao tác tạo mới (không HIGH_RISK_MIGRATION)", () => {
  it("0000 và 0001 không chứa DROP, đổi kiểu cột hay SET NOT NULL", () => {
    const files = readdirSync(MIGRATIONS_FOLDER).filter((name) => /^000[01]_.*\.sql$/.test(name));
    expect(files).toHaveLength(2);
    for (const file of files) {
      const sqlText = readFileSync(join(MIGRATIONS_FOLDER, file), "utf8").replace(/^--.*$/gm, "");
      expect(sqlText, file).not.toMatch(/\bDROP\b|\bALTER\s+COLUMN\b|\bSET\s+NOT\s+NULL\b|\bTRUNCATE\b/i);
    }
  });
});
