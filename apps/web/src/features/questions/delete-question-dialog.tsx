"use client";

import type { Question } from "@quiq/shared/questions";
import { useState } from "react";
import { Button, Dialog, DialogClose, DialogContent, useToast } from "@/components/ui";
import { deleteQuestion } from "./use-questions";

export interface DeleteQuestionDialogProps {
  /** null = dialog đóng. */
  question: Question | null;
  onClose: () => void;
  onDeleted: () => void;
}

/** Xác nhận xóa: nêu rõ câu nào và hậu quả, nút xác nhận màu đỏ (design-spec §3 Dialog). */
export function DeleteQuestionDialog({ question, onClose, onDeleted }: DeleteQuestionDialogProps) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!question) return;
    setBusy(true);
    try {
      await deleteQuestion(question.id);
      onDeleted();
    } catch (cause) {
      toast({
        title: "Không xóa được câu hỏi",
        description: cause instanceof Error ? cause.message : undefined,
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={question !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        title="Xóa câu hỏi?"
        size="sm"
        description="Câu hỏi sẽ bị xóa vĩnh viễn khỏi ngân hàng và không dùng được khi tạo bài thi mới. Các bài thi đã tạo vẫn giữ nguyên bản sao câu hỏi."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="secondary">Hủy</Button>
            </DialogClose>
            <Button variant="danger" loading={busy} loadingLabel="Đang xóa…" onClick={confirmDelete}>
              Xóa câu hỏi
            </Button>
          </>
        }
      >
        {question ? (
          <p className="line-clamp-3 rounded-sm border border-line bg-subtle px-3 py-2 text-base text-ink">
            {question.content}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
