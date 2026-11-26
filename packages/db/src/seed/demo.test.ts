import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "../security/password";
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
  exams,
  questionOptions,
  questions,
  schools,
  staffAccounts,
  students,
  studentSessions,
  waitingPresence,
} from "../schema";
import { createDispatchedExamClass, createInterruptedAttempt, createTenant } from "../test-fixtures";
import { createTestDb, type TestDbHandle } from "../testing";
import { assertSeedAllowed, DEMO_PASSWORD, DEMO_SCHOOL_NAME, resetDemoAttempts, seedDemo } from "./demo";
import { ensureSuperAdmin } from "./superadmin";

let handle: TestDbHandle;
beforeAll(async () => {
  handle = await createTestDb();
});
afterAll(async () => {
  await handle.close();
});

async function countRows(): Promise<Record<string, number>> {
  const { db } = handle;
  return {
    schools: await db.$count(schools),
    staff: await db.$count(staffAccounts),
    years: await db.$count(academicYears),
    classes: await db.$count(classes),
    students: await db.$count(students),
    enrollments: await db.$count(enrollments),
    assignments: await db.$count(assignments),
    questions: await db.$count(questions),
    questionOptions: await db.$count(questionOptions),
    exams: await db.$count(exams),
    examQuestions: await db.$count(examQuestions),
    examOptions: await db.$count(examOptions),
    examClasses: await db.$count(examClasses),
  };
}

