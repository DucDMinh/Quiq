import type { StaffMe } from "@quiq/shared/auth";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { AppShell } from "@/features/shell/app-shell";
import { postLoginPath } from "@/features/shell/nav-config";
import { UNAUTHENTICATED_EVENT } from "@/lib/api-client";
import { LoginForm } from "./login-form";

const navigation = vi.hoisted(() => {
  const replace = vi.fn();
  const push = vi.fn();
  // Cùng một object qua mọi lần render, như useRouter thật của Next.
  return { pathname: "/giao-vien/ngan-hang", replace, push, router: { replace, push } };
});
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => navigation.router,
}));

const TEACHER: StaffMe = {
  id: "staff-1",
  username: "gv.toan",
  displayName: "Giáo viên Toán",
  role: "teacher",
  schoolId: "school-1",
  schoolName: "Trường THPT Demo",
  subject: { id: "subject-1", name: "Toán" },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
const success = (data: unknown) => jsonResponse({ success: true, data });
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

// Dựng từ mã ký tự: quy tắc mã nguồn cấm ký tự em-dash xuất hiện trong file.
const EM_DASH = String.fromCharCode(0x2014);
const visibleText = () => document.body.textContent ?? "";

beforeEach(() => {
  navigation.pathname = "/giao-vien/ngan-hang";
  navigation.replace.mockReset();
  navigation.push.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postLoginPath", () => {
  it("giáo viên về ngân hàng câu hỏi; chỉ nhận trang quay lại nội bộ thuộc khu vực giáo viên", () => {
    expect(postLoginPath("teacher")).toBe("/giao-vien/ngan-hang");
    expect(postLoginPath("teacher", "/giao-vien/bai-thi?lop=1")).toBe("/giao-vien/bai-thi?lop=1");
    for (const unsafe of ["//evil.com", "https://evil.com", "/\\evil.com", "/quan-tri", "/giao-vienx", "giao-vien"]) {
      expect(postLoginPath("teacher", unsafe)).toBe("/giao-vien/ngan-hang");
    }
  });

  it("vai trò chưa có giao diện: null", () => {
    expect(postLoginPath("school_admin")).toBeNull();
    expect(postLoginPath("super_admin", "/giao-vien")).toBeNull();
  });
});

describe("LoginForm", () => {
  const fillAndSubmit = async (username: string, password: string) => {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/Tên đăng nhập/), username);
    await user.type(screen.getByLabelText(/^Mật khẩu/), password);
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));
    return user;
  };

  it("nút hiện/ẩn mật khẩu đổi kiểu ô và nhãn", async () => {
    render(<LoginForm />);
    // Trước khi JS hydrate, gửi form phải là POST để mật khẩu không lọt vào URL.
    expect(screen.getByRole("form", { name: "Đăng nhập cán bộ" })).toHaveAttribute("method", "post");
    const password = screen.getByLabelText(/^Mật khẩu/);
    expect(password).toHaveAttribute("type", "password");

    await userEvent.setup().click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ẩn mật khẩu" })).toHaveAttribute("aria-pressed", "true");
  });

  it("để trống: lỗi ngay dưới từng ô, không gọi API", async () => {
    const fetchMock = mockApi({});
    render(<LoginForm />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByText("Nhập tên đăng nhập")).toBeInTheDocument();
    expect(screen.getByText("Nhập mật khẩu")).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên đăng nhập/)).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sai thông tin: lỗi chung, không phát sự kiện hết phiên, không chuyển trang", async () => {
    mockApi({
      "POST /api/auth/login": () =>
        failure(401, "INVALID_CREDENTIALS", "Tên đăng nhập hoặc mật khẩu không đúng."),
    });
    const expiredListener = vi.fn();
    window.addEventListener(UNAUTHENTICATED_EVENT, expiredListener);
    render(<LoginForm />);
    await fillAndSubmit("gv.toan", "sai");

    expect(await screen.findByRole("alert")).toHaveTextContent("Tên đăng nhập hoặc mật khẩu không đúng.");
    expect(expiredListener).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    window.removeEventListener(UNAUTHENTICATED_EVENT, expiredListener);
  });

  it("bị chặn vì sai nhiều lần: báo số phút chờ", async () => {
    mockApi({
      "POST /api/auth/login": () =>
        failure(429, "LOGIN_THROTTLED", "Bạn đã nhập sai quá nhiều lần.", { retryAfterSeconds: 540 }),
    });
    render(<LoginForm />);
    await fillAndSubmit("gv.toan", "sai");
    expect(await screen.findByRole("alert")).toHaveTextContent("Vui lòng thử lại sau 9 phút.");
  });

  it("trường bị khóa: hiện thông điệp của máy chủ", async () => {
    mockApi({
      "POST /api/auth/login": () =>
        failure(403, "SCHOOL_LOCKED", "Trường của bạn đang bị khóa. Liên hệ quản trị hệ thống."),
    });
    render(<LoginForm />);
    await fillAndSubmit("gv.toan", "dung");
    expect(await screen.findByRole("alert")).toHaveTextContent("Trường của bạn đang bị khóa");
  });

  it("giáo viên đăng nhập đúng: mật khẩu chỉ trong body POST, chuyển tới trang quay lại hợp lệ", async () => {
    const fetchMock = mockApi({ "POST /api/auth/login": () => success(TEACHER) });
    render(<LoginForm returnTo="/giao-vien/phong-thi" />);
    await fillAndSubmit("gv.toan", "Mat-khau-dung");

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/giao-vien/phong-thi"));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/auth/login");
    expect(url).not.toContain("Mat-khau-dung");
    expect(JSON.parse(String(init?.body))).toEqual({ username: "gv.toan", password: "Mat-khau-dung" });
  });

  it("vai trò chưa có giao diện: thông báo, đăng xuất phiên vừa tạo, không chuyển trang", async () => {
    const fetchMock = mockApi({
      "POST /api/auth/login": () => success({ ...TEACHER, role: "school_admin", subject: null }),
      "POST /api/auth/logout": () => success({ loggedOut: true }),
    });
    render(<LoginForm />);
    await fillAndSubmit("admin.demo", "dung");

    expect(await screen.findByRole("status")).toHaveTextContent("Chưa có giao diện cho vai trò này");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(visibleText()).not.toContain(EM_DASH);
  });
});

