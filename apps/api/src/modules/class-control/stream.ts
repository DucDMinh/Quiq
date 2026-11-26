import { ROSTER_STREAM_EVENT, type RosterView } from "@quiq/shared/exams";
import type { Context } from "koa";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";
import { createSessionCheck } from "../../http/guards";
import { DEFAULT_REALTIME_TIMING } from "../../realtime/hub";
import { openSse, type SseChannel } from "../../realtime/sse";
import type { TeacherScope } from "../exams/service";
import { getRoster } from "./roster";
import { loadOwnedExamClass, type ExamClassRef } from "./service";

interface LiveRoster {
  /** Báo "lớp đổi": gộp trong `coalesceMs` rồi tính lại một lần. */
  signal: () => void;
  /** Gắn kênh sau khi ảnh chụp đầu đã gửi; tín hiệu tới trước đó được bù ngay. */
  attach: (channel: SseChannel) => void;
  stop: () => void;
}

/** Tính lại tuần tự: không bao giờ hai lần getRoster chồng nhau, tối đa một lần chờ phía sau. */
function createLiveRoster(load: () => Promise<RosterView>, coalesceMs: number): LiveRoster {
  let channel: SseChannel | null = null;
  let stopped = false;
  let running = false;
  let queued = false;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const push = async (): Promise<void> => {
    if (stopped) return;
    if (running || !channel) {
      queued = true;
      return;
    }
    running = true;
    try {
      const view = await load();
      if (!stopped) channel.event(ROSTER_STREAM_EVENT, view);
    } catch {
      // Mất quyền / DB lỗi: đóng luồng, client quay về polling. Không ném: lỗi trong timer làm sập tiến trình.
      channel.close();
    } finally {
      running = false;
      if (queued && !stopped) {
        queued = false;
        void push();
      }
    }
  };

  return {
    signal: () => {
      if (stopped || debounce) return;
      debounce = setTimeout(() => {
        debounce = null;
        void push();
      }, coalesceMs);
    },
    attach: (attached) => {
      channel = attached;
      if (queued) {
        queued = false;
        void push();
      }
    },
    stop: () => {
      stopped = true;
      if (debounce) clearTimeout(debounce);
      debounce = null;
    },
  };
}

/**
 * GET .../stream (FR-035, C-12): ảnh chụp roster ngay khi kết nối, rồi một sự kiện `roster` mỗi khi lớp đổi
 * (gộp ~250ms) và mỗi ~10 giây (presence hết hạn + keepalive). Kiểm quyền và ảnh chụp đầu chạy TRƯỚC khi mở
 * luồng, nên 401/404 vẫn là JSON thường. Mỗi kết nối giữ đúng 1 người nghe + 1 interval, dọn khi đóng.
 */
export async function openRosterStream(
  ctx: Context,
  deps: AppDeps,
  scope: TeacherScope,
  ref: ExamClassRef,
): Promise<void> {
  const { id: examClassId } = await loadOwnedExamClass(deps.db, scope, ref);
  const timing = deps.realtime?.timing ?? DEFAULT_REALTIME_TIMING;
  const sessionStillValid = createSessionCheck(deps, ctx);
  // FR-001: trước MỖI lần đẩy (kể cả nhịp định kỳ) kiểm lại phiên, KHÔNG gia hạn. Phiên bị thu hồi/hết hạn,
  // tài khoản tắt hoặc trường khóa → push ném lỗi → đóng luồng. Client quay về polling, request roster kế tiếp
  // nhận 401 (hoặc SCHOOL_LOCKED) và hiện hộp thoại hết phiên như mọi trang khác.
  const loadIfAuthorized = async () => {
    if (!(await sessionStillValid())) throw new AppError("UNAUTHENTICATED");
    return getRoster(deps, scope, ref);
  };
  const live = createLiveRoster(loadIfAuthorized, timing.coalesceMs);
  // Đăng ký trước khi chụp: thay đổi commit trong lúc chụp vẫn được bù, không phải chờ nhịp 10 giây.
  const unsubscribe = deps.realtime?.subscribe(examClassId, live.signal) ?? (() => undefined);
  let snapshot: RosterView;
  try {
    snapshot = await getRoster(deps, scope, ref);
  } catch (error) {
    unsubscribe();
    live.stop();
    throw error;
  }

  const channel = openSse(ctx);
  const refresh = setInterval(() => {
    channel.comment("keepalive");
    live.signal();
  }, timing.refreshMs);
  channel.onClose(() => {
    clearInterval(refresh);
    unsubscribe();
    live.stop();
    channel.close();
  });
  channel.event(ROSTER_STREAM_EVENT, snapshot);
  live.attach(channel);
}