describe("seedDemo", () => {
  it("tạo đủ dữ liệu mẫu theo task", async () => {
    await seedDemo(handle.db);
    const { db } = handle;

    const [school] = await db.select().from(schools).where(eq(schools.name, DEMO_SCHOOL_NAME));
    expect(school).toMatchObject({ status: "active", maxAttempts: 3, warnLimit: 2, interruptSecs: 60 });

    const staff = await db.select().from(staffAccounts);
    expect(staff.map((s) => `${s.role}:${s.username}`).sort()).toEqual([
      "school_admin:admin.demo",
      "super_admin:superadmin",
      "teacher:gv.toan",
    ]);
    expect(staff.find((s) => s.role === "super_admin")?.schoolId).toBeNull();
    expect(staff.find((s) => s.username === "gv.toan")?.subjectId).not.toBeNull();

    const [year] = await db.select().from(academicYears);
    expect(year?.isCurrent).toBe(true);
    const [klass] = await db.select().from(classes);
    expect(klass).toMatchObject({ name: "10A1", academicYearId: year?.id });

    const codes = (await db.select().from(students)).map((s) => s.code).sort();
    expect(codes).toEqual(["HS001", "HS002", "HS003", "HS004", "HS005"]);
    expect(await db.select().from(enrollments)).toHaveLength(5);
    expect(await db.select().from(assignments)).toHaveLength(1);
  });

  it("mật khẩu cán bộ băm bằng scrypt và khớp DEMO_PASSWORD", async () => {
    const staff = await handle.db.select().from(staffAccounts);
    expect(staff).toHaveLength(3);
    for (const account of staff) {
      expect(account.passwordHash).not.toContain(DEMO_PASSWORD);
      expect(await verifyPassword(DEMO_PASSWORD, account.passwordHash)).toBe(true);
    }
  });

  it("ngân hàng 30 câu: 10 dễ, 10 trung bình, 10 khó, có câu nhiều đáp án đúng", async () => {
    const { db } = handle;
    const bank = await db.select().from(questions);
    expect(bank).toHaveLength(30);
    for (const level of ["easy", "medium", "hard"] as const) {
      expect(bank.filter((q) => q.difficulty === level)).toHaveLength(10);
    }
    const options = await db.select().from(questionOptions);
    for (const question of bank) {
      const own = options.filter((o) => o.questionId === question.id);
      const correct = own.filter((o) => o.isCorrect).length;
      expect(own, question.content).toHaveLength(4);
      expect(correct, question.content).toBeGreaterThanOrEqual(1);
      // multi_select khớp với số đáp án đúng, để engine không phải đoán.
      expect(question.multiSelect, question.content).toBe(correct > 1);
    }
    // Doc ghi "mỗi mức có 2 câu nhiều đáp án đúng": khóa con số đó lại.
    for (const level of ["easy", "medium", "hard"] as const) {
      expect(bank.filter((q) => q.difficulty === level && q.multiSelect), level).toHaveLength(2);
    }
    expect(new Set(bank.map((q) => q.content)).size).toBe(30);
  });

  it("bài thi DEMO01: 10 câu, 15 phút, đã phát cho lớp 10A1 kèm snapshot", async () => {
    const { db } = handle;
    const [exam] = await db.select().from(exams).where(eq(exams.code, "DEMO01"));
    expect(exam).toMatchObject({ durationMinutes: 15, drawConfig: { total: 10, easy: 4, medium: 3, hard: 3 } });

    const examQuestionRows = await db.select().from(examQuestions).where(eq(examQuestions.examId, exam!.id));
    expect(examQuestionRows).toHaveLength(10);
    expect(examQuestionRows.map((q) => q.position).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const copiedOptions = await db
      .select()
      .from(examOptions)
      .where(
        inArray(
          examOptions.examQuestionId,
          examQuestionRows.map((q) => q.id),
        ),
      );
    for (const question of examQuestionRows) {
      const own = copiedOptions.filter((o) => o.examQuestionId === question.id);
      expect(own).toHaveLength(4);
      expect(own.filter((o) => o.isCorrect).length > 1).toBe(question.multiSelect);
      expect(own.some((o) => o.isCorrect)).toBe(true);
    }

    const [examClass] = await db.select().from(examClasses).where(eq(examClasses.examId, exam!.id));
    expect(examClass).toMatchObject({
      status: "dispatched",
      maxAttemptsSnap: 3,
      warnLimitSnap: 2,
      interruptSecsSnap: 60,
      closedAt: null,
      answersPublishedAt: null,
      scoresPublishedAt: null,
    });
    expect(examClass?.dispatchedAt).toBeInstanceOf(Date);
  });

  it("chạy lại không nhân đôi dữ liệu", async () => {
    const before = await countRows();
    await seedDemo(handle.db);
    await seedDemo(handle.db);
    expect(await countRows()).toEqual(before);
  });
});

describe("resetDemoAttempts", () => {
  it("xóa bài làm, phiên học sinh, phòng chờ và mở lại lớp; giữ nguyên dữ liệu nền", async () => {
    const { db } = handle;
    const [exam] = await db.select().from(exams).where(eq(exams.code, "DEMO01"));
    const [examClass] = await db.select().from(examClasses).where(eq(examClasses.examId, exam!.id));
    const [student] = await db.select().from(students).where(eq(students.code, "HS001"));
    const [firstQuestion] = await db.select().from(examQuestions).where(eq(examQuestions.examId, exam!.id));
    const base = { schoolId: examClass!.schoolId, examClassId: examClass!.id, studentId: student!.id };

    const [attempt] = await db
      .insert(attempts)
      .values({ ...base, attemptNo: 1, status: "submitted", submittedAt: new Date(), score: 7.5 })
      .returning();
    await db
      .insert(attemptAnswers)
      .values({ schoolId: base.schoolId, attemptId: attempt!.id, examQuestionId: firstQuestion!.id });
    await db.insert(waitingPresence).values(base);
    await db.insert(studentSessions).values({ ...base, tokenHash: "hash-reset-test" });
    await db
      .update(examClasses)
      .set({ status: "closed", closedAt: new Date(), scoresPublishedAt: new Date(), answersPublishedAt: new Date() })
      .where(eq(examClasses.id, examClass!.id));

    const before = await countRows();
    const result = await resetDemoAttempts(db);

    expect(result.attemptsDeleted).toBe(1);
    expect(await db.select().from(attempts)).toHaveLength(0);
    expect(await db.select().from(attemptAnswers)).toHaveLength(0);
    expect(await db.select().from(waitingPresence)).toHaveLength(0);
    expect(await db.select().from(studentSessions)).toHaveLength(0);
    const [reopened] = await db.select().from(examClasses).where(eq(examClasses.id, examClass!.id));
    expect(reopened).toMatchObject({
      status: "dispatched",
      closedAt: null,
      answersPublishedAt: null,
      scoresPublishedAt: null,
    });
    expect(await countRows()).toEqual(before);
  });

  it("không đụng bài làm, phiên, phòng chờ hay trạng thái lớp của trường khác", async () => {
    const { db } = handle;
    const other = await createTenant(db);
    const { examClassId } = await createDispatchedExamClass(db, other, "OTHER1");
    const attemptId = await createInterruptedAttempt(db, other, examClassId);
    await db.insert(waitingPresence).values({ schoolId: other.schoolId, examClassId, studentId: other.studentId });
    await db
      .insert(studentSessions)
      .values({ schoolId: other.schoolId, examClassId, studentId: other.studentId, tokenHash: "hash-other-school" });
    await db.update(examClasses).set({ scoresPublishedAt: new Date() }).where(eq(examClasses.id, examClassId));

    await resetDemoAttempts(db);

    const survivingAttempts = await db.select().from(attempts).where(eq(attempts.id, attemptId));
    expect(survivingAttempts).toHaveLength(1);
    expect(await db.$count(waitingPresence, eq(waitingPresence.schoolId, other.schoolId))).toBe(1);
    expect(await db.$count(studentSessions, eq(studentSessions.schoolId, other.schoolId))).toBe(1);
    const [otherExamClass] = await db.select().from(examClasses).where(eq(examClasses.id, examClassId));
    expect(otherExamClass?.scoresPublishedAt).toBeInstanceOf(Date);
    const survivors = await db
      .select()
      .from(students)
      .where(and(eq(students.schoolId, other.schoolId), eq(students.id, other.studentId)));
    expect(survivors).toHaveLength(1);
  });
});

describe("assertSeedAllowed", () => {
  const stagingUrl = "postgresql://postgres.stagingref:pw@aws-0-region.pooler.supabase.com:5432/postgres";
  const prodUrl = "postgresql://postgres.prodref:pw@aws-0-region.pooler.supabase.com:5432/postgres";

  it("cho phép khi không phải production và chuỗi khác DATABASE_URL_PROD", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "development", DATABASE_URL_PROD: prodUrl }, stagingUrl)).not.toThrow();
    expect(() => assertSeedAllowed({}, stagingUrl)).not.toThrow();
  });

  it("từ chối khi NODE_ENV=production", () => {
    expect(() => assertSeedAllowed({ NODE_ENV: "production" }, stagingUrl)).toThrow(/production/i);
  });

  it("từ chối khi chuỗi kết nối trùng DATABASE_URL_PROD", () => {
    expect(() => assertSeedAllowed({ DATABASE_URL_PROD: prodUrl }, prodUrl)).toThrow(/DATABASE_URL_PROD/);
  });

  it("từ chối khi trỏ cùng máy chủ, cổng, database và user dù khác tham số truy vấn", () => {
    expect(() => assertSeedAllowed({ DATABASE_URL_PROD: prodUrl }, `${prodUrl}?sslmode=require`)).toThrow(
      /DATABASE_URL_PROD/,
    );
  });

  it("không nhầm hai project Supabase dùng chung máy chủ pooler (khác user)", () => {
    expect(() => assertSeedAllowed({ DATABASE_URL_PROD: prodUrl }, stagingUrl)).not.toThrow();
  });
});

