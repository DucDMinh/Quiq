import { enrollments, studentSessions, students, waitingPresence } from "@quiq/db";
import type { ApiSuccess } from "@quiq/shared/common";
import type { StudentStateView } from "@quiq/shared/student";
import { and, eq, isNull } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../testing/test-app";
import { hashStudentToken, STUDENT_COOKIE } from "./student-session";
import {
  createDispatchedExam,
  createExamFixture,
  EXAM_MINUTES,
  QUESTION_COUNT,
} from "./test-fixtures";

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.close();
});

const agent = () => request.agent(testApp.app.callback());

function cookieToken(res: request.Response): string | undefined {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = raw?.find((line) => line.startsWith(`${STUDENT_COOKIE}=`));
  return cookie?.split(";")[0]?.slice(STUDENT_COOKIE.length + 1);
}

const stateOf = (res: request.Response) => (res.body as ApiSuccess<StudentStateView>).data;

describe("POST /api/student/enter", () => {
  it("vào thi đúng: cookie quiq_stu HttpOnly, DB chỉ lưu hash của token", async () => {
    const fixture = await createExamFixture(testApp.db);
    const res = await agent()
      .post("/api/student/enter")
      .send({ examCode: fixture.examCode, studentCode: "HS001" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { examCode: fixture.examCode } });
    const setCookie = (res.headers["set-cookie"] as unknown as string[]).join(";").toLowerCase();
    expect(setCookie).toContain("httponly");
    const token = cookieToken(res)!;
    expect(token.length).toBeGreaterThan(30);
    expect(JSON.stringify(res.body)).not.toContain(token);

    const rows = await testApp.db
      .select()
      .from(studentSessions)
      .where(eq(studentSessions.studentId, fixture.studentIds.HS001));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashStudentToken(token));
    expect(rows[0]!.tokenHash).not.toBe(token);
  });

  it("chuẩn hóa mã: khoảng trắng, chữ thường và dán cả link đều vào được", async () => {
    const fixture = await createExamFixture(testApp.db);
    const link = `http://localhost:3000/thi/${fixture.examCode.toLowerCase()}/phong-cho`;
    for (const examCode of [`  ${fixture.examCode.toLowerCase()} `, link]) {
      const res = await agent()
        .post("/api/student/enter")
        .send({ examCode, studentCode: "  hs002 " });
      expect(res.status, examCode).toBe(200);
      expect(res.body.data.examCode).toBe(fixture.examCode);
    }
  });

  it("mã sai, mã vô hiệu, học sinh lớp khác, học sinh trường khác: cùng một thông báo", async () => {
    const fixture = await createExamFixture(testApp.db);
    const otherSchool = await createExamFixture(testApp.db);
    const [outsider] = await testApp.db
      .insert(students)
      .values({ schoolId: otherSchool.schoolId, code: "HS777" })
      .returning();
    await testApp.db.insert(enrollments).values({
      schoolId: otherSchool.schoolId,
      studentId: outsider!.id,
      classId: otherSchool.classId,
    });

    const bodies = [];
    for (const studentCode of ["KHONGCO", "HS009", "HS003", "HS777"]) {
      const res = await agent()
        .post("/api/student/enter")
        .send({ examCode: fixture.examCode, studentCode });
      expect(res.status, studentCode).toBe(404);
      expect(res.headers["set-cookie"], studentCode).toBeUndefined();
      bodies.push(res.body);
    }
    expect(bodies[0]).toEqual({
      success: false,
      code: "STUDENT_NOT_ALLOWED",
      error: "Mã học sinh không đúng hoặc không thuộc lớp được gán.",
    });
    for (const body of bodies) expect(body).toEqual(bodies[0]);
  });

  it("bài thi không tồn tại: 404 EXAM_NOT_FOUND; trường bị khóa: 403", async () => {
    const missing = await agent()
      .post("/api/student/enter")
      .send({ examCode: "ZZZZZZ", studentCode: "HS001" });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("EXAM_NOT_FOUND");

    const locked = await createExamFixture(testApp.db, { schoolStatus: "locked" });
    const res = await agent()
      .post("/api/student/enter")
      .send({ examCode: locked.examCode, studentCode: "HS001" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("SCHOOL_LOCKED");
  });

  it("body thiếu hoặc rỗng: 422", async () => {
    const res = await agent()
      .post("/api/student/enter")
      .send({ examCode: "   ", studentCode: "HS001" });
    expect(res.status).toBe(422);
  });

  it("vào lại lần hai: phiên cũ bị thu hồi, chỉ một phiên còn hiệu lực", async () => {
    const fixture = await createExamFixture(testApp.db);
    const first = agent();
    await first
      .post("/api/student/enter")
      .send({ examCode: fixture.examCode, studentCode: "HS001" })
      .expect(200);
    const second = agent();
    await second
      .post("/api/student/enter")
      .send({ examCode: fixture.examCode, studentCode: "HS001" })
      .expect(200);

    const active = await testApp.db
      .select()
      .from(studentSessions)
      .where(
        and(
          eq(studentSessions.studentId, fixture.studentIds.HS001),
          isNull(studentSessions.revokedAt),
        ),
      );
    expect(active).toHaveLength(1);
    expect((await first.get("/api/student/state")).status).toBe(401);
    expect((await second.get("/api/student/state")).status).toBe(200);
  });
});

describe("GET /api/student/state", () => {
  it("không có cookie hoặc cookie lạ: 401", async () => {
    expect((await agent().get("/api/student/state")).status).toBe(401);
    const res = await agent()
      .get("/api/student/state")
      .set("Cookie", `${STUDENT_COOKIE}=khong-hop-le`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("STUDENT_SESSION_REQUIRED");
  });

  it("lớp chưa phát đề: pha waiting, ghi waiting_presence theo giờ máy chủ", async () => {
    const fixture = await createExamFixture(testApp.db, { classStatus: "draft" });
    const client = agent();
    await client
      .post("/api/student/enter")
      .send({ examCode: fixture.examCode, studentCode: "HS001" })
      .expect(200);
    const res = await client.get("/api/student/state");

    expect(res.status).toBe(200);
    const state = stateOf(res);
    expect(state.phase).toBe("waiting");
    expect(state.exam).toMatchObject({
      code: fixture.examCode,
      durationMinutes: EXAM_MINUTES,
      questionCount: QUESTION_COUNT,
    });
    expect(state.student).toEqual({ code: "HS001", fullName: "Nguyễn Văn An" });
    expect(state.className).toBe("10A1");
    expect(state.serverNow).toBe(testApp.clock.now().toISOString());

    const [presence] = await testApp.db
      .select()
      .from(waitingPresence)
      .where(eq(waitingPresence.studentId, fixture.studentIds.HS001));
    expect(presence?.lastSeenAt.toISOString()).toBe(testApp.clock.now().toISOString());
  });

  it("lớp đã phát đề: can_start; lớp đã thu bài: closed", async () => {
    const open = await createExamFixture(testApp.db);
    const client = agent();
    await client
      .post("/api/student/enter")
      .send({ examCode: open.examCode, studentCode: "HS001" })
      .expect(200);
    expect(stateOf(await client.get("/api/student/state")).phase).toBe("can_start");

    const closed = await createExamFixture(testApp.db, { classStatus: "closed" });
    const other = agent();
    await other
      .post("/api/student/enter")
      .send({ examCode: closed.examCode, studentCode: "HS001" })
      .expect(200);
    const state = stateOf(await other.get("/api/student/state"));
    expect(state.phase).toBe("closed");
    expect(state.closedReason).toBe("class_closed");
  });
});

describe("Vào thi khi đang có lần làm (chống chiếm bài, C1)", () => {
  async function startExam(examCode: string, studentCode = "HS001") {
    const client = agent();
    await client.post("/api/student/enter").send({ examCode, studentCode }).expect(200);
    const started = await client.post("/api/student/attempts").expect(201);
    return {
      client,
      attemptId: (started.body as ApiSuccess<{ attemptId: string }>).data.attemptId,
    };
  }

  it("máy khác không cookie vào bằng mã đang làm: 409, phiên cũ vẫn lưu và nộp được, đáp án không lộ", async () => {
    const fixture = await createExamFixture(testApp.db);
    const owner = await startExam(fixture.examCode);
    const question = fixture.questions[1]!;
    await owner.client
      .put(`/api/student/attempts/${owner.attemptId}/answers`)
      .send({ questionId: question.id, optionIds: question.correctIds })
      .expect(200);

    const intruder = agent();
    const denied = await intruder
      .post("/api/student/enter")
      .send({ examCode: fixture.examCode, studentCode: "hs001" });
    expect(denied.status).toBe(409);
    expect(denied.body).toEqual({
      success: false,
      code: "ATTEMPT_IN_PROGRESS",
      error: "Bạn đang làm bài này trên một máy khác. Hãy quay lại máy đó hoặc báo giáo viên.",
    });
    expect(denied.headers["set-cookie"]).toBeUndefined();
    expect((await intruder.get(`/api/student/attempts/${owner.attemptId}`)).status).toBe(401);

    const paper = await owner.client.get(`/api/student/attempts/${owner.attemptId}`).expect(200);
    expect(paper.body.data.answers).toEqual({ [question.id]: question.correctIds });
    const result = await owner.client
      .post(`/api/student/attempts/${owner.attemptId}/submit`)
      .expect(200);
    expect(result.body.data.correct).toBe(1);
  });

  it("vào lại bằng chính cookie đang làm: giữ nguyên phiên, làm tiếp được", async () => {
    const fixture = await createExamFixture(testApp.db);
    const owner = await startExam(fixture.examCode);
    const again = await owner.client
      .post("/api/student/enter")
      .send({ examCode: fixture.examCode, studentCode: "HS001" });
    expect(again.status).toBe(200);
    await owner.client.get(`/api/student/attempts/${owner.attemptId}`).expect(200);
    const sessions = await testApp.db
      .select()
      .from(studentSessions)
      .where(eq(studentSessions.studentId, fixture.studentIds.HS001));
    expect(sessions).toHaveLength(1);
  });

  it("đang làm bài X, vào bài Y: 409, phiên bài X không bị thu hồi", async () => {
    const fixture = await createExamFixture(testApp.db);
    const owner = await startExam(fixture.examCode);
    const examY = await createDispatchedExam(testApp.db, fixture);

    const res = await owner.client
      .post("/api/student/enter")
      .send({ examCode: examY.examCode, studentCode: "HS001" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ATTEMPT_IN_PROGRESS");
    await owner.client.get(`/api/student/attempts/${owner.attemptId}`).expect(200);
    const active = await testApp.db
      .select()
      .from(studentSessions)
      .where(
        and(
          eq(studentSessions.studentId, fixture.studentIds.HS001),
          isNull(studentSessions.revokedAt),
        ),
      );
    expect(active).toHaveLength(1);
  });

  it("hết giờ rồi vào lại không cookie: bài tự nộp, được phiên chỉ-xem, thấy kết quả", async () => {
    const fixture = await createExamFixture(testApp.db);
    const owner = await startExam(fixture.examCode);
    testApp.clock.advance(EXAM_MINUTES * 60_000 + 3_001);

    const later = agent();
    await later
      .post("/api/student/enter")
      .send({ examCode: fixture.examCode, studentCode: "HS001" })
      .expect(200);
    expect(stateOf(await later.get("/api/student/state").expect(200)).phase).toBe("completed");
    const result = await later.get(`/api/student/attempts/${owner.attemptId}/result`).expect(200);
    expect(result.body.data.endReason).toBe("timeout");
    await later.post("/api/student/attempts").expect(401);
  });
});
