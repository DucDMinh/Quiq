import { exams, schools, sessions } from "@quiq/db";
import { ROSTER_STREAM_EVENT, type RosterView } from "@quiq/shared/exams";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createRealtimeHub } from "../../realtime/hub";
import { connectSse, listenTestServer, waitUntil, type SseClient, type SseEvent, type TestServer } from "../../testing/sse-client";
import { createTestApp, type TestApp } from "../../testing/test-app";
import { createOtherTeacher, createTeacherFixture } from "../exams/test-fixtures";
import {
  EXAM_MS,
  enterStudent,
  fetchRoster,
  setupExamClass,
  startAttempt,
  statusOf,
  teacherPost,
  type ClassSetup,
} from "./test-setup";

/** AC: client nhận roster mới trong <= 1 giây sau mỗi thay đổi. */
const WITHIN_MS = 1000;

const rosterOf = (event: SseEvent): RosterView => JSON.parse(event.data);
const roster = (check: (view: RosterView) => boolean) => (event: SseEvent) =>
  event.event === ROSTER_STREAM_EVENT && check(rosterOf(event));

interface Harness {
  testApp: TestApp;
  server: TestServer;
  clients: SseClient[];
}

/** Mỗi describe một app + server thật; luồng mở trong test được đóng ở afterEach. */
function useHarness(timing: { coalesceMs?: number; refreshMs: number }): Harness {
  const clients: SseClient[] = [];
  let started: { testApp: TestApp; server: TestServer } | null = null;
  const current = () => {
    if (!started) throw new Error("harness chưa khởi động (beforeAll)");
    return started;
  };
  beforeAll(async () => {
    const testApp = await createTestApp({ realtime: createRealtimeHub(timing) });
    started = { testApp, server: await listenTestServer(testApp.app) };
  });
  // Chờ server dọn xong luồng của test trước, để các phép đếm người nghe không chập chờn.
  afterEach(async () => {
    for (const client of clients) client.close();
    clients.length = 0;
    await waitUntil(() => current().testApp.realtime.listenerCount() === 0, WITHIN_MS);
  });
  afterAll(async () => {
    await current().server.close();
    await current().testApp.close();
  });
  return {
    clients,
    get testApp() {
      return current().testApp;
    },
    get server() {
      return current().server;
    },
  };
}

async function openStream(h: Harness, s: ClassSetup, cookie = s.fixture.cookie): Promise<SseClient> {
  const client = await connectSse(h.server.port, s.classUrl(s.fixture.classId, "stream"), cookie);
  h.clients.push(client);
  return client;
}