describe("AppShell (route guard)", () => {
  const renderShell = () =>
    render(
      <ToastProvider>
        <AppShell role="teacher">
          <p>Nội dung trang</p>
        </AppShell>
      </ToastProvider>,
    );

  it("đang tải: skeleton, chưa hiện nội dung", () => {
    mockApi({ "GET /api/auth/me": () => new Promise<Response>(() => undefined) });
    renderShell();
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải");
    expect(screen.queryByText("Nội dung trang")).not.toBeInTheDocument();
  });

  it("đã đăng nhập: menu 3 mục, mục hiện tại được đánh dấu, khối người dùng", async () => {
    mockApi({ "GET /api/auth/me": () => success(TEACHER) });
    renderShell();

    const nav = await screen.findByRole("navigation", { name: "Menu chính" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Ngân hàng câu hỏi", "/giao-vien/ngan-hang"],
      ["Bài thi", "/giao-vien/bai-thi"],
      ["Phòng thi", "/giao-vien/phong-thi"],
    ]);
    expect(links[0]).toHaveAttribute("aria-current", "page");
    expect(links[1]).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Giáo viên Toán")).toBeInTheDocument();
    expect(screen.getByText("Môn Toán")).toBeInTheDocument();
    expect(screen.getByText("Nội dung trang")).toBeInTheDocument();
    expect(visibleText()).not.toContain(EM_DASH);
  });

  it("chưa đăng nhập: chuyển sang trang đăng nhập kèm trang đang xem, không hiện nội dung", async () => {
    navigation.pathname = "/giao-vien/bai-thi";
    mockApi({ "GET /api/auth/me": () => failure(401, "UNAUTHENTICATED", "Bạn cần đăng nhập để tiếp tục.") });
    renderShell();

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/dang-nhap?next=%2Fgiao-vien%2Fbai-thi"));
    expect(screen.queryByText("Nội dung trang")).not.toBeInTheDocument();
    expect(screen.queryByText("Phiên đăng nhập đã hết hạn")).not.toBeInTheDocument();
  });

  it("hết phiên giữa chừng: dialog rồi về trang đăng nhập", async () => {
    mockApi({ "GET /api/auth/me": () => success(TEACHER) });
    renderShell();
    await screen.findByText("Nội dung trang");

    act(() => {
      window.dispatchEvent(new CustomEvent(UNAUTHENTICATED_EVENT, { detail: { code: "UNAUTHENTICATED", message: "" } }));
    });
    const dialog = await screen.findByRole("dialog", { name: "Phiên đăng nhập đã hết hạn" });
    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Đăng nhập lại" }));
    expect(navigation.replace).toHaveBeenCalledWith("/dang-nhap?next=%2Fgiao-vien%2Fngan-hang");
  });

  it("đăng xuất: gọi API rồi về trang đăng nhập", async () => {
    const fetchMock = mockApi({
      "GET /api/auth/me": () => success(TEACHER),
      "POST /api/auth/logout": () => success({ loggedOut: true }),
    });
    renderShell();
    await userEvent.setup().click(await screen.findByRole("button", { name: "Đăng xuất" }));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/dang-nhap"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
  });

  it("trường bị khóa: thông báo khóa, không hiện nội dung", async () => {
    mockApi({
      "GET /api/auth/me": () =>
        failure(403, "SCHOOL_LOCKED", "Trường của bạn đang bị khóa. Liên hệ quản trị hệ thống."),
    });
    renderShell();
    expect(await screen.findByRole("alert")).toHaveTextContent("Trường của bạn đang bị khóa");
    expect(screen.getByRole("link", { name: "Về trang đăng nhập" })).toHaveAttribute("href", "/dang-nhap");
    expect(screen.queryByText("Nội dung trang")).not.toBeInTheDocument();
  });

  it("lỗi máy chủ: báo lỗi và thử lại được", async () => {
    let calls = 0;
    mockApi({
      "GET /api/auth/me": () =>
        ++calls === 1 ? failure(500, "INTERNAL", "Đã có lỗi xảy ra, vui lòng thử lại sau.") : success(TEACHER),
    });
    renderShell();
    expect(await screen.findByRole("alert")).toHaveTextContent("Đã có lỗi xảy ra");

    await userEvent.setup().click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Nội dung trang")).toBeInTheDocument();
  });

  it("sai vai trò cho khu vực: trang không tìm thấy chung", async () => {
    mockApi({ "GET /api/auth/me": () => success({ ...TEACHER, role: "school_admin", subject: null }) });
    renderShell();
    expect(await screen.findByText("Không tìm thấy trang")).toBeInTheDocument();
    expect(screen.queryByText("Nội dung trang")).not.toBeInTheDocument();
  });
});
