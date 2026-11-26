import { schools, sessions, STAFF_ROLES as DB_STAFF_ROLES, staffAccounts } from "@quiq/db";
import { STAFF_ROLES, STAFF_SESSION_TTL_MS } from "@quiq/shared/auth";
import { apiFailureSchema } from "@quiq/shared/common";
import { eq } from "drizzle-orm";
import request from "supertest";
import { inspect } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../app";
import { systemClock } from "../../http/deps";
import { hashSessionToken, STAFF_SESSION_COOKIE } from "../../http/session-cookie";
import { insertSchool, insertStaff, type SchoolFixture, type StaffFixture } from "../../testing/staff-fixtures";
import { createTestApp, TEST_SESSION_CONFIG, type TestApp } from "../../testing/test-app";
import { LOGIN_FAILURE_WINDOW_MS } from "./rate-limit";

const INVALID_BODY = {
  success: false,
  code: "INVALID_CREDENTIALS",
  error: "Tên đăng nhập hoặc mật khẩu không đúng.",
};

let testApp: TestApp;
let school: SchoolFixture;

beforeAll(async () => {
  testApp = await createTestApp();
  school = await insertSchool(testApp.db);
});

afterAll(async () => {
  await testApp.close();
});

beforeEach(() => {
  testApp.clock.set(new Date("2026-11-26T08:00:00.000Z"));
});

const agent = () => request(testApp.app.callback());
const login = (username: string, password: string) => agent().post("/api/auth/login").send({ username, password });
const me = (cookie?: string) => (cookie ? agent().get("/api/auth/me").set("Cookie", cookie) : agent().get("/api/auth/me"));

function setCookieHeader(res: request.Response): string {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = header?.find((line) => line.startsWith(`${STAFF_SESSION_COOKIE}=`));
  if (!cookie) throw new Error("Response không có cookie phiên.");
  return cookie;
}

/** Phần `quiq_session=<token>` để gửi lại ở request sau. */
const cookiePair = (res: request.Response) => setCookieHeader(res).split(";")[0]!;
const tokenOf = (cookie: string) => cookie.slice(`${STAFF_SESSION_COOKIE}=`.length);

async function loginCookie(staff: StaffFixture): Promise<string> {
  const res = await login(staff.username, staff.password);
  expect(res.status).toBe(200);
  return cookiePair(res);
}

const teacher = (username?: string) => insertStaff(testApp.db, { role: "teacher", school, username });

describe("vai trò dùng chung", () => {
  it("danh sách vai trò của shared khớp với schema DB", () => {
    expect([...STAFF_ROLES]).toEqual([...DB_STAFF_ROLES]);
  });
});

