import { createServer, request as httpRequest, type IncomingHttpHeaders } from "node:http";
import type Koa from "koa";

export interface SseEvent {
  event: string;
  data: string;
}

export interface TestServer {
  port: number;
  /** Cắt mọi kết nối còn mở (luồng SSE) rồi đóng server. */
  close: () => Promise<void>;
}

/** Server HTTP thật trên cổng ngẫu nhiên: supertest không đọc được luồng chưa kết thúc. */
export async function listenTestServer(app: Koa): Promise<TestServer> {
  const server = createServer(app.callback());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server chưa có cổng");
  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export interface SseClient {
  status: number;
  headers: IncomingHttpHeaders;
  /** Các comment (`: ...`) đã nhận, vd keepalive. */
  comments: string[];
  /** Toàn bộ body khi response kết thúc (dùng cho 401/404). */
  text: () => Promise<string>;
  /** Sự kiện KẾ TIẾP (tính từ lần chờ trước) thỏa `match`, trong `timeoutMs`; sự kiện không khớp bị bỏ qua. */
  waitFor: (match: (event: SseEvent) => boolean, timeoutMs: number) => Promise<SseEvent>;
  close: () => void;
  /** Server đã kết thúc response (luồng bị đóng phía server). */
  ended: () => boolean;
}

function parseBlock(block: string, events: SseEvent[], comments: string[]): void {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith(":")) comments.push(line.slice(1).trim());
    else if (line.startsWith("event: ")) event = line.slice("event: ".length);
    else if (line.startsWith("data: ")) data.push(line.slice("data: ".length));
  }
  if (data.length > 0) events.push({ event, data: data.join("\n") });
}

/** Tách chunk thành sự kiện và cho test chờ theo thứ tự đến. */
function createEventReader() {
  const events: SseEvent[] = [];
  const comments: string[] = [];
  let buffer = "";
  let cursor = 0;
  let ended = false;
  let wake: (() => void) | null = null;

  const waitFor: SseClient["waitFor"] = async (match, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      for (let event = events[cursor]; event; event = events[cursor]) {
        cursor += 1;
        if (match(event)) return event;
      }
      if (ended) throw new Error("luồng SSE đã đóng trước khi có sự kiện cần chờ");
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`không có sự kiện cần chờ sau ${timeoutMs}ms`);
      await new Promise<void>((wakeUp) => {
        const timer = setTimeout(wakeUp, left);
        wake = () => {
          clearTimeout(timer);
          wakeUp();
        };
      });
      wake = null;
    }
  };
  return {
    comments,
    waitFor,
    isEnded: () => ended,
    push: (chunk: string) => {
      buffer += chunk;
      for (let sep = buffer.indexOf("\n\n"); sep >= 0; sep = buffer.indexOf("\n\n")) {
        parseBlock(buffer.slice(0, sep), events, comments);
        buffer = buffer.slice(sep + 2);
      }
      wake?.();
    },
    end: () => {
      ended = true;
      wake?.();
    },
  };
}

/** Mở GET luồng SSE và đọc từng chunk thật từ socket. */
export function connectSse(port: number, path: string, cookie?: string): Promise<SseClient> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { accept: "text/event-stream" };
    if (cookie) headers.cookie = cookie;
    const req = httpRequest({ host: "127.0.0.1", port, path, headers }, (res) => {
      res.setEncoding("utf8");
      const reader = createEventReader();
      let raw = "";
      res.on("data", (chunk: string) => {
        raw += chunk;
        reader.push(chunk);
      });
      const finished = new Promise<string>((done) => {
        res.on("end", () => {
          reader.end();
          done(raw);
        });
      });
      res.on("error", () => undefined);
      resolve({
        status: res.statusCode ?? 0,
        headers: res.headers,
        comments: reader.comments,
        text: () => finished,
        waitFor: reader.waitFor,
        close: () => req.destroy(),
        ended: reader.isEnded,
      });
    });
    req.on("error", reject);
    req.end();
  });
}

/** Hỏi lại điều kiện mỗi 10ms tới hạn `timeoutMs` (dọn dẹp chạy bất đồng bộ sau khi socket đóng). */
export async function waitUntil(check: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`điều kiện chưa đúng sau ${timeoutMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
