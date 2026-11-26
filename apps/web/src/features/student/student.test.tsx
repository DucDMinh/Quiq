import type { AttemptResultView, ExamPaperView, StudentStateView } from "@quiq/shared/student";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnterForm } from "./enter-form";
import { ExamView } from "./exam-view";
import { ResultView } from "./result-view";
import { WaitingRoom } from "./waiting-room";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/thi" }));

interface Reply {
  status?: number;
  body: unknown;
}
type Handler = (body: unknown) => Reply;
const handlers = new Map<string, Handler>();
const calls: Array<{ key: string; body: unknown }> = [];

/** Giả máy chủ: khóa "METHOD /api/path"; trả envelope thành công khi handler trả `data`. */
function serve(key: string, handler: Handler) {
  handlers.set(key, handler);
}
const ok = (data: unknown): Reply => ({ body: { success: true, data } });
const fail = (status: number, code: string, error: string): Reply => ({
  status,
  body: { success: false, code, error },
});

beforeEach(() => {
  handlers.clear();
  calls.length = 0;
  router.push.mockReset();
  router.replace.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${url}`;
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ key, body });
      const reply = handlers.get(key)?.(body) ?? fail(404, "NOT_FOUND", "Không tìm thấy.");
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const SERVER_NOW = "2026-03-02T08:00:00.000Z";

function stateOf(overrides: Partial<StudentStateView> = {}): StudentStateView {
  return {
    phase: "can_start",
    closedReason: null,
    exam: {
      code: "DEMO01",
      title: "Kiểm tra Toán mẫu",
      subjectName: "Toán",
      durationMinutes: 15,
      questionCount: 2,
    },
    student: { code: "HS001", fullName: "Nguyễn Văn An" },
    className: "10A1",
    attempt: null,
    attemptsUsed: 0,
    maxAttempts: 3,
    warnLimit: 2,
    serverNow: SERVER_NOW,
    ...overrides,
  };
}

const option = (question: number, n: number) => ({
  id: `o${question}${n}`,
  content: `Đáp án ${n} câu ${question}`,
});
function paperOf(endsAt: string): ExamPaperView {
  return {
    attemptId: "a1",
    attemptNo: 1,
    maxAttempts: 3,
    examTitle: "Kiểm tra Toán mẫu",
    student: { code: "HS001", fullName: "Nguyễn Văn An" },
    endsAt,
    serverNow: SERVER_NOW,
    questions: [
      {
        id: "q1",
        content: "Câu hỏi một",
        multiSelect: false,
        options: [1, 2, 3, 4].map((n) => option(1, n)),
      },
      {
        id: "q2",
        content: "Câu hỏi hai",
        multiSelect: true,
        options: [1, 2, 3, 4].map((n) => option(2, n)),
      },
    ],
    answers: {},
  };
}

describe("EnterForm", () => {
  it("bỏ trống: báo lỗi tại ô, không gọi API", async () => {
    render(<EnterForm />);
    await userEvent.click(screen.getByRole("button", { name: "Vào phòng chờ" }));
    expect(screen.getByText("Hãy nhập mã bài thi hoặc dán đường dẫn bài thi.")).toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it("vào thi đúng: gửi mã, chuyển sang phòng chờ theo mã chuẩn của máy chủ", async () => {
    serve("POST /api/student/enter", () => ok({ examCode: "DEMO01" }));
    render(<EnterForm />);
    await userEvent.type(screen.getByLabelText(/Mã bài thi/), " demo01 ");
    await userEvent.type(screen.getByLabelText(/Mã học sinh/), "hs001{Enter}");

    expect(calls[0]).toEqual({
      key: "POST /api/student/enter",
      body: { examCode: " demo01 ", studentCode: "hs001" },
    });
    expect(router.push).toHaveBeenCalledWith("/thi/DEMO01/phong-cho");
  });

  it("mã sai: hiện thông báo chung của máy chủ; mở bằng link thì ô mã bài thi bị khóa", async () => {
    serve("POST /api/student/enter", () =>
      fail(404, "STUDENT_NOT_ALLOWED", "Mã học sinh không đúng hoặc không thuộc lớp được gán."),
    );
    render(<EnterForm initialExamCode="DEMO01" />);
    expect(screen.getByLabelText(/Mã bài thi/)).toHaveValue("DEMO01");
    expect(screen.getByLabelText(/Mã bài thi/)).toHaveAttribute("readonly");
    await userEvent.type(screen.getByLabelText(/Mã học sinh/), "HS999{Enter}");

    expect(
      await screen.findByText("Mã học sinh không đúng hoặc không thuộc lớp được gán."),
    ).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("WaitingRoom", () => {
  it("chưa phát đề: nút khóa; hỏi lại sau 3 giây thấy đã phát đề thì bật, bấm Bắt đầu sang làm bài", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let phase: StudentStateView["phase"] = "waiting";
    serve("GET /api/student/state", () => ok(stateOf({ phase })));
    serve("POST /api/student/attempts", () => ({
      status: 201,
      body: { success: true, data: paperOf(SERVER_NOW) },
    }));
    render(<WaitingRoom examCode="DEMO01" />);

    const start = await screen.findByRole("button", { name: "Bắt đầu làm bài" });
    expect(start).toBeDisabled();
    expect(screen.getByText(/Đang chờ giáo viên phát đề cho lớp 10A1/)).toBeInTheDocument();
    expect(screen.getByText("Lượt sắp làm: 1/3 · Cảnh báo tối đa: 2")).toBeInTheDocument();

    phase = "can_start";
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByRole("button", { name: "Bắt đầu làm bài" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Bắt đầu làm bài" }));
    expect(calls.some((call) => call.key === "POST /api/student/attempts")).toBe(true);
    expect(router.push).toHaveBeenCalledWith("/thi/DEMO01/lam-bai");
  });

  it("phiên hết hạn: báo lỗi và đưa liên kết nhập lại mã", async () => {
    serve("GET /api/student/state", () =>
      fail(
        401,
        "STUDENT_SESSION_REQUIRED",
        "Phiên làm bài đã kết thúc. Hãy nhập lại mã để vào thi.",
      ),
    );
    render(<WaitingRoom examCode="DEMO01" />);
    expect(await screen.findByText(/Phiên làm bài đã kết thúc/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nhập lại mã" })).toHaveAttribute(
      "href",
      "/thi/DEMO01",
    );
  });
});

function serveExam(endsAt: string) {
  serve("GET /api/student/state", () =>
    ok(stateOf({ phase: "in_progress", attempt: { id: "a1", attemptNo: 1, endsAt } })),
  );
  serve("GET /api/student/attempts/a1", () => ok(paperOf(endsAt)));
  serve("PUT /api/student/attempts/a1/answers", (body) =>
    ok({ ...(body as object), serverNow: SERVER_NOW }),
  );
  serve("POST /api/student/attempts/a1/submit", () => ok({}));
}

describe("ExamView", () => {
  it("lưu mỗi lần chọn; câu chọn 1 làm mờ ô còn lại, câu chọn nhiều thì không; nộp nêu số câu chưa làm", async () => {
    serveExam("2026-03-02T08:15:00.000Z");
    render(<ExamView examCode="DEMO01" />);

    await userEvent.click(await screen.findByRole("button", { name: /Đáp án 2 câu 1/ }));
    expect(calls.find((call) => call.key === "PUT /api/student/attempts/a1/answers")?.body).toEqual(
      {
        questionId: "q1",
        optionIds: ["o12"],
      },
    );
    expect(screen.getByRole("button", { name: /Đáp án 1 câu 1/ })).toHaveAttribute(
      "data-dimmed",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "Câu 2, chưa trả lời" }));
    await userEvent.click(screen.getByRole("button", { name: /Đáp án 1 câu 2/ }));
    await userEvent.click(screen.getByRole("button", { name: /Đáp án 3 câu 2/ }));
    expect(screen.getByRole("button", { name: /Đáp án 3 câu 2/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Đáp án 2 câu 2/ })).not.toHaveAttribute(
      "data-dimmed",
    );
    await userEvent.click(screen.getByRole("button", { name: /Đáp án 1 câu 2/ }));

    expect(screen.getByRole("button", { name: "Nộp bài (2/2)" })).toBeInTheDocument();
    // Bỏ chọn hết câu 2 (câu chọn nhiều) thì câu đó tính là chưa làm, lựa chọn rỗng vẫn được lưu.
    await userEvent.click(screen.getByRole("button", { name: /Đáp án 3 câu 2/ }));
    expect(screen.getByRole("button", { name: "Nộp bài (1/2)" })).toBeInTheDocument();
    expect(calls.at(-1)).toEqual({
      key: "PUT /api/student/attempts/a1/answers",
      body: { questionId: "q2", optionIds: [] },
    });
  });

  it("xác nhận nộp: dialog nêu số câu chưa làm, nộp xong sang trang kết quả", async () => {
    serveExam("2026-03-02T08:15:00.000Z");
    render(<ExamView examCode="DEMO01" />);
    await userEvent.click(await screen.findByRole("button", { name: /Đáp án 2 câu 1/ }));
    await userEvent.click(screen.getByRole("button", { name: "Nộp bài (1/2)" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Bạn còn 1 câu chưa trả lời. Nộp bài?")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Nộp bài" }));
    expect(calls.some((call) => call.key === "POST /api/student/attempts/a1/submit")).toBe(true);
    expect(router.replace).toHaveBeenCalledWith("/thi/DEMO01/ket-qua");
  });

  it("đồng hồ theo giờ máy chủ dù máy học sinh lệch giờ; hết giờ tự nộp và sang kết quả", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-02T09:30:00.000Z")); // máy học sinh nhanh 1 giờ 30 phút
    serveExam("2026-03-02T08:00:02.000Z");
    render(<ExamView examCode="DEMO01" />);

    expect(await screen.findByRole("timer")).toHaveTextContent("00:02");
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByText("Hết giờ. Bài của bạn đang được nộp…")).toBeInTheDocument();
    expect(calls.some((call) => call.key === "POST /api/student/attempts/a1/submit")).toBe(true);
    expect(router.replace).toHaveBeenCalledWith("/thi/DEMO01/ket-qua");
  });
});

describe("ResultView", () => {
  it("hiện điểm 2 chữ số, lý do kết thúc; Xem đáp án báo chưa công bố, không lộ đáp án", async () => {
    const result: AttemptResultView = {
      attemptId: "a1",
      attemptNo: 1,
      maxAttempts: 3,
      score: 3.75,
      correct: 3,
      total: 8,
      endReason: "timeout",
      examTitle: "Kiểm tra Toán mẫu",
      examCode: "DEMO01",
      student: { code: "HS001", fullName: "Nguyễn Văn An" },
    };
    serve("GET /api/student/state", () =>
      ok(stateOf({ phase: "completed", attempt: { id: "a1", attemptNo: 1, endsAt: null } })),
    );
    serve("GET /api/student/attempts/a1/result", () => ok(result));
    render(<ResultView examCode="DEMO01" />);

    expect(await screen.findByTestId("score")).toHaveTextContent("3,75");
    expect(screen.getByText("Đúng 3/8 câu (thang 10)")).toBeInTheDocument();
    expect(screen.getByText(/Lý do kết thúc: Hết giờ/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Xem đáp án" }));
    expect(screen.getByRole("status")).toHaveTextContent("Giáo viên chưa công bố đáp án");
    expect(document.body.textContent).not.toMatch(/Đáp án \d câu/);
  });
});
