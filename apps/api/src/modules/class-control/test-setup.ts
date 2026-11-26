import type { ApiSuccess } from "@quiq/shared/common";
import type { ExamListItem, RosterStatus, RosterView } from "@quiq/shared/exams";
import type { ExamPaperView } from "@quiq/shared/student";
import request from "supertest";
import { expect } from "vitest";
import type { TestApp } from "../../testing/test-app";
import { createTeacherFixture, type TeacherFixture } from "../exams/test-fixtures";

/** Dùng chung cho stream.test.ts và roster-expiry.test.ts (Layer 4). */
export const dataOf = <T>(res: request.Response) => (res.body as ApiSuccess<T>).data;

export interface ClassSetup {
  fixture: TeacherFixture;
  exam: ExamListItem;
  classUrl: (classId: string, action: string) => string;
}

/** Bài thi 15 phút, 4 câu dễ, gán cho 10A1 (HS001, HS002) và 10A2. */
export async function setupExamClass(testApp: TestApp): Promise<ClassSetup> {
  const fixture = await createTeacherFixture(testApp, { easy: 4, medium: 0, hard: 0 });
  const res = await request(testApp.app.callback())
    .post("/api/teacher/exams")
    .set("Cookie", fixture.cookie)
    .send({
      title: "Phòng thi trực tiếp",
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

export async function teacherPost(testApp: TestApp, s: ClassSetup, action: "dispatch" | "close") {
  return request(testApp.app.callback())
    .post(s.classUrl(s.fixture.classId, action))
    .set("Cookie", s.fixture.cookie);
}

export async function fetchRoster(testApp: TestApp, s: ClassSetup): Promise<RosterView> {
  const res = await request(testApp.app.callback())
    .get(s.classUrl(s.fixture.classId, "roster"))
    .set("Cookie", s.fixture.cookie);
  expect(res.status).toBe(200);
  return dataOf<RosterView>(res);
}

/** Vào thi + hỏi trạng thái một lần (ghi "đang chờ"). */
export async function enterStudent(testApp: TestApp, s: ClassSetup, studentCode: string) {
  const student = request.agent(testApp.app.callback());
  const res = await student.post("/api/student/enter").send({ examCode: s.exam.code, studentCode });
  expect(res.status).toBe(200);
  expect((await student.get("/api/student/state")).status).toBe(200);
  return student;
}

export async function startAttempt(student: ReturnType<typeof request.agent>): Promise<string> {
  const res = await student.post("/api/student/attempts");
  expect(res.status).toBe(201);
  return dataOf<ExamPaperView>(res).attemptId;
}

export const statusOf = (view: RosterView, code: string): RosterStatus | undefined =>
  view.students.find((student) => student.code === code)?.status;

export const EXAM_MS = 15 * 60_000;
