import type { ExamListItem, RosterView } from "@quiq/shared/exams";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { ControlPanel } from "@/features/class-control/control-panel";
import { CreateExamDialog } from "./create-exam-dialog";
import { ExamTable } from "./exam-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/giao-vien/bai-thi",
}));

interface Reply {
  status?: number;
  body: unknown;
}
const handlers = new Map<string, (body: unknown) => Reply>();
const calls: Array<{ key: string; body: unknown }> = [];

const serve = (key: string, handler: (body: unknown) => Reply) => handlers.set(key, handler);
const ok = (data: unknown): Reply => ({ body: { success: true, data } });
const fail = (status: number, code: string, error: string, details?: unknown): Reply => ({
  status,
  body: { success: false, code, error, details },
});

beforeEach(() => {
  handlers.clear();
  calls.length = 0;
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
  vi.unstubAllGlobals();
});

const withToast = (node: ReactNode) => render(<ToastProvider>{node}</ToastProvider>);

const CLASS_A = "11111111-1111-4111-8111-111111111111";
const EXAM_ID = "22222222-2222-4222-8222-222222222222";

function examOf(overrides: Partial<ExamListItem> = {}): ExamListItem {
  return {
    id: EXAM_ID,
    code: "AB23CD",
    link: "/thi/AB23CD",
    title: "Kiểm tra 15 phút",
    durationMinutes: 15,
    drawConfig: { total: 3, easy: 2, medium: 1, hard: 0 },
    classes: [{ classId: CLASS_A, className: "10A1", status: "draft" }],
    attemptCount: 0,
    createdAt: "2026-03-01T08:00:00.000Z",
    ...overrides,
  };
}

function serveCreateOptions() {
  serve("GET /api/teacher/exams/classes", () =>
    ok([{ classId: CLASS_A, className: "10A1", academicYearName: "2026-2027" }]),
  );
  serve("GET /api/teacher/exams/bank-counts", () => ok({ easy: 5, medium: 3, hard: 2 }));
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Tên bài thi/), "Kiểm tra chương 1");
  await user.type(screen.getByLabelText(/Tổng số câu/), "4");
  await user.type(screen.getByLabelText(/Số câu Dễ/), "2");
  await user.type(screen.getByLabelText(/Số câu Trung bình/), "1");
  await user.type(screen.getByLabelText(/Số câu Khó/), "1");
  await user.click(screen.getByRole("checkbox", { name: /10A1/ }));
}

describe("CreateExamDialog", () => {
  it("hiện số câu hiện có theo mức và báo thiếu tại chỗ, không gửi request", async () => {
    serveCreateOptions();
    const user = userEvent.setup();
    withToast(<CreateExamDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);

    expect(await screen.findByText("Hiện có 2 câu")).toBeInTheDocument();
    expect(screen.getByText("Hiện có 5 câu")).toBeInTheDocument();
    await fillValidForm(user);
    await user.clear(screen.getByLabelText(/Số câu Khó/));
    await user.type(screen.getByLabelText(/Số câu Khó/), "5");
    await user.clear(screen.getByLabelText(/Tổng số câu/));
    await user.type(screen.getByLabelText(/Tổng số câu/), "8");
    await user.click(screen.getByRole("button", { name: "Tạo bài thi" }));

    expect(await screen.findByText("Ngân hàng chỉ có 2 câu Khó, cần 5.")).toBeInTheDocument();
    expect(calls.some((c) => c.key === "POST /api/teacher/exams")).toBe(false);
  });

  it("gửi đúng body, báo tạo xong; lỗi 422 của máy chủ hiện ngay dưới ô của mức thiếu", async () => {
    serveCreateOptions();
    let reply: Reply = fail(422, "INSUFFICIENT_QUESTIONS", "Ngân hàng chỉ có 0 câu Khó, cần 1.", {
      difficulty: "hard",
      have: 0,
      need: 1,
    });
    serve("POST /api/teacher/exams", () => reply);
    const onCreated = vi.fn();
    const user = userEvent.setup();
    withToast(<CreateExamDialog open onOpenChange={vi.fn()} onCreated={onCreated} />);
    await screen.findByText("Hiện có 2 câu");
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Tạo bài thi" }));
    expect(await screen.findByText("Ngân hàng chỉ có 0 câu Khó, cần 1.")).toBeInTheDocument();
    expect(calls.find((c) => c.key === "POST /api/teacher/exams")?.body).toEqual({
      title: "Kiểm tra chương 1",
      durationMinutes: 15,
      drawConfig: { total: 4, easy: 2, medium: 1, hard: 1 },
      classIds: [CLASS_A],
    });

    reply = ok(examOf());
    await user.click(screen.getByRole("button", { name: "Tạo bài thi" }));
    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledWith(examOf()));
  });
});