describe("POST /api/auth/login", () => {
  it("đúng mật khẩu: 200, hồ sơ giáo viên và cookie HttpOnly; DB chỉ lưu HMAC của token", async () => {
    const staff = await teacher("gv.toan");
    const res = await login("gv.toan", staff.password);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        id: staff.staffId,
        username: "gv.toan",
        displayName: "Cán bộ gv.toan",
        role: "teacher",
        schoolId: school.schoolId,
        schoolName: expect.any(String),
        subject: { id: school.subjectId, name: "Toán" },
      },
    });

    const cookie = setCookieHeader(res);
    expect(cookie).toMatch(/; path=\//i);
    expect(cookie).toMatch(/; samesite=lax/i);
    expect(cookie).toMatch(/; httponly/i);
    expect(cookie).not.toMatch(/; secure/i);

    const token = tokenOf(cookiePair(res));
    expect(token.length).toBeGreaterThanOrEqual(40);
    const rows = await testApp.db.select().from(sessions).where(eq(sessions.staffId, staff.staffId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashSessionToken(token, TEST_SESSION_CONFIG.secret));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]!.expiresAt.getTime()).toBe(testApp.clock.now().getTime() + STAFF_SESSION_TTL_MS);
  });

  it("tên đăng nhập không phân biệt hoa thường và bỏ khoảng trắng", async () => {
    const staff = await teacher();
    const res = await login(`  ${staff.username.toUpperCase()} `, staff.password);
    expect(res.status).toBe(200);
  });

  it("sai mật khẩu, tên không tồn tại, tài khoản vô hiệu: cùng một lỗi chung", async () => {
    const staff = await teacher();
    const inactive = await insertStaff(testApp.db, { role: "teacher", school, isActive: false });

    const responses = [
      await login(staff.username, "sai-mat-khau"),
      await login("khong.ton.tai", staff.password),
      await login(inactive.username, inactive.password),
    ];
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(INVALID_BODY);
      expect(res.headers["set-cookie"]).toBeUndefined();
    }
  });

  it("thiếu trường: 422, không phản hồi lại mật khẩu", async () => {
    const res = await agent().post("/api/auth/login").send({ username: "", password: "Bi-mat-khong-tra-ve" });
    expect(res.status).toBe(422);
    expect(apiFailureSchema.parse(res.body).code).toBe("VALIDATION");
    expect(JSON.stringify(res.body)).not.toContain("Bi-mat-khong-tra-ve");
  });

  it("5 lần sai liên tiếp vẫn là lỗi chung; lần thứ 6 bị 429 kể cả khi mật khẩu đúng", async () => {
    const staff = await teacher();
    for (let attempt = 1; attempt <= 5; attempt++) {
      const res = await login(staff.username, `sai-${attempt}`);
      expect(res.status).toBe(401);
    }

    const blocked = await login(staff.username, staff.password);
    expect(blocked.status).toBe(429);
    expect(apiFailureSchema.parse(blocked.body)).toMatchObject({ code: "LOGIN_THROTTLED" });
    expect(blocked.body.error).toMatch(/quá nhiều lần/);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(blocked.headers["set-cookie"]).toBeUndefined();

    // Tên đăng nhập khác (cùng IP) không bị ảnh hưởng.
    const other = await teacher();
    expect((await login(other.username, other.password)).status).toBe(200);

    // Hết cửa sổ thì được thử lại.
    testApp.clock.advance(LOGIN_FAILURE_WINDOW_MS);
    expect((await login(staff.username, staff.password)).status).toBe(200);
  });

  it("10 request sai gửi đồng thời: chỉ 5 tới bước kiểm mật khẩu, còn lại 429; sau đó mật khẩu đúng vẫn 429", async () => {
    const staff = await teacher();
    const burst = await Promise.all(Array.from({ length: 10 }, (_, i) => login(staff.username, `sai-song-song-${i}`)));
    const statuses = burst.map((res) => res.status).sort();

    // 401 chỉ xuất hiện sau khi đã so mật khẩu, nên đúng 5 lượt 401 nghĩa là đúng 5 lượt tới bước đó.
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429, 429, 429, 429]);
    expect((await login(staff.username, staff.password)).status).toBe(429);
  });

  it("đăng nhập lại khi đang có cookie phiên cũ: phiên cũ bị thu hồi", async () => {
    const staff = await teacher();
    const oldCookie = await loginCookie(staff);

    const again = await agent()
      .post("/api/auth/login")
      .set("Cookie", oldCookie)
      .send({ username: staff.username, password: staff.password });
    expect(again.status).toBe(200);
    const newCookie = cookiePair(again);
    expect(newCookie).not.toBe(oldCookie);

    expect((await me(oldCookie)).status).toBe(401);
    expect((await me(newCookie)).status).toBe(200);
    const rows = await testApp.db.select().from(sessions).where(eq(sessions.staffId, staff.staffId));
    expect(rows.filter((row) => row.revokedAt === null)).toHaveLength(1);
  });

  it("đăng nhập đúng xóa bộ đếm sai", async () => {
    const staff = await teacher();
    for (let attempt = 1; attempt <= 4; attempt++) await login(staff.username, "sai");
    expect((await login(staff.username, staff.password)).status).toBe(200);
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await login(staff.username, "sai")).status).toBe(401);
    }
    expect((await login(staff.username, staff.password)).status).toBe(429);
  });

  it("trường bị khóa: đúng mật khẩu báo trường khóa, sai mật khẩu vẫn chỉ là lỗi chung", async () => {
    const lockedSchool = await insertSchool(testApp.db, "locked");
    const staff = await insertStaff(testApp.db, { role: "teacher", school: lockedSchool });

    const wrong = await login(staff.username, "sai");
    expect(wrong.body).toEqual(INVALID_BODY);

    const right = await login(staff.username, staff.password);
    expect(right.status).toBe(403);
    expect(right.body).toEqual({
      success: false,
      code: "SCHOOL_LOCKED",
      error: "Trường của bạn đang bị khóa. Liên hệ quản trị hệ thống.",
    });
    expect(right.headers["set-cookie"]).toBeUndefined();
  });

  it("admin tổng: không có trường, không có môn", async () => {
    const admin = await insertStaff(testApp.db, { role: "super_admin" });
    const res = await login(admin.username, admin.password);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: "super_admin", schoolId: null, schoolName: null, subject: null });
  });

  it("mật khẩu không xuất hiện trong log hay response ở mọi nhánh", async () => {
    const secret = "Mat-khau-RIENG-khong-log-123";
    const logged = (["error", "warn", "log", "info", "debug"] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    try {
      const staff = await teacher();
      const bodies = [
        await login(staff.username, secret),
        await agent().post("/api/auth/login").send({ username: "", password: secret }),
        await agent().post("/api/auth/login").send({ username: staff.username, password: secret.repeat(20) }),
        await agent().post("/api/auth/login").set("Content-Type", "application/json").send(`{"password":"${secret}"`),
      ].map((res) => JSON.stringify(res.body) + JSON.stringify(res.headers));
      const logText = logged.map((spy) => inspect(spy.mock.calls, { depth: 6 })).join("\n");
      for (const text of [...bodies, logText]) expect(text).not.toContain(secret);
    } finally {
      logged.forEach((spy) => spy.mockRestore());
    }
  });
});

