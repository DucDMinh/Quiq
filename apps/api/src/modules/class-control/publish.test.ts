import { examClasses } from "@quiq/db";
import type { ApiFailure } from "@quiq/shared/common";
import type { ExamClassState } from "@quiq/shared/exams";
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestApp, type TestApp } from "../../testing/test-app";
import { createOtherTeacher, createTeacherFixture } from "../exams/test-fixtures";
import {
  dataOf,
  enterStudent,
  fetchRoster,
  setupExamClass,
  startAttempt,
  teacherPost,
  type ClassSetup,
} from "./test-setup";

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.close();
});

const http = () => request(testApp.app.callback());
const failureOf = (res: request.Response) => res.body as ApiFailure;

type PublishAction = "publish-answers" | "publish-scores";

const publish = (s: ClassSetup, action: PublishAction, cookie = s.fixture.cookie) =>
  http().post(s.classUrl(s.fixture.classId, action)).set("Cookie", cookie);

async function publishedColumns(s: ClassSetup) {
  const [row] = await testApp.db
    .select({ answers: examClasses.answersPublishedAt, scores: examClasses.scoresPublishedAt })
    .from(examClasses)
    .where(and(eq(examClasses.examId, s.exam.id), eq(examClasses.classId, s.fixture.classId)));
  return row!;
}

/** Phát đề / thu bài lớp bất kỳ của bài thi (setup có 10A1 = classId và 10A2 = otherClassId). */
const classPost = (s: ClassSetup, classId: string, action: "dispatch" | "close" | PublishAction) =>
  http().post(s.classUrl(classId, action)).set("Cookie", s.fixture.cookie);

async function dispatchAndClose(s: ClassSetup, classId: string) {
  expect((await classPost(s, classId, "dispatch")).status).toBe(200);
  expect((await classPost(s, classId, "close")).status).toBe(200);
}

/** Cả hai lớp của bài thi đã thu bài xong (điều kiện để công bố đáp án). */
async function closedClass(): Promise<ClassSetup> {
  const s = await setupExamClass(testApp);
  await dispatchAndClose(s, s.fixture.classId);
  await dispatchAndClose(s, s.fixture.otherClassId);
  return s;
}

