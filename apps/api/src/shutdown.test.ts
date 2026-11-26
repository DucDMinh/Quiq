import { describe, expect, it, vi } from "vitest";
import { createShutdown } from "./shutdown";

function setup(closeDb: () => Promise<void> = () => Promise.resolve()) {
  const events: string[] = [];
  let finishServerClose: () => void = () => undefined;
  const server = {
    close: vi.fn((callback: () => void) => {
      events.push("server.close");
      finishServerClose = callback;
    }),
    closeAllConnections: vi.fn(() => events.push("server.closeAllConnections")),
  };
  const closeDbSpy = vi.fn(() => {
    events.push("db.close");
    return closeDb();
  });
  const exit = vi.fn((code: number) => events.push(`exit(${code})`));
  const logError = vi.fn();
  const shutdown = createShutdown({ server, closeDb: closeDbSpy, exit, logError });
  return { events, server, closeDb: closeDbSpy, exit, logError, shutdown, finishServerClose: () => finishServerClose() };
}

describe("createShutdown", () => {
  it("đóng server xong mới đóng pool DB rồi thoát mã 0", async () => {
    const t = setup();

    t.shutdown();
    expect(t.events).toEqual(["server.close", "server.closeAllConnections"]);
    expect(t.closeDb).not.toHaveBeenCalled();

    t.finishServerClose();
    await vi.waitFor(() => expect(t.exit).toHaveBeenCalledWith(0));
    expect(t.events).toEqual(["server.close", "server.closeAllConnections", "db.close", "exit(0)"]);
  });

  it("gọi lần hai (SIGINT rồi SIGTERM) không làm gì thêm", async () => {
    const t = setup();

    t.shutdown();
    t.shutdown();
    t.finishServerClose();
    await vi.waitFor(() => expect(t.exit).toHaveBeenCalled());
    t.shutdown();

    expect(t.server.close).toHaveBeenCalledTimes(1);
    expect(t.closeDb).toHaveBeenCalledTimes(1);
    expect(t.exit).toHaveBeenCalledTimes(1);
  });

  it("đóng pool lỗi thì ghi log và thoát mã 1", async () => {
    const failure = new Error("pool end failed");
    const t = setup(() => Promise.reject(failure));

    t.shutdown();
    t.finishServerClose();

    await vi.waitFor(() => expect(t.exit).toHaveBeenCalledWith(1));
    expect(t.logError).toHaveBeenCalledWith(failure);
  });
});