describe("ExamTable", () => {
  it("nút Xóa bị khóa kèm lý do khi đã có lượt thi; đề chưa ai làm thì xóa qua dialog xác nhận", async () => {
    serve(`DELETE /api/teacher/exams/${EXAM_ID}`, () => ok({ id: EXAM_ID }));
    const onChanged = vi.fn();
    const user = userEvent.setup();
    const locked = examOf({ id: "33333333-3333-4333-8333-333333333333", title: "Đã thi", attemptCount: 2 });
    withToast(<ExamTable exams={[examOf(), locked]} onChanged={onChanged} />);

    const lockedRow = screen.getByText("Đã thi").closest("tr")!;
    const lockedDelete = within(lockedRow).getByRole("button", { name: "Xóa" });
    expect(lockedDelete).toBeDisabled();
    expect(lockedDelete).toHaveAttribute("title", "Bài thi đã có học sinh làm nên không xóa được.");

    const row = screen.getByText("Kiểm tra 15 phút").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Xóa" }));
    await user.click(await screen.findByRole("button", { name: "Xóa bài thi" }));
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls.some((c) => c.key === `DELETE /api/teacher/exams/${EXAM_ID}`)).toBe(true);
  });
});

function rosterOf(status: "draft" | "dispatched", inProgress: number): RosterView {
  return {
    examClass: {
      examId: EXAM_ID,
      classId: CLASS_A,
      className: "10A1",
      status,
      dispatchedAt: null,
      closedAt: null,
      maxAttempts: null,
      warnLimit: null,
      interruptSecs: null,
      answersPublishedAt: null,
      scoresPublishedAt: null,
      otherClassesOpen: false,
    },
    students: [
      {
        studentId: "s1",
        code: "HS001",
        fullName: "Nguyễn Văn An",
        status: inProgress > 0 ? "in_progress" : "submitted",
        attemptsUsed: 1,
        bestScore: inProgress > 0 ? null : 7.5,
        interrupted: false,
      },
    ],
    counts: { not_started: 0, waiting: 0, in_progress: inProgress, submitted: inProgress > 0 ? 0 : 1 },
    serverNow: "2026-03-01T08:00:00.000Z",
  };
}

describe("ControlPanel", () => {
  const rosterKey = `GET /api/teacher/exams/${EXAM_ID}/classes/${CLASS_A}/roster`;

  it("lớp chưa phát: chỉ bật Phát đề, xác nhận qua dialog rồi gọi API", async () => {
    serve("GET /api/teacher/exams", () => ok([examOf()]));
    serve(rosterKey, () => ok(rosterOf("draft", 0)));
    serve(`POST /api/teacher/exams/${EXAM_ID}/classes/${CLASS_A}/dispatch`, () => ok(rosterOf("dispatched", 0).examClass));
    const user = userEvent.setup();
    withToast(<ControlPanel initialExamId={EXAM_ID} />);

    const dispatch = await screen.findByRole("button", { name: "Phát đề cho lớp 10A1" });
    await vi.waitFor(() => expect(dispatch).toBeEnabled());
    expect(screen.getByRole("button", { name: "Đóng / Thu bài lớp 10A1" })).toBeDisabled();
    expect(screen.getByText("7,5")).toBeInTheDocument();

    await user.click(dispatch);
    await user.click(await screen.findByRole("button", { name: "Phát đề" }));
    await vi.waitFor(() =>
      expect(calls.some((c) => c.key === `POST /api/teacher/exams/${EXAM_ID}/classes/${CLASS_A}/dispatch`)).toBe(true),
    );
  });

  it("thu bài: dialog nêu số học sinh đang làm sẽ bị nộp, xác nhận thì gọi API", async () => {
    serve("GET /api/teacher/exams", () => ok([examOf({ classes: [{ classId: CLASS_A, className: "10A1", status: "dispatched" }] })]));
    serve(rosterKey, () => ok(rosterOf("dispatched", 1)));
    serve(`POST /api/teacher/exams/${EXAM_ID}/classes/${CLASS_A}/close`, () =>
      ok({ examClass: rosterOf("dispatched", 0).examClass, finalizedAttempts: 1 }),
    );
    const user = userEvent.setup();
    withToast(<ControlPanel initialExamId={EXAM_ID} />);

    const close = await screen.findByRole("button", { name: "Đóng / Thu bài lớp 10A1" });
    await vi.waitFor(() => expect(close).toBeEnabled());
    expect(screen.getByText("Đang làm", { selector: "span" })).toBeInTheDocument();
    await user.click(close);
    expect(await screen.findByText("1 học sinh đang làm sẽ bị nộp ngay.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thu bài" }));
    await vi.waitFor(() =>
      expect(calls.some((c) => c.key === `POST /api/teacher/exams/${EXAM_ID}/classes/${CLASS_A}/close`)).toBe(true),
    );
  });

  it("lớp đã đóng nhưng còn học sinh Đang làm: nút Thu bài lại bật để phục hồi", async () => {
    serve("GET /api/teacher/exams", () => ok([examOf()]));
    const stuck = rosterOf("dispatched", 1);
    serve(rosterKey, () => ok({ ...stuck, examClass: { ...stuck.examClass, status: "closed" } }));
    withToast(<ControlPanel initialExamId={EXAM_ID} />);
    const reclose = await screen.findByRole("button", { name: "Thu bài lại lớp 10A1" });
    await vi.waitFor(() => expect(reclose).toBeEnabled());
  });

  it("chưa có bài thi: empty state dẫn tới trang Bài thi", async () => {
    serve("GET /api/teacher/exams", () => ok([]));
    withToast(<ControlPanel />);
    expect(await screen.findByText("Chưa có bài thi nào")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đi tới Bài thi" })).toHaveAttribute("href", "/giao-vien/bai-thi");
  });
});
