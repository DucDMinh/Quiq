import type { Context } from "koa";
import { PassThrough } from "node:stream";

export interface SseChannel {
  event(name: string, data: unknown): void;
  comment(text: string): void;
  /** Kết thúc luồng phía server; gọi nhiều lần vô hại. */
  close(): void;
  /** Chạy đúng một lần khi kết nối đóng (client rời đi hoặc server đóng luồng). */
  onClose(handler: () => void): void;
}

/** Client không đọc (kết nối nửa mở, mạng nghẽn) mà đệm vượt ngưỡng này thì cắt kết nối, không giữ RAM mãi. */
export const MAX_BUFFERED_BYTES = 1024 * 1024;

/**
 * Ghi chunk vào luồng, bỏ qua khi luồng đã đóng. Đệm chưa gửi (`writableLength`) vượt `maxBufferedBytes` thì gọi
 * `onOverflow` một lần và không ghi thêm: client chậm sẽ nối lại (hoặc quay về polling) và nhận ảnh chụp mới.
 */
export function createSseWriter(
  stream: PassThrough,
  onOverflow: () => void,
  maxBufferedBytes = MAX_BUFFERED_BYTES,
): (chunk: string) => void {
  let overflowed = false;
  return (chunk) => {
    if (overflowed || stream.writableEnded || stream.destroyed) return;
    if (stream.writableLength > maxBufferedBytes) {
      overflowed = true;
      onOverflow();
      return;
    }
    stream.write(chunk);
  };
}

/**
 * Mở luồng Server-Sent Events trên ctx. Spike Layer 4: qua rewrite của Next dev sự kiện tới trong vài ms
 * với các header dưới đây. `no-transform` khiến middleware nén (Next `compress`, gói `compression`) bỏ qua
 * response này; `X-Accel-Buffering: no` tắt gom ở nginx nếu có proxy phía trước.
 */
export function openSse(ctx: Context): SseChannel {
  ctx.req.socket.setTimeout(0);
  ctx.req.socket.setNoDelay(true);
  ctx.set({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  ctx.status = 200;
  const stream = new PassThrough();
  ctx.body = stream;

  const write = createSseWriter(stream, () => {
    stream.destroy();
    ctx.res.destroy();
  });
  // Comment đầu tiên đẩy header đi ngay, client biết kết nối đã mở.
  write(": open\n\n");
  return {
    event: (name, data) => write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`),
    comment: (text) => write(`: ${text}\n\n`),
    close: () => {
      if (!stream.writableEnded) stream.end();
    },
    onClose: (handler) => {
      let called = false;
      const once = () => {
        if (called) return;
        called = true;
        handler();
      };
      ctx.res.once("close", once);
      stream.once("close", once);
      // Client đã rời đi trong lúc tính ảnh chụp đầu tiên: sự kiện close đã qua, dọn ngay.
      if (ctx.req.socket.destroyed) queueMicrotask(once);
    },
  };
}
