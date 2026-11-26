"use client";

import type { Question } from "@quiq/shared/questions";
import { IconBooks, IconPlus } from "@tabler/icons-react";
import { Alert, Button, EmptyState, Skeleton } from "@/components/ui";
import { QuestionRow } from "./question-row";
import type { useQuestionList } from "./use-questions";

type QuestionListState = ReturnType<typeof useQuestionList>;

export interface QuestionListBodyProps {
  list: QuestionListState;
  onCreate: () => void;
  onEdit: (question: Question) => void;
  onDelete: (question: Question) => void;
}

/** Vùng danh sách với đủ trạng thái: lỗi, đang tải (skeleton), ngân hàng trống, lọc không có câu, có câu. */
export function QuestionListBody({ list, onCreate, onEdit, onDelete }: QuestionListBodyProps) {
  if (list.error) {
    return (
      <Alert
        tone="danger"
        title="Không tải được ngân hàng câu hỏi"
        action={
          <Button variant="secondary" size="sm" onClick={list.reload}>
            Thử lại
          </Button>
        }
      >
        {list.error}
      </Alert>
    );
  }
  if (list.loading || !list.data) return <QuestionListSkeleton />;
  if (list.data.stats.total === 0) return <EmptyBank onCreate={onCreate} />;
  if (list.data.items.length === 0) {
    return (
      <EmptyState
        title="Không có câu hỏi ở mức này"
        description="Chọn mức khác hoặc chọn Tất cả để xem toàn bộ ngân hàng."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label="Danh sách câu hỏi" className="flex flex-col gap-3">
        {list.data.items.map((question) => (
          <QuestionRow key={question.id} question={question} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
      <Pagination list={list} />
    </div>
  );
}

function EmptyBank({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={<IconBooks size={28} />}
      title="Chưa có câu hỏi nào"
      description="Thêm câu hỏi đầu tiên để bắt đầu xây dựng ngân hàng cho môn của bạn."
      action={
        <Button onClick={onCreate}>
          <IconPlus size={18} aria-hidden="true" />
          Thêm câu hỏi
        </Button>
      }
    />
  );
}

function Pagination({ list }: { list: QuestionListState }) {
  if (!list.data) return null;
  const pageCount = Math.ceil(list.data.total / list.data.pageSize);
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Phân trang" className="flex items-center justify-end gap-3">
      <Button variant="secondary" size="sm" disabled={list.page <= 1} onClick={() => list.goToPage(list.page - 1)}>
        Trang trước
      </Button>
      <span className="font-mono text-sm tabular-nums text-ink-secondary">
        Trang {list.page} / {pageCount}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={list.page >= pageCount}
        onClick={() => list.goToPage(list.page + 1)}
      >
        Trang sau
      </Button>
    </nav>
  );
}

function QuestionListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Đang tải câu hỏi">
      {[0, 1, 2].map((row) => (
        <div key={row} className="rounded-md border border-line bg-surface p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-5 w-1/2" />
          <Skeleton className="mt-3 h-6 w-40" />
        </div>
      ))}
    </div>
  );
}
