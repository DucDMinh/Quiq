import Router from "@koa/router";
import { schools, sessions, subjects } from "@quiq/db";
import { createTestDb, type TestDbHandle } from "@quiq/db/testing";
import { apiFailureSchema } from "@quiq/shared/common";
import { and, eq } from "drizzle-orm";
import Koa from "koa";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestClock } from "../testing/test-clock";
import { TEST_SESSION_CONFIG } from "../testing/test-app";
import {
  insertSchool,
  insertSessionCookie,
  insertStaff,
  sessionExpiryAfter,
  type SchoolFixture,
} from "../testing/staff-fixtures";
import type { AppDeps } from "./deps";
import { AppError } from "./errors";
import {
  assertSameSchool,
  authenticate,
  requireRole,
  requireTenant,
  staffGuard,
  tenantSchoolId,
} from "./guards";
import { errorMiddleware } from "./middleware";
import { ok } from "./response";
import { hashSessionToken } from "./session-cookie";

// App mẫu chỉ dùng trong test: route theo vai trò và route dữ liệu trường, không đưa vào module thật.
function buildSampleApp(deps: AppDeps): Koa {
  const router = new Router({ prefix: "/api" });
  router.get("/teacher-only", ...staffGuard(deps, ["teacher"]), (ctx) => ok(ctx, { ok: true }));
  router.get("/school-admin-only", ...staffGuard(deps, ["school_admin"]), (ctx) => ok(ctx, { ok: true }));
  router.get("/super-only", authenticate(deps), requireRole("super_admin"), (ctx) => ok(ctx, { ok: true }));
  router.get("/any-school-staff", authenticate(deps), requireTenant(), (ctx) => ok(ctx, { ok: true }));
  router.get("/my-school", ...staffGuard(deps, ["teacher", "school_admin"]), (ctx) =>
    ok(ctx, { schoolId: tenantSchoolId(ctx) }),
  );
  // Cách 1: lọc truy vấn theo schoolId của phiên.
  router.get("/subjects/:id", ...staffGuard(deps, ["teacher"]), async (ctx) => {
    const [subject] = await deps.db
      .select()
      .from(subjects)
      .where(and(eq(subjects.id, ctx.params.id!), eq(subjects.schoolId, tenantSchoolId(ctx))));
    if (!subject) throw new AppError("NOT_FOUND");
    ok(ctx, { id: subject.id });
  });
  // Cách 2: nạp theo id rồi so trường.
  router.get("/loaded-subjects/:id", ...staffGuard(deps, ["teacher"]), async (ctx) => {
    const [subject] = await deps.db.select().from(subjects).where(eq(subjects.id, ctx.params.id!));
    assertSameSchool(ctx, subject?.schoolId);
    ok(ctx, { id: subject!.id });
  });

  const app = new Koa();
  app.silent = true;
  app.use(errorMiddleware());
  app.use(router.routes());
  return app;
}

let handle: TestDbHandle;
const clock = createTestClock(new Date("2026-11-26T08:00:00.000Z"));
let app: Koa;
let schoolA: SchoolFixture;
let schoolB: SchoolFixture;
let teacherA: string;
let adminA: string;
let superAdmin: string;

beforeAll(async () => {
  handle = await createTestDb();
  app = buildSampleApp({ db: handle.db, clock, session: TEST_SESSION_CONFIG });
  schoolA = await insertSchool(handle.db);
  schoolB = await insertSchool(handle.db);
  teacherA = (await insertStaff(handle.db, { role: "teacher", school: schoolA })).staffId;
  adminA = (await insertStaff(handle.db, { role: "school_admin", school: schoolA })).staffId;
  superAdmin = (await insertStaff(handle.db, { role: "super_admin" })).staffId;
});

afterAll(async () => {
  await handle.close();
});

beforeEach(() => {
  clock.set(new Date("2026-11-26T08:00:00.000Z"));
});

const cookieFor = (staffId: string, expiresAt = sessionExpiryAfter(clock.now())) =>
  insertSessionCookie(handle.db, staffId, TEST_SESSION_CONFIG.secret, expiresAt);
const get = async (path: string, staffId?: string) => {
  const req = request(app.callback()).get(path);
  return staffId ? req.set("Cookie", await cookieFor(staffId)) : req;
};
const codeOf = (res: request.Response) => apiFailureSchema.parse(res.body).code;
const tokenHashOf = (cookie: string) => hashSessionToken(cookie.split("=")[1]!, TEST_SESSION_CONFIG.secret);

