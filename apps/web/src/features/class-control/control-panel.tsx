"use client";

import { EXAM_CLASS_STATUS_LABELS, type ExamListItem, type RosterView } from "@quiq/shared/exams";
import Link from "next/link";
import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  EmptyState,
  Field,
  KpiCard,
  Select,
  Skeleton,
  useToast,
} from "@/components/ui";
import { toApiError, useExams } from "@/features/exams/use-exams";
import { ConnectionBadge, RosterTable } from "./roster-table";
import { classControlApi, useRoster, type ExamClassTarget, type RosterConnection } from "./use-roster";

type PendingAction = "dispatch" | "close";

export interface ControlPanelProps {
  /** Bài thi chọn sẵn (từ nút "Phòng thi" ở trang Bài thi, `?bai=<id>`). */
  initialExamId?: string | null;
}

export function ControlPanel({ initialExamId }: ControlPanelProps) {
  const { exams, error: examsError, reload: reloadExams } = useExams();
  const [examId, setExamId] = useState<string | null>(initialExamId ?? null);
  const [classId, setClassId] = useState<string | null>(null);

  const exam = exams?.find((e) => e.id === examId) ?? exams?.[0] ?? null;
  const examClass = exam?.classes.find((c) => c.classId === classId) ?? exam?.classes[0] ?? null;
  const target: ExamClassTarget | null =
    exam && examClass ? { examId: exam.id, classId: examClass.classId } : null;
  const { roster, error: rosterError, connection, reload } = useRoster(target);

  if (examsError) {
    return (
      <Alert tone="danger" action={<Button size="sm" variant="secondary" onClick={reloadExams}>Thử lại</Button>}>
        {examsError.message}
      </Alert>
    );
  }
  if (exams === null) return <Skeleton className="h-64 w-full" />;
  if (!exam || !examClass || !target) {
    return (
      <EmptyState
        title="Chưa có bài thi nào"
        description="Tạo bài thi và gán lớp trước, rồi quay lại đây để phát đề."
        action={<Link href="/giao-vien/bai-thi" className="font-semibold text-brand underline">Đi tới Bài thi</Link>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ExamClassPicker
        exams={exams}
        exam={exam}
        classId={examClass.classId}
        onExamChange={(value) => {
          setExamId(value);
          setClassId(null);
        }}
        onClassChange={setClassId}
      />
      <ClassActions
        target={target}
        className={examClass.className}
        roster={roster}
        onDone={() => {
          reload();
          reloadExams();
        }}
      />
      {rosterError ? <Alert tone="danger">{rosterError.message}</Alert> : null}
      <RosterSection roster={roster} connection={connection} />
    </div>
  );
}

interface ExamClassPickerProps {
  exams: ExamListItem[];
  exam: ExamListItem;
  classId: string;
  onExamChange: (examId: string) => void;
  onClassChange: (classId: string) => void;
}

function ExamClassPicker({ exams, exam, classId, onExamChange, onClassChange }: ExamClassPickerProps) {
  return (
    <div className="grid grid-cols-[1fr_16rem_auto] items-end gap-4">
      <Field label="Bài thi">
        {(control) => (
          <Select
            {...control}
            options={exams.map((e) => ({ value: e.id, label: `${e.title} (${e.code})` }))}
            value={exam.id}
            onValueChange={onExamChange}
          />
        )}
      </Field>
      <Field label="Lớp">
        {(control) => (
          <Select
            {...control}
            options={exam.classes.map((c) => ({ value: c.classId, label: c.className }))}
            value={classId}
            onValueChange={onClassChange}
          />
        )}
      </Field>
      <CopyCodeButton exam={exam} />
    </div>
  );
}

function CopyCodeButton({ exam }: { exam: ExamListItem }) {
  const { toast } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exam.code);
      toast({ tone: "success", title: `Đã sao chép mã bài thi ${exam.code}` });
    } catch {
      toast({ tone: "danger", title: "Không sao chép được", description: `Mã bài thi: ${exam.code}` });
    }
  };
  return (
    <Button variant="secondary" onClick={() => void copy()}>
      Sao chép mã bài thi
    </Button>
  );
}

