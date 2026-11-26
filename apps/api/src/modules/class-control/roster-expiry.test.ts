import { attempts } from "@quiq/db";
import type { CloseClassResult } from "@quiq/shared/exams";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../testing/test-app";
import {
  EXAM_MS,
  dataOf,
  enterStudent,
  fetchRoster,
  setupExamClass,
  startAttempt,
  statusOf,
  teacherPost,
} from "./test-setup";

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.close();
});

async function attemptRow(attemptId: string) {
  const [row] = await testApp.db.select().from(attempts).where(eq(attempts.id, attemptId));
  return row;
}

describe("G-12: hết giờ trên bảng trạng thái và khi thu bài", () => {
  it("roster: trong dung sai 3 giây vẫn Đang làm; quá ends_at + 3s thì nộp với endReason=timeout", async () => {
    const s = await setupExamClass(testApp);
    expect((await teacherPost(testApp, s, "dispatch")).status).toBe(200);
    const attemptId = await startAttempt(await enterStudent(testApp, s, "HS001"));

    testApp.clock.advance(EXAM_MS + 2_000);
    expect(statusOf(await fetchRoster(testApp, s), "HS001")).toBe("in_progress");
    expect(await attemptRow(attemptId)).toMatchObject({ status: "in_progress" });

    testApp.clock.advance(2_000);
    const view = await fetchRoster(testApp, s);
    expect(statusOf(view, "HS001")).toBe("submitted");
    expect(view.counts.in_progress).toBe(0);
    expect(await attemptRow(attemptId)).toMatchObject({ status: "submitted", endReason: "timeout" });
  });

  it("thu bài: bài đã quá hạn kết thúc timeout, bài còn giờ kết thúc closed", async () => {
    const s = await setupExamClass(testApp);
    expect((await teacherPost(testApp, s, "dispatch")).status).toBe(200);
    const overdue = await startAttempt(await enterStudent(testApp, s, "HS001"));
    testApp.clock.advance(10 * 60_000);
    const running = await startAttempt(await enterStudent(testApp, s, "HS002"));

    // HS001 đã quá ends_at + 3s, HS002 còn khoảng 10 phút; không request nào kiểm lười trước khi thu bài.
    testApp.clock.advance(5 * 60_000 + 4_000);
    const res = await teacherPost(testApp, s, "close");
    expect(res.status).toBe(200);
    expect(dataOf<CloseClassResult>(res).finalizedAttempts).toBe(2);
    expect(await attemptRow(overdue)).toMatchObject({ status: "submitted", endReason: "timeout" });
    expect(await attemptRow(running)).toMatchObject({ status: "submitted", endReason: "closed" });
  });
});
