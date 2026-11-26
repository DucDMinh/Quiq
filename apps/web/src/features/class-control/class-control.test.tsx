import type { RosterStatus, RosterView } from "@quiq/shared/exams";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionBadge, RosterTable } from "./roster-table";
import {
  ROSTER_POLL_MS,
  SSE_FIRST_EVENT_MS,
  SSE_RETRY_MS,
  SSE_STALL_MS,
  useRoster,
  type ExamClassTarget,
} from "./use-roster";

/** EventSource giả: test tự phát sự kiện `roster` hoặc lỗi, và kiểm kết nối đã đóng chưa. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  closed = false;
  onerror: (() => void) | null = null;
  private readonly listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close() {
    this.closed = true;
  }

  emit(view: RosterView) {
    const event = new MessageEvent("roster", { data: JSON.stringify(view) });
    for (const listener of this.listeners.get("roster") ?? []) listener(event);
  }

  fail() {
    this.onerror?.();
  }
}

const latestSource = () => {
  const source = FakeEventSource.instances.at(-1);
  if (!source) throw new Error("chưa có EventSource nào");
  return source;
};

const EXAM = "e1";
const target = (classId: string): ExamClassTarget => ({ examId: EXAM, classId });
const rosterUrl = (classId: string) => `/api/teacher/exams/${EXAM}/classes/${classId}/roster`;

function rosterOf(status: RosterStatus, interrupted = false): RosterView {
  return {
    examClass: {
      examId: EXAM,
      classId: "c1",
      className: "10A1",
      status: "dispatched",
      dispatchedAt: null,
      closedAt: null,
      maxAttempts: 1,
      warnLimit: 3,
      interruptSecs: 60,
    },
    students: [
      { studentId: "s1", code: "HS001", fullName: "An", status, attemptsUsed: 1, bestScore: null, interrupted },
    ],
    counts: { not_started: 0, waiting: 0, in_progress: 0, submitted: 0, [status]: 1 },
    serverNow: "2026-03-01T08:00:00.000Z",
  };
}

function Harness({ classId }: { classId: string }) {
  const { roster, connection } = useRoster(target(classId));
  return (
    <>
      <ConnectionBadge connection={connection} />
      {roster ? <RosterTable students={roster.students} /> : null}
    </>
  );
}

let pollReply: RosterView;
const fetchMock = vi.fn(async (url: string) => {
  void url;
  return new Response(JSON.stringify({ success: true, data: pollReply }), { status: 200 });
});
const rosterFetches = (classId: string) => fetchMock.mock.calls.filter(([url]) => url === rosterUrl(classId)).length;
const flush = () => act(async () => vi.advanceTimersByTimeAsync(0));
const advance = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  fetchMock.mockClear();
  pollReply = rosterOf("waiting");
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useRoster qua SSE", () => {
  it("mở luồng cùng origin, cập nhật bảng từ sự kiện roster, huy hiệu Trực tiếp, không polling", async () => {
    render(<Harness classId="c1" />);
    expect(latestSource().url).toBe(`/api/teacher/exams/${EXAM}/classes/c1/stream`);
    act(() => latestSource().emit(rosterOf("in_progress")));
    expect(screen.getByText("Đang làm")).toBeInTheDocument();
    expect(screen.getByText("Trực tiếp")).toBeInTheDocument();

    await advance(ROSTER_POLL_MS * 4);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("SSE lỗi: quay về polling 3 giây, huy hiệu Đang kết nối lại; mở lại SSE sau và dừng polling", async () => {
    render(<Harness classId="c1" />);
    const first = latestSource();
    act(() => first.fail());
    await flush();
    expect(first.closed).toBe(true);
    expect(screen.getByText("Đang kết nối lại")).toBeInTheDocument();
    expect(screen.getByText("Đang chờ")).toBeInTheDocument();
    expect(rosterFetches("c1")).toBe(1);

    pollReply = rosterOf("submitted");
    await advance(ROSTER_POLL_MS);
    expect(rosterFetches("c1")).toBe(2);
    expect(screen.getByText("Đã nộp")).toBeInTheDocument();

    await advance(SSE_RETRY_MS - ROSTER_POLL_MS);
    const second = latestSource();
    expect(second).not.toBe(first);
    act(() => second.emit(rosterOf("in_progress")));
    expect(screen.getByText("Trực tiếp")).toBeInTheDocument();
    const fetchesAfterLive = rosterFetches("c1");
    await advance(ROSTER_POLL_MS * 3);
    expect(rosterFetches("c1")).toBe(fetchesAfterLive);
    expect(screen.getByText("Đang làm")).toBeInTheDocument();
  });

  it("đổi lớp đóng luồng cũ và mở luồng lớp mới; unmount đóng luồng và dừng mọi timer", async () => {
    const view = render(<Harness classId="c1" />);
    const first = latestSource();
    view.rerender(<Harness classId="c2" />);
    expect(first.closed).toBe(true);
    const second = latestSource();
    expect(second.url).toBe(`/api/teacher/exams/${EXAM}/classes/c2/stream`);

    act(() => second.fail());
    await flush();
    view.unmount();
    expect(second.closed).toBe(true);
    const fetches = fetchMock.mock.calls.length;
    await advance(SSE_RETRY_MS * 2);
    expect(fetchMock.mock.calls.length).toBe(fetches);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("EventSource treo, không có roster trong 5 giây: đóng luồng, polling, Đang kết nối lại, thử lại sau", async () => {
    render(<Harness classId="c1" />);
    const hung = latestSource();
    await advance(SSE_FIRST_EVENT_MS - 1);
    expect(hung.closed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    await advance(1);
    expect(hung.closed).toBe(true);
    expect(screen.getByText("Đang kết nối lại")).toBeInTheDocument();
    expect(screen.getByText("Đang chờ")).toBeInTheDocument();
    expect(rosterFetches("c1")).toBe(1);
    await advance(SSE_RETRY_MS);
    expect(latestSource()).not.toBe(hung);
  });

  it("đang trực tiếp mà im quá 25 giây: quay về polling", async () => {
    render(<Harness classId="c1" />);
    const quiet = latestSource();
    act(() => quiet.emit(rosterOf("in_progress")));
    await advance(SSE_STALL_MS - 1);
    expect(quiet.closed).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    await advance(1);
    expect(quiet.closed).toBe(true);
    expect(screen.getByText("Đang kết nối lại")).toBeInTheDocument();
    expect(rosterFetches("c1")).toBe(1);
  });

  it("học sinh có cờ interrupted hiện huy hiệu Gián đoạn", () => {
    render(<Harness classId="c1" />);
    act(() => latestSource().emit(rosterOf("not_started", true)));
    expect(screen.getByText("Gián đoạn")).toBeInTheDocument();
  });
});
