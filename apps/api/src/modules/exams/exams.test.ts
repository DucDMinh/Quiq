import {
  attempts,
  examClasses,
  examOptions,
  examQuestions,
  exams,
  questionOptions,
  questions,
  studentSessions,
  waitingPresence,
} from "@quiq/db";
import type { ApiFailure, ApiSuccess } from "@quiq/shared/common";
import type { AssignableClass, BankCounts, ExamDetailView, ExamListItem } from "@quiq/shared/exams";
import { eq, inArray } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { insertSchool, insertStaff } from "../../testing/staff-fixtures";
import { createTestApp, type TestApp } from "../../testing/test-app";
import { createExamFixture } from "../student/test-fixtures";
import { EXAM_CODE_ALPHABET, EXAM_CODE_LENGTH } from "./exam-code";
import { createExam } from "./create";
import type { TeacherScope } from "./service";
import {
  createOtherTeacher,
  createTeacherFixture,
  teacherCookie,
  type TeacherFixture,
} from "./test-fixtures";

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.close();
});

const http = () => request(testApp.app.callback());
const dataOf = <T>(res: request.Response) => (res.body as ApiSuccess<T>).data;
const failureOf = (res: request.Response) => res.body as ApiFailure;

function examBody(fixture: TeacherFixture, overrides: Record<string, unknown> = {}) {
  return {
    title: "Kiểm tra chương 1",
    durationMinutes: 20,
    drawConfig: { total: 6, easy: 3, medium: 2, hard: 1 },
    classIds: [fixture.classId, fixture.otherClassId],
    ...overrides,
  };
}

async function postExam(fixture: TeacherFixture, overrides: Record<string, unknown> = {}) {
  return http()
    .post("/api/teacher/exams")
    .set("Cookie", fixture.cookie)
    .send(examBody(fixture, overrides));
}

async function countSchoolRows(schoolId: string) {
  return {
    exams: await testApp.db.$count(exams, eq(exams.schoolId, schoolId)),
    questions: await testApp.db.$count(examQuestions, eq(examQuestions.schoolId, schoolId)),
    options: await testApp.db.$count(examOptions, eq(examOptions.schoolId, schoolId)),
    classes: await testApp.db.$count(examClasses, eq(examClasses.schoolId, schoolId)),
  };
}

