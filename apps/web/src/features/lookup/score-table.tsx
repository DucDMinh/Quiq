import type { LookupScoreRow } from "@quiq/shared/lookup";
import { IconFileSearch } from "@tabler/icons-react";
import {
  Card,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatScore } from "./lookup-api";

/** Dùng chung cho mã sai, mã vô hiệu và chưa có bài công bố: không phân biệt được (chống dò mã). */
export const EMPTY_LOOKUP_MESSAGE = "Chưa có bài thi nào được công bố bảng điểm";

function ScoreHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Môn học</TableHead>
        <TableHead>Bài thi</TableHead>
        <TableHead>Mã bài thi</TableHead>
        <TableHead align="right">Điểm chính thức</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** Bảng điểm (design-spec §4.3): không họ tên, không thông tin cá nhân. Bảng cuộn ngang trong khung riêng. */
export function ScoreTable({ items }: { items: readonly LookupScoreRow[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<IconFileSearch size={28} />}
          title={EMPTY_LOOKUP_MESSAGE}
          description="Kiểm tra lại trường, mã học sinh và năm học, hoặc chờ giáo viên công bố bảng điểm."
        />
      </Card>
    );
  }
  return (
    <Table aria-label="Bảng điểm" className="min-w-[560px]">
      <ScoreHeader />
      <TableBody>
        {items.map((item, index) => (
          // Học sinh ở hai lớp cùng được gán một bài thì mã bài thi lặp lại: khóa kèm vị trí.
          <TableRow key={`${item.examCode}-${index}`}>
            <TableCell>{item.subjectName}</TableCell>
            <TableCell>{item.examTitle}</TableCell>
            <TableCell className="font-mono tabular-nums">{item.examCode}</TableCell>
            <TableCell align="right" className="font-mono font-bold tabular-nums">
              {formatScore(item.score)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ScoreTableSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <span className="sr-only">Đang tra cứu…</span>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </div>
  );
}
