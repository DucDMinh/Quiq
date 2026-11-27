import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "../../testing/test-app";
import { createTestClock } from "../../testing/test-clock";
import {
  createLookupRateLimiter,
  LOOKUP_LIMITER_MAX_KEYS,
  LOOKUP_MAX_REQUESTS,
  LOOKUP_WINDOW_MS,
} from "./rate-limit";

describe("createLookupRateLimiter", () => {
  it("tính mọi lượt; quá ngưỡng thì trả số giây còn lại của cửa sổ", () => {
    const clock = createTestClock();
    const limiter = createLookupRateLimiter(clock);
    for (let i = 0; i < LOOKUP_MAX_REQUESTS; i++) expect(limiter.tryAcquire("ip")).toBe(0);
    expect(limiter.tryAcquire("ip")).toBe(LOOKUP_WINDOW_MS / 1000);

    clock.advance(10_000);
    expect(limiter.tryAcquire("ip")).toBe(LOOKUP_WINDOW_MS / 1000 - 10);
    expect(limiter.tryAcquire("ip-khac")).toBe(0);

    clock.advance(LOOKUP_WINDOW_MS);
    expect(limiter.tryAcquire("ip")).toBe(0);
  });

  it("có trần số khóa trong bộ nhớ và tự dọn khóa hết cửa sổ", () => {
    const clock = createTestClock();
    const limiter = createLookupRateLimiter(clock);
    for (let i = 0; i < LOOKUP_LIMITER_MAX_KEYS + 5; i++) limiter.tryAcquire(`ip-${i}`);
    expect(limiter.size()).toBe(LOOKUP_LIMITER_MAX_KEYS);

    clock.advance(LOOKUP_WINDOW_MS);
    limiter.tryAcquire("moi");
    expect(limiter.size()).toBe(1);
  });
});

describe("POST /api/lookup: giới hạn tốc độ", () => {
  let testApp: TestApp;
  const body = { schoolId: "00000000-0000-4000-8000-000000000000", studentCode: "HS001" };
  const lookup = (payload: object) => request(testApp.app.callback()).post("/api/lookup").send(payload);

  beforeAll(async () => {
    testApp = await createTestApp();
  });
  afterAll(async () => {
    await testApp.close();
  });
  // Mọi request test đi từ cùng một IP: sang cửa sổ mới trước mỗi test.
  beforeEach(() => {
    testApp.clock.advance(LOOKUP_WINDOW_MS);
  });

  it("vượt ngưỡng: 429 RATE_LIMITED + Retry-After; sang cửa sổ mới thì tra được lại", async () => {
    for (let i = 0; i < LOOKUP_MAX_REQUESTS; i++) expect((await lookup(body)).status).toBe(200);

    const blocked = await lookup(body);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      success: false,
      code: "RATE_LIMITED",
      details: { retryAfterSeconds: LOOKUP_WINDOW_MS / 1000 },
    });
    expect(blocked.headers["retry-after"]).toBe(String(LOOKUP_WINDOW_MS / 1000));

    testApp.clock.advance(LOOKUP_WINDOW_MS);
    expect((await lookup(body)).status).toBe(200);
  });

  it("input sai cũng bị tính lượt (spam không lách được giới hạn)", async () => {
    for (let i = 0; i < LOOKUP_MAX_REQUESTS; i++) await lookup({});
    expect((await lookup({})).status).toBe(429);
  });
});