interface ClassActionsProps {
  target: ExamClassTarget;
  className: string;
  roster: RosterView | null;
  onDone: () => void;
}

function ClassActions({ target, className, roster, onDone }: ClassActionsProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const status = roster?.examClass.status;
  const inProgress = roster?.counts.in_progress ?? 0;
  // Lớp đã đóng mà còn bài đang làm (lần thu bài trước lỗi giữa chừng): cho thu bài lại để dọn nốt.
  const recloseNeeded = status === "closed" && inProgress > 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={status !== "draft"} onClick={() => setPending("dispatch")}>
        Phát đề cho lớp {className}
      </Button>
      <Button
        variant="danger"
        disabled={status !== "dispatched" && !recloseNeeded}
        onClick={() => setPending("close")}
      >
        {recloseNeeded ? `Thu bài lại lớp ${className}` : `Đóng / Thu bài lớp ${className}`}
      </Button>
      {status ? (
        <Badge tone={status === "dispatched" ? "info" : status === "closed" ? "danger" : "neutral"}>
          {EXAM_CLASS_STATUS_LABELS[status]}
        </Badge>
      ) : null}
      <ConfirmActionDialog
        action={pending}
        target={target}
        className={className}
        inProgress={inProgress}
        onClose={() => setPending(null)}
        onDone={onDone}
      />
    </div>
  );
}

interface ConfirmActionDialogProps {
  action: PendingAction | null;
  target: ExamClassTarget;
  className: string;
  inProgress: number;
  onClose: () => void;
  onDone: () => void;
}

function ConfirmActionDialog({ action, target, className, inProgress, onClose, onDone }: ConfirmActionDialogProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      if (action === "dispatch") {
        await classControlApi.dispatch(target);
        toast({ tone: "success", title: `Đã phát đề cho lớp ${className}` });
      } else {
        const result = await classControlApi.close(target);
        toast({
          tone: "success",
          title: `Đã thu bài lớp ${className}`,
          description: `${result.finalizedAttempts} bài đang làm đã được nộp và chấm.`,
        });
      }
      close();
      onDone();
    } catch (cause) {
      setError(toApiError(cause).message);
    } finally {
      setBusy(false);
    }
  };

  const isClose = action === "close";
  const footer = (
    <>
      <DialogClose asChild>
        <Button variant="secondary">Hủy</Button>
      </DialogClose>
      <Button variant={isClose ? "danger" : "primary"} loading={busy} loadingLabel="Đang xử lý…" onClick={() => void confirm()}>
        {isClose ? "Thu bài" : "Phát đề"}
      </Button>
    </>
  );

  return (
    <Dialog open={action !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent
        title={isClose ? `Đóng và thu bài lớp ${className}?` : `Phát đề cho lớp ${className}?`}
        size="sm"
        footer={footer}
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {isClose ? (
          <p>
            <strong>{inProgress} học sinh đang làm sẽ bị nộp ngay.</strong> Học sinh chưa bắt đầu sẽ không làm được
            nữa. Không thể mở lại lớp sau khi thu bài.
          </p>
        ) : (
          <p>
            Học sinh lớp {className} sẽ bấm được &quot;Bắt đầu làm bài&quot;. Số lần làm và số lần cảnh báo hiện tại của
            trường được chốt cho lớp này.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RosterSection({ roster, connection }: { roster: RosterView | null; connection: RosterConnection }) {
  const loading = roster === null;
  const counts = roster?.counts;
  return (
    <>
      <div className="flex justify-end" aria-live="polite">
        <ConnectionBadge connection={connection} />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Đang chờ" tone="warning" value={counts?.waiting ?? 0} loading={loading} />
        <KpiCard label="Đang làm" tone="info" value={counts?.in_progress ?? 0} loading={loading} />
        <KpiCard label="Đã nộp" tone="success" value={counts?.submitted ?? 0} loading={loading} />
        <KpiCard label="Chưa vào thi" tone="brand" value={counts?.not_started ?? 0} loading={loading} />
      </div>
      {roster ? <RosterTable students={roster.students} /> : <Skeleton className="h-48 w-full" />}
    </>
  );
}