describe("POST /api/teacher/exams", () => {
  it("rút đúng tổng và đúng số câu từng mức, sao chép câu + đáp án, sinh mã và link, lớp ở trạng thái nháp", async () => {
    const fixture = await createTeacherFixture(testApp);
    const res = await postExam(fixture);

    expect(res.status).toBe(201);
    const exam = dataOf<ExamListItem>(res);
    expect(exam.code).toHaveLength(EXAM_CODE_LENGTH);
    expect([...exam.code].every((ch) => EXAM_CODE_ALPHABET.includes(ch))).toBe(true);
    expect(exam.link).toBe(`/thi/${exam.code}`);
    expect(exam.drawConfig).toEqual({ total: 6, easy: 3, medium: 2, hard: 1 });
    expect(exam.classes.map((c) => [c.className, c.status])).toEqual([
      ["10A1", "draft"],
      ["10A2", "draft"],
    ]);

    const copies = await testApp.db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, exam.id));
    const byDifficulty = { easy: 0, medium: 0, hard: 0 };
    for (const copy of copies) byDifficulty[copy.difficulty] += 1;
    expect(byDifficulty).toEqual({ easy: 3, medium: 2, hard: 1 });
    expect(copies.map((c) => c.position).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);

    const firstCopy = copies[0]!;
    const [source] = await testApp.db
      .select()
      .from(questions)
      .where(eq(questions.id, firstCopy.sourceQuestionId!));
    expect(firstCopy.content).toBe(source!.content);
    const copiedOptions = await testApp.db
      .select()
      .from(examOptions)
      .where(eq(examOptions.examQuestionId, firstCopy.id));
    expect(copiedOptions).toHaveLength(4);
    expect(copiedOptions.filter((o) => o.isCorrect)).toHaveLength(1);
  });

  it("thiếu câu ở một mức: 422 kèm {difficulty, have, need}, không có hàng nào được tạo", async () => {
    const fixture = await createTeacherFixture(testApp);
    const before = await countSchoolRows(fixture.schoolId);
    const res = await postExam(fixture, {
      drawConfig: { total: 8, easy: 2, medium: 1, hard: 5 },
    });

    expect(res.status).toBe(422);
    expect(failureOf(res).code).toBe("INSUFFICIENT_QUESTIONS");
    expect(failureOf(res).error).toBe("Ngân hàng chỉ có 2 câu Khó, cần 5.");
    expect(failureOf(res).details).toEqual({ difficulty: "hard", have: 2, need: 5 });
    expect(await countSchoolRows(fixture.schoolId)).toEqual(before);
  });

  it("cấu hình sai (tổng không khớp, thiếu tên, không chọn lớp): 422", async () => {
    const fixture = await createTeacherFixture(testApp);
    for (const overrides of [
      { drawConfig: { total: 5, easy: 3, medium: 2, hard: 1 } },
      { title: "   " },
      { classIds: [] },
      { durationMinutes: 0 },
    ]) {
      const res = await postExam(fixture, overrides);
      expect(res.status, JSON.stringify(overrides)).toBe(422);
    }
  });

  it("gán lớp ngoài phân công hoặc lớp trường khác: 403 có thông điệp, không tạo đề", async () => {
    const fixture = await createTeacherFixture(testApp);
    const otherSchool = await createExamFixture(testApp.db);
    const before = await countSchoolRows(fixture.schoolId);
    for (const classId of [fixture.unassignedClassId, otherSchool.classId]) {
      const res = await postExam(fixture, { classIds: [fixture.classId, classId] });
      expect(res.status).toBe(403);
      expect(failureOf(res).code).toBe("CLASS_NOT_ASSIGNED");
      expect(failureOf(res).error).toContain("lớp mình phụ trách");
    }
    expect(await countSchoolRows(fixture.schoolId)).toEqual(before);
  });

  it("va chạm mã: mã đã tồn tại (kể cả khác hoa thường) bị bỏ qua, dùng mã kế tiếp", async () => {
    const fixture = await createTeacherFixture(testApp);
    const scope: TeacherScope = { schoolId: fixture.schoolId, teacherId: fixture.teacherId };
    const candidates = [fixture.examCode.toLowerCase(), fixture.examCode, "ZZ22QQ"];
    const exam = await createExam(
      { db: testApp.db, clock: testApp.clock },
      scope,
      {
        title: "Va chạm",
        durationMinutes: 10,
        drawConfig: { total: 1, easy: 1, medium: 0, hard: 0 },
        classIds: [fixture.classId],
      },
      () => candidates.shift()!,
    );
    expect(exam.code).toBe("ZZ22QQ");
    expect(await testApp.db.$count(exams, eq(exams.code, fixture.examCode))).toBe(1);
  });

  it("hết lượt thử mã: lỗi có thông điệp tiếng Việt, không tạo đề", async () => {
    const fixture = await createTeacherFixture(testApp);
    const scope: TeacherScope = { schoolId: fixture.schoolId, teacherId: fixture.teacherId };
    const before = await countSchoolRows(fixture.schoolId);
    await expect(
      createExam(
        { db: testApp.db, clock: testApp.clock },
        scope,
        {
          title: "Luôn trùng",
          durationMinutes: 10,
          drawConfig: { total: 1, easy: 1, medium: 0, hard: 0 },
          classIds: [fixture.classId],
        },
        () => fixture.examCode,
      ),
    ).rejects.toMatchObject({ code: "INTERNAL", message: "Chưa tạo được mã bài thi, vui lòng thử lại." });
    expect(await countSchoolRows(fixture.schoolId)).toEqual(before);
  });

  it("chưa đăng nhập 401, admin trường 403", async () => {
    const school = await insertSchool(testApp.db);
    const admin = await insertStaff(testApp.db, { role: "school_admin", school });
    expect((await http().get("/api/teacher/exams")).status).toBe(401);
    const res = await http()
      .get("/api/teacher/exams")
      .set("Cookie", await teacherCookie(testApp, admin.staffId));
    expect(res.status).toBe(403);
  });
});

