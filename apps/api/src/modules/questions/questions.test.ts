import { DIFFICULTIES as DB_DIFFICULTIES, questionOptions, questions } from "@quiq/db";
import { DIFFICULTIES, type Question, type QuestionInput, type QuestionListResult } from "@quiq/shared/questions";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, TEST_SESSION_CONFIG, type TestApp } from "../../testing/test-app";
import {
  insertSchool,
  insertSessionCookie,
  insertStaff,
  sessionExpiryAfter,
  type SchoolFixture,
} from "../../testing/staff-fixtures";

let t: TestApp;
let schoolA: SchoolFixture;
let schoolB: SchoolFixture;

const BASE = "/api/teacher/questions";
const http = () => request(t.app.callback());

beforeAll(async () => {
  t = await createTestApp();
  schoolA = await insertSchool(t.db);
  schoolB = await insertSchool(t.db);
});

afterAll(async () => {
  await t?.close();
});

interface Login {
  staffId: string;
  cookie: string;
}

async function loginAs(spec: Parameters<typeof insertStaff>[1]): Promise<Login> {
  const staff = await insertStaff(t.db, spec);
  const cookie = await insertSessionCookie(
    t.db,
    staff.staffId,
    TEST_SESSION_CONFIG.secret,
    sessionExpiryAfter(t.clock.now()),
  );
  return { staffId: staff.staffId, cookie };
}

// Mỗi test dùng giáo viên mới nên ngân hàng bắt đầu rỗng, số liệu KPI không lẫn giữa các test.
const newTeacher = (school: SchoolFixture = schoolA) => loginAs({ role: "teacher", school });

function sampleInput(overrides: Partial<QuestionInput> = {}): QuestionInput {
  return {
    content: "1 + 1 bằng mấy?",
    difficulty: "easy",
    multiSelect: false,
    options: [
      { content: "2", isCorrect: true },
      { content: "3", isCorrect: false },
    ],
    ...overrides,
  };
}

async function createAs(login: Login, input: unknown = sampleInput()): Promise<Question> {
  const res = await http().post(BASE).set("Cookie", login.cookie).send(input as object);
  expect(res.status).toBe(201);
  return res.body.data as Question;
}

async function listAs(login: Login, query = ""): Promise<QuestionListResult> {
  const res = await http().get(`${BASE}${query}`).set("Cookie", login.cookie);
  expect(res.status).toBe(200);
  return res.body.data as QuestionListResult;
}

describe("hợp đồng chung", () => {
  it("DIFFICULTIES của shared khớp với db", () => {
    expect([...DIFFICULTIES]).toEqual([...DB_DIFFICULTIES]);
  });

  it("chưa đăng nhập: 401; vai trò khác giáo viên: 403", async () => {
    expect((await http().get(BASE)).status).toBe(401);
    const admin = await loginAs({ role: "school_admin", school: schoolA });
    const res = await http().get(BASE).set("Cookie", admin.cookie);
    expect(res.status).toBe(403);
    const superAdmin = await loginAs({ role: "super_admin" });
    expect((await http().get(BASE).set("Cookie", superAdmin.cookie)).status).toBe(403);
    expect((await http().post(BASE).set("Cookie", superAdmin.cookie).send(sampleInput())).status).toBe(403);
  });
});

