import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  Alert,
  AnswerTile,
  AnswerTileGroup,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  KpiCard,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Timer,
  ToastProvider,
  formatClock,
  useToast,
  type AlertTone,
  type BadgeTone,
} from "./index";
import { UiGallery } from "@/app/%5Fui/gallery";

const UI_DIR = import.meta.dirname;
const SRC_DIR = join(UI_DIR, "..", "..");
const GLOBALS_CSS = join(SRC_DIR, "app", "globals.css");

function listFiles(directory: string, extensions: readonly string[]): string[] {
  return readdirSync(directory).flatMap((name) => {
    const fullPath = join(directory, name);
    if (statSync(fullPath).isDirectory()) return listFiles(fullPath, extensions);
    return extensions.some((extension) => name.endsWith(extension)) ? [fullPath] : [];
  });
}

describe("quy tắc mã nguồn", () => {
  it("không có hex hay hàm màu thô trong components/ui (chỉ dùng biến token)", () => {
    const componentFiles = listFiles(UI_DIR, [".ts", ".tsx"]).filter((file) => !file.includes(".test."));
    expect(componentFiles.length).toBeGreaterThan(10);
    for (const file of componentFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source, file).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab)\(/);
    }
  });

  it("không có kích thước px/rem viết thẳng cho viền và cỡ chữ (dùng token --lip-*, --text-*)", () => {
    const componentFiles = listFiles(UI_DIR, [".tsx"]).filter((file) => !file.includes(".test."));
    for (const file of componentFiles) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/\b(?:border(?:-[trblxy])?|text)-\[[\d.]+(?:px|rem)\]/);
    }
  });

  it("không có em-dash trong bất kỳ file nào dưới src", () => {
    const emDash = String.fromCharCode(0x2014);
    for (const file of listFiles(SRC_DIR, [".ts", ".tsx", ".css"])) {
      expect(readFileSync(file, "utf8").includes(emDash), file).toBe(false);
    }
  });

  it("không có emoji làm icon và không có nhãn thương hiệu cũ trong src", () => {
    const forbiddenBrands = ["kah" + "oot", "game " + "pin"];
    for (const file of listFiles(SRC_DIR, [".ts", ".tsx", ".css"])) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\p{Extended_Pictographic}/u);
      for (const brand of forbiddenBrands) expect(source.toLowerCase(), file).not.toContain(brand);
    }
  });
});

// Đọc token từ globals.css để bảng contrast trong design-tokens.md không bị lệch khỏi code.
function readHexTokens(): Record<string, string> {
  const css = readFileSync(GLOBALS_CSS, "utf8");
  const tokens: Record<string, string> = {};
  for (const match of css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, value] = match;
    if (name && value) tokens[name] = value;
  }
  return tokens;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

describe("tokens: contrast theo bảng đã đo", () => {
  const tokens = readHexTokens();
  const token = (name: string): string => {
    const value = tokens[name];
    if (!value) throw new Error(`Thiếu token ${name} trong globals.css`);
    return value;
  };

  it("các cặp then chốt đúng số đã đo", () => {
    const white = token("--brand-primary-text");
    expect(contrast(white, token("--quiq-brand"))).toBeCloseTo(5.47, 1);
    expect(contrast(white, token("--quiq-brand-hover"))).toBeCloseTo(7.58, 1);
    expect(contrast(token("--quiq-amber-ink"), token("--quiq-amber"))).toBeCloseTo(8.49, 1);
    expect(contrast(white, token("--quiq-rose"))).toBeCloseTo(6.29, 1);
    expect(contrast(token("--quiq-brand-dark"), token("--quiq-brand-tint"))).toBeCloseTo(8.41, 1);
    expect(contrast(token("--on-brand-dark-label"), token("--quiq-brand-dark"))).toBeCloseTo(7.61, 1);
  });

  it("chữ trên nút, ô đáp án, badge và alert đạt AA (4.5:1)", () => {
    const white = token("--brand-primary-text");
    for (const background of ["--quiq-brand", "--quiq-green", "--quiq-sky", "--quiq-red", "--quiq-rose", "--quiq-indigo"]) {
      expect(contrast(white, token(background)), background).toBeGreaterThanOrEqual(4.5);
    }
    for (const tone of ["success", "warning", "danger", "info", "neutral"]) {
      expect(contrast(token(`--status-${tone}-text`), token(`--status-${tone}-bg`)), tone).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(token("--text-muted"), token("--bg-canvas"))).toBeGreaterThanOrEqual(4.5);
  });

  it("ring focus đủ 3:1 trên nền sáng và trên nền teal", () => {
    expect(contrast(token("--focus-ring"), token("--bg-surface"))).toBeGreaterThanOrEqual(3);
    expect(contrast(token("--focus-ring"), token("--bg-canvas"))).toBeGreaterThanOrEqual(3);
    expect(contrast(token("--focus-ring-on-brand"), token("--quiq-brand"))).toBeGreaterThanOrEqual(3);
  });
});

