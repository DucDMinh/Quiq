import { attempts, studentSessions } from "@quiq/db";
import type { ApiSuccess } from "@quiq/shared/common";
import type { AttemptResultView, ExamPaperView, StudentStateView } from "@quiq/shared/student";
import { and, eq, isNull } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../testing/test-app";
import { isUniqueViolation } from "../student/errors";
import {
  createDispatchedExam,
  createExamFixture,
  EXAM_MINUTES,
  type ExamFixture,
  type FixtureQuestion,
} from "../student/test-fixtures";

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.close();
});

type Agent = ReturnType<typeof request.agent>;
const dataOf = <T>(res: request.Response) => (res.body as ApiSuccess<T>).data;

async function enter(fixture: ExamFixture, studentCode = "HS001"): Promise<Agent> {
  const client = request.agent(testApp.app.callback());
  await client
    .post("/api/student/enter")
    .send({ examCode: fixture.examCode, studentCode })
    .expect(200);
  return client;
}

async function enterAndStart(fixture: ExamFixture, studentCode = "HS001") {
  const client = await enter(fixture, studentCode);
  const res = await client.post("/api/student/attempts").expect(201);
  return { client, paper: dataOf<ExamPaperView>(res) };
}

/** Mọi khóa ở mọi tầng của JSON, để chứng minh không có trường đáp án đúng nào bị lộ. */
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

function expectNoAnswerKey(body: unknown): void {
  const leaked = allKeys(body).filter((key) => /correct/i.test(key) && key !== "correct");
  expect(leaked).toEqual([]);
  expect(JSON.stringify(body)).not.toMatch(/is_?correct/i);
}

const answer = (client: Agent, attemptId: string, questionId: string, optionIds: string[]) =>
  client.put(`/api/student/attempts/${attemptId}/answers`).send({ questionId, optionIds });

