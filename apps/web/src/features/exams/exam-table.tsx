"use client";

import {
  DIFFICULTY_LABELS,
  EXAM_CLASS_STATUS_LABELS,
  type ExamDetailView,
  type ExamListItem,
} from "@quiq/shared/exams";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from "@/components/ui";
import { examsApi, toApiError } from "./use-exams";

export interface ExamTableProps {
  exams: ExamListItem[];
  /** Gọi sau khi xóa thành công để tải lại danh sách. */
  onChanged: () => void;
}

const drawSummary = ({ drawConfig: c }: ExamListItem) =>
  `${c.total} câu (Dễ ${c.easy} / TB ${c.medium} / Khó ${c.hard})`;

export function ExamTable({ exams, onChanged }: ExamTableProps) {
  const { toast } = useToast();
  const [viewing, setViewing] = useState<ExamListItem | null>(null);
  const [deleting, setDeleting] = useState<ExamListItem | null>(null);

  const copyLink = async (exam: ExamListItem) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${exam.link}`);
      toast({ tone: "success", title: `Đã sao chép link bài thi ${exam.code}` });
    } catch {
      toast({ tone: "danger", title: "Không sao chép được", description: `Mã bài thi: ${exam.code}` });
    }
  };

  return (
    <>
      <Table aria-label="Danh sách bài thi">
        <TableHeader>
          <TableRow>
            <TableHead>Tên bài</TableHead>
            <TableHead>Mã bài thi</TableHead>
            <TableHead>Cấu hình đề</TableHead>
            <TableHead>Lớp được gán</TableHead>
            <TableHead align="right">Lượt thi</TableHead>
            <TableHead align="right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {exams.map((exam) => (
            <TableRow key={exam.id}>
              <TableCell>
                <span className="font-semibold">{exam.title}</span>
                <span className="block text-sm text-ink-muted">{exam.durationMinutes} phút</span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{exam.code}</span>
                  <Button size="sm" variant="secondary" onClick={() => void copyLink(exam)}>
                    Sao chép link
                  </Button>
                </div>
              </TableCell>
              <TableCell>{drawSummary(exam)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1.5">
                  {exam.classes.map((c) => (
                    <Badge key={c.classId} tone={c.status === "dispatched" ? "info" : "neutral"}>
                      {c.className}: {EXAM_CLASS_STATUS_LABELS[c.status]}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell align="right" className="font-mono">
                {exam.attemptCount}
              </TableCell>
              <TableCell align="right">
                <ExamActions exam={exam} onView={setViewing} onDelete={setDeleting} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ExamDetailDialog exam={viewing} onClose={() => setViewing(null)} />
      <DeleteExamDialog exam={deleting} onClose={() => setDeleting(null)} onDeleted={onChanged} />
    </>
  );
}

interface ExamActionsProps {
  exam: ExamListItem;
  onView: (exam: ExamListItem) => void;
  onDelete: (exam: ExamListItem) => void;
}

function ExamActions({ exam, onView, onDelete }: ExamActionsProps) {
  const locked = exam.attemptCount > 0;
  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" variant="secondary" onClick={() => onView(exam)}>
        Xem đề
      </Button>
      <Link
        href={`/giao-vien/phong-thi?bai=${exam.id}`}
        className="inline-flex min-h-(--control-height-sm) items-center rounded-md border border-line-strong px-3 text-sm font-semibold text-ink hover:bg-subtle"
      >
        Phòng thi
      </Link>
      <Button
        size="sm"
        variant="danger-outline"
        disabled={locked}
        title={locked ? "Bài thi đã có học sinh làm nên không xóa được." : undefined}
        onClick={() => onDelete(exam)}
      >
        Xóa
      </Button>
    </div>
  );
}

function ExamDetailDialog({ exam, onClose }: { exam: ExamListItem | null; onClose: () => void }) {
  // Kết quả gắn với id đề đã nạp; mở đề khác thì kết quả cũ tự bị bỏ qua.
  const [loaded, setLoaded] = useState<{ examId: string; detail?: ExamDetailView; error?: string }>({
    examId: "",
  });
  const examId = exam?.id;

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    examsApi.detail(examId).then(
      (view) => {
        if (!cancelled) setLoaded({ examId, detail: view });
      },
      (cause: unknown) => {
        if (!cancelled) setLoaded({ examId, error: toApiError(cause).message });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [examId]);

  const current = loaded.examId === examId;
  const detail = current ? loaded.detail : undefined;
  const error = current ? loaded.error : undefined;

  return (
    <Dialog open={exam !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={exam ? `Đề: ${exam.title}` : "Đề"} size="lg">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {!detail && !error ? <Skeleton className="h-40 w-full" /> : null}
        <ol className="flex flex-col gap-4">
          {detail?.questions.map((q) => (
            <li key={q.id} className="rounded-md border border-line p-4">
              <p className="font-semibold">
                Câu {q.position}. {q.content}
              </p>
              <p className="mb-2 text-sm text-ink-muted">
                {DIFFICULTY_LABELS[q.difficulty]}
                {q.multiSelect ? " · Chọn nhiều đáp án" : ""}
              </p>
              <ul className="flex flex-col gap-1">
                {q.options.map((o) => (
                  <li key={o.id} className={o.isCorrect ? "font-semibold text-success-text" : undefined}>
                    {o.content}
                    {o.isCorrect ? " (đáp án đúng)" : ""}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteExamDialogProps {
  exam: ExamListItem | null;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteExamDialog({ exam, onClose, onDeleted }: DeleteExamDialogProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!exam) return;
    setBusy(true);
    setError(null);
    try {
      await examsApi.remove(exam.id);
      toast({ tone: "success", title: `Đã xóa bài thi ${exam.title}` });
      onClose();
      onDeleted();
    } catch (cause) {
      setError(toApiError(cause).message);
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      <DialogClose asChild>
        <Button variant="secondary">Hủy</Button>
      </DialogClose>
      <Button variant="danger" loading={busy} loadingLabel="Đang xóa…" onClick={() => void confirm()}>
        Xóa bài thi
      </Button>
    </>
  );

  return (
    <Dialog open={exam !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="Xóa bài thi" size="sm" footer={footer}>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <p>
          Xóa bài thi <strong>{exam?.title}</strong> ({exam?.code}) cùng đề và các lớp được gán. Học sinh sẽ
          không vào thi bằng mã này được nữa. Không thể hoàn tác.
        </p>
      </DialogContent>
    </Dialog>
  );
}
