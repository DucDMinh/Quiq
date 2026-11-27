import type { ExamClassState } from "@quiq/shared/exams";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { PublishActions } from "./publish-actions";

const EXAM = "e1";
const CLASS = "c1";
const target = { examId: EXAM, classId: CLASS };
const publishUrl = (action: string) => `/api/teacher/exams/${EXAM}/classes/${CLASS}/${action}`;

function classState(overrides: Partial<ExamClassState> = {}): ExamClassState {
  return {
    examId: EXAM,
    classId: CLASS,
    className: "10A1",
    status: "closed",
    dispatchedAt: "2026-03-01T07:00:00.000Z",
    closedAt: "2026-03-01T08:00:00.000Z",
    maxAttempts: 1,
    warnLimit: 3,
    interruptSecs: 60,
    answersPublishedAt: null,
    scoresPublishedAt: null,
    otherClassesOpen: false,
    ...overrides,
  };
}

const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  void init;
  const published = url === publishUrl("publish-answers") ? { answersPublishedAt: "2026-03-01T09:00:00.000Z" } : {};
  return new Response(JSON.stringify({ success: true, data: classState(published) }), { status: 200 });
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderActions = (examClass: ExamClassState, onDone = vi.fn(), inProgress = 0) =>
  render(
    <ToastProvider>
      <PublishActions target={target} className="10A1" examClass={examClass} inProgress={inProgress} onDone={onDone} />
    </ToastProvider>,
  );

describe("PublishActions", () => {
  it("lớp chưa thu bài: hai nút bị khóa, có gợi ý thu bài trước", () => {
    renderActions(classState({ status: "dispatched", closedAt: null }));
    expect(screen.getByRole("button", { name: "Công bố đáp án" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Công bố bảng điểm" })).toBeDisabled();
    expect(screen.getByText("Thu bài trước khi công bố.")).toBeInTheDocument();
  });

  it("lớp đã đóng nhưng còn bài đang làm (thu bài lỗi giữa chừng): hai nút bị khóa, gợi ý thu bài lại", () => {
    renderActions(classState(), vi.fn(), 1);
    expect(screen.getByRole("button", { name: "Công bố đáp án" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Công bố bảng điểm" })).toBeDisabled();
    expect(screen.getByText("Thu bài lại trước khi công bố.")).toBeInTheDocument();
  });

  it("lớp đã thu bài: dialog nêu không hủy được; xác nhận gọi đúng API rồi báo xong; Hủy thì không gọi", async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();
    renderActions(classState(), onDone);
    expect(screen.queryByText("Thu bài trước khi công bố.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Công bố bảng điểm" }));
    expect(await screen.findByText("Không thể hủy công bố sau khi xác nhận.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Công bố đáp án" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Không thể hủy công bố");
    await user.click(screen.getAllByRole("button", { name: "Công bố đáp án" }).at(-1)!);
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${url}`)).toEqual([
      `POST ${publishUrl("publish-answers")}`,
    ]);
  });

  it("lớp khác của bài chưa thu bài xong: khóa riêng Công bố đáp án, bảng điểm vẫn bấm được", () => {
    renderActions(classState({ otherClassesOpen: true }));
    expect(screen.getByRole("button", { name: "Công bố đáp án" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Công bố bảng điểm" })).toBeEnabled();
    expect(screen.getByText("Mọi lớp của bài phải thu bài trước khi công bố đáp án.")).toBeInTheDocument();
  });

  it("đã công bố: thay nút bằng badge riêng cho từng loại", () => {
    renderActions(classState({ answersPublishedAt: "2026-03-01T09:00:00.000Z" }));
    expect(screen.getByText("Đáp án: Đã công bố")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Công bố đáp án" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Công bố bảng điểm" })).toBeEnabled();
  });
});
