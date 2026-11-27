import { attempts, examClasses, examOptions } from "@quiq/db";
import type { ApiFailure } from "@quiq/shared/common";
import type { AttemptAnswersView, ExamPaperView } from "@quiq/shared/student";
import { and, eq, inArray } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../testing/test-app";
import {
  dataOf,
  enterStudent,
  fetchRoster,
  setupExamClass,
  teacherPost,
  type ClassSetup,
} from "../class-control/test-setup";

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.close();
});

type Agent = ReturnType<typeof request.agent>;
const failureOf = (res: request.Response) => res.body as ApiFailure;
const answersOf = (client: Agent, attemptId: string) => client.get(`/api/student/attempts/${attemptId}/answers`);
const publishAnswers = (s: ClassSetup) =>
  request(testApp.app.callback())
    .post(s.classUrl(s.fixture.classId, "publish-answers"))
    .set("Cookie", s.fixture.cookie);

const siblingPost = (s: ClassSetup, action: "dispatch" | "close") =>
  request(testApp.app.callback())
    .post(s.classUrl(s.fixture.otherClassId, action))
    .set("Cookie", s.fixture.cookie);

/** Mọi khóa ở mọi tầng của JSON. */
function allKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) allKeys(item, found);
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      found.push(key);
      allKeys(child, found);
    }
  }
  return found;
}

/** Payload cũ (đề, kết quả, trạng thái, roster) không được mang cờ đáp án đúng, kể cả sau khi công bố. */
function expectNoAnswerKey(body: unknown): void {
  const leaked = allKeys(body).filter((key) => /correct/i.test(key) && key !== "correct");
  expect(leaked).toEqual([]);
}

/** Bài lỗi chỉ được mang thông điệp, không một mẩu nội dung đề nào. */
function expectNoPaperContent(body: unknown, paper: ExamPaperView): void {
  const json = JSON.stringify(body);
  for (const question of paper.questions) {
    expect(json).not.toContain(question.id);
    expect(json).not.toContain(question.content);
    for (const option of question.options) expect(json).not.toContain(option.content);
  }
}

async function startWithPaper(student: Agent): Promise<ExamPaperView> {
  const res = await student.post("/api/student/attempts");
  expect(res.status).toBe(201);
  return dataOf<ExamPaperView>(res);
}

interface ClosedScenario {
  s: ClassSetup;
  /** HS001: đang làm (đã chọn 1 đáp án) thì bị thu bài, end_reason = closed (C-07). */
  hs001: Agent;
  paper: ExamPaperView;
  savedOptionId: string;
  /** HS002: tự nộp trước khi thu bài. */
  hs002: Agent;
  paper2: ExamPaperView;
}

async function closedScenario(): Promise<ClosedScenario> {
  const s = await setupExamClass(testApp);
  expect((await teacherPost(testApp, s, "dispatch")).status).toBe(200);
  const hs001 = await enterStudent(testApp, s, "HS001");
  const paper = await startWithPaper(hs001);
  const question = paper.questions[0]!;
  const savedOptionId = question.options[1]!.id;
  const save = await hs001
    .put(`/api/student/attempts/${paper.attemptId}/answers`)
    .send({ questionId: question.id, optionIds: [savedOptionId] });
  expect(save.status).toBe(200);

  const hs002 = await enterStudent(testApp, s, "HS002");
  const paper2 = await startWithPaper(hs002);
  expect((await hs002.post(`/api/student/attempts/${paper2.attemptId}/submit`)).status).toBe(200);

  // Chưa thu bài: HS001 chưa hoàn thành, HS002 hoàn thành nhưng chưa công bố.
  const unfinished = await answersOf(hs001, paper.attemptId);
  expect(unfinished.status).toBe(409);
  expect(failureOf(unfinished).code).toBe("ATTEMPT_NOT_FINISHED");
  expectNoPaperContent(unfinished.body, paper);

  expect((await teacherPost(testApp, s, "close")).status).toBe(200);
  // Lớp 10A2 cùng bài thi cũng phải thu bài xong thì mới công bố đáp án được (R1).
  expect((await siblingPost(s, "dispatch")).status).toBe(200);
  expect((await siblingPost(s, "close")).status).toBe(200);
  return { s, hs001, paper, savedOptionId, hs002, paper2 };
}

