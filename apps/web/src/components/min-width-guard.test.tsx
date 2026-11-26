import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MinWidthGuard } from "./min-width-guard";
import { Button, Dialog, DialogContent, DialogTrigger, Input } from "./ui";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

type Listener = () => void;

// matchMedia giả theo bề rộng cửa sổ: đọc `min-width` từ query nên đổi ngưỡng 1024 hoặc đổi sang
// max-width trong mã thật sẽ làm test rớt. Query lạ bị từ chối để không âm thầm khớp sai.
function fakeViewport(initialWidth: number) {
  let width = initialWidth;
  const listeners = new Set<Listener>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => {
      const minWidth = /^\(min-width:\s*(\d+)px\)$/.exec(query)?.[1];
      if (minWidth === undefined) throw new Error(`Query không được mô phỏng: ${query}`);
      return {
        get matches() {
          return width >= Number(minWidth);
        },
        media: query,
        addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
        removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
      };
    }),
  );
  return {
    resize(nextWidth: number) {
      width = nextWidth;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

const WIDE = 1280;
const NARROW = 800;

// Con có state và effect mount: nếu guard unmount cây thì đếm sẽ về 0 và effect chạy lại.
function Counter({ onMount }: { onMount: () => void }) {
  const [count, setCount] = useState(0);
  useEffect(onMount, [onMount]);
  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      {`Đã bấm ${count}`}
    </button>
  );
}

beforeEach(() => {
  navigation.pathname = "/";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MinWidthGuard", () => {
  it("từ 1024px trở lên: thấy nội dung, không có thông báo", () => {
    fakeViewport(WIDE);
    render(
      <MinWidthGuard>
        <p>Nội dung thi</p>
      </MinWidthGuard>,
    );
    expect(screen.getByText("Nội dung thi")).toBeVisible();
    expect(screen.queryByText(/chỉ hỗ trợ máy tính/i)).not.toBeInTheDocument();
  });

  it("dưới 1024px: hiện thông báo và ẩn nội dung khỏi người dùng", () => {
    fakeViewport(NARROW);
    render(
      <MinWidthGuard>
        <p>Nội dung thi</p>
      </MinWidthGuard>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Quiq chỉ hỗ trợ máy tính");
    expect(screen.getByRole("alert")).toHaveTextContent("màn hình rộng từ 1024px");
    expect(screen.getByText("Nội dung thi")).not.toBeVisible();
  });

  it("thu hẹp rồi nới rộng: nội dung KHÔNG bị unmount, state của con được giữ", async () => {
    const user = userEvent.setup();
    const onMount = vi.fn();
    const viewport = fakeViewport(WIDE);
    render(
      <MinWidthGuard>
        <Counter onMount={onMount} />
      </MinWidthGuard>,
    );
    await user.click(screen.getByRole("button", { name: "Đã bấm 0" }));
    expect(screen.getByRole("button", { name: "Đã bấm 1" })).toBeVisible();

    viewport.resize(NARROW);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    const hiddenButton = screen.getByText("Đã bấm 1", { selector: "button" });
    expect(hiddenButton).toBeInTheDocument();
    expect(hiddenButton).not.toBeVisible();

    viewport.resize(WIDE);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đã bấm 1" })).toBeVisible();
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it("timer trong nội dung vẫn chạy khi bị chặn", () => {
    vi.useFakeTimers();
    try {
      const viewport = fakeViewport(WIDE);
      function Clock() {
        const [seconds, setSeconds] = useState(0);
        useEffect(() => {
          const id = setInterval(() => setSeconds((value) => value + 1), 1000);
          return () => clearInterval(id);
        }, []);
        return <output>{`Giây: ${seconds}`}</output>;
      }
      render(
        <MinWidthGuard>
          <Clock />
        </MinWidthGuard>,
      );
      viewport.resize(NARROW);
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      viewport.resize(WIDE);
      expect(screen.getByText("Giây: 3")).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("/tra-cuu và đường con của nó được miễn: hẹp vẫn xem được, không có thông báo", () => {
    fakeViewport(NARROW);
    for (const pathname of ["/tra-cuu", "/tra-cuu/ket-qua"]) {
      navigation.pathname = pathname;
      const { unmount } = render(
        <MinWidthGuard>
          <p>Bảng điểm</p>
        </MinWidthGuard>,
      );
      expect(screen.getByText("Bảng điểm")).toBeVisible();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("đường dẫn chỉ giống tiền tố (/tra-cuu-khac) không được miễn", () => {
    fakeViewport(NARROW);
    navigation.pathname = "/tra-cuu-khac";
    render(
      <MinWidthGuard>
        <p>Nội dung khác</p>
      </MinWidthGuard>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Nội dung khác")).not.toBeVisible();
  });

  it("ngưỡng đúng 1024px: 1023 bị chặn, 1024 được qua", () => {
    const viewport = fakeViewport(1023);
    render(
      <MinWidthGuard>
        <p>Nội dung thi</p>
      </MinWidthGuard>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Nội dung thi")).not.toBeVisible();

    viewport.resize(1024);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Nội dung thi")).toBeVisible();

    viewport.resize(1023);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  describe("Dialog đang mở khi cửa sổ bị thu hẹp", () => {
    function DialogInGuard() {
      return (
        <MinWidthGuard>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Mở hộp thoại</Button>
            </DialogTrigger>
            <DialogContent title="Nộp bài" description="Bạn chắc chắn muốn nộp bài?">
              <Input aria-label="Ghi chú" />
            </DialogContent>
          </Dialog>
        </MinWidthGuard>
      );
    }

    it("bị ẩn cùng nội dung (không nhận focus dưới thông báo), nới rộng thì còn nguyên state", async () => {
      const user = userEvent.setup();
      const viewport = fakeViewport(WIDE);
      render(<DialogInGuard />);

      await user.click(screen.getByRole("button", { name: "Mở hộp thoại" }));
      const dialog = await screen.findByRole("dialog", { name: "Nộp bài" });
      await user.type(screen.getByLabelText("Ghi chú"), "đã kiểm tra");
      expect(dialog).toBeVisible();

      viewport.resize(NARROW);
      // Dialog vẫn mounted nhưng nằm trong wrapper bị ẩn; thông báo vẫn đọc được.
      const hiddenDialog = screen.getByRole("dialog", { name: "Nộp bài", hidden: true });
      expect(hiddenDialog).not.toBeVisible();
      expect(screen.getByRole("alert")).toBeVisible();
      expect(screen.getByRole("alert")).toHaveTextContent("Quiq chỉ hỗ trợ máy tính");

      viewport.resize(WIDE);
      expect(screen.getByRole("dialog", { name: "Nộp bài" })).toBeVisible();
      expect(screen.getByLabelText("Ghi chú")).toHaveValue("đã kiểm tra");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("render trên máy chủ (trước hydrate)", () => {
    it("màn hẹp do CSS quyết định: wrapper có max-lg:hidden, thông báo có hidden max-lg:flex", () => {
      const html = renderToString(
        <MinWidthGuard>
          <p>Nội dung thi</p>
        </MinWidthGuard>,
      );
      expect(html).toContain("Nội dung thi");
      expect(html).toContain("max-lg:hidden");
      expect(html).toContain("hidden max-lg:flex");
      expect(html).toContain("Quiq chỉ hỗ trợ máy tính");
      // Chưa hydrate thì JS chưa được quyền ẩn nội dung bằng thuộc tính hidden.
      expect(html).not.toMatch(/<div hidden/);
    });

    it("đường dẫn được miễn: không có lớp ẩn và không có thông báo", () => {
      navigation.pathname = "/tra-cuu";
      const html = renderToString(
        <MinWidthGuard>
          <p>Bảng điểm</p>
        </MinWidthGuard>,
      );
      expect(html).toContain("Bảng điểm");
      expect(html).not.toContain("max-lg:hidden");
      expect(html).not.toContain("Quiq chỉ hỗ trợ máy tính");
    });
  });
});
