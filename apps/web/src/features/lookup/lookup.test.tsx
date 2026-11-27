import type { LookupScoreRow, LookupSchool, LookupYear } from "@quiq/shared/lookup";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LookupPage } from "./lookup-page";

interface Reply {
  status?: number;
  body: unknown;
}
type Handler = (body: unknown) => Reply | Promise<Reply>;
const handlers = new Map<string, Handler>();
const calls: Array<{ key: string; body: unknown }> = [];

/** Giả máy chủ: khóa "METHOD /api/path". */
function serve(key: string, handler: Handler) {
  handlers.set(key, handler);
}
const ok = (data: unknown): Reply => ({ body: { success: true, data } });
const fail = (status: number, code: string, error: string, details?: unknown): Reply => ({
  status,
  body: { success: false, code, error, details },
});

const SCHOOLS: LookupSchool[] = [
  { id: "s-le-loi", name: "THPT Lê Lợi" },
  { id: "s-tran-phu", name: "THPT Trần Phú" },
];
const YEARS: LookupYear[] = [
  { id: "y-now", name: "2026-2027", isCurrent: true },
  { id: "y-old", name: "2025-2026", isCurrent: false },
];
const ROWS: LookupScoreRow[] = [
  { subjectName: "Toán", examTitle: "Kiểm tra 15 phút", examCode: "TOAN15", score: 8.5 },
  { subjectName: "Vật lý", examTitle: "Giữa kỳ", examCode: "LY01", score: 0 },
];

const lookupCalls = () => calls.filter((call) => call.key === "POST /api/lookup");