describe("GET /api/auth/me và phiên", () => {
  it("có cookie: trả vai trò, họ tên, trường, môn; không có hash mật khẩu", async () => {
    const staff = await teacher();
    const res = await me(await loginCookie(staff));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: staff.staffId,
      role: "teacher",
      displayName: `Cán bộ ${staff.username}`,
      schoolId: school.schoolId,
      subject: { id: school.subjectId, name: "Toán" },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/password|scrypt/i);
  });

  it("không có cookie hoặc cookie rác: 401", async () => {
    for (const res of [await me(), await me(`${STAFF_SESSION_COOKIE}=khong-hop-le`)]) {
      expect(res.status).toBe(401);
      expect(apiFailureSchema.parse(res.body).code).toBe("UNAUTHENTICATED");
    }
  });

  it("hết hạn sau 8 giờ không hoạt động", async () => {
    const cookie = await loginCookie(await teacher());
    testApp.clock.advance(STAFF_SESSION_TTL_MS);
    expect((await me(cookie)).status).toBe(401);
  });

  it("hạn trượt: mỗi request làm mới hạn 8 giờ (DB và cookie)", async () => {
    const staff = await teacher();
    const cookie = await loginCookie(staff);

    testApp.clock.advance(7 * 60 * 60 * 1000);
    const first = await me(cookie);
    expect(first.status).toBe(200);
    expect(setCookieHeader(first)).toMatch(/; httponly/i);
    const [row] = await testApp.db.select().from(sessions).where(eq(sessions.staffId, staff.staffId));
    expect(row!.expiresAt.getTime()).toBe(testApp.clock.now().getTime() + STAFF_SESSION_TTL_MS);

    testApp.clock.advance(7 * 60 * 60 * 1000); // 14 giờ từ lúc đăng nhập, 7 giờ từ request trước
    expect((await me(cookie)).status).toBe(200);

    testApp.clock.advance(STAFF_SESSION_TTL_MS);
    expect((await me(cookie)).status).toBe(401);
  });

  it("đăng xuất thu hồi phiên: cookie cũ hết dùng được", async () => {
    const staff = await teacher();
    const cookie = await loginCookie(staff);

    const res = await agent().post("/api/auth/logout").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(setCookieHeader(res)).toMatch(new RegExp(`^${STAFF_SESSION_COOKIE}=;`));

    expect((await me(cookie)).status).toBe(401);
    const [row] = await testApp.db.select().from(sessions).where(eq(sessions.staffId, staff.staffId));
    expect(row!.revokedAt).not.toBeNull();
  });

  it("đăng xuất không có cookie vẫn thành công", async () => {
    expect((await agent().post("/api/auth/logout")).status).toBe(200);
  });

  it("trường bị khóa sau khi đăng nhập: phiên cũ bị chặn", async () => {
    const lockLater = await insertSchool(testApp.db);
    const staff = await insertStaff(testApp.db, { role: "teacher", school: lockLater });
    const cookie = await loginCookie(staff);

    await testApp.db.update(schools).set({ status: "locked" }).where(eq(schools.id, lockLater.schoolId));
    const res = await me(cookie);
    expect(res.status).toBe(403);
    expect(apiFailureSchema.parse(res.body).code).toBe("SCHOOL_LOCKED");
  });

  it("tài khoản bị vô hiệu sau khi đăng nhập: 401", async () => {
    const staff = await teacher();
    const cookie = await loginCookie(staff);
    await testApp.db.update(staffAccounts).set({ isActive: false }).where(eq(staffAccounts.id, staff.staffId));
    expect((await me(cookie)).status).toBe(401);
  });
});

describe("cấu hình phiên", () => {
  it("cookie có cờ Secure khi secureCookie bật", async () => {
    const secureApp = await createTestApp({ session: { ...TEST_SESSION_CONFIG, secureCookie: true } });
    try {
      const staff = await insertStaff(secureApp.db, { role: "teacher", school: await insertSchool(secureApp.db) });
      const res = await request(secureApp.app.callback())
        .post("/api/auth/login")
        .send({ username: staff.username, password: staff.password });
      expect(res.status).toBe(200);
      expect(setCookieHeader(res)).toMatch(/; secure/i);
    } finally {
      await secureApp.close();
    }
  });

  it("thiếu deps.session: đăng nhập và /me đóng chặt (500), không cấp phiên", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = await createApp({ deps: { db: testApp.db, clock: systemClock } });
    app.silent = true;
    const staff = await teacher();

    const res = await request(app.callback())
      .post("/api/auth/login")
      .send({ username: staff.username, password: staff.password });
    expect(res.status).toBe(500);
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect((await request(app.callback()).get("/api/auth/me").set("Cookie", "quiq_session=x")).status).toBe(500);
    vi.restoreAllMocks();
  });
});