describe("Button", () => {
  it("render đủ 6 biến thể và 3 cỡ", () => {
    const variants = ["primary", "secondary", "subtle", "success", "danger", "danger-outline"] as const;
    const sizes = ["sm", "md", "lg"] as const;
    render(
      <div>
        {variants.flatMap((variant) =>
          sizes.map((size) => (
            <Button key={`${variant}-${size}`} variant={variant} size={size}>
              {`${variant}-${size}`}
            </Button>
          )),
        )}
      </div>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(18);
  });

  it("đang xử lý: khóa nút, đổi nhãn, đánh dấu aria-busy", () => {
    render(<Button loading>Lưu kỳ thi</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveTextContent("Đang lưu…");
  });

  it("nút chỉ icon luôn có aria-label", () => {
    render(<IconButton label="Xóa câu hỏi">x</IconButton>);
    expect(screen.getByRole("button", { name: "Xóa câu hỏi" })).toBeInTheDocument();
  });
});

describe("Field và ô nhập", () => {
  it("nối nhãn, hint, lỗi với ô nhập; lỗi có role alert", () => {
    render(
      <Field label="Tên kỳ thi" hint="Tối đa 120 ký tự" error="Tên kỳ thi không được để trống" required>
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText(/Tên kỳ thi/);
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Tên kỳ thi không được để trống");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
    expect(input).toHaveAccessibleDescription(/Tối đa 120 ký tự/);
  });

  it("không lỗi thì không có aria-invalid và role alert", () => {
    render(<Field label="Ghi chú">{(control) => <Textarea {...control} />}</Field>);
    expect(screen.getByLabelText("Ghi chú")).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Select hiện placeholder và nhận aria-invalid", () => {
    render(
      <Field label="Môn học" error="Hãy chọn môn học">
        {(control) => (
          <Select
            {...control}
            placeholder="Chọn môn"
            options={[
              { value: "toan", label: "Toán" },
              { value: "ly", label: "Vật lý" },
            ]}
          />
        )}
      </Field>,
    );
    const trigger = screen.getByRole("combobox", { name: /Môn học/ });
    expect(trigger).toHaveTextContent("Chọn môn");
    expect(trigger).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Badge, Alert, Card, Skeleton, EmptyState, KpiCard, Table", () => {
  it("Badge có đủ 6 loại và luôn có chữ", () => {
    const tones: BadgeTone[] = ["brand", "success", "warning", "danger", "info", "neutral"];
    render(
      <div>
        {tones.map((tone) => (
          <Badge key={tone} tone={tone}>
            {`Nhãn ${tone}`}
          </Badge>
        ))}
      </div>,
    );
    for (const tone of tones) expect(screen.getByText(`Nhãn ${tone}`)).toBeInTheDocument();
  });

  it("Alert: lỗi dùng role alert, các loại còn lại dùng role status", () => {
    const tones: AlertTone[] = ["success", "info", "warning", "danger", "neutral"];
    render(
      <div>
        {tones.map((tone) => (
          <Alert key={tone} tone={tone} title={`Tiêu đề ${tone}`}>
            Nội dung
          </Alert>
        ))}
      </div>,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByRole("status")).toHaveLength(4);
  });

  it("Skeleton ẩn khỏi trình đọc màn hình; KpiCard loading thay số bằng skeleton", () => {
    const { container } = render(<KpiCard label="Số bài thi" value={128} loading />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByText("128")).not.toBeInTheDocument();
    render(<Skeleton data-testid="sk" className="h-4 w-10" />);
    expect(screen.getByTestId("sk")).toHaveAttribute("aria-hidden", "true");
  });

  it("KpiCard hiện số bằng font mono tabular-nums", () => {
    render(<KpiCard label="Số bài thi" value={128} sub="So với tuần trước: +12" />);
    expect(screen.getByText("128")).toHaveClass("font-mono", "tabular-nums");
  });

  it("EmptyState có tiêu đề, hướng dẫn và hành động chính", () => {
    render(
      <EmptyState title="Chưa có kỳ thi" description="Tạo kỳ thi đầu tiên để bắt đầu." action={<Button>Tạo kỳ thi</Button>} />,
    );
    expect(screen.getByText("Chưa có kỳ thi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo kỳ thi" })).toBeInTheDocument();
  });

  it("Table nằm trong khung cuộn riêng, cột thao tác căn phải", () => {
    render(
      <Table aria-label="Danh sách học sinh">
        <TableHeader>
          <TableRow>
            <TableHead>Họ tên</TableHead>
            <TableHead align="right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Nguyễn Văn Ánh</TableCell>
            <TableCell align="right">Sửa</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const region = screen.getByRole("region", { name: "Danh sách học sinh" });
    expect(region).toHaveClass("overflow-auto");
    expect(within(region).getByRole("columnheader", { name: "Thao tác" })).toHaveClass("text-right");
  });
});

describe("Dialog", () => {
  function DialogDemo() {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button>Mở hộp thoại</Button>
        </DialogTrigger>
        <DialogContent
          title="Xóa kỳ thi"
          description="Hành động này không thể hoàn tác."
          footer={
            <DialogClose asChild>
              <Button variant="secondary">Hủy</Button>
            </DialogClose>
          }
        >
          <Input aria-label="Lý do" />
        </DialogContent>
      </Dialog>
    );
  }

  it("bẫy focus, đóng bằng Esc và trả focus về nút mở", async () => {
    const user = userEvent.setup();
    render(<DialogDemo />);
    const trigger = screen.getByRole("button", { name: "Mở hộp thoại" });

    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Xóa kỳ thi" });
    expect(dialog).toHaveAccessibleDescription("Hành động này không thể hoàn tác.");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    for (let press = 0; press < 6; press += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("nút đóng có aria-label", async () => {
    const user = userEvent.setup();
    render(<DialogDemo />);
    await user.click(screen.getByRole("button", { name: "Mở hộp thoại" }));
    await user.click(await screen.findByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("Tabs", () => {
  it("mũi tên phải/trái đổi tab", async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="tong-quan">
        <TabsList aria-label="Chi tiết kỳ thi">
          <TabsTrigger value="tong-quan">Tổng quan</TabsTrigger>
          <TabsTrigger value="diem">Điểm</TabsTrigger>
        </TabsList>
        <TabsContent value="tong-quan">Nội dung tổng quan</TabsContent>
        <TabsContent value="diem">Nội dung điểm</TabsContent>
      </Tabs>,
    );
    const first = screen.getByRole("tab", { name: "Tổng quan" });
    const second = screen.getByRole("tab", { name: "Điểm" });

    await user.click(first);
    await user.keyboard("{ArrowRight}");
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Nội dung điểm")).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(first).toHaveAttribute("aria-selected", "true");
  });
});

describe("Toast", () => {
  function ToastDemo() {
    const { toast } = useToast();
    return (
      <Button onClick={() => toast({ title: "Đã lưu kỳ thi", description: "Thay đổi đã được áp dụng.", tone: "success" })}>
        Lưu
      </Button>
    );
  }

  it("hiện thông báo trong vùng aria-live polite và có nút đóng", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastDemo />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText("Đã lưu kỳ thi")).toBeInTheDocument();
    expect(document.querySelector('[aria-live="polite"]')).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    await waitFor(() => expect(screen.queryByText("Đã lưu kỳ thi")).not.toBeInTheDocument());
  });

  it("toast lỗi được đọc ở mức assertive, toast thường ở mức polite", async () => {
    const user = userEvent.setup();
    function Demo() {
      const { toast } = useToast();
      return (
        <>
          <Button onClick={() => toast({ title: "Không lưu được", tone: "danger" })}>Lỗi</Button>
          <Button onClick={() => toast({ title: "Đã lưu xong", tone: "success" })}>Xong</Button>
        </>
      );
    }
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    const announcement = (level: string) =>
      Array.from(document.querySelectorAll(`[role="status"][aria-live="${level}"]`)).map(
        (node) => node.textContent ?? "",
      );

    await user.click(screen.getByRole("button", { name: "Lỗi" }));
    await waitFor(() => expect(announcement("assertive").join(" ")).toContain("Không lưu được"));
    expect(announcement("polite").join(" ")).not.toContain("Không lưu được");

    await user.click(screen.getByRole("button", { name: "Xong" }));
    await waitFor(() => expect(announcement("polite").join(" ")).toContain("Đã lưu xong"));
    expect(announcement("assertive").join(" ")).not.toContain("Đã lưu xong");
  });
});

describe("AnswerTile", () => {
  const options = [
    { id: "a", label: "Hà Nội" },
    { id: "b", label: "Huế" },
    { id: "c", label: "Đà Nẵng" },
    { id: "d", label: "Cần Thơ" },
  ];

  function Harness({ multiple }: { multiple: boolean }) {
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <AnswerTileGroup
        aria-label="Đáp án"
        options={options}
        selectedIds={selected}
        onChange={setSelected}
        multiple={multiple}
      />
    );
  }

  const tileOf = (text: string) => screen.getByRole("button", { name: new RegExp(text) });

  it("gán chữ cái A B C D theo vị trí", () => {
    render(<Harness multiple={false} />);
    const tiles = screen.getAllByRole("button");
    expect(tiles.map((tile) => tile.textContent?.[0])).toEqual(["A", "B", "C", "D"]);
  });

  it("chọn 1 đáp án: ô còn lại bị làm mờ, ô đã chọn có tick và aria-pressed", async () => {
    const user = userEvent.setup();
    render(<Harness multiple={false} />);
    await user.click(tileOf("Huế"));

    expect(tileOf("Huế")).toHaveAttribute("aria-pressed", "true");
    expect(tileOf("Huế")).not.toHaveAttribute("data-dimmed");
    expect(tileOf("Huế")).not.toHaveClass("opacity-60");
    expect(within(tileOf("Huế")).getByTestId("answer-tick")).toBeInTheDocument();
    for (const other of ["Hà Nội", "Đà Nẵng", "Cần Thơ"]) {
      expect(tileOf(other)).toHaveAttribute("data-dimmed", "true");
      expect(tileOf(other)).toHaveClass("opacity-60");
      expect(tileOf(other)).toHaveAttribute("aria-pressed", "false");
    }

    await user.click(tileOf("Cần Thơ"));
    expect(tileOf("Cần Thơ")).toHaveAttribute("aria-pressed", "true");
    expect(tileOf("Huế")).toHaveAttribute("aria-pressed", "false");
    expect(tileOf("Huế")).toHaveAttribute("data-dimmed", "true");
  });

  it("chọn nhiều đáp án: không làm mờ ô nào, bấm lần nữa để bỏ chọn", async () => {
    const user = userEvent.setup();
    render(<Harness multiple />);
    await user.click(tileOf("Hà Nội"));
    await user.click(tileOf("Đà Nẵng"));

    expect(tileOf("Hà Nội")).toHaveAttribute("aria-pressed", "true");
    expect(tileOf("Đà Nẵng")).toHaveAttribute("aria-pressed", "true");
    for (const tile of screen.getAllByRole("button")) {
      expect(tile).not.toHaveAttribute("data-dimmed");
      expect(tile).not.toHaveClass("opacity-60");
    }

    await user.click(tileOf("Hà Nội"));
    expect(tileOf("Hà Nội")).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryAllByTestId("answer-tick")).toHaveLength(1);
  });

  it("ô đơn lẻ: tick chỉ xuất hiện khi đã chọn", () => {
    const { rerender } = render(<AnswerTile letter="C">Đáp án</AnswerTile>);
    expect(screen.queryByTestId("answer-tick")).not.toBeInTheDocument();
    rerender(
      <AnswerTile letter="C" selected>
        Đáp án
      </AnswerTile>,
    );
    expect(screen.getByTestId("answer-tick")).toBeInTheDocument();
  });
});

describe("Timer", () => {
  it("định dạng mm:ss và h:mm:ss", () => {
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(-3)).toBe("00:00");
    expect(formatClock(3725)).toBe("1:02:05");
  });

  it("dùng font mono tabular-nums; còn dưới hoặc bằng 120 giây đổi sang hồng đậm", () => {
    const { rerender } = render(<Timer remainingSeconds={121} />);
    const timer = screen.getByRole("timer");
    expect(timer).toHaveClass("font-mono", "tabular-nums");
    expect(timer).not.toHaveAttribute("data-urgent");
    expect(timer).not.toHaveClass("bg-quiq-rose");

    rerender(<Timer remainingSeconds={120} />);
    expect(screen.getByRole("timer")).toHaveAttribute("data-urgent", "true");
    expect(screen.getByRole("timer")).toHaveClass("bg-quiq-rose");
  });

  it("vùng aria-live assertive chỉ có chữ ở ba mốc 5 phút, 1 phút, 30 giây (design-spec §11)", () => {
    const { container, rerender } = render(<Timer remainingSeconds={301} />);
    const live = () => container.querySelector('[aria-live="assertive"]');
    expect(live()).toBeEmptyDOMElement();
    rerender(<Timer remainingSeconds={300} />);
    expect(live()).toHaveTextContent("Còn tối đa 5 phút");
    rerender(<Timer remainingSeconds={299} />);
    expect(live()).toHaveTextContent("Còn tối đa 5 phút");
    rerender(<Timer remainingSeconds={61} />);
    expect(live()).toHaveTextContent("Còn tối đa 5 phút");
    rerender(<Timer remainingSeconds={60} />);
    expect(live()).toHaveTextContent("Còn tối đa 1 phút");
    rerender(<Timer remainingSeconds={31} />);
    expect(live()).toHaveTextContent("Còn tối đa 1 phút");
    rerender(<Timer remainingSeconds={30} />);
    expect(live()).toHaveTextContent("Còn tối đa 30 giây");
    rerender(<Timer remainingSeconds={29} />);
    expect(live()).toHaveTextContent("Còn tối đa 30 giây");
    rerender(<Timer remainingSeconds={0} />);
    expect(live()).toHaveTextContent("Còn tối đa 30 giây");
  });
});

describe("trang /_ui", () => {
  it("render không lỗi và các tương tác Radix trong trang chạy được", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <UiGallery />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: "Thư viện giao diện Quiq" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Toast thành công" }));
    expect(await screen.findByText("Đã lưu kỳ thi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xóa kỳ thi" }));
    expect(await screen.findByRole("dialog", { name: /Xóa kỳ thi Giữa kỳ Toán 12/ })).toBeInTheDocument();
  });
});