describe("Luồng SSE phòng thi: kết nối và tín hiệu", () => {
  // Nhịp định kỳ rất dài: mọi sự kiện trong describe này PHẢI đến từ tín hiệu của hub.
  const h = useHarness({ refreshMs: 600_000 });

  it("nhận ngay ảnh chụp giống GET roster, header chống gom; chưa đăng nhập 401; giáo viên khác/trường khác 404", async () => {
    const s = await setupExamClass(h.testApp);
    const stream = await openStream(h, s);
    expect(stream.status).toBe(200);
    expect(stream.headers["content-type"]).toMatch(/^text\/event-stream/);
    expect(stream.headers["cache-control"]).toContain("no-transform");
    expect(stream.headers["x-accel-buffering"]).toBe("no");
    const first = rosterOf(await stream.waitFor(roster(() => true), WITHIN_MS));
    expect(first).toEqual(await fetchRoster(h.testApp, s));
    expect(first.students.every((student) => student.interrupted === false)).toBe(true);

    const anonymous = await connectSse(h.server.port, s.classUrl(s.fixture.classId, "stream"));
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers["content-type"]).toMatch(/json/);
    await anonymous.text();
    const other = await createOtherTeacher(h.testApp, s.fixture);
    const foreign = await createTeacherFixture(h.testApp);
    for (const cookie of [other.cookie, foreign.cookie]) {
      const denied = await connectSse(h.server.port, s.classUrl(s.fixture.classId, "stream"), cookie);
      expect(denied.status).toBe(404);
      await denied.text();
    }
    expect(h.testApp.realtime.listenerCount()).toBe(1);
  });

  it("phát đề, vào phòng chờ, Bắt đầu, nộp, hết giờ, thu bài: mỗi lần nhận roster mới trong 1 giây", async () => {
    const s = await setupExamClass(h.testApp);
    const stream = await openStream(h, s);
    await stream.waitFor(roster((v) => v.examClass.status === "draft"), WITHIN_MS);

    expect((await teacherPost(h.testApp, s, "dispatch")).status).toBe(200);
    await stream.waitFor(roster((v) => v.examClass.status === "dispatched"), WITHIN_MS);

    const first = await enterStudent(h.testApp, s, "HS001");
    await stream.waitFor(roster((v) => statusOf(v, "HS001") === "waiting"), WITHIN_MS);
    const firstAttempt = await startAttempt(first);
    await stream.waitFor(roster((v) => statusOf(v, "HS001") === "in_progress"), WITHIN_MS);
    expect((await first.post(`/api/student/attempts/${firstAttempt}/submit`)).status).toBe(200);
    await stream.waitFor(roster((v) => statusOf(v, "HS001") === "submitted"), WITHIN_MS);

    const second = await enterStudent(h.testApp, s, "HS002");
    await startAttempt(second);
    await stream.waitFor(roster((v) => statusOf(v, "HS002") === "in_progress"), WITHIN_MS);
    // Hết giờ: lần hỏi trạng thái kế tiếp của học sinh tự nộp bài (kiểm lười), phòng thi thấy ngay.
    h.testApp.clock.advance(EXAM_MS + 4_000);
    expect((await second.get("/api/student/state")).status).toBe(200);
    await stream.waitFor(roster((v) => statusOf(v, "HS002") === "submitted"), WITHIN_MS);

    expect((await teacherPost(h.testApp, s, "close")).status).toBe(200);
    await stream.waitFor(roster((v) => v.examClass.status === "closed"), WITHIN_MS);
  });

  it("G-12: GET roster của giáo viên tự nộp bài quá hạn thì luồng nhận roster mới trong 1 giây", async () => {
    const s = await setupExamClass(h.testApp);
    expect((await teacherPost(h.testApp, s, "dispatch")).status).toBe(200);
    await startAttempt(await enterStudent(h.testApp, s, "HS001"));
    const stream = await openStream(h, s);
    await stream.waitFor(roster((v) => statusOf(v, "HS001") === "in_progress"), WITHIN_MS);

    h.testApp.clock.advance(EXAM_MS + 4_000);
    expect(statusOf(await fetchRoster(h.testApp, s), "HS001")).toBe("submitted");
    await stream.waitFor(roster((v) => statusOf(v, "HS001") === "submitted"), WITHIN_MS);
  });
});

describe("Luồng SSE phòng thi: phiên và lỗi sau khi đã kết nối", () => {
  const h = useHarness({ coalesceMs: 20, refreshMs: 100 });

  async function connectedStream(): Promise<{ s: ClassSetup; stream: SseClient }> {
    const s = await setupExamClass(h.testApp);
    const stream = await openStream(h, s);
    await stream.waitFor(roster(() => true), WITHIN_MS);
    expect(h.testApp.realtime.listenerCount()).toBe(1);
    return { s, stream };
  }

  async function expectClosedCleanly(stream: SseClient) {
    await waitUntil(() => stream.ended(), WITHIN_MS);
    await waitUntil(() => h.testApp.realtime.listenerCount() === 0, WITHIN_MS);
  }

  it("phiên bị thu hồi (đăng xuất ở tab khác): luồng đóng trong khoảng một nhịp, gỡ người nghe", async () => {
    const { s, stream } = await connectedStream();
    await h.testApp.db
      .update(sessions)
      .set({ revokedAt: h.testApp.clock.now() })
      .where(eq(sessions.staffId, s.fixture.teacherId));
    await expectClosedCleanly(stream);
  });

  it("trường bị khóa: luồng đóng", async () => {
    const { s, stream } = await connectedStream();
    await h.testApp.db.update(schools).set({ status: "locked" }).where(eq(schools.id, s.fixture.schoolId));
    await expectClosedCleanly(stream);
  });

  it("phiên quá 8 giờ không hoạt động: luồng đóng, và luồng mở KHÔNG tự gia hạn phiên", async () => {
    const { stream } = await connectedStream();
    h.testApp.clock.advance(8 * 60 * 60_000 + 1_000);
    await expectClosedCleanly(stream);
  });

  it("getRoster ném lỗi khi đẩy (bài chuyển cho giáo viên khác): luồng đóng sạch, gỡ người nghe", async () => {
    const { s, stream } = await connectedStream();
    const other = await createOtherTeacher(h.testApp, s.fixture);
    await h.testApp.db.update(exams).set({ teacherId: other.staffId }).where(eq(exams.id, s.exam.id));
    await expectClosedCleanly(stream);
  });
});

