import { createTestDb, type TestDb } from "@quiq/db/testing";
import type Koa from "koa";
import { createApp } from "../app";
import type { SessionConfig } from "../http/deps";
import { createRealtimeHub, type RealtimeHub } from "../realtime/hub";
import { createTestClock, type TestClock } from "./test-clock";

export interface CreateTestAppOptions {
  /** Thư mục module khác mặc định (vd. thư mục tạm chứa module giả); bỏ trống = module thật. */
  modulesDir?: string;
  /** Cấu hình phiên cán bộ; mặc định TEST_SESSION_CONFIG (khóa cố định, cookie không Secure). */
  session?: SessionConfig;
  /** Hub SSE; mặc định hub thật với nhịp mặc định. Test stream truyền nhịp ngắn để không phải chờ thật. */
  realtime?: RealtimeHub;
}

/** Khóa phiên chỉ dùng trong test; server thật đọc SESSION_SECRET từ môi trường. */
export const TEST_SESSION_CONFIG: SessionConfig = {
  secret: "test-session-secret-khong-dung-ngoai-test-0123456789",
  secureCookie: false,
};

export interface TestApp {
  /** Dùng với supertest: `request(app.callback())`. */
  app: Koa;
  db: TestDb;
  clock: TestClock;
  realtime: RealtimeHub;
  /** Đóng PGlite; gọi trong afterEach/afterAll. */
  close: () => Promise<void>;
}

/**
 * App đầy đủ trên PGlite đã áp dụng migration thật + đồng hồ giả.
 * Mỗi lần gọi là một cơ sở dữ liệu riêng, nên test không ảnh hưởng nhau.
 * Mỗi lần gọi mất khoảng 1-2 giây (khởi động PGlite + migration): file có nhiều test nên gọi một lần ở
 * `beforeAll` rồi dọn dữ liệu giữa các test.
 */
export async function createTestApp(options: CreateTestAppOptions = {}): Promise<TestApp> {
  const testDb = await createTestDb();
  const clock = createTestClock();
  const realtime = options.realtime ?? createRealtimeHub();
  try {
    const app = await createApp({
      deps: { db: testDb.db, clock, session: options.session ?? TEST_SESSION_CONFIG, realtime },
      modulesDir: options.modulesDir,
    });
    return { app, db: testDb.db, clock, realtime, close: testDb.close };
  } catch (error) {
    await testDb.close();
    throw error;
  }
}