describe("GET /api/student/attempts/:id/answers", () => {
  it("chưa công bố: ANSWERS_NOT_PUBLISHED, không lộ nội dung đề; công bố bảng điểm không mở đáp án", async () => {
    const { s, hs001, paper, hs002, paper2 } = await closedScenario();

    for (const [client, own] of [
      [hs001, paper],
      [hs002, paper2],
    ] as const) {
      const res = await answersOf(client, own.attemptId);
      expect(res.status).toBe(409);
      expect(failureOf(res).code).toBe("ANSWERS_NOT_PUBLISHED");
      expectNoPaperContent(res.body, own);
    }

    const scores = await request(testApp.app.callback())
      .post(s.classUrl(s.fixture.classId, "publish-scores"))
      .set("Cookie", s.fixture.cookie);
    expect(scores.status).toBe(200);
    const stillHidden = await answersOf(hs001, paper.attemptId);
    expect(failureOf(stillHidden).code).toBe("ANSWERS_NOT_PUBLISHED");
    expectNoPaperContent(stillHidden.body, paper);
  });

  it("đã công bố: đúng bộ câu và thứ tự của attempt, cờ đúng khớp DB, không có lựa chọn của học sinh (C-07)", async () => {
    const { s, hs001, paper, savedOptionId } = await closedScenario();
    const [ended] = await testApp.db.select().from(attempts).where(eq(attempts.id, paper.attemptId));
    expect(ended).toMatchObject({ status: "submitted", endReason: "closed" });
    expect((await publishAnswers(s)).status).toBe(200);

    const res = await answersOf(hs001, paper.attemptId);
    expect(res.status).toBe(200);
    const view = dataOf<AttemptAnswersView>(res);
    expect(view.attemptId).toBe(paper.attemptId);
    expect(view.questions.map((q) => q.id)).toEqual(paper.questions.map((q) => q.id));
    view.questions.forEach((question, index) => {
      expect(question.options.map((o) => o.id)).toEqual(paper.questions[index]!.options.map((o) => o.id));
    });

    const optionIds = view.questions.flatMap((q) => q.options.map((o) => o.id));
    const truth = await testApp.db
      .select({ id: examOptions.id, isCorrect: examOptions.isCorrect })
      .from(examOptions)
      .where(inArray(examOptions.id, optionIds));
    const correctById = new Map(truth.map((row) => [row.id, row.isCorrect]));
    for (const option of view.questions.flatMap((q) => q.options)) {
      expect(option.isCorrect).toBe(correctById.get(option.id));
    }

    // FR-047: không có trường lựa chọn nào; đáp án đã chọn chỉ xuất hiện như một phương án bình thường.
    expect(Object.keys(view).sort()).toEqual(["attemptId", "examTitle", "questions"]);
    for (const question of view.questions) {
      expect(Object.keys(question).sort()).toEqual(["content", "id", "multiSelect", "options"]);
      for (const option of question.options) expect(Object.keys(option).sort()).toEqual(["content", "id", "isCorrect"]);
    }
    expect(allKeys(view).filter((key) => /^(answers?|selected\w*|chosen\w*|optionIds)$/i.test(key))).toEqual([]);
    expect(JSON.stringify(view).split(savedOptionId)).toHaveLength(2);
  });

  it("sau công bố, đề/kết quả/trạng thái/roster vẫn không mang cờ đáp án đúng", async () => {
    const { s, hs001, paper } = await closedScenario();
    expect((await publishAnswers(s)).status).toBe(200);
    const result = await hs001.get(`/api/student/attempts/${paper.attemptId}/result`);
    expect(result.status).toBe(200);
    const state = await hs001.get("/api/student/state");
    expect(state.status).toBe(200);
    for (const body of [result.body, state.body, await fetchRoster(testApp, s)]) expectNoAnswerKey(body);
  });

  it("phòng thủ: lớp khác của bài bị mở lại sau khi công bố thì che đáp án; đề của lớp đó không có cờ đúng", async () => {
    const { s, hs001, paper } = await closedScenario();
    expect((await publishAnswers(s)).status).toBe(200);
    expect((await answersOf(hs001, paper.attemptId)).status).toBe(200);

    // Dữ liệu lệch (vd lớp mới mở lại): 10A2 cùng bài thi đang thi trở lại.
    await testApp.db
      .update(examClasses)
      .set({ status: "dispatched", closedAt: null })
      .where(and(eq(examClasses.examId, s.exam.id), eq(examClasses.classId, s.fixture.otherClassId)));
    const hidden = await answersOf(hs001, paper.attemptId);
    expect(hidden.status).toBe(409);
    expect(failureOf(hidden).code).toBe("ANSWERS_NOT_PUBLISHED");
    expectNoPaperContent(hidden.body, paper);

    const hs003 = await enterStudent(testApp, s, "HS003");
    const sibling = await startWithPaper(hs003);
    expectNoAnswerKey(sibling);
    const reopened = await hs003.get(`/api/student/attempts/${sibling.attemptId}`);
    expect(reopened.status).toBe(200);
    expectNoAnswerKey(reopened.body);
  });

  it("attempt của học sinh khác hoặc trường khác: 404; không có phiên: 401", async () => {
    const { s, hs001, paper, hs002, paper2 } = await closedScenario();
    expect((await publishAnswers(s)).status).toBe(200);
    expect((await answersOf(hs001, paper2.attemptId)).status).toBe(404);
    expect((await answersOf(hs002, paper.attemptId)).status).toBe(404);

    const foreign = await setupExamClass(testApp);
    expect((await teacherPost(testApp, foreign, "dispatch")).status).toBe(200);
    const outsider = await enterStudent(testApp, foreign, "HS001");
    const res = await answersOf(outsider, paper.attemptId);
    expect(res.status).toBe(404);
    expectNoPaperContent(res.body, paper);

    const anonymous = await request(testApp.app.callback()).get(`/api/student/attempts/${paper.attemptId}/answers`);
    expect(anonymous.status).toBe(401);
  });
});
