import type { Question, QuestionListResult } from "@quiq/shared/questions";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { QuestionBank } from "./question-list";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const success = (data: unknown, status = 200) => jsonResponse({ success: true, data }, status);
const failure = (status: number, code: string, error: string, details?: unknown) =>
  jsonResponse({ success: false, code, error, details }, status);

type Route = (init: RequestInit) => Response | Promise<Response>;

/** fetch giả theo "METHOD đường-dẫn"; đường dẫn không khai thì test rớt để không âm thầm khớp sai. */
function mockApi(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const route = routes[`${init.method ?? "GET"} ${url}`];
    if (!route) throw new Error(`Không mô phỏng: ${init.method} ${url}`);
    return route(init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const bodyOf = (init: RequestInit) => JSON.parse(String(init.body)) as unknown;

// Dựng từ mã ký tự: quy tắc mã nguồn cấm ký tự em-dash xuất hiện trong file.
const EM_DASH = String.fromCharCode(0x2014);

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: "q-1",
    content: "Thủ đô của Việt Nam là gì?",
    difficulty: "easy",
    multiSelect: false,
    options: [
      { id: "o-1", content: "Hà Nội", isCorrect: true, position: 0 },
      { id: "o-2", content: "Huế", isCorrect: false, position: 1 },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeList(items: Question[], overrides: Partial<QuestionListResult> = {}): QuestionListResult {
  return {
    subject: { id: "subject-1", name: "Địa lý" },
    stats: { total: 3, easy: 2, medium: 1, hard: 0 },
    items,
    total: items.length,
    page: 1,
    pageSize: 25,
    ...overrides,
  };
}

const LIST_URL = "GET /api/teacher/questions?page=1";

function renderBank() {
  return render(
    <ToastProvider>
      <QuestionBank />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("màn ngân hàng câu hỏi", () => {
  it("hiện KPI, danh sách với đáp án đúng; lọc pill gọi API theo mức", async () => {
    const easy = makeQuestion();
    const medium = makeQuestion({ id: "q-2", content: "Sông dài nhất?", difficulty: "medium" });
    const fetchMock = mockApi({
      [LIST_URL]: () => success(makeList([easy, medium])),
      "GET /api/teacher/questions?difficulty=medium&page=1": () => success(makeList([medium], { total: 1 })),
    });
    const user = userEvent.setup();
    renderBank();

    expect(await screen.findByText("Thủ đô của Việt Nam là gì?")).toBeInTheDocument();
    expect(screen.getByText(/Môn Địa lý/)).toBeInTheDocument();
    const kpis = screen.getByRole("region", { name: "Thống kê câu hỏi" });
    expect(within(kpis).getByText("Trung bình").parentElement).toHaveTextContent("1");
    const list = screen.getByRole("list", { name: "Danh sách câu hỏi" });
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Đáp án đúng: A");

    const filter = screen.getByRole("group", { name: "Lọc theo mức khó" });
    await user.click(within(filter).getByRole("button", { name: "Trung bình" }));

    await waitFor(() => expect(screen.queryByText("Thủ đô của Việt Nam là gì?")).not.toBeInTheDocument());
    expect(screen.getByText("Sông dài nhất?")).toBeInTheDocument();
    expect(within(filter).getByRole("button", { name: "Trung bình" })).toHaveAttribute("aria-pressed", "true");
    expect(within(filter).getByRole("button", { name: "Tất cả" })).toHaveAttribute("aria-pressed", "false");
    expect(fetchMock).toHaveBeenCalledWith("/api/teacher/questions?difficulty=medium&page=1", expect.anything());
    expect(document.body.textContent).not.toContain(EM_DASH);
  });

  it("ngân hàng trống: thông báo và nút Thêm câu hỏi", async () => {
    mockApi({ [LIST_URL]: () => success(makeList([], { stats: { total: 0, easy: 0, medium: 0, hard: 0 } })) });
    renderBank();
    expect(await screen.findByText("Chưa có câu hỏi nào")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Thêm câu hỏi" })).toHaveLength(2);
  });

  it("lỗi tải: hiện lỗi và Thử lại tải lại", async () => {
    let calls = 0;
    mockApi({
      [LIST_URL]: () => {
        calls += 1;
        return calls === 1 ? failure(500, "INTERNAL", "Đã có lỗi xảy ra.") : success(makeList([makeQuestion()]));
      },
    });
    const user = userEvent.setup();
    renderBank();
    expect(await screen.findByText("Không tải được ngân hàng câu hỏi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Thủ đô của Việt Nam là gì?")).toBeInTheDocument();
  });

  it("hơn 25 câu: có phân trang và chuyển trang", async () => {
    const fetchMock = mockApi({
      [LIST_URL]: () => success(makeList([makeQuestion()], { total: 30 })),
      "GET /api/teacher/questions?page=2": () =>
        success(makeList([makeQuestion({ id: "q-26", content: "Câu trang hai" })], { total: 30, page: 2 })),
    });
    const user = userEvent.setup();
    renderBank();
    expect(await screen.findByText("Trang 1 / 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Trang sau" }));
    expect(await screen.findByText("Câu trang hai")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/teacher/questions?page=2", expect.anything());
  });

  it("xóa: dialog nêu hậu quả, xác nhận thì gọi DELETE và tải lại", async () => {
    const question = makeQuestion();
    let deleted = false;
    mockApi({
      [LIST_URL]: () => success(makeList(deleted ? [] : [question])),
      "DELETE /api/teacher/questions/q-1": () => {
        deleted = true;
        return success({ id: "q-1" });
      },
    });
    const user = userEvent.setup();
    renderBank();
    await user.click(await screen.findByRole("button", { name: "Xóa câu hỏi: Thủ đô của Việt Nam là gì?" }));

    const dialog = await screen.findByRole("dialog", { name: "Xóa câu hỏi?" });
    expect(dialog).toHaveTextContent("xóa vĩnh viễn");
    expect(dialog).toHaveTextContent("Các bài thi đã tạo vẫn giữ nguyên");
    await user.click(within(dialog).getByRole("button", { name: "Xóa câu hỏi" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(deleted).toBe(true);
    expect(await screen.findByText("Đã xóa câu hỏi")).toBeInTheDocument();
  });
});

describe("dialog soạn câu hỏi", () => {
  async function openCreateDialog() {
    const user = userEvent.setup();
    renderBank();
    const addButton = await screen.findByRole("button", { name: "Thêm câu hỏi" });
    await user.click(addButton);
    const dialog = await screen.findByRole("dialog", { name: "Thêm câu hỏi" });
    return { user, dialog, addButton };
  }

  it("kiểm lỗi tại chỗ: nội dung rỗng, đáp án rỗng, chưa có đáp án đúng", async () => {
    mockApi({ [LIST_URL]: () => success(makeList([makeQuestion()])) });
    const { user, dialog } = await openCreateDialog();

    await user.click(within(dialog).getByRole("button", { name: "Lưu câu hỏi" }));
    expect(within(dialog).getByText("Nhập nội dung câu hỏi")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Nhập nội dung đáp án")).toHaveLength(4);
    expect(within(dialog).getByRole("textbox", { name: /Nội dung câu hỏi/ })).toHaveAttribute("aria-invalid", "true");

    await user.type(within(dialog).getByRole("textbox", { name: /Nội dung câu hỏi/ }), "2 + 2 = ?");
    await user.click(within(dialog).getByRole("button", { name: "Xóa đáp án D" }));
    await user.click(within(dialog).getByRole("button", { name: "Xóa đáp án C" }));
    expect(within(dialog).getByRole("button", { name: "Xóa đáp án B" })).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox", { name: "Nội dung đáp án A" }), "4");
    await user.type(within(dialog).getByRole("textbox", { name: "Nội dung đáp án B" }), "5");
    await user.click(within(dialog).getByRole("button", { name: "Lưu câu hỏi" }));
    expect(within(dialog).getByText("Cần ít nhất 1 đáp án đúng")).toBeInTheDocument();
  });

  it("lưu câu một đáp án: gửi đúng body, đóng dialog, trả focus về nút mở", async () => {
    let posted: unknown;
    mockApi({
      [LIST_URL]: () => success(makeList([makeQuestion()])),
      "POST /api/teacher/questions": (init) => {
        posted = bodyOf(init);
        return success(makeQuestion({ id: "q-new" }), 201);
      },
    });
    const { user, dialog, addButton } = await openCreateDialog();

    await user.type(within(dialog).getByRole("textbox", { name: /Nội dung câu hỏi/ }), "2 + 2 = ?");
    for (const [letter, text] of [["A", "3"], ["B", "4"], ["C", "5"], ["D", "6"]] as const) {
      await user.type(within(dialog).getByRole("textbox", { name: `Nội dung đáp án ${letter}` }), text);
    }
    await user.click(within(dialog).getByRole("radio", { name: "Đáp án B đúng" }));
    await user.click(within(dialog).getByRole("radio", { name: "Khó" }));
    await user.click(within(dialog).getByRole("button", { name: "Lưu câu hỏi" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(posted).toEqual({
      content: "2 + 2 = ?",
      difficulty: "hard",
      multiSelect: false,
      options: [
        { content: "3", isCorrect: false },
        { content: "4", isCorrect: true },
        { content: "5", isCorrect: false },
        { content: "6", isCorrect: false },
      ],
    });
    expect(addButton).toHaveFocus();
    expect(await screen.findByText("Đã thêm câu hỏi")).toBeInTheDocument();
  });

  it("sửa câu nhiều đáp án sang một đáp án: tắt công tắc chỉ giữ đáp án đúng đầu tiên", async () => {
    const multi = makeQuestion({
      multiSelect: true,
      options: [
        { id: "o-1", content: "Hà Nội", isCorrect: false, position: 0 },
        { id: "o-2", content: "Huế", isCorrect: true, position: 1 },
        { id: "o-3", content: "Đà Nẵng", isCorrect: true, position: 2 },
      ],
    });
    let put: unknown;
    mockApi({
      [LIST_URL]: () => success(makeList([multi])),
      "PUT /api/teacher/questions/q-1": (init) => {
        put = bodyOf(init);
        return success(multi);
      },
    });
    const user = userEvent.setup();
    renderBank();
    await user.click(await screen.findByRole("button", { name: "Sửa câu hỏi: Thủ đô của Việt Nam là gì?" }));
    const dialog = await screen.findByRole("dialog", { name: "Sửa câu hỏi" });

    const toggle = within(dialog).getByRole("switch", { name: "Cho phép chọn nhiều đáp án" });
    expect(toggle).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "Đáp án C đúng" })).toBeChecked();
    await user.click(toggle);
    expect(within(dialog).getByRole("radio", { name: "Đáp án B đúng" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "Đáp án C đúng" })).not.toBeChecked();

    await user.click(within(dialog).getByRole("button", { name: "Lưu câu hỏi" }));
    await waitFor(() => expect(put).toBeDefined());
    expect(put).toMatchObject({
      multiSelect: false,
      options: [
        { content: "Hà Nội", isCorrect: false },
        { content: "Huế", isCorrect: true },
        { content: "Đà Nẵng", isCorrect: false },
      ],
    });
  });

  it("bỏ một đáp án: lỗi của đáp án đó mất, lỗi các đáp án sau dời theo đúng ô", async () => {
    mockApi({ [LIST_URL]: () => success(makeList([makeQuestion()])) });
    const { user, dialog } = await openCreateDialog();
    const answer = (letter: string) => within(dialog).getByRole("textbox", { name: `Nội dung đáp án ${letter}` });

    await user.type(answer("A"), "Một");
    await user.type(answer("C"), "Ba");
    await user.click(within(dialog).getByRole("button", { name: "Lưu câu hỏi" }));
    expect(within(dialog).getAllByText("Nhập nội dung đáp án")).toHaveLength(2);
    expect(answer("B")).toHaveAttribute("aria-invalid", "true");
    expect(answer("D")).toHaveAttribute("aria-invalid", "true");

    // Bỏ B (trống): C cũ thành B (có nội dung), D cũ thành C (vẫn trống, lỗi đi theo).
    await user.click(within(dialog).getByRole("button", { name: "Xóa đáp án B" }));
    expect(within(dialog).getAllByText("Nhập nội dung đáp án")).toHaveLength(1);
    expect(answer("B")).toHaveValue("Ba");
    expect(answer("B")).not.toHaveAttribute("aria-invalid");
    expect(answer("C")).toHaveValue("");
    expect(answer("C")).toHaveAttribute("aria-invalid", "true");
  });

  it("lỗi 422 từ API hiện ngay dưới ô tương ứng; Esc đóng dialog", async () => {
    mockApi({
      [LIST_URL]: () => success(makeList([makeQuestion()])),
      "POST /api/teacher/questions": () =>
        failure(422, "VALIDATION", "Dữ liệu không hợp lệ.", [
          { path: "options.0.content", message: "Nội dung đáp án quá dài (tối đa 1000 ký tự)" },
        ]),
    });
    const { user, dialog } = await openCreateDialog();
    await user.type(within(dialog).getByRole("textbox", { name: /Nội dung câu hỏi/ }), "Câu hỏi");
    await user.click(within(dialog).getByRole("button", { name: "Xóa đáp án D" }));
    await user.click(within(dialog).getByRole("button", { name: "Xóa đáp án C" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Nội dung đáp án A" }), "A");
    await user.type(within(dialog).getByRole("textbox", { name: "Nội dung đáp án B" }), "B");
    await user.click(within(dialog).getByRole("radio", { name: "Đáp án A đúng" }));
    await user.click(within(dialog).getByRole("button", { name: "Lưu câu hỏi" }));

    expect(await within(dialog).findByText("Nội dung đáp án quá dài (tối đa 1000 ký tự)")).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: "Nội dung đáp án A" })).toHaveAttribute("aria-invalid", "true");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
