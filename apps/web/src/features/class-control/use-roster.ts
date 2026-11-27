"use client";

import {
  ROSTER_STREAM_EVENT,
  type CloseClassResult,
  type ExamClassState,
  type PublishKind,
  type RosterView,
} from "@quiq/shared/exams";
import { useCallback, useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api-client";
import { toApiError } from "@/features/exams/use-exams";

export interface ExamClassTarget {
  examId: string;
  classId: string;
}

const classPath = (t: ExamClassTarget, action: string) =>
  `/teacher/exams/${t.examId}/classes/${t.classId}/${action}`;

export const classControlApi = {
  dispatch: (t: ExamClassTarget) => api.post<ExamClassState>(classPath(t, "dispatch")),
  close: (t: ExamClassTarget) => api.post<CloseClassResult>(classPath(t, "close")),
  publish: (t: ExamClassTarget, kind: PublishKind) =>
    api.post<ExamClassState>(classPath(t, kind === "answers" ? "publish-answers" : "publish-scores")),
  roster: (t: ExamClassTarget) => api.get<RosterView>(classPath(t, "roster")),
  // Cùng origin (rewrite của Next) để cookie HttpOnly đi theo EventSource.
  streamUrl: (t: ExamClassTarget) => `/api${classPath(t, "stream")}`,
};

/** Polling dự phòng khi SSE lỗi hoặc trình duyệt không có EventSource. */
export const ROSTER_POLL_MS = 3000;
/** Sau khi SSE lỗi, thử mở lại sau khoảng này (giữa chừng vẫn polling). */
export const SSE_RETRY_MS = 10_000;
/** Server gửi ảnh chụp ngay khi kết nối: quá hạn này chưa có `roster` thì coi như luồng treo. */
export const SSE_FIRST_EVENT_MS = 5000;
/** Server gửi `roster` ít nhất mỗi 10 giây (nhịp định kỳ): im quá hạn này thì coi như luồng treo. */
export const SSE_STALL_MS = 25_000;

/** null: đang mở kết nối đầu tiên, hoặc trình duyệt không hỗ trợ SSE (chỉ polling, không hiện huy hiệu). */
export type RosterConnection = "live" | "reconnecting" | null;

interface RosterFeedHandlers {
  onRoster: (view: RosterView) => void;
  onError: (error: ApiError) => void;
  onConnection: (connection: "live" | "reconnecting") => void;
}

/** Polling 3 giây; start/stop gọi nhiều lần vô hại. */
function createRosterPoller(target: ExamClassTarget, handlers: RosterFeedHandlers) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const poll = async () => {
    try {
      const view = await classControlApi.roster(target);
      // Bỏ kết quả về muộn khi polling đã dừng (SSE nhận lại quyền cập nhật, hoặc đã đóng): không đè dữ liệu mới.
      if (timer !== undefined) handlers.onRoster(view);
    } catch (cause) {
      if (timer !== undefined) handlers.onError(toApiError(cause));
    }
  };
  return {
    start: () => {
      if (timer !== undefined) return;
      timer = setInterval(() => void poll(), ROSTER_POLL_MS);
      void poll();
    },
    stop: () => {
      clearInterval(timer);
      timer = undefined;
    },
  };
}

/** Nguồn dữ liệu bảng: SSE khi được; lỗi thì polling 3 giây và thử lại SSE sau. Trả hàm đóng mọi thứ. */
export function startRosterFeed(target: ExamClassTarget, handlers: RosterFeedHandlers): () => void {
  let closed = false;
  let source: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const poller = createRosterPoller(target, handlers);

  // Lỗi, hoặc watchdog hết hạn: tự quản việc thử lại (thay vì để EventSource tự nối) để polling chạy trong lúc chờ.
  const fallBack = (stream: EventSource) => {
    stream.close();
    clearTimeout(watchdog);
    if (closed || source !== stream) return;
    source = null;
    handlers.onConnection("reconnecting");
    poller.start();
    retryTimer = setTimeout(openStream, SSE_RETRY_MS);
  };
  // Treo ở CONNECTING hoặc proxy gom dữ liệu: không có `roster` đúng hạn thì coi như lỗi.
  const armWatchdog = (stream: EventSource, ms: number) => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => fallBack(stream), ms);
  };
  const openStream = () => {
    const stream = new EventSource(classControlApi.streamUrl(target));
    source = stream;
    armWatchdog(stream, SSE_FIRST_EVENT_MS);
    stream.addEventListener(ROSTER_STREAM_EVENT, (event: MessageEvent<string>) => {
      if (closed) return;
      armWatchdog(stream, SSE_STALL_MS);
      poller.stop();
      handlers.onConnection("live");
      handlers.onRoster(JSON.parse(event.data));
    });
    stream.onerror = () => fallBack(stream);
  };

  if (typeof EventSource === "undefined") poller.start();
  else openStream();
  return () => {
    closed = true;
    source?.close();
    poller.stop();
    clearTimeout(retryTimer);
    clearTimeout(watchdog);
  };
}

export interface RosterResult {
  roster: RosterView | null;
  error: ApiError | null;
  connection: RosterConnection;
  reload: () => void;
}

interface LoadedRoster {
  key: string;
  roster: RosterView | null;
  error: ApiError | null;
  connection: RosterConnection;
}

const EMPTY: LoadedRoster = { key: "", roster: null, error: null, connection: null };

/** Bảng trạng thái lớp đang chọn (SSE + polling dự phòng); lỗi tạm thời giữ dữ liệu cũ để màn không nháy. */
export function useRoster(target: ExamClassTarget | null): RosterResult {
  // Kết quả gắn với lớp đã nạp nó: đổi lớp thì dữ liệu lớp cũ không còn hiển thị (không cần reset trong effect).
  const [loaded, setLoaded] = useState<LoadedRoster>(EMPTY);
  const [reloadKey, setReloadKey] = useState(0);
  const examId = target?.examId;
  const classId = target?.classId;
  const key = examId && classId ? `${examId}/${classId}` : "";

  useEffect(() => {
    if (!examId || !classId) return;
    const loadedKey = `${examId}/${classId}`;
    const sameClass = (prev: LoadedRoster) => (prev.key === loadedKey ? prev : { ...EMPTY, key: loadedKey });
    // Mỗi lần đổi lớp, rời trang hoặc tải lại: hàm dọn đóng EventSource + mọi timer.
    return startRosterFeed(
      { examId, classId },
      {
        onRoster: (roster) => setLoaded((prev) => ({ ...sameClass(prev), roster, error: null })),
        onError: (error) => setLoaded((prev) => ({ ...sameClass(prev), error })),
        onConnection: (connection) => setLoaded((prev) => ({ ...sameClass(prev), connection })),
      },
    );
  }, [examId, classId, reloadKey]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);
  const current = key !== "" && loaded.key === key;
  return {
    roster: current ? loaded.roster : null,
    error: current ? loaded.error : null,
    connection: current ? loaded.connection : null,
    reload,
  };
}