describe("GET /api/teacher/exams, /:id, /classes, /bank-counts", () => {
  it("lớp được gán: chỉ lớp trong phân công năm hiện tại; số câu theo mức của ngân hàng", async () => {
    const fixture = await createTeacherFixture(testApp, { easy: 3, medium: 1, hard: 0 });
    const classesRes = await http().get("/api/teacher/exams/classes").set("Cookie", fixture.cookie);
    expect(dataOf<AssignableClass[]>(classesRes).map((c) => c.className)).toEqual(["10A1", "10A2"]);
    const countsRes = await http()
      .get("/api/teacher/exams/bank-counts")
      .set("Cookie", fixture.cookie);
    expect(dataOf<BankCounts>(countsRes)).toEqual({ easy: 3, medium: 1, hard: 0 });
  });

  it("sửa/xóa câu ngân hàng sau khi ra đề không đổi bản sao trong đề", async () => {
    const fixture = await createTeacherFixture(testApp);
    const created = dataOf<ExamListItem>(await postExam(fixture));
    const before = dataOf<ExamDetailView>(
      await http().get(`/api/teacher/exams/${created.id}`).set("Cookie", fixture.cookie),
    );
    expect(before.questions).toHaveLength(6);
    expect(before.questions[0]!.options.some((o) => o.isCorrect)).toBe(true);

    await testApp.db.update(questions).set({ content: "ĐÃ SỬA" }).where(eq(questions.schoolId, fixture.schoolId));
    await testApp.db.update(questionOptions).set({ isCorrect: true }).where(eq(questionOptions.schoolId, fixture.schoolId));
    await testApp.db.delete(questions).where(inArray(questions.id, fixture.bankQuestionIds.slice(0, 3)));

    const after = await http().get(`/api/teacher/exams/${created.id}`).set("Cookie", fixture.cookie);
    expect(after.status).toBe(200);
    expect(dataOf<ExamDetailView>(after).questions).toEqual(before.questions);
  });

  it("danh sách chỉ có đề của mình; đề của giáo viên khác hoặc trường khác: 404", async () => {
    const fixture = await createTeacherFixture(testApp);
    const created = dataOf<ExamListItem>(await postExam(fixture));
    const other = await createOtherTeacher(testApp, fixture);
    const foreign = await createTeacherFixture(testApp);

    const own = dataOf<ExamListItem[]>(
      await http().get("/api/teacher/exams").set("Cookie", fixture.cookie),
    );
    // Fixture đã có sẵn một bài thi của chính giáo viên này (createExamFixture).
    expect(own.map((e) => e.id)).toEqual([created.id, fixture.examId]);
    expect(dataOf<ExamListItem[]>(await http().get("/api/teacher/exams").set("Cookie", other.cookie))).toEqual([]);

    for (const cookie of [other.cookie, foreign.cookie]) {
      expect((await http().get(`/api/teacher/exams/${created.id}`).set("Cookie", cookie)).status).toBe(404);
      expect((await http().delete(`/api/teacher/exams/${created.id}`).set("Cookie", cookie)).status).toBe(404);
    }
    expect((await http().get("/api/teacher/exams/khong-phai-uuid").set("Cookie", fixture.cookie)).status).toBe(404);
  });
});

describe("DELETE /api/teacher/exams/:id", () => {
  it("đề đã có lần làm: 409, đề vẫn còn", async () => {
    const fixture = await createTeacherFixture(testApp);
    const created = dataOf<ExamListItem>(await postExam(fixture));
    const [examClass] = await testApp.db
      .select()
      .from(examClasses)
      .where(eq(examClasses.examId, created.id));
    await testApp.db.insert(attempts).values({
      schoolId: fixture.schoolId,
      examClassId: examClass!.id,
      studentId: fixture.studentIds.HS001,
      attemptNo: 1,
    });

    const res = await http().delete(`/api/teacher/exams/${created.id}`).set("Cookie", fixture.cookie);
    expect(res.status).toBe(409);
    expect(failureOf(res).code).toBe("EXAM_HAS_ATTEMPTS");
    expect(await testApp.db.$count(exams, eq(exams.id, created.id))).toBe(1);
  });

  it("học sinh mới vào phòng chờ (chưa làm) không chặn xóa; xóa sạch bản sao, lớp, phiên, phòng chờ", async () => {
    const fixture = await createTeacherFixture(testApp);
    const created = dataOf<ExamListItem>(await postExam(fixture));
    const student = request.agent(testApp.app.callback());
    expect(
      (await student.post("/api/student/enter").send({ examCode: created.code, studentCode: "HS001" })).status,
    ).toBe(200);
    expect((await student.get("/api/student/state")).status).toBe(200);

    const res = await http().delete(`/api/teacher/exams/${created.id}`).set("Cookie", fixture.cookie);
    expect(res.status).toBe(200);
    expect(await testApp.db.$count(exams, eq(exams.id, created.id))).toBe(0);
    expect(await testApp.db.$count(examQuestions, eq(examQuestions.examId, created.id))).toBe(0);
    expect(await testApp.db.$count(examClasses, eq(examClasses.examId, created.id))).toBe(0);
    expect(
      await testApp.db.$count(studentSessions, eq(studentSessions.studentId, fixture.studentIds.HS001)),
    ).toBe(0);
    expect(
      await testApp.db.$count(waitingPresence, eq(waitingPresence.studentId, fixture.studentIds.HS001)),
    ).toBe(0);
  });
});