describe("authenticate", () => {
  it("không có cookie → 401", async () => {
    const res = await get("/api/teacher-only");
    expect(res.status).toBe(401);
    expect(codeOf(res)).toBe("UNAUTHENTICATED");
  });

  it("phiên hết hạn, bị thu hồi hoặc tài khoản vô hiệu → 401", async () => {
    const expired = await cookieFor(teacherA, clock.now());
    expect((await request(app.callback()).get("/api/teacher-only").set("Cookie", expired)).status).toBe(401);

    const revoked = await cookieFor(teacherA);
    await handle.db.update(sessions).set({ revokedAt: clock.now() }).where(eq(sessions.tokenHash, tokenHashOf(revoked)));
    expect((await request(app.callback()).get("/api/teacher-only").set("Cookie", revoked)).status).toBe(401);

    const inactiveId = (await insertStaff(handle.db, { role: "teacher", school: schoolA, isActive: false })).staffId;
    expect((await get("/api/teacher-only", inactiveId)).status).toBe(401);
  });

  it("trường bị khóa → phiên bị chặn 403 SCHOOL_LOCKED", async () => {
    const locked = await insertSchool(handle.db);
    const staffId = (await insertStaff(handle.db, { role: "teacher", school: locked })).staffId;
    const cookie = await cookieFor(staffId);
    await handle.db.update(schools).set({ status: "locked" }).where(eq(schools.id, locked.schoolId));

    const res = await request(app.callback()).get("/api/teacher-only").set("Cookie", cookie);
    expect(res.status).toBe(403);
    expect(codeOf(res)).toBe("SCHOOL_LOCKED");
  });

  it("thiếu cấu hình phiên → 500, không cho qua", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const noSession = buildSampleApp({ db: handle.db, clock });
    const res = await request(noSession.callback()).get("/api/teacher-only").set("Cookie", await cookieFor(teacherA));
    expect(res.status).toBe(500);
    vi.restoreAllMocks();
  });
});

describe("requireRole / requireTenant", () => {
  it("đúng vai trò → 200; sai vai trò → 403", async () => {
    expect((await get("/api/teacher-only", teacherA)).status).toBe(200);
    expect((await get("/api/school-admin-only", adminA)).status).toBe(200);
    expect((await get("/api/super-only", superAdmin)).status).toBe(200);

    for (const [path, staffId] of [
      ["/api/school-admin-only", teacherA],
      ["/api/teacher-only", adminA],
      ["/api/super-only", teacherA],
      ["/api/teacher-only", superAdmin],
    ] as const) {
      const res = await get(path, staffId);
      expect(res.status, `${path}`).toBe(403);
      expect(codeOf(res)).toBe("FORBIDDEN");
    }
  });

  it("admin tổng không có trường → route dữ liệu trường trả 403", async () => {
    expect((await get("/api/any-school-staff", superAdmin)).status).toBe(403);
    expect((await get("/api/any-school-staff", teacherA)).status).toBe(200);
  });
});

describe("tenant: schoolId lấy từ phiên", () => {
  it("bỏ qua schoolId trong request", async () => {
    const res = await get(`/api/my-school?schoolId=${schoolB.schoolId}`, teacherA);
    expect(res.body).toEqual({ success: true, data: { schoolId: schoolA.schoolId } });
  });

  it("người trường A gọi tài nguyên trường B → 404 (cả hai cách lọc)", async () => {
    for (const path of ["/api/subjects", "/api/loaded-subjects"]) {
      expect((await get(`${path}/${schoolA.subjectId}`, teacherA)).status).toBe(200);
      const crossSchool = await get(`${path}/${schoolB.subjectId}`, teacherA);
      expect(crossSchool.status).toBe(404);
      expect(codeOf(crossSchool)).toBe("NOT_FOUND");
    }
  });

  it("phiên còn hạn được gia hạn trượt sau mỗi request", async () => {
    const cookie = await cookieFor(teacherA);
    clock.advance(60 * 60 * 1000);
    await request(app.callback()).get("/api/teacher-only").set("Cookie", cookie);

    const [row] = await handle.db.select().from(sessions).where(eq(sessions.tokenHash, tokenHashOf(cookie)));
    expect(row!.expiresAt.getTime()).toBe(sessionExpiryAfter(clock.now()).getTime());
  });
});
