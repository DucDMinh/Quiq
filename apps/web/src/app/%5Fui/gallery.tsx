"use client";

import { IconBell, IconFileOff, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState, type ReactNode } from "react";
import {
  Alert,
  AnswerTileGroup,
  Badge,
  Button,
  Card,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  KpiCard,
  LetterBadge,
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
  useToast,
  type AlertTone,
  type BadgeTone,
} from "@/components/ui";

const BUTTON_VARIANTS = ["primary", "secondary", "subtle", "success", "danger", "danger-outline"] as const;
const BADGE_TONES: BadgeTone[] = ["brand", "success", "warning", "danger", "info", "neutral"];
const ALERT_TONES_LIST: AlertTone[] = ["success", "info", "warning", "danger", "neutral"];
const ANSWERS = [
  { id: "a", label: "Hà Nội" },
  { id: "b", label: "Huế" },
  { id: "c", label: "Đà Nẵng" },
  { id: "d", label: "Cần Thơ" },
];
const VIETNAMESE_SAMPLE = "Ắ ể ữ ợ ặ: Thí sinh nộp bài đúng giờ";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function UiGallery() {
  const { toast } = useToast();
  const [single, setSingle] = useState<string[]>([]);
  const [multiple, setMultiple] = useState<string[]>(["a", "c"]);

  return (
    <main className="mx-auto flex max-w-(--layout-content-max) flex-col gap-10 px-8 py-8">
      <header className="on-brand -mx-8 flex items-center justify-between rounded-md bg-brand px-8 py-4 text-on-brand">
        <h1 className="font-display text-2xl font-extrabold">Thư viện giao diện Quiq</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-on-brand-muted">Ring focus trắng trên nền teal</span>
          <IconButton label="Mở thông báo" variant="secondary" size="sm">
            <IconBell size={18} aria-hidden="true" />
          </IconButton>
          <Timer remainingSeconds={95} />
        </div>
      </header>

      <Section title="Font tiếng Việt đủ dấu">
        <Card className="flex flex-col gap-2">
          <p className="font-display text-xl font-extrabold">Montserrat: {VIETNAMESE_SAMPLE}</p>
          <p className="font-sans text-base">Be Vietnam Pro: {VIETNAMESE_SAMPLE}</p>
          <p className="font-mono text-base tabular-nums">IBM Plex Mono: {VIETNAMESE_SAMPLE} 0123456789</p>
        </Card>
      </Section>

      <Section title="Nút">
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Nhỏ 36px</Button>
          <Button size="md">Vừa 42px</Button>
          <Button size="lg">Lớn 50px</Button>
          <Button loading>Lưu</Button>
          <Button disabled title="Chưa chọn kỳ thi nào">
            Vô hiệu
          </Button>
          <Button variant="secondary">
            <IconPlus size={18} aria-hidden="true" />
            Thêm câu hỏi
          </Button>
          <IconButton label="Xóa câu hỏi" variant="danger-outline">
            <IconTrash size={18} aria-hidden="true" />
          </IconButton>
        </div>
      </Section>

      <Section title="Ô nhập">
        <div className="grid grid-cols-3 gap-6">
          <Field label="Tên kỳ thi" hint="Tối đa 120 ký tự" required>
            {(control) => <Input {...control} placeholder="Ví dụ: Giữa kỳ Toán 12" />}
          </Field>
          <Field label="Mã bài thi" error="Mã bài thi gồm 6 chữ số">
            {(control) => <Input {...control} className="font-mono tabular-nums" defaultValue="12ab" />}
          </Field>
          <Field label="Môn học">
            {(control) => (
              <Select
                {...control}
                placeholder="Chọn môn"
                options={[
                  { value: "toan", label: "Toán" },
                  { value: "ly", label: "Vật lý" },
                  { value: "van", label: "Ngữ văn" },
                ]}
              />
            )}
          </Field>
          <Field label="Ghi chú" className="col-span-3">
            {(control) => <Textarea {...control} />}
          </Field>
        </div>
      </Section>

      <Section title="Badge, cảnh báo, thẻ">
        <div className="flex flex-wrap gap-2">
          {BADGE_TONES.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {ALERT_TONES_LIST.map((tone) => (
            <Alert
              key={tone}
              tone={tone}
              title={`Cảnh báo ${tone}`}
              action={tone === "danger" ? <Button size="sm" variant="danger-outline">Thử lại</Button> : undefined}
            >
              Nội dung ngắn gọn, nói rõ việc cần làm tiếp theo.
            </Alert>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Kỳ thi đang mở" value={12} sub="Tăng 2 so với tuần trước" />
          <KpiCard label="Đã nộp bài" value="1.248" tone="success" />
          <KpiCard label="Cần chú ý" value={7} tone="warning" />
          <KpiCard label="Đang tải" value={0} loading />
        </div>
        <Card>
          <CardTitle>Thẻ nội dung</CardTitle>
          <p className="mt-1 text-base text-ink-secondary">Nền trắng, viền nhạt, bóng thẻ, bo 10px.</p>
        </Card>
      </Section>

      <Section title="Tabs và bảng">
        <Tabs defaultValue="tong-quan">
          <TabsList aria-label="Chi tiết kỳ thi">
            <TabsTrigger value="tong-quan">Tổng quan</TabsTrigger>
            <TabsTrigger value="diem">Điểm</TabsTrigger>
            <TabsTrigger value="nhat-ky">Nhật ký</TabsTrigger>
          </TabsList>
          <TabsContent value="tong-quan">
            <Table aria-label="Danh sách thí sinh" wrapperClassName="max-h-64">
              <TableHeader>
                <TableRow>
                  <TableHead>Mã</TableHead>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead align="right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {["Nguyễn Văn Ánh", "Trần Thị Thu Hà", "Lê Hoàng Phước"].map((name, index) => (
                  <TableRow key={name}>
                    <TableCell className="font-mono tabular-nums">{`HS${String(index + 1).padStart(4, "0")}`}</TableCell>
                    <TableCell>{name}</TableCell>
                    <TableCell>
                      <Badge tone={index === 1 ? "warning" : "success"}>{index === 1 ? "Đang làm" : "Đã nộp"}</Badge>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="sm" variant="secondary">
                        Xem
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="diem">
            <EmptyState
              icon={<IconFileOff size={28} />}
              title="Chưa có điểm"
              description="Điểm xuất hiện sau khi thí sinh đầu tiên nộp bài."
              action={<Button variant="secondary">Làm mới</Button>}
            />
          </TabsContent>
          <TabsContent value="nhat-ky">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Hộp thoại và thông báo">
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger">Xóa kỳ thi</Button>
            </DialogTrigger>
            <DialogContent
              title="Xóa kỳ thi Giữa kỳ Toán 12?"
              description="Toàn bộ bài làm và điểm của 42 thí sinh sẽ bị xóa vĩnh viễn."
              footer={
                <>
                  <DialogClose asChild>
                    <Button variant="secondary">Hủy</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="danger">Xóa kỳ thi</Button>
                  </DialogClose>
                </>
              }
            />
          </Dialog>
          <Button variant="secondary" onClick={() => toast({ title: "Đã lưu kỳ thi", tone: "success" })}>
            Toast thành công
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast({ title: "Không lưu được", description: "Hãy thử lại sau ít phút.", tone: "danger" })}
          >
            Toast lỗi
          </Button>
        </div>
      </Section>

      <Section title="Ô đáp án và đồng hồ">
        <div className="grid grid-cols-2 gap-8">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink-secondary">Chọn 1 đáp án (ô còn lại bị mờ)</p>
            <AnswerTileGroup aria-label="Thủ đô của Việt Nam" options={ANSWERS} selectedIds={single} onChange={setSingle} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-ink-secondary">Chọn nhiều đáp án (không làm mờ)</p>
            <AnswerTileGroup
              aria-label="Các thành phố trực thuộc trung ương"
              options={ANSWERS}
              selectedIds={multiple}
              onChange={setMultiple}
              multiple
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Timer remainingSeconds={1800} />
          <Timer remainingSeconds={119} />
          {(["A", "B", "C", "D"] as const).map((letter) => (
            <span key={letter} className="rounded-full bg-brand p-1">
              <LetterBadge letter={letter} />
            </span>
          ))}
        </div>
      </Section>
    </main>
  );
}
