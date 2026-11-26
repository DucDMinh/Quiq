import { attempts, examClasses, examOptions, schools, studentSessions } from "@quiq/db";
import type { ApiFailure, ApiSuccess } from "@quiq/shared/common";
import type { CloseClassResult, ExamClassState, ExamListItem, RosterView } from "@quiq/shared/exams";
import type { ExamPaperView, StudentStateView } from "@quiq/shared/student";
import { and, eq, inArray, isNull } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../testing/test-app";
import { createOtherTeacher, createTeacherFixture, type TeacherFixture } from "../exams/test-fixtures";

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

interface Setup {
  fixture: TeacherFixture;
  exam: ExamListItem;
  classUrl: (classId: string, action: string) => string;
}

/** Bài thi 4 câu dễ (một đáp án đúng mỗi câu) gán cho 10A1 và 10A2. */
async function setup(): Promise<Setup> {
  const fixture = await createTeacherFixture(testApp, { easy: 4, medium: 0, hard: 0 });
  const res = await http()
    .post("/api/teacher/exams")
    .set("Cookie", fixture.cookie)
    .send({
      title: "Thu bài",
      durationMinutes: 15,
      drawConfig: { total: 4, easy: 4, medium: 0, hard: 0 },
      classIds: [fixture.classId, fixture.otherClassId],
    });
  expect(res.status).toBe(201);
  const exam = dataOf<ExamListItem>(res);
  return {
    fixture,
    exam,
    classUrl: (classId, action) => `/api/teacher/exams/${exam.id}/classes/${classId}/${action}`,
  };
}

async function teacherPost(s: Setup, classId: string, action: "dispatch" | "close") {
  return http().post(s.classUrl(classId, action)).set("Cookie", s.fixture.cookie);
}

async function roster(s: Setup, classId: string): Promise<RosterView> {
  const res = await http().get(s.classUrl(classId, "roster")).set("Cookie", s.fixture.cookie);
  expect(res.status).toBe(200);
  return dataOf<RosterView>(res);
}

async function enterStudent(s: Setup, studentCode: string) {
  const student = request.agent(testApp.app.callback());
  const res = await student.post("/api/student/enter").send({ examCode: s.exam.code, studentCode });
  expect(res.status).toBe(200);
  expect((await student.get("/api/student/state")).status).toBe(200);
  return student;
}

const statusByCode = (view: RosterView) =>
  Object.fromEntries(view.students.map((st) => [st.code, st.status]));

describe("Phát đề", () => {
  it("chụp snapshot từ schools; đổi thiết lập trường sau đó không đổi lớp đã phát; lớp B vẫn chưa phát", async () => {
    const s = await setup();
    await testApp.db
      .update(schools)
      .set({ maxAttempts: 5, warnLimit: 4, interruptSecs: 90 })
      .where(eq(schools.id, s.fixture.schoolId));

    const res = await teacherPost(s, s.fixture.classId, "dispatch");
    expect(res.status).toBe(200);
    const state = dataOf<ExamClassState>(res);
    expect(state).toMatchObject({ status: "dispatched", maxAttempts: 5, warnLimit: 4, interruptSecs: 90 });
    expect(state.dispatchedAt).toBe(testApp.clock.now().toISOString());

    await testApp.db
      .update(schools)
      .set({ maxAttempts: 1, warnLimit: 0, interruptSecs: 10 })
      .where(eq(schools.id, s.fixture.schoolId));
    const after = await roster(s, s.fixture.classId);
    expect(after.examClass).toMatchObject({ maxAttempts: 5, warnLimit: 4, interruptSecs: 90 });
    expect((await roster(s, s.fixture.otherClassId)).examClass.status).toBe("draft");

    // Học sinh lớp B (HS003) vẫn ở phòng chờ chưa phát đề.
    const studentB = await enterStudent(s, "HS003");
    const stateB = dataOf<StudentStateView>(await studentB.get("/api/student/state"));
    expect(stateB.phase).toBe("waiting");
    expect((await studentB.post("/api/student/attempts")).status).toBe(409);
  });

  it("phát lại lớp đã phát: 409; thu bài lớp chưa phát: 409", async () => {
    const s = await setup();
    const close = await teacherPost(s, s.fixture.classId, "close");
    expect(close.status).toBe(409);
    expect(failureOf(close).code).toBe("CLASS_NOT_DISPATCHED");
    expect((await teacherPost(s, s.fixture.classId, "dispatch")).status).toBe(200);
    const again = await teacherPost(s, s.fixture.classId, "dispatch");
    expect(again.status).toBe(409);
    expect(failureOf(again).code).toBe("CLASS_ALREADY_DISPATCHED");
  });
});

