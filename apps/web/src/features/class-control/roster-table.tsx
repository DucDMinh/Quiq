import { ROSTER_STATUS_LABELS, type RosterStatus, type RosterStudent } from "@quiq/shared/exams";
import {
  Badge,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type BadgeTone,
} from "@/components/ui";
import type { RosterConnection } from "./use-roster";

const STATUS_TONE: Record<RosterStatus, BadgeTone> = {
  not_started: "neutral",
  waiting: "warning",
  in_progress: "info",
  submitted: "success",
};

const scoreFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export function formatScore(score: number | null): string {
  return score === null ? "Chưa có" : scoreFormat.format(score);
}

/** Huy hiệu kết nối SSE; không hiện khi đang mở kết nối đầu hoặc trình duyệt chỉ polling. */
export function ConnectionBadge({ connection }: { connection: RosterConnection }) {
  if (connection === null) return null;
  return connection === "live" ? (
    <Badge tone="success">Trực tiếp</Badge>
  ) : (
    <Badge tone="warning">Đang kết nối lại</Badge>
  );
}

export function RosterTable({ students }: { students: RosterStudent[] }) {
  if (students.length === 0) {
    return <EmptyState title="Lớp chưa có học sinh" description="Admin trường thêm học sinh vào lớp này." />;
  }
  return (
    <Table aria-label="Trạng thái học sinh của lớp">
      <TableHeader>
        <TableRow>
          <TableHead>Mã</TableHead>
          <TableHead>Họ tên</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead align="right">Lượt làm</TableHead>
          <TableHead align="right">Điểm cao nhất</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((student) => (
          <TableRow key={student.studentId}>
            <TableCell className="font-mono">{student.code}</TableCell>
            <TableCell>{student.fullName ?? "(Đã xóa thông tin)"}</TableCell>
            <TableCell>
              <span className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[student.status]}>{ROSTER_STATUS_LABELS[student.status]}</Badge>
                {student.interrupted ? <Badge tone="danger">Gián đoạn</Badge> : null}
              </span>
            </TableCell>
            <TableCell align="right" className="font-mono">
              {student.attemptsUsed}
            </TableCell>
            <TableCell align="right" className="font-mono">
              {formatScore(student.bestScore)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
