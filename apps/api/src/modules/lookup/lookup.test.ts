import { attempts, schools } from "@quiq/db";
import type { ApiSuccess } from "@quiq/shared/common";
import type { LookupResult, LookupSchool, LookupYear } from "@quiq/shared/lookup";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../testing/test-app";
import { createDispatchedExam } from "../student/test-fixtures";
import { LOOKUP_WINDOW_MS } from "./rate-limit";
import { addPreviousYear, attemptOf, insertAttempt, publishedFixture, type AttemptSpec } from "./test-fixtures";

let testApp: TestApp;

beforeAll(async () => {
  testApp = await createTestApp();
});

afterAll(async () => {
  await testApp.close();
});

// Mọi request test đi từ cùng một IP: sang cửa sổ mới trước mỗi test để giới hạn không lan giữa các test.
beforeEach(() => {
  testApp.clock.advance(LOOKUP_WINDOW_MS);
});

const client = () => request(testApp.app.callback());
const lookup = (body: Record<string, unknown>) => client().post("/api/lookup").send(body);
const itemsOf = (res: request.Response) => (res.body as ApiSuccess<LookupResult>).data.items;
const published = (options?: { schoolStatus?: "active" | "locked" }) => publishedFixture(testApp.db, options);
const attempt = (spec: AttemptSpec) => insertAttempt(testApp.db, spec);
const UNKNOWN_SCHOOL = "00000000-0000-4000-8000-000000000000";

describe("POST /api/lookup: điểm chính thức", () => {
  it("điểm cao nhất các lần đã chấm; lần chưa chấm bị bỏ qua; mã viết thường có khoảng trắng vẫn khớp", async () => {
    const fixture = await published();
    await attempt({ ...attemptOf(fixture, "HS001", 1), status: "submitted", score: 6.25 });
    await attempt({ ...attemptOf(fixture, "HS001", 2), status: "submitted", score: 8.5 });
    await attempt({ ...attemptOf(fixture, "HS001", 3), status: "interrupted", score: null });

    const res = await lookup({ schoolId: fixture.schoolId, studentCode: "  hs001 " });

    expect(res.status).toBe(200);
    expect(itemsOf(res)).toEqual([
      { subjectName: "Toán", examTitle: "Kiểm tra 15 phút", examCode: fixture.examCode, score: 8.5 },
    ]);
  });

  it("lớp đã công bố mà học sinh không có lần nào đã chấm: điểm 0, không ghi attempt nào", async () => {
    const fixture = await published();

    const res = await lookup({ schoolId: fixture.schoolId, studentCode: "HS002" });

    expect(itemsOf(res)).toEqual([expect.objectContaining({ examCode: fixture.examCode, score: 0 })]);
    const rows = await testApp.db.select().from(attempts).where(eq(attempts.studentId, fixture.studentIds.HS002));
    expect(rows).toHaveLength(0);
  });

  it("chỉ bài của lớp đã công bố bảng điểm; lớp chưa công bố không xuất hiện", async () => {
    const fixture = await published();
    const unpublished = await createDispatchedExam(testApp.db, { ...fixture, status: "closed" });
    await attempt({
      schoolId: fixture.schoolId,
      examClassId: unpublished.examClassId,
      studentId: fixture.studentIds.HS001,
      attemptNo: 1,
      status: "submitted",
      score: 9,
    });

    const items = itemsOf(await lookup({ schoolId: fixture.schoolId, studentCode: "HS001" }));

    expect(items.map((item) => item.examCode)).toEqual([fixture.examCode]);
  });
});

describe("POST /api/lookup: năm học", () => {
  it("mặc định năm hiện tại; chọn năm trước thì chỉ ra bài của lớp năm trước", async () => {
    const fixture = await published();
    const previous = await addPreviousYear(testApp.db, fixture);

    const current = itemsOf(await lookup({ schoolId: fixture.schoolId, studentCode: "HS001" }));
    expect(current.map((item) => item.examCode)).toEqual([fixture.examCode]);

    const old = itemsOf(
      await lookup({ schoolId: fixture.schoolId, studentCode: "HS001", academicYearId: previous.yearId }),
    );
    expect(old).toEqual([expect.objectContaining({ examCode: previous.examCode, score: 7 })]);
  });

  it("năm học của trường khác: kết quả rỗng", async () => {
    const fixture = await published();
    const otherPrevious = await addPreviousYear(testApp.db, await published());

    const res = await lookup({ schoolId: fixture.schoolId, studentCode: "HS001", academicYearId: otherPrevious.yearId });

    expect(res.status).toBe(200);
    expect(itemsOf(res)).toEqual([]);
  });

  it("GET /lookup/schools/:id/years: năm học của đúng trường, có cờ năm hiện tại", async () => {
    const fixture = await published();
    const previous = await addPreviousYear(testApp.db, fixture);
    await published();

    const res = await client().get(`/api/lookup/schools/${fixture.schoolId}/years`);

    expect(res.status).toBe(200);
    expect((res.body as ApiSuccess<LookupYear[]>).data).toEqual([
      { id: expect.any(String), name: "2026-2027", isCurrent: true },
      { id: previous.yearId, name: "2025-2026", isCurrent: false },
    ]);
  });
});