describe("tạo, đọc, sửa, xóa", () => {
  it("tạo câu: môn và chủ sở hữu lấy từ phiên, bỏ qua giá trị client gửi", async () => {
    const teacher = await newTeacher();
    const other = await newTeacher(schoolB);
    const created = await createAs(teacher, {
      ...sampleInput({ content: "  Thủ đô Việt Nam?  " }),
      subjectId: schoolB.subjectId,
      teacherId: other.staffId,
      schoolId: schoolB.schoolId,
    });
    expect(created.content).toBe("Thủ đô Việt Nam?");
    expect(created.options.map((o) => [o.content, o.isCorrect, o.position])).toEqual([
      ["2", true, 0],
      ["3", false, 1],
    ]);

    const [row] = await t.db.select().from(questions).where(eq(questions.id, created.id));
    expect(row).toMatchObject({
      schoolId: schoolA.schoolId,
      subjectId: schoolA.subjectId,
      teacherId: teacher.staffId,
    });
  });

  it("đọc theo id và danh sách trả môn cố định của giáo viên", async () => {
    const teacher = await newTeacher();
    const created = await createAs(teacher);
    const res = await http().get(`${BASE}/${created.id}`).set("Cookie", teacher.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(created);
    const list = await listAs(teacher);
    expect(list.subject).toEqual({ id: schoolA.subjectId, name: "Toán" });
    expect(list.items.map((q) => q.id)).toEqual([created.id]);
  });

  it("sửa nhiều đáp án sang một đáp án rồi ngược lại, dữ liệu giữ đúng", async () => {
    const teacher = await newTeacher();
    const created = await createAs(
      teacher,
      sampleInput({
        multiSelect: true,
        options: [
          { content: "A", isCorrect: true },
          { content: "B", isCorrect: false },
          { content: "C", isCorrect: true },
        ],
      }),
    );

    const toSingle = await http()
      .put(`${BASE}/${created.id}`)
      .set("Cookie", teacher.cookie)
      .send(
        sampleInput({
          content: "Câu đã sửa",
          difficulty: "hard",
          multiSelect: false,
          options: [
            { content: "Một", isCorrect: false },
            { content: "Hai", isCorrect: true },
          ],
        }),
      );
    expect(toSingle.status).toBe(200);
    const single = (await http().get(`${BASE}/${created.id}`).set("Cookie", teacher.cookie)).body.data as Question;
    expect(single).toMatchObject({ content: "Câu đã sửa", difficulty: "hard", multiSelect: false });
    expect(single.options.map((o) => [o.content, o.isCorrect, o.position])).toEqual([
      ["Một", false, 0],
      ["Hai", true, 1],
    ]);

    const toMulti = await http()
      .put(`${BASE}/${created.id}`)
      .set("Cookie", teacher.cookie)
      .send(
        sampleInput({
          multiSelect: true,
          options: [
            { content: "W", isCorrect: true },
            { content: "X", isCorrect: true },
            { content: "Y", isCorrect: false },
            { content: "Z", isCorrect: true },
          ],
        }),
      );
    expect(toMulti.status).toBe(200);
    expect((toMulti.body.data as Question).multiSelect).toBe(true);
    const stored = await t.db.select().from(questionOptions).where(eq(questionOptions.questionId, created.id));
    expect(stored).toHaveLength(4);
    expect(stored.filter((o) => o.isCorrect)).toHaveLength(3);
  });

  it("xóa câu: 200, sau đó 404 và đáp án bị xóa theo", async () => {
    const teacher = await newTeacher();
    const created = await createAs(teacher);
    const res = await http().delete(`${BASE}/${created.id}`).set("Cookie", teacher.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: created.id });
    expect((await http().get(`${BASE}/${created.id}`).set("Cookie", teacher.cookie)).status).toBe(404);
    const options = await t.db.select().from(questionOptions).where(eq(questionOptions.questionId, created.id));
    expect(options).toHaveLength(0);
  });

  it("id không phải uuid hoặc không tồn tại: 404", async () => {
    const teacher = await newTeacher();
    for (const id of ["khong-phai-uuid", "123", "00000000-0000-4000-8000-000000000000"]) {
      expect((await http().get(`${BASE}/${id}`).set("Cookie", teacher.cookie)).status).toBe(404);
      expect((await http().delete(`${BASE}/${id}`).set("Cookie", teacher.cookie)).status).toBe(404);
    }
  });
});

describe("cô lập theo chủ sở hữu và theo trường", () => {
  it("giáo viên khác cùng trường và giáo viên trường khác đều nhận 404, không thấy trong danh sách", async () => {
    const owner = await newTeacher();
    const created = await createAs(owner);
    const outsiders = [await newTeacher(schoolA), await newTeacher(schoolB)];

    for (const outsider of outsiders) {
      const url = `${BASE}/${created.id}`;
      expect((await http().get(url).set("Cookie", outsider.cookie)).status).toBe(404);
      expect((await http().put(url).set("Cookie", outsider.cookie).send(sampleInput({ content: "Chiếm" }))).status).toBe(
        404,
      );
      expect((await http().delete(url).set("Cookie", outsider.cookie)).status).toBe(404);
      const list = await listAs(outsider);
      expect(list.stats.total).toBe(0);
      expect(list.items).toEqual([]);
    }

    const stillThere = await http().get(`${BASE}/${created.id}`).set("Cookie", owner.cookie);
    expect(stillThere.status).toBe(200);
    expect((stillThere.body.data as Question).content).toBe("1 + 1 bằng mấy?");
  });
});

