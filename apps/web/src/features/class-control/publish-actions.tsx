"use client";

import type { ExamClassState, PublishKind } from "@quiq/shared/exams";
import { useState } from "react";
import { Alert, Badge, Button, Dialog, DialogClose, DialogContent, useToast } from "@/components/ui";
import { toApiError } from "@/features/exams/use-exams";
import { classControlApi, type ExamClassTarget } from "./use-roster";

const PUBLISH_KINDS: readonly PublishKind[] = ["answers", "scores"];

const PUBLISH_TEXT: Record<PublishKind, { action: string; done: string; effect: string }> = {
  answers: {
    action: "Công bố đáp án",
    done: "Đáp án: Đã công bố",
    effect: "Học sinh của lớp sẽ xem được đề và đáp án đúng tại trang kết quả.",
  },
  scores: {
    action: "Công bố bảng điểm",
    done: "Bảng điểm: Đã công bố",
    effect: "Bảng điểm của lớp sẽ được công bố cho học sinh.",
  },
};

const isPublished = (examClass: ExamClassState, kind: PublishKind) =>
  (kind === "answers" ? examClass.answersPublishedAt : examClass.scoresPublishedAt) !== null;

export interface PublishActionsProps {
  target: ExamClassTarget;
  className: string;
  /** Trạng thái lớp từ roster (SSE); null khi đang tải. */
  examClass: ExamClassState | null;
  /** Số bài đang làm; > 0 khi lớp đã đóng nghĩa là lần thu bài trước lỗi giữa chừng (server cũng chặn). */
  inProgress: number;
  onDone: () => void;
}

/**
 * "Công bố đáp án" và "Công bố bảng điểm" (FR-037, FR-038, BR-010): hai nút riêng, chỉ bấm được khi lớp đã thu bài
 * xong (server cũng chặn), một chiều nên đã công bố thì đổi thành badge.
 */
export function PublishActions({ target, className, examClass, inProgress, onDone }: PublishActionsProps) {
  const [pending, setPending] = useState<PublishKind | null>(null);
  const closed = examClass?.status === "closed";
  const ready = closed && inProgress === 0;
  // Câu hỏi thuộc bài thi: đáp án chỉ công bố được khi mọi lớp của bài đã thu bài xong (server cũng chặn).
  const answersBlocked = examClass?.otherClassesOpen ?? false;
  const canPublish = (kind: PublishKind) => ready && !(kind === "answers" && answersBlocked);
  return (
    <>
      {PUBLISH_KINDS.map((kind) =>
        examClass && isPublished(examClass, kind) ? (
          <Badge key={kind} tone="success">
            {PUBLISH_TEXT[kind].done}
          </Badge>
        ) : (
          <Button key={kind} variant="secondary" disabled={!canPublish(kind)} onClick={() => setPending(kind)}>
            {PUBLISH_TEXT[kind].action}
          </Button>
        ),
      )}
      <PublishHint examClass={examClass} closed={closed} ready={ready} answersBlocked={answersBlocked} />
      <ConfirmPublishDialog
        kind={pending}
        target={target}
        className={className}
        onClose={() => setPending(null)}
        onDone={onDone}
      />
    </>
  );
}

interface PublishHintProps {
  examClass: ExamClassState | null;
  closed: boolean;
  ready: boolean;
  answersBlocked: boolean;
}

function PublishHint({ examClass, closed, ready, answersBlocked }: PublishHintProps) {
  if (!examClass) return null;
  let hint: string | null = null;
  if (!ready) hint = closed ? "Thu bài lại trước khi công bố." : "Thu bài trước khi công bố.";
  else if (answersBlocked && !isPublished(examClass, "answers"))
    hint = "Mọi lớp của bài phải thu bài trước khi công bố đáp án.";
  return hint ? <p className="text-sm text-ink-muted">{hint}</p> : null;
}

interface ConfirmPublishDialogProps {
  kind: PublishKind | null;
  target: ExamClassTarget;
  className: string;
  onClose: () => void;
  onDone: () => void;
}

function ConfirmPublishDialog({ kind, target, className, onClose, onDone }: ConfirmPublishDialogProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = kind ? PUBLISH_TEXT[kind] : null;

  const close = () => {
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!kind || !text) return;
    setBusy(true);
    setError(null);
    try {
      await classControlApi.publish(target, kind);
      toast({ tone: "success", title: `Đã ${text.action.toLowerCase()} lớp ${className}` });
      close();
      onDone();
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
      <Button loading={busy} loadingLabel="Đang xử lý…" onClick={() => void confirm()}>
        {text?.action ?? ""}
      </Button>
    </>
  );

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent title={`${text?.action ?? ""} lớp ${className}?`} size="sm" footer={footer}>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <p>
          {text?.effect} <strong>Không thể hủy công bố sau khi xác nhận.</strong>
        </p>
      </DialogContent>
    </Dialog>
  );
}