describe("Công bố đáp án / bảng điểm", () => {
  it("lớp nháp hoặc đang thi: 409 CLASS_NOT_CLOSED, DB không đổi", async () => {
    const s = await setupExamClass(testApp);
    for (const action of ["publish-answers", "publish-scores"] as const) {
      const draft = await publish(s, action);
      expect(draft.status).toBe(409);
      expect(failureOf(draft).code).toBe("CLASS_NOT_CLOSED");
    }
    expect((await teacherPost(testApp, s, "dispatch")).status).toBe(200);
    for (const action of ["publish-answers", "publish-scores"] as const) {
      const dispatched = await publish(s, action);
      expect(dispatched.status).toBe(409);
      expect(failureOf(dispatched).code).toBe("CLASS_NOT_CLOSED");
    }
    expect(await publishedColumns(s)).toEqual({ answers: null, scores: null });
  });

  it("lớp đã thu bài: ghi mốc, trả state mới; bấm lại giữ mốc cũ; hai thao tác độc lập (BR-010)", async () => {
    const s = await closedClass();
    const publishedAt = testApp.clock.now().toISOString();

    const first = await publish(s, "publish-answers");
    expect(first.status).toBe(200);
    expect(dataOf<ExamClassState>(first)).toMatchObject({
      status: "closed",
      answersPublishedAt: publishedAt,
      scoresPublishedAt: null,
    });
    expect((await publishedColumns(s)).scores).toBeNull();

    testApp.clock.advance(60_000);
    const again = await publish(s, "publish-answers");
    expect(again.status).toBe(200);
    expect(dataOf<ExamClassState>(again).answersPublishedAt).toBe(publishedAt);
    expect((await publishedColumns(s)).answers?.toISOString()).toBe(publishedAt);

    const scores = await publish(s, "publish-scores");
    expect(scores.status).toBe(200);
    const scoresAt = testApp.clock.now().toISOString();
    expect(dataOf<ExamClassState>(scores)).toMatchObject({
      answersPublishedAt: publishedAt,
      scoresPublishedAt: scoresAt,
    });
    testApp.clock.advance(60_000);
    expect(dataOf<ExamClassState>(await publish(s, "publish-scores")).scoresPublishedAt).toBe(scoresAt);

    // Roster (và luồng SSE dùng chung nó) mang hai mốc để web hiện badge "Đã công bố".
    expect((await fetchRoster(testApp, s)).examClass).toMatchObject({
      answersPublishedAt: publishedAt,
      scoresPublishedAt: scoresAt,
    });
  });

  it("lớp đã closed nhưng thu bài lỗi giữa chừng (còn bài đang làm): 409, thu bài lại xong mới công bố được", async () => {
    const s = await setupExamClass(testApp);
    expect((await teacherPost(testApp, s, "dispatch")).status).toBe(200);
    const working = await enterStudent(testApp, s, "HS001");
    expect((await working.post("/api/student/attempts")).status).toBe(201);
    // Mô phỏng: bước đóng lớp đã commit, bước nộp bài đang làm chưa chạy.
    await testApp.db
      .update(examClasses)
      .set({ status: "closed", closedAt: testApp.clock.now() })
      .where(and(eq(examClasses.examId, s.exam.id), eq(examClasses.classId, s.fixture.classId)));

    for (const action of ["publish-answers", "publish-scores"] as const) {
      const res = await publish(s, action);
      expect(res.status).toBe(409);
      expect(failureOf(res).code).toBe("CLASS_NOT_CLOSED");
    }
    expect(await publishedColumns(s)).toEqual({ answers: null, scores: null });

    expect((await teacherPost(testApp, s, "close")).status).toBe(200);
    await dispatchAndClose(s, s.fixture.otherClassId);
    expect((await publish(s, "publish-answers")).status).toBe(200);
  });

  it("công bố bảng điểm không công bố đáp án", async () => {
    const s = await closedClass();
    expect((await publish(s, "publish-scores")).status).toBe(200);
    const columns = await publishedColumns(s);
    expect(columns.answers).toBeNull();
    expect(columns.scores).toBeInstanceOf(Date);
  });

  it("phát tín hiệu realtime khi công bố lần đầu, bấm lại thì không", async () => {
    const s = await closedClass();
    const publishSpy = vi.spyOn(testApp.realtime, "publish");
    try {
      expect((await publish(s, "publish-answers")).status).toBe(200);
      expect(publishSpy).toHaveBeenCalledWith(await examClassIdOf(s));
      publishSpy.mockClear();
      expect((await publish(s, "publish-answers")).status).toBe(200);
      expect(publishSpy).not.toHaveBeenCalled();
    } finally {
      publishSpy.mockRestore();
    }
  });
});

async function examClassIdOf(s: ClassSetup): Promise<string> {
  const [row] = await testApp.db
    .select({ id: examClasses.id })
    .from(examClasses)
    .where(and(eq(examClasses.examId, s.exam.id), eq(examClasses.classId, s.fixture.classId)));
  return row!.id;
}