describe("kiểm hợp lệ", () => {
  const twoOptions = sampleInput().options;
  const cases: Array<{ name: string; body: unknown; path: string; message?: string }> = [
    { name: "1 đáp án", body: sampleInput({ options: [{ content: "A", isCorrect: true }] }), path: "options" },
    {
      name: "5 đáp án",
      body: sampleInput({
        options: ["A", "B", "C", "D", "E"].map((content, i) => ({ content, isCorrect: i === 0 })),
      }),
      path: "options",
    },
    {
      name: "không đáp án đúng",
      body: sampleInput({ options: twoOptions.map((o) => ({ ...o, isCorrect: false })) }),
      path: "options",
      message: "Cần ít nhất 1 đáp án đúng",
    },
    {
      name: "một đáp án nhưng đánh dấu 2 đúng",
      body: sampleInput({ options: twoOptions.map((o) => ({ ...o, isCorrect: true })) }),
      path: "options",
    },
    { name: "nội dung rỗng", body: sampleInput({ content: "   " }), path: "content" },
    { name: "mức khó lạ", body: { ...sampleInput(), difficulty: "extreme" }, path: "difficulty" },
    {
      name: "đáp án rỗng",
      body: sampleInput({ options: [twoOptions[0]!, { content: " ", isCorrect: false }] }),
      path: "options.1.content",
    },
  ];

  it.each(cases)("từ chối $name: 422 VALIDATION, details theo trường", async ({ body, path, message }) => {
    const teacher = await newTeacher();
    const res = await http().post(BASE).set("Cookie", teacher.cookie).send(body as object);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION");
    expect(res.body.details).toEqual(
      expect.arrayContaining([expect.objectContaining(message ? { path, message } : { path })]),
    );
  });

  it("PUT cũng kiểm hợp lệ và không đổi dữ liệu khi sai", async () => {
    const teacher = await newTeacher();
    const created = await createAs(teacher);
    const res = await http()
      .put(`${BASE}/${created.id}`)
      .set("Cookie", teacher.cookie)
      .send(sampleInput({ content: "" }));
    expect(res.status).toBe(422);
    const after = (await http().get(`${BASE}/${created.id}`).set("Cookie", teacher.cookie)).body.data as Question;
    expect(after).toEqual(created);
  });

  it("query danh sách sai: mức khó lạ, trang 0, trang vượt giới hạn, trang không phải số: 422", async () => {
    const teacher = await newTeacher();
    for (const query of ["?difficulty=extreme", "?page=0", "?page=10001", "?page=abc", "?page=1.5"]) {
      const res = await http().get(`${BASE}${query}`).set("Cookie", teacher.cookie);
      expect(res.status, query).toBe(422);
      expect(res.body.details, query).toEqual(expect.arrayContaining([expect.objectContaining({ path: expect.any(String) })]));
    }
    expect((await http().get(`${BASE}?page=10000`).set("Cookie", teacher.cookie)).status).toBe(200);
  });
});

describe("danh sách, KPI và phân trang", () => {
  it("KPI đếm theo mức không phụ thuộc bộ lọc; lọc trả đúng câu", async () => {
    const teacher = await newTeacher();
    await createAs(teacher, sampleInput({ difficulty: "easy" }));
    await createAs(teacher, sampleInput({ difficulty: "easy" }));
    const medium = await createAs(teacher, sampleInput({ difficulty: "medium" }));

    const all = await listAs(teacher);
    expect(all.stats).toEqual({ total: 3, easy: 2, medium: 1, hard: 0 });
    expect(all.total).toBe(3);

    const onlyMedium = await listAs(teacher, "?difficulty=medium");
    expect(onlyMedium.stats).toEqual(all.stats);
    expect(onlyMedium.total).toBe(1);
    expect(onlyMedium.items.map((q) => q.id)).toEqual([medium.id]);

    const onlyHard = await listAs(teacher, "?difficulty=hard");
    expect(onlyHard).toMatchObject({ total: 0, items: [] });
  });

  it("hơn 25 câu: phân trang 25 câu mỗi trang", async () => {
    const teacher = await newTeacher();
    for (let i = 0; i < 26; i += 1) await createAs(teacher, sampleInput({ content: `Câu ${i}` }));

    const first = await listAs(teacher);
    expect(first).toMatchObject({ total: 26, page: 1, pageSize: 25 });
    expect(first.items).toHaveLength(25);

    const second = await listAs(teacher, "?page=2");
    expect(second.items).toHaveLength(1);
    const ids = new Set([...first.items, ...second.items].map((q) => q.id));
    expect(ids.size).toBe(26);
  });
});