beforeEach(() => {
  handlers.clear();
  calls.length = 0;
  serve("GET /api/lookup/schools", () => ok(SCHOOLS));
  serve("GET /api/lookup/schools/s-le-loi/years", () => ok(YEARS));
  serve("POST /api/lookup", () => ok({ items: ROWS }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${url}`;
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ key, body });
      const reply = (await handlers.get(key)?.(body)) ?? fail(404, "NOT_FOUND", "Không tìm thấy.");
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Chọn trường bằng cách gõ không dấu rồi bấm vào kết quả, nhập mã học sinh. */
async function fillForm(user: ReturnType<typeof userEvent.setup>, code = " hs001 ") {
  const school = await screen.findByRole("combobox", { name: /Trường/ });
  await user.click(school);
  await user.type(school, "le loi");
  const options = screen.getAllByRole("option");
  expect(options).toHaveLength(1);
  await user.click(options[0]!);
  const year = screen.getByRole("combobox", { name: /Năm học/ });
  await waitFor(() => expect(year).toHaveTextContent("2026-2027 (hiện tại)"));
  await user.type(screen.getByLabelText(/Mã học sinh/), code);
}

describe("Tra cứu điểm", () => {
  it("chọn trường (tìm không dấu), năm hiện tại chọn sẵn, tra ra bảng điểm 2 chữ số thập phân", async () => {
    const user = userEvent.setup();
    render(<LookupPage />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Tra cứu" }));

    const table = await screen.findByRole("region", { name: "Bảng điểm" });
    expect(lookupCalls()[0]?.body).toEqual({
      schoolId: "s-le-loi",
      studentCode: "HS001",
      academicYearId: "y-now",
    });
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Toán");
    expect(rows[1]).toHaveTextContent("TOAN15");
    expect(rows[1]).toHaveTextContent("8,50");
    expect(rows[2]).toHaveTextContent("0,00");
    // FR-047: không dẫn sang xem đáp án từ trang tra cứu.
    expect(screen.queryByText(/đáp án/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(String.fromCharCode(0x2014));
  });

  it("chọn năm học trước thì gửi đúng năm đó", async () => {
    const user = userEvent.setup();
    render(<LookupPage />);
    await fillForm(user);
    await user.click(screen.getByRole("combobox", { name: /Năm học/ }));
    await user.click(await screen.findByRole("option", { name: "2025-2026" }));
    await user.click(screen.getByRole("button", { name: "Tra cứu" }));

    await screen.findByRole("region", { name: "Bảng điểm" });
    expect(lookupCalls()[0]?.body).toMatchObject({ academicYearId: "y-old" });
  });

  it("không có kết quả: thông điệp chung (dùng cho cả mã sai/mã vô hiệu)", async () => {
    serve("POST /api/lookup", () => ok({ items: [] }));
    const user = userEvent.setup();
    render(<LookupPage />);
    await fillForm(user, "KHONGCO");
    await user.click(screen.getByRole("button", { name: "Tra cứu" }));

    expect(await screen.findByText("Chưa có bài thi nào được công bố bảng điểm")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Bảng điểm" })).not.toBeInTheDocument();
  });

  it("thiếu trường hoặc mã: báo lỗi ngay dưới ô, không gửi", async () => {
    const user = userEvent.setup();
    render(<LookupPage />);
    await user.click(await screen.findByRole("button", { name: "Tra cứu" }));

    expect(screen.getByText("Hãy chọn trường.")).toBeInTheDocument();
    expect(screen.getByText("Hãy nhập mã học sinh.")).toBeInTheDocument();
    expect(lookupCalls()).toHaveLength(0);
  });

  it("đang tra: hiện khung giữ chỗ", async () => {
    let release: (reply: Reply) => void = () => undefined;
    serve("POST /api/lookup", () => new Promise<Reply>((resolve) => (release = resolve)));
    const user = userEvent.setup();
    render(<LookupPage />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Tra cứu" }));

    expect(await screen.findByText("Đang tra cứu…", { selector: ".sr-only" })).toBeInTheDocument();
    release(ok({ items: ROWS }));
    await screen.findByRole("region", { name: "Bảng điểm" });
  });

  it("429: báo thử lại sau số giây máy chủ trả về", async () => {
    serve("POST /api/lookup", () =>
      fail(429, "RATE_LIMITED", "Bạn thao tác quá nhanh.", { retryAfterSeconds: 42 }),
    );
    const user = userEvent.setup();
    render(<LookupPage />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Tra cứu" }));

    expect(
      await screen.findByText("Bạn đã tra cứu quá nhiều lần. Hãy thử lại sau 42 giây."),
    ).toBeInTheDocument();
  });

  it("lỗi máy chủ: hiện lỗi + Thử lại gửi lại đúng yêu cầu", async () => {
    let failing = true;
    serve("POST /api/lookup", () =>
      failing ? fail(500, "INTERNAL", "Đã có lỗi xảy ra, vui lòng thử lại sau.") : ok({ items: ROWS }),
    );
    const user = userEvent.setup();
    render(<LookupPage />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Tra cứu" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Đã có lỗi xảy ra");
    failing = false;
    await user.click(screen.getByRole("button", { name: "Thử lại" }));

    await screen.findByRole("region", { name: "Bảng điểm" });
    expect(lookupCalls()).toHaveLength(2);
    expect(lookupCalls()[1]?.body).toEqual(lookupCalls()[0]?.body);
  });

  it("không tải được danh sách trường: lỗi + Thử lại", async () => {
    let failing = true;
    serve("GET /api/lookup/schools", () =>
      failing ? fail(500, "INTERNAL", "Đã có lỗi xảy ra, vui lòng thử lại sau.") : ok(SCHOOLS),
    );
    const user = userEvent.setup();
    render(<LookupPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Đã có lỗi xảy ra");
    failing = false;
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByRole("combobox", { name: /Trường/ })).toBeInTheDocument();
  });

  it("không tải được năm học: báo lỗi (không giả làm 'chưa có năm học') + tải lại được", async () => {
    let failing = true;
    serve("GET /api/lookup/schools/s-le-loi/years", () =>
      failing ? fail(500, "INTERNAL", "Đã có lỗi xảy ra, vui lòng thử lại sau.") : ok(YEARS),
    );
    const user = userEvent.setup();
    render(<LookupPage />);
    const school = await screen.findByRole("combobox", { name: /Trường/ });
    await user.click(school);
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Không tải được danh sách năm học.")).toBeInTheDocument();
    const year = screen.getByRole("combobox", { name: /Năm học/ });
    expect(year).toHaveTextContent("Không tải được năm học");
    expect(year).not.toHaveTextContent("Chưa có năm học");
    failing = false;
    await user.click(screen.getByRole("button", { name: "Tải lại năm học" }));
    await waitFor(() => expect(year).toHaveTextContent("2026-2027 (hiện tại)"));
  });

  it("đổi mã, trường hoặc năm sau khi tra: bảng cũ bị xóa", async () => {
    const user = userEvent.setup();
    render(<LookupPage />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Tra cứu" }));
    await screen.findByRole("region", { name: "Bảng điểm" });

    await user.type(screen.getByLabelText(/Mã học sinh/), "2");
    expect(screen.queryByRole("region", { name: "Bảng điểm" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tra cứu" }));
    await screen.findByRole("region", { name: "Bảng điểm" });
    await user.click(screen.getByRole("combobox", { name: /Năm học/ }));
    await user.click(await screen.findByRole("option", { name: "2025-2026" }));
    expect(screen.queryByRole("region", { name: "Bảng điểm" })).not.toBeInTheDocument();
  });

  it("ô nhập, ô chọn năm và nút đều có vùng chạm tối thiểu 44px", async () => {
    render(<LookupPage />);
    const school = await screen.findByRole("combobox", { name: /Trường/ });
    for (const control of [
      school,
      screen.getByLabelText(/Mã học sinh/),
      screen.getByRole("combobox", { name: /Năm học/ }),
      screen.getByRole("button", { name: "Tra cứu" }),
    ]) {
      expect(control).toHaveClass("min-h-11");
    }
  });

  it("chọn trường bằng bàn phím: mũi tên xuống + Enter", async () => {
    const user = userEvent.setup();
    render(<LookupPage />);
    const school = await screen.findByRole("combobox", { name: /Trường/ });
    await user.click(school);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(school).toHaveValue("THPT Trần Phú");
    expect(calls.map((call) => call.key)).toContain("GET /api/lookup/schools/s-tran-phu/years");
  });
});