describe("ensureSuperAdmin", () => {
  it("tạo admin tổng không thuộc trường nào và chạy lại không tạo trùng", async () => {
    const { db } = handle;
    const first = await ensureSuperAdmin(db, { username: "root.admin", password: "mat-khau-rat-dai-123" });
    const second = await ensureSuperAdmin(db, { username: "ROOT.admin", password: "mat-khau-rat-dai-123" });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    const rows = await db.select().from(staffAccounts).where(eq(staffAccounts.username, "root.admin"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ role: "super_admin", schoolId: null, subjectId: null });
    expect(await verifyPassword("mat-khau-rat-dai-123", rows[0]!.passwordHash)).toBe(true);
  });

  it("từ chối mật khẩu quá ngắn", async () => {
    await expect(ensureSuperAdmin(handle.db, { username: "yeu.admin", password: "ngan" })).rejects.toThrow(
      /ít nhất/,
    );
  });
});

describe("seedDemo trên database trống", () => {
  it("dùng thời điểm `now` được truyền vào cho năm học và thời điểm phát đề", async () => {
    const fresh = await createTestDb();
    try {
      const now = new Date("2027-01-15T03:00:00.000Z");
      await seedDemo(fresh.db, { now });
      const [year] = await fresh.db.select().from(academicYears);
      expect(year?.name).toBe("2026-2027");
      const [examClass] = await fresh.db.select().from(examClasses);
      expect(examClass?.dispatchedAt?.toISOString()).toBe(now.toISOString());
    } finally {
      await fresh.close();
    }
  });

  it("nhận ra tài khoản admin tổng đã có (khác hoa thường) thay vì lỗi trùng username", async () => {
    const fresh = await createTestDb();
    try {
      await ensureSuperAdmin(fresh.db, { username: "SuperAdmin", password: "mat-khau-rat-dai-123" });
      await expect(seedDemo(fresh.db)).resolves.toBeDefined();
      const superAdmins = (await fresh.db.select().from(staffAccounts)).filter((s) => s.role === "super_admin");
      expect(superAdmins).toHaveLength(1);
      expect(superAdmins[0]?.username).toBe("SuperAdmin");
    } finally {
      await fresh.close();
    }
  });
});