describe("POST /api/student/attempts (Bắt đầu)", () => {
  it("tạo attempt in_progress, ends_at = giờ máy chủ + số phút, đề không có is_correct", async () => {
    const fixture = await createExamFixture(testApp.db);
    const { client, paper } = await enterAndStart(fixture);
    const now = testApp.clock.now().getTime();

    expect(paper.endsAt).toBe(new Date(now + EXAM_MINUTES * 60_000).toISOString());
    expect(paper.serverNow).toBe(new Date(now).toISOString());
    expect(paper.questions).toHaveLength(fixture.questions.length);
    for (const question of paper.questions)
      expect(Object.keys(question.options[0]!).sort()).toEqual(["content", "id"]);

    const reloaded = await client.get(`/api/student/attempts/${paper.attemptId}`).expect(200);
    const state = await client.get("/api/student/state").expect(200);
    expect(dataOf<StudentStateView>(state).phase).toBe("in_progress");
    for (const body of [paper, reloaded.body, state.body]) expectNoAnswerKey(body);
  });

  it("hai học sinh có thứ tự câu/đáp án khác nhau và không ảnh hưởng nhau", async () => {
    const fixture = await createExamFixture(testApp.db);
    const first = await enterAndStart(fixture, "HS001");
    const second = await enterAndStart(fixture, "HS002");
    const layout = (paper: ExamPaperView) =>
      paper.questions.map((q) => [q.id, ...q.options.map((o) => o.id)].join());

    expect(layout(first.paper)).not.toEqual(layout(second.paper));
    const question = fixture.questions[1]!;
    await answer(first.client, first.paper.attemptId, question.id, [
      question.correctIds[0]!,
    ]).expect(200);
    const secondReload = await second.client
      .get(`/api/student/attempts/${second.paper.attemptId}`)
      .expect(200);
    expect(dataOf<ExamPaperView>(secondReload).answers).toEqual({});
    // Không xem/sửa được attempt của người khác.
    await first.client.get(`/api/student/attempts/${second.paper.attemptId}`).expect(404);
    await answer(first.client, second.paper.attemptId, question.id, []).expect(404);
  });

  it("lớp chưa phát đề vào phòng chờ được nhưng không bắt đầu được; lớp đã thu bài cũng không", async () => {
    const draft = await createExamFixture(testApp.db, { classStatus: "draft" });
    const waiting = await enter(draft);
    const denied = await waiting.post("/api/student/attempts");
    expect(denied.status).toBe(409);
    expect(denied.body.code).toBe("EXAM_NOT_DISPATCHED");

    const closed = await createExamFixture(testApp.db, { classStatus: "closed" });
    const late = await enter(closed);
    const res = await late.post("/api/student/attempts");
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EXAM_CLOSED");
  });

  it("hai request Bắt đầu đồng thời: đúng một thành công, DB chỉ có một attempt", async () => {
    const fixture = await createExamFixture(testApp.db);
    const client = await enter(fixture);
    const results = await Promise.all([
      client.post("/api/student/attempts"),
      client.post("/api/student/attempts"),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    const rows = await testApp.db
      .select()
      .from(attempts)
      .where(eq(attempts.studentId, fixture.studentIds.HS001));
    expect(rows).toHaveLength(1);
  });

  it("DB từ chối hàng in_progress thứ hai của cùng học sinh", async () => {
    const fixture = await createExamFixture(testApp.db);
    await enterAndStart(fixture);
    const now = testApp.clock.now();
    const second = testApp.db.insert(attempts).values({
      schoolId: fixture.schoolId,
      examClassId: fixture.examClassId,
      studentId: fixture.studentIds.HS001,
      attemptNo: 2,
      status: "in_progress",
      startedAt: now,
      endsAt: now,
    });
    const error = await second.then(
      () => null,
      (cause: unknown) => cause,
    );
    // Chính chỉ mục duy nhất từng phần attempts_one_in_progress_key từ chối, không phải lỗi khác.
    expect(isUniqueViolation(error)).toBe(true);
  });
});

describe("PUT /api/student/attempts/:id/answers", () => {
  it("lưu mỗi lần chọn, đổi đáp án ghi đè, mở lại đề thấy lựa chọn đã lưu", async () => {
    const fixture = await createExamFixture(testApp.db);
    const { client, paper } = await enterAndStart(fixture);
    const [multi, single] = [fixture.questions[0]!, fixture.questions[1]!];

    await answer(client, paper.attemptId, single.id, [single.wrongIds[0]!]).expect(200);
    const changed = await answer(client, paper.attemptId, single.id, [
      single.correctIds[0]!,
    ]).expect(200);
    expect(dataOf(changed)).toEqual({
      questionId: single.id,
      optionIds: [single.correctIds[0]],
      serverNow: expect.any(String),
    });
    await answer(client, paper.attemptId, multi.id, multi.correctIds).expect(200);

    const reloaded = dataOf<ExamPaperView>(
      await client.get(`/api/student/attempts/${paper.attemptId}`).expect(200),
    );
    expect(reloaded.answers).toEqual({
      [single.id]: [single.correctIds[0]],
      [multi.id]: multi.correctIds,
    });
    await answer(client, paper.attemptId, multi.id, []).expect(200);
  });

  it("từ chối câu của đề khác, đáp án của câu khác, chọn 2 ở câu chọn 1, đáp án trùng, id sai định dạng", async () => {
    const fixture = await createExamFixture(testApp.db);
    const other = await createExamFixture(testApp.db);
    const { client, paper } = await enterAndStart(fixture);
    const [multi, single, next] = [
      fixture.questions[0]!,
      fixture.questions[1]!,
      fixture.questions[2]!,
    ];
    const foreign = other.questions[1]!;

    const invalid: Array<[string, string[]]> = [
      [foreign.id, [foreign.correctIds[0]!]],
      [single.id, [next.correctIds[0]!]],
      [single.id, [single.correctIds[0]!, single.wrongIds[0]!]],
      [multi.id, [multi.correctIds[0]!, multi.correctIds[0]!]],
    ];
    for (const [questionId, optionIds] of invalid) {
      const res = await answer(client, paper.attemptId, questionId, optionIds);
      expect(res.status, JSON.stringify(optionIds)).toBe(422);
    }
    expect((await answer(client, "khong-phai-uuid", single.id, [])).status).toBe(422);
    expect((await answer(client, paper.attemptId, "x", [])).status).toBe(422);
  });
});

function answerSome(client: Agent, attemptId: string, questions: FixtureQuestion[]) {
  const [q0, q1, q2, q3, q4] = questions as [
    FixtureQuestion,
    FixtureQuestion,
    FixtureQuestion,
    FixtureQuestion,
    FixtureQuestion,
  ];
  // Đúng: q0 (chọn nhiều, đủ 2), q1, q3. Sai: q2. Đúng một phần: q4. Bỏ trống: q5..q7. => 3/8 = 3.75
  return Promise.all([
    answer(client, attemptId, q0.id, q0.correctIds).expect(200),
    answer(client, attemptId, q1.id, q1.correctIds).expect(200),
    answer(client, attemptId, q2.id, [q2.wrongIds[0]!]).expect(200),
    answer(client, attemptId, q3.id, q3.correctIds).expect(200),
    answer(client, attemptId, q4.id, [q4.correctIds[0]!]).expect(200),
  ]);
}

describe("Nộp bài và kết quả", () => {
  it("chấm theo engine (một phần = sai, trống = sai), nộp lần hai không đổi điểm, không làm lại được", async () => {
    const fixture = await createExamFixture(testApp.db);
    const { client, paper } = await enterAndStart(fixture);
    await answerSome(client, paper.attemptId, fixture.questions);

    const submitted = await client
      .post(`/api/student/attempts/${paper.attemptId}/submit`)
      .expect(200);
    const result = dataOf<AttemptResultView>(submitted);
    expect(result).toMatchObject({
      score: 3.75,
      correct: 3,
      total: 8,
      endReason: "submitted",
      attemptNo: 1,
    });
    expect(Object.keys(result).sort()).toEqual([
      "attemptId",
      "attemptNo",
      "correct",
      "endReason",
      "examCode",
      "examTitle",
      "maxAttempts",
      "score",
      "student",
      "total",
    ]);
    const again = await client.post(`/api/student/attempts/${paper.attemptId}/submit`).expect(200);
    expect(dataOf<AttemptResultView>(again).score).toBe(3.75);

    const viewed = await client.get(`/api/student/attempts/${paper.attemptId}/result`).expect(200);
    expect(dataOf(viewed)).toEqual(result);
    const optionIds = fixture.questions.flatMap((q) => [...q.correctIds, ...q.wrongIds]);
    for (const body of [submitted.body, viewed.body]) {
      expectNoAnswerKey(body);
      for (const id of optionIds) expect(JSON.stringify(body)).not.toContain(id);
    }

    // Phiên đã bị thu hồi khi nộp: không bắt đầu/lưu được nữa, nhưng vẫn xem trạng thái.
    await client.post("/api/student/attempts").expect(401);
    expect(dataOf<StudentStateView>(await client.get("/api/student/state").expect(200)).phase).toBe(
      "completed",
    );
    // Vào lại sau khi đã nộp: phiên mới chỉ để xem (không giữ mã), vẫn không bắt đầu được.
    const reentered = await enter(fixture);
    expect(
      dataOf<StudentStateView>(await reentered.get("/api/student/state").expect(200)).phase,
    ).toBe("completed");
    await reentered.post("/api/student/attempts").expect(401);
    const rows = await testApp.db
      .select()
      .from(attempts)
      .where(eq(attempts.studentId, fixture.studentIds.HS001));
    expect(rows).toHaveLength(1);
  });

  it("nộp xong thì nhả mã: phiên bị thu hồi, vào bài thi khác của cùng lớp bình thường", async () => {
    const fixture = await createExamFixture(testApp.db);
    const { client, paper } = await enterAndStart(fixture);
    await client.post(`/api/student/attempts/${paper.attemptId}/submit`).expect(200);

    const active = () =>
      testApp.db
        .select()
        .from(studentSessions)
        .where(
          and(
            eq(studentSessions.studentId, fixture.studentIds.HS001),
            isNull(studentSessions.revokedAt),
          ),
        );
    expect(await active()).toHaveLength(0);

    const nextExam = await createDispatchedExam(testApp.db, fixture);
    const next = await enter({ ...fixture, ...nextExam });
    expect(dataOf<StudentStateView>(await next.get("/api/student/state").expect(200)).phase).toBe(
      "can_start",
    );
    await next.post("/api/student/attempts").expect(201);
    expect(await active()).toHaveLength(1);
    // Cookie cũ vẫn xem được kết quả của lần đã nộp.
    await client.get(`/api/student/attempts/${paper.attemptId}/result`).expect(200);
  });
});

describe("Hết giờ (kiểm lười theo giờ máy chủ)", () => {
  it("đúng ends_at + 3 giây còn lưu được; quá 1ms thì tự nộp theo câu đã lưu và từ chối", async () => {
    const fixture = await createExamFixture(testApp.db);
    const { client, paper } = await enterAndStart(fixture);
    const [q1, q2] = [fixture.questions[1]!, fixture.questions[2]!];
    await answer(client, paper.attemptId, q1.id, q1.correctIds).expect(200);

    testApp.clock.advance(EXAM_MINUTES * 60_000 + 3_000);
    await answer(client, paper.attemptId, q2.id, q2.correctIds).expect(200);
    testApp.clock.advance(1);
    const late = await answer(client, paper.attemptId, q1.id, [q1.wrongIds[0]!]);
    expect(late.status).toBe(409);
    expect(late.body.code).toBe("ATTEMPT_ENDED");

    const [row] = await testApp.db.select().from(attempts).where(eq(attempts.id, paper.attemptId));
    expect(row).toMatchObject({ status: "submitted", endReason: "timeout", score: 2.5 });
    const result = await client.get(`/api/student/attempts/${paper.attemptId}/result`).expect(200);
    expect(dataOf<AttemptResultView>(result)).toMatchObject({
      endReason: "timeout",
      correct: 2,
      score: 2.5,
    });
  });

  it("hỏi trạng thái sau hạn thì bài tự nộp, pha completed; nộp trong dung sai ghi lý do hết giờ", async () => {
    const fixture = await createExamFixture(testApp.db);
    const lazy = await enterAndStart(fixture, "HS001");
    const grace = await enterAndStart(fixture, "HS002");

    testApp.clock.advance(EXAM_MINUTES * 60_000 + 1_000);
    const submitted = await grace.client
      .post(`/api/student/attempts/${grace.paper.attemptId}/submit`)
      .expect(200);
    expect(dataOf<AttemptResultView>(submitted).endReason).toBe("timeout");

    testApp.clock.advance(2_001);
    const state = dataOf<StudentStateView>(await lazy.client.get("/api/student/state").expect(200));
    expect(state.phase).toBe("completed");
    // Bài đã tự nộp nên phiên chỉ còn quyền xem: mở lại đề bị từ chối, xem kết quả được.
    await lazy.client.get(`/api/student/attempts/${lazy.paper.attemptId}`).expect(401);
    const result = await lazy.client
      .get(`/api/student/attempts/${lazy.paper.attemptId}/result`)
      .expect(200);
    expect(dataOf<AttemptResultView>(result)).toMatchObject({
      endReason: "timeout",
      score: 0,
      correct: 0,
    });
  });
});
