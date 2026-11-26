"use client";

import type { Question, QuestionStats } from "@quiq/shared/questions";
import { IconPlus } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Button, KpiCard, Skeleton, useToast } from "@/components/ui";
import { DeleteQuestionDialog } from "./delete-question-dialog";
import { DifficultyFilter } from "./difficulty-filter";
import { QuestionEditorDialog } from "./question-editor-dialog";
import { QuestionListBody } from "./question-list-body";
import { useQuestionList } from "./use-questions";

/**
 * Radix chỉ trả focus về DialogTrigger, còn các dialog ở đây mở từ nhiều nút (đầu trang, empty, từng dòng).
 * Nhớ phần tử đang focus lúc mở, đóng dialog thì trả focus về đó nếu nó còn trên trang.
 */
function useReturnFocus(open: boolean) {
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) return;
    const opener = openerRef.current;
    openerRef.current = null;
    if (opener?.isConnected) opener.focus();
  }, [open]);
  return () => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
}

/** Dialog soạn câu (thêm khi `question` null) và dialog xóa, mỗi cái tự trả focus về nút đã mở nó. */
function useBankDialogs() {
  const [editor, setEditor] = useState<{ question: Question | null } | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);
  const rememberEditorOpener = useReturnFocus(editor !== null);
  const rememberDeleteOpener = useReturnFocus(deleting !== null);

  const openEditor = (question: Question | null) => {
    rememberEditorOpener();
    setEditor({ question });
  };
  const openDelete = (question: Question) => {
    rememberDeleteOpener();
    setDeleting(question);
  };
  const closeEditor = () => setEditor(null);
  const closeDelete = () => setDeleting(null);

  return { editor, deleting, openEditor, openDelete, closeEditor, closeDelete };
}

/** Màn Ngân hàng câu hỏi của giáo viên (design-spec §9.1). */
export function QuestionBank() {
  const list = useQuestionList();
  const dialogs = useBankDialogs();
  const { toast } = useToast();
  const openCreate = () => dialogs.openEditor(null);

  function handleSaved() {
    const editing = dialogs.editor?.question;
    toast({ title: editing ? "Đã lưu thay đổi câu hỏi" : "Đã thêm câu hỏi", tone: "success" });
    dialogs.closeEditor();
    list.reload();
  }

  function handleDeleted() {
    dialogs.closeDelete();
    toast({ title: "Đã xóa câu hỏi", tone: "success" });
    list.reloadAfterDelete();
  }

  return (
    <div className="flex flex-col gap-6">
      <QuestionBankHeader subjectName={list.data?.subject.name} onCreate={openCreate} />
      <QuestionStatsCards stats={list.data?.stats} />
      <DifficultyFilter value={list.difficulty} onChange={list.changeDifficulty} />
      <QuestionListBody list={list} onCreate={openCreate} onEdit={dialogs.openEditor} onDelete={dialogs.openDelete} />
      <QuestionEditorDialog
        open={dialogs.editor !== null}
        question={dialogs.editor?.question ?? null}
        onOpenChange={(open) => {
          if (!open) dialogs.closeEditor();
        }}
        onSaved={handleSaved}
      />
      <DeleteQuestionDialog question={dialogs.deleting} onClose={dialogs.closeDelete} onDeleted={handleDeleted} />
    </div>
  );
}

function QuestionBankHeader({ subjectName, onCreate }: { subjectName: string | undefined; onCreate: () => void }) {
  return (
    <header className="flex items-start justify-between gap-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink">Ngân hàng câu hỏi</h1>
        {subjectName ? (
          <p className="mt-1 text-base text-ink-secondary">Môn {subjectName} · Câu hỏi riêng của bạn</p>
        ) : (
          <Skeleton className="mt-2 h-5 w-48" />
        )}
      </div>
      <Button onClick={onCreate}>
        <IconPlus size={18} aria-hidden="true" />
        Thêm câu hỏi
      </Button>
    </header>
  );
}

function QuestionStatsCards({ stats }: { stats: QuestionStats | undefined }) {
  const loading = !stats;
  return (
    <section aria-label="Thống kê câu hỏi" className="grid grid-cols-4 gap-4">
      <KpiCard label="Tổng" value={stats?.total ?? 0} sub="câu hỏi" tone="brand" loading={loading} />
      <KpiCard label="Dễ" value={stats?.easy ?? 0} sub="câu hỏi" tone="success" loading={loading} />
      <KpiCard label="Trung bình" value={stats?.medium ?? 0} sub="câu hỏi" tone="warning" loading={loading} />
      <KpiCard label="Khó" value={stats?.hard ?? 0} sub="câu hỏi" tone="danger" loading={loading} />
    </section>
  );
}