describe("Thu bài và bảng trạng thái", () => {
  it("roster bốn trạng thái; thu bài nộp + chấm bài đang làm, thu hồi mọi phiên, phòng chờ thấy đã thu bài", async () => {
    const s = await setup();
    expect((await teacherPost(s, s.fixture.classId, "dispatch")).status).toBe(200);

    // HS001 đang làm và đã trả lời đúng một câu; HS002 chỉ ở phòng chờ.
    const working = await enterStudent(s, "HS001");
    const startRes = await working.post("/api/student/attempts");
    expect(startRes.status).toBe(201);
    const paper = dataOf<ExamPaperView>(startRes);
    const firstQuestion = paper.questions[0]!;
    const [correct] = await testApp.db
      .select({ id: examOptions.id })
      .from(examOptions)
      .where(and(eq(examOptions.examQuestionId, firstQuestion.id), eq(examOptions.isCorrect, true)));
    const save = await working
      .put(`/api/student/attempts/${paper.attemptId}/answers`)
      .send({ questionId: firstQuestion.id, optionIds: [correct!.id] });
    expect(save.status).toBe(200);
    const waiting = await enterStudent(s, "HS002");

    const before = await roster(s, s.fixture.classId);
    // Chỉ học sinh của chính lớp 10A1 (HS003 thuộc 10A2, HS009 đã vô hiệu).
    expect(statusByCode(before)).toEqual({ HS001: "in_progress", HS002: "waiting" });
    expect(before.counts).toEqual({ not_started: 0, waiting: 1, in_progress: 1, submitted: 0 });

    // Dấu hiện diện cũ hơn 15 giây: không còn "đang chờ".
    testApp.clock.advance(16_000);
    expect(statusByCode(await roster(s, s.fixture.classId)).HS002).toBe("not_started");
    expect((await waiting.get("/api/student/state")).status).toBe(200);
    expect(statusByCode(await roster(s, s.fixture.classId)).HS002).toBe("waiting");

    const closeRes = await teacherPost(s, s.fixture.classId, "close");
    expect(closeRes.status).toBe(200);
    const closed = dataOf<CloseClassResult>(closeRes);
    expect(closed.finalizedAttempts).toBe(1);
    expect(closed.examClass.status).toBe("closed");

    const [finished] = await testApp.db.select().from(attempts).where(eq(attempts.id, paper.attemptId));
    expect(finished).toMatchObject({ status: "submitted", endReason: "closed", score: 2.5 });
    const [examClass] = await testApp.db
      .select()
      .from(examClasses)
      .where(and(eq(examClasses.examId, s.exam.id), eq(examClasses.classId, s.fixture.classId)));
    const activeSessions = await testApp.db
      .select()
      .from(studentSessions)
      .where(and(eq(studentSessions.examClassId, examClass!.id), isNull(studentSessions.revokedAt)));
    expect(activeSessions).toEqual([]);

    // Học sinh phòng chờ: vẫn XEM được trạng thái "đã thu bài", nhưng không bắt đầu được.
    const waitingState = await waiting.get("/api/student/state");
    expect(waitingState.status).toBe(200);
    expect(dataOf<StudentStateView>(waitingState)).toMatchObject({
      phase: "closed",
      closedReason: "class_closed",
    });
    expect((await waiting.post("/api/student/attempts")).status).toBe(401);
    // Vào lại bằng mã: lớp đã đóng nên chỉ được phiên chỉ-xem (không giữ mã, không bao giờ active).
    expect(
      (await waiting.post("/api/student/enter").send({ examCode: s.exam.code, studentCode: "HS002" })).status,
    ).toBe(200);
    const reentered = dataOf<StudentStateView>(await waiting.get("/api/student/state"));
    expect(reentered).toMatchObject({ phase: "closed", closedReason: "class_closed" });
    expect(reentered.student.code).toBe("HS002");
    const activeForStudent = await testApp.db
      .select()
      .from(studentSessions)
      .where(and(eq(studentSessions.studentId, s.fixture.studentIds.HS002), isNull(studentSessions.revokedAt)));
    expect(activeForStudent).toEqual([]);
    const restart = await waiting.post("/api/student/attempts");
    expect(restart.status).toBe(409);
    expect(failureOf(restart).code).toBe("EXAM_CLOSED");
    // Học sinh đang làm: thấy đã hoàn thành.
    expect(dataOf<StudentStateView>(await working.get("/api/student/state")).phase).toBe("completed");

    const after = await roster(s, s.fixture.classId);
    expect(statusByCode(after)).toEqual({ HS001: "submitted", HS002: "not_started" });
    expect(after.students.find((st) => st.code === "HS001")).toMatchObject({
      attemptsUsed: 1,
      bestScore: 2.5,
    });
    expect(after.counts).toEqual({ not_started: 1, waiting: 0, in_progress: 0, submitted: 1 });

    // Thu bài lại lớp đã đóng: idempotent, không còn gì để dọn.
    const twice = await teacherPost(s, s.fixture.classId, "close");
    expect(twice.status).toBe(200);
    expect(dataOf<CloseClassResult>(twice)).toMatchObject({
      finalizedAttempts: 0,
      examClass: { status: "closed", closedAt: closed.examClass.closedAt },
    });
  });

  it("thu bài lỗi giữa chừng (lớp đã closed, còn bài đang làm + phiên hiệu lực): Bắt đầu bị chặn, thu bài lại dọn sạch", async () => {
    const s = await setup();
    expect((await teacherPost(s, s.fixture.classId, "dispatch")).status).toBe(200);
    const working = await enterStudent(s, "HS001");
    const started = await working.post("/api/student/attempts");
    expect(started.status).toBe(201);
    const attemptId = dataOf<ExamPaperView>(started).attemptId;
    const waiting = await enterStudent(s, "HS002");

    // Mô phỏng: bước (1) đã commit, bước (2)(3) chưa chạy.
    await testApp.db
      .update(examClasses)
      .set({ status: "closed", closedAt: testApp.clock.now() })
      .where(and(eq(examClasses.examId, s.exam.id), eq(examClasses.classId, s.fixture.classId)));
    // Phiên còn hiệu lực nhưng Bắt đầu đọc lại trạng thái lớp (đã khóa hàng) nên bị chặn.
    const lateStart = await waiting.post("/api/student/attempts");
    expect(lateStart.status).toBe(409);
    expect(failureOf(lateStart).code).toBe("EXAM_CLOSED");
    expect((await roster(s, s.fixture.classId)).counts.in_progress).toBe(1);

    testApp.clock.advance(5_000);
    const res = await teacherPost(s, s.fixture.classId, "close");
    expect(res.status).toBe(200);
    expect(dataOf<CloseClassResult>(res).finalizedAttempts).toBe(1);
    const [finished] = await testApp.db.select().from(attempts).where(eq(attempts.id, attemptId));
    expect(finished).toMatchObject({ status: "submitted", endReason: "closed" });
    const stillActive = await testApp.db
      .select()
      .from(studentSessions)
      .where(
        and(
          inArray(studentSessions.studentId, [s.fixture.studentIds.HS001, s.fixture.studentIds.HS002]),
          isNull(studentSessions.revokedAt),
        ),
      );
    expect(stillActive).toEqual([]);
    expect(dataOf<StudentStateView>(await waiting.get("/api/student/state")).phase).toBe("closed");
  });

  it("phiên đã bị thu hồi TRƯỚC khi thu bài (vào thi ở máy khác) vẫn bị từ chối sau khi thu bài", async () => {
    const s = await setup();
    expect((await teacherPost(s, s.fixture.classId, "dispatch")).status).toBe(200);
    const oldMachine = await enterStudent(s, "HS001");
    await enterStudent(s, "HS001");
    testApp.clock.advance(1_000);
    expect((await teacherPost(s, s.fixture.classId, "close")).status).toBe(200);
    expect((await oldMachine.get("/api/student/state")).status).toBe(401);
  });
});

describe("Cô lập", () => {
  it("giáo viên khác cùng trường hoặc trường khác: 404 cho phát đề, thu bài, roster; id sai: 404", async () => {
    const s = await setup();
    const other = await createOtherTeacher(testApp, s.fixture);
    const foreign = await createTeacherFixture(testApp);
    for (const cookie of [other.cookie, foreign.cookie]) {
      expect((await http().post(s.classUrl(s.fixture.classId, "dispatch")).set("Cookie", cookie)).status).toBe(404);
      expect((await http().post(s.classUrl(s.fixture.classId, "close")).set("Cookie", cookie)).status).toBe(404);
      expect((await http().get(s.classUrl(s.fixture.classId, "roster")).set("Cookie", cookie)).status).toBe(404);
    }
    expect((await teacherPost(s, s.fixture.unassignedClassId, "dispatch")).status).toBe(404);
    expect(
      (await http().get(`/api/teacher/exams/abc/classes/${s.fixture.classId}/roster`).set("Cookie", s.fixture.cookie))
        .status,
    ).toBe(404);
    expect((await roster(s, s.fixture.classId)).examClass.status).toBe("draft");
  });
});