describe("Đáp án chéo lớp cùng bài thi (R1)", () => {
  it("A đã thu bài, B đang thi: đáp án 409 OTHER_CLASSES_NOT_CLOSED, bảng điểm vẫn được, học sinh A không thấy đáp án; thu bài B xong thì được", async () => {
    const s = await setupExamClass(testApp);
    expect((await classPost(s, s.fixture.classId, "dispatch")).status).toBe(200);
    const hs001 = await enterStudent(testApp, s, "HS001");
    const attemptId = await startAttempt(hs001);
    expect((await hs001.post(`/api/student/attempts/${attemptId}/submit`)).status).toBe(200);
    expect((await classPost(s, s.fixture.classId, "close")).status).toBe(200);
    expect((await classPost(s, s.fixture.otherClassId, "dispatch")).status).toBe(200);

    const denied = await publish(s, "publish-answers");
    expect(denied.status).toBe(409);
    expect(failureOf(denied).code).toBe("OTHER_CLASSES_NOT_CLOSED");
    expect((await publishedColumns(s)).answers).toBeNull();
    expect((await fetchRoster(testApp, s)).examClass.otherClassesOpen).toBe(true);
    expect((await publish(s, "publish-scores")).status).toBe(200);
    const hidden = await hs001.get(`/api/student/attempts/${attemptId}/answers`);
    expect(hidden.status).toBe(409);
    expect(failureOf(hidden).code).toBe("ANSWERS_NOT_PUBLISHED");
    expect(JSON.stringify(hidden.body)).not.toContain("Ngân hàng");

    expect((await classPost(s, s.fixture.otherClassId, "close")).status).toBe(200);
    expect((await fetchRoster(testApp, s)).examClass.otherClassesOpen).toBe(false);
    expect((await publish(s, "publish-answers")).status).toBe(200);
    expect((await hs001.get(`/api/student/attempts/${attemptId}/answers`)).status).toBe(200);
  });

  it("lớp B chưa phát đề, hoặc B đã đóng nhưng còn bài đang làm: công bố đáp án cho A bị chặn", async () => {
    const s = await setupExamClass(testApp);
    await dispatchAndClose(s, s.fixture.classId);
    const draftSibling = await publish(s, "publish-answers");
    expect(draftSibling.status).toBe(409);
    expect(failureOf(draftSibling).code).toBe("OTHER_CLASSES_NOT_CLOSED");

    expect((await classPost(s, s.fixture.otherClassId, "dispatch")).status).toBe(200);
    const hs003 = await enterStudent(testApp, s, "HS003");
    await startAttempt(hs003);
    // Thu bài B lỗi giữa chừng: B đã closed nhưng HS003 vẫn đang làm.
    await testApp.db
      .update(examClasses)
      .set({ status: "closed", closedAt: testApp.clock.now() })
      .where(and(eq(examClasses.examId, s.exam.id), eq(examClasses.classId, s.fixture.otherClassId)));
    const runningSibling = await publish(s, "publish-answers");
    expect(runningSibling.status).toBe(409);
    expect(failureOf(runningSibling).code).toBe("OTHER_CLASSES_NOT_CLOSED");
    expect(await publishedColumns(s)).toEqual({ answers: null, scores: null });

    expect((await classPost(s, s.fixture.otherClassId, "close")).status).toBe(200);
    expect((await publish(s, "publish-answers")).status).toBe(200);
  });

  it("hai lần công bố đồng thời: cùng một mốc, realtime phát đúng một lần", async () => {
    const s = await closedClass();
    const publishSpy = vi.spyOn(testApp.realtime, "publish");
    try {
      const results = await Promise.all([publish(s, "publish-answers"), publish(s, "publish-answers")]);
      expect(results.map((res) => res.status)).toEqual([200, 200]);
      const stamps = results.map((res) => dataOf<ExamClassState>(res).answersPublishedAt);
      expect(stamps[0]).not.toBeNull();
      expect(stamps[1]).toBe(stamps[0]);
      expect(publishSpy).toHaveBeenCalledTimes(1);
    } finally {
      publishSpy.mockRestore();
    }
  });
});

describe("Phân quyền và cô lập", () => {
  it("giáo viên khác cùng trường, trường khác: 404; chưa đăng nhập, phiên học sinh: 401", async () => {
    const s = await closedClass();
    const other = await createOtherTeacher(testApp, s.fixture);
    const foreign = await createTeacherFixture(testApp);
    for (const action of ["publish-answers", "publish-scores"] as const) {
      for (const cookie of [other.cookie, foreign.cookie]) {
        expect((await publish(s, action, cookie)).status).toBe(404);
      }
      expect((await http().post(s.classUrl(s.fixture.classId, action))).status).toBe(401);
    }

    const s2 = await setupExamClass(testApp);
    expect((await teacherPost(testApp, s2, "dispatch")).status).toBe(200);
    const student = await enterStudent(testApp, s2, "HS001");
    expect((await student.post(s2.classUrl(s2.fixture.classId, "publish-answers"))).status).toBe(401);

    expect(await publishedColumns(s)).toEqual({ answers: null, scores: null });
  });
});