describe("POST /api/lookup: chống dò mã, không PII, cô lập", () => {
  it("mã không tồn tại, mã vô hiệu, mã đúng nhưng chưa có bài công bố: body giống hệt nhau", async () => {
    const fixture = await published();
    // Mã vô hiệu vẫn được ghi danh và có điểm đã chấm: vẫn không được tra ra.
    await attempt({ ...attemptOf(fixture, "HS009", 1), status: "submitted", score: 10 });

    const bodies = [];
    for (const studentCode of ["KHONGCO", "HS009", "HS003"]) {
      const res = await lookup({ schoolId: fixture.schoolId, studentCode });
      expect(res.status, studentCode).toBe(200);
      bodies.push(res.body);
    }

    expect(bodies[0]).toEqual({ success: true, data: { items: [] } });
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
  });

  it("không có thông tin cá nhân hay id nội bộ học sinh trong response", async () => {
    const fixture = await published();
    await attempt({ ...attemptOf(fixture, "HS001", 1), status: "submitted", score: 5 });

    const res = await lookup({ schoolId: fixture.schoolId, studentCode: "HS001" });

    expect(Object.keys(res.body.data)).toEqual(["items"]);
    for (const item of itemsOf(res)) {
      expect(Object.keys(item).sort()).toEqual(["examCode", "examTitle", "score", "subjectName"]);
    }
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(fixture.studentIds.HS001);
    expect(raw).not.toContain("Nguyễn Văn An");
    expect(raw).not.toContain("10A1");
  });

  it("trường bị khóa vẫn tra cứu được và vẫn có trong danh sách trường (C-09)", async () => {
    const fixture = await published({ schoolStatus: "locked" });
    await attempt({ ...attemptOf(fixture, "HS001", 1), status: "submitted", score: 4.75 });

    const items = itemsOf(await lookup({ schoolId: fixture.schoolId, studentCode: "HS001" }));
    expect(items).toEqual([expect.objectContaining({ score: 4.75 })]);

    const schoolList = (await client().get("/api/lookup/schools")).body as ApiSuccess<LookupSchool[]>;
    expect(schoolList.data.map((school) => school.id)).toContain(fixture.schoolId);
  });

  it("mã học sinh trùng ở hai trường: chỉ ra điểm của trường được chọn", async () => {
    const first = await published();
    const second = await published();
    await attempt({ ...attemptOf(first, "HS001", 1), status: "submitted", score: 3 });
    await attempt({ ...attemptOf(second, "HS001", 1), status: "submitted", score: 9 });

    const items = itemsOf(await lookup({ schoolId: first.schoolId, studentCode: "HS001" }));

    expect(items).toEqual([expect.objectContaining({ examCode: first.examCode, score: 3 })]);
  });

  it("trường không tồn tại: cùng kết quả rỗng", async () => {
    const res = await lookup({ schoolId: UNKNOWN_SCHOOL, studentCode: "HS001" });
    expect(res.body).toEqual({ success: true, data: { items: [] } });
  });
});

describe("GET /api/lookup/schools và input sai", () => {
  it("chỉ trả id và tên trường, đủ mọi trường", async () => {
    await published();
    const res = await client().get("/api/lookup/schools");

    expect(res.status).toBe(200);
    const list = (res.body as ApiSuccess<LookupSchool[]>).data;
    expect(list.length).toBeGreaterThan(0);
    for (const school of list) expect(Object.keys(school).sort()).toEqual(["id", "name"]);
    expect(list).toHaveLength(await testApp.db.$count(schools));
  });

  it("input sai: 422 VALIDATION theo envelope lỗi chung", async () => {
    for (const body of [
      {},
      { schoolId: "khong-phai-uuid", studentCode: "HS001" },
      { schoolId: UNKNOWN_SCHOOL, studentCode: "   " },
      { schoolId: UNKNOWN_SCHOOL, studentCode: "HS001", academicYearId: "x" },
    ]) {
      const res = await lookup(body);
      expect(res.status, JSON.stringify(body)).toBe(422);
      expect(res.body).toMatchObject({ success: false, code: "VALIDATION" });
    }
  });
});