describe("Luồng SSE phòng thi: nhịp định kỳ và dọn dẹp", () => {
  const REFRESH_MS = 100;
  const h = useHarness({ coalesceMs: 20, refreshMs: REFRESH_MS });

  it("presence quá 15 giây: học sinh rời Đang chờ ở lần tính lại định kỳ, kèm keepalive", async () => {
    const s = await setupExamClass(h.testApp);
    expect((await teacherPost(h.testApp, s, "dispatch")).status).toBe(200);
    await enterStudent(h.testApp, s, "HS001");
    const stream = await openStream(h, s);
    await stream.waitFor(roster((v) => statusOf(v, "HS001") === "waiting"), WITHIN_MS);

    h.testApp.clock.advance(16_000);
    await stream.waitFor(roster((v) => statusOf(v, "HS001") === "not_started"), WITHIN_MS);
    expect(stream.comments).toContain("keepalive");
  });

  it("đóng kết nối: hub gỡ người nghe và interval của kết nối bị xoá", async () => {
    const setSpy = vi.spyOn(globalThis, "setInterval");
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    try {
      const s = await setupExamClass(h.testApp);
      const stream = await openStream(h, s);
      await stream.waitFor(roster(() => true), WITHIN_MS);
      expect(h.testApp.realtime.listenerCount()).toBe(1);
      const index = setSpy.mock.calls.findIndex(([, ms]) => ms === REFRESH_MS);
      expect(index).toBeGreaterThanOrEqual(0);
      const handle: unknown = setSpy.mock.results[index]?.value;

      stream.close();
      await waitUntil(() => h.testApp.realtime.listenerCount() === 0, WITHIN_MS);
      await waitUntil(() => clearSpy.mock.calls.some(([cleared]) => cleared === handle), WITHIN_MS);
    } finally {
      setSpy.mockRestore();
      clearSpy.mockRestore();
    }
  });
});

describe("Luồng SSE phòng thi: công bố", () => {
  const h = useHarness({ refreshMs: 600_000 });

  it("công bố đáp án: roster mới mang mốc công bố trong 1 giây và không có cờ đáp án đúng nào", async () => {
    const s = await setupExamClass(h.testApp);
    const post = (classId: string, action: string) =>
      request(h.testApp.app.callback()).post(s.classUrl(classId, action)).set("Cookie", s.fixture.cookie);
    for (const classId of [s.fixture.classId, s.fixture.otherClassId]) {
      expect((await post(classId, "dispatch")).status).toBe(200);
      expect((await post(classId, "close")).status).toBe(200);
    }
    const stream = await openStream(h, s);
    await stream.waitFor(roster((v) => v.examClass.status === "closed"), WITHIN_MS);

    expect((await post(s.fixture.classId, "publish-answers")).status).toBe(200);
    const event = await stream.waitFor(roster((v) => v.examClass.answersPublishedAt !== null), WITHIN_MS);
    expect(event.data).not.toMatch(/correct/i);
  });
});
