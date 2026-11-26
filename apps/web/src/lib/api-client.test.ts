import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, UNAUTHENTICATED_EVENT, api, type UnauthenticatedEventDetail } from "./api-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (!(response instanceof Response)) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api-client: thành công", () => {
  it("trả data của envelope, gọi cùng origin /api/* với cookie phiên", async () => {
    const fetchMock = mockFetch(jsonResponse({ success: true, data: { id: "e1", name: "Toán 12" } }));

    const result = await api.get<{ id: string; name: string }>("/exams/e1");

    expect(result).toEqual({ id: "e1", name: "Toán 12" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/exams/e1");
    expect(init.method).toBe("GET");
    expect(init.credentials).toBe("include");
  });

  it("tiền tố /api được thêm đúng một lần cho mọi cách viết đường dẫn", async () => {
    const fetchMock = mockFetch(jsonResponse({ success: true, data: null }));
    const calledUrls = async (...paths: string[]) => {
      fetchMock.mockClear();
      fetchMock.mockImplementation(async () => jsonResponse({ success: true, data: null }));
      for (const path of paths) await api.get(path);
      return fetchMock.mock.calls.map((call) => (call as unknown as [string])[0]);
    };

    expect(await calledUrls("/exams", "exams", "/api/exams", "/api", "/api/")).toEqual([
      "/api/exams",
      "/api/exams",
      "/api/exams",
      "/api",
      "/api/",
    ]);
  });

  it("nhận cả đường dẫn đã có tiền tố /api và ghép query, bỏ giá trị rỗng", async () => {
    const fetchMock = mockFetch(jsonResponse({ success: true, data: [] }));

    await api.get("/api/exams", { query: { page: 2, keyword: "lý", status: undefined, archived: null } });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("/api/exams?page=2&keyword=l%C3%BD");
  });

  it("gửi JSON kèm Content-Type; gửi FormData nguyên bản không đặt Content-Type", async () => {
    const fetchMock = mockFetch(jsonResponse({ success: true, data: { ok: true } }));

    await api.post("/auth/login", { username: "gv01", password: "mat-khau" });
    const [, jsonInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(jsonInit.body).toBe(JSON.stringify({ username: "gv01", password: "mat-khau" }));
    expect(jsonInit.headers).toEqual({ "Content-Type": "application/json" });

    fetchMock.mockClear();
    fetchMock.mockImplementation(async () => jsonResponse({ success: true, data: { ok: true } }));
    const form = new FormData();
    form.set("file", new Blob(["a"]), "a.csv");
    await api.post("/students/import", form);
    const [, formInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(formInit.body).toBe(form);
    expect(formInit.headers).toBeUndefined();
  });

  it("204 không có thân trả undefined", async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(api.delete("/exams/e1")).resolves.toBeUndefined();
  });
});

describe("api-client: lỗi", () => {
  it("envelope lỗi thành ApiError có status, code, message, details", async () => {
    const details = [{ path: "name", message: "Bắt buộc" }];
    mockFetch(jsonResponse({ success: false, code: "VALIDATION", error: "Dữ liệu không hợp lệ.", details }, 422));

    const error = await api.post("/exams", {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      name: "ApiError",
      status: 422,
      code: "VALIDATION",
      message: "Dữ liệu không hợp lệ.",
      details,
    });
  });

  it("phản hồi không phải envelope (ví dụ 502 HTML) thành BAD_RESPONSE, giữ status", async () => {
    mockFetch(new Response("<html>Bad Gateway</html>", { status: 502 }));
    await expect(api.get("/health")).rejects.toMatchObject({ status: 502, code: "BAD_RESPONSE" });
  });

  it("HTTP 200 nhưng thân không đúng envelope vẫn ném ApiError", async () => {
    mockFetch(jsonResponse({ ok: true }));
    await expect(api.get("/health")).rejects.toMatchObject({ status: 200, code: "BAD_RESPONSE" });
  });

  it("huỷ request (AbortError) được ném lại nguyên bản, không đóng gói thành ApiError", async () => {
    const abort = new DOMException("The operation was aborted.", "AbortError");
    mockFetch(abort);

    const error = await api.get("/exams", { signal: new AbortController().signal }).catch((caught: unknown) => caught);

    expect(error).toBe(abort);
    expect(error).not.toBeInstanceOf(ApiError);
  });

  it("mất mạng thành ApiError status 0 mã NETWORK_ERROR", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    await expect(api.get("/health")).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });
});

describe("api-client: 401", () => {
  const unauthorized = () =>
    jsonResponse({ success: false, code: "UNAUTHENTICATED", error: "Phiên đăng nhập đã hết hạn." }, 401);

  it("bắn sự kiện trên window một lần rồi vẫn ném ApiError", async () => {
    mockFetch(unauthorized());
    const listener = vi.fn();
    window.addEventListener(UNAUTHENTICATED_EVENT, listener);

    await expect(api.get("/auth/me")).rejects.toMatchObject({ status: 401, code: "UNAUTHENTICATED" });

    window.removeEventListener(UNAUTHENTICATED_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0] as CustomEvent<UnauthenticatedEventDetail>;
    expect(event.detail).toEqual({ code: "UNAUTHENTICATED", message: "Phiên đăng nhập đã hết hạn." });
  });

  it("skipUnauthenticatedEvent: không bắn sự kiện (đăng nhập sai mật khẩu)", async () => {
    mockFetch(unauthorized());
    const listener = vi.fn();
    window.addEventListener(UNAUTHENTICATED_EVENT, listener);

    await expect(api.post("/auth/login", {}, { skipUnauthenticatedEvent: true })).rejects.toBeInstanceOf(ApiError);

    window.removeEventListener(UNAUTHENTICATED_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it("lỗi khác 401 không bắn sự kiện", async () => {
    mockFetch(jsonResponse({ success: false, code: "FORBIDDEN", error: "Bạn không có quyền." }, 403));
    const listener = vi.fn();
    window.addEventListener(UNAUTHENTICATED_EVENT, listener);

    await expect(api.get("/admin")).rejects.toMatchObject({ status: 403 });

    window.removeEventListener(UNAUTHENTICATED_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
  });
});
