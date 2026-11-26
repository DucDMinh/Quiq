"use client";

import type { StudentStateView } from "@quiq/shared/student";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button, Card, type AlertTone, type BadgeTone } from "@/components/ui";
import { CardSkeleton, LoadError, PortalFrame } from "./portal-frame";
import { examPath, isSessionError, studentApi, toApiError } from "./student-api";
import { useStudentState } from "./use-student-state";

function classBadge(state: StudentStateView): { tone: BadgeTone; label: string } {
  if (state.phase === "waiting") return { tone: "warning", label: "Chưa phát đề" };
  if (state.closedReason === "class_closed") return { tone: "danger", label: "Đã thu bài" };
  return { tone: "success", label: "Đã phát đề" };
}

function phaseAlert(state: StudentStateView): { tone: AlertTone; text: string } {
  switch (state.phase) {
    case "waiting":
      return {
        tone: "warning",
        text: `Đang chờ giáo viên phát đề cho lớp ${state.className}. Mã của bạn chưa bị khóa ở phòng chờ.`,
      };
    case "can_start":
      return {
        tone: "success",
        text: "Giáo viên đã phát đề. Đồng hồ chỉ bắt đầu khi bạn bấm Bắt đầu làm bài.",
      };
    case "in_progress":
      return { tone: "info", text: "Bạn đang làm bài dở. Đồng hồ vẫn chạy, hãy quay lại làm bài." };
    case "completed":
      return { tone: "info", text: "Bạn đã hoàn thành bài này." };
    case "closed":
      return state.closedReason === "max_attempts"
        ? {
            tone: "danger",
            text: `Bạn đã dùng hết ${state.attemptsUsed}/${state.maxAttempts} lượt làm bài.`,
          }
        : { tone: "danger", text: "Giáo viên đã đóng và thu bài. Bạn không thể bắt đầu lượt mới." };
  }
}

function InfoBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-md border border-line bg-canvas px-4 py-3">
      <p className="text-sm font-semibold text-ink-muted">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-base font-semibold text-ink">
          {line}
        </p>
      ))}
    </div>
  );
}

/** Nút "Bắt đầu làm bài": chỉ bật khi giáo viên đã phát đề và còn lượt. */
function StartButton({ state, examCode }: { state: StudentStateView; examCode: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      await studentApi.start();
      router.push(examPath(examCode, "lam-bai"));
    } catch (cause) {
      const apiError = toApiError(cause);
      if (apiError.code === "ATTEMPT_IN_PROGRESS")
        return router.push(examPath(examCode, "lam-bai"));
      setError(apiError.message);
      setStarting(false);
    }
  }

  const canStart = state.phase === "can_start";
  const disabledReason =
    state.phase === "waiting" ? "Giáo viên chưa phát đề" : "Không thể bắt đầu lượt mới";
  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="success"
        size="lg"
        className="w-[220px]"
        disabled={!canStart}
        title={canStart ? undefined : disabledReason}
        loading={starting}
        loadingLabel="Đang bắt đầu…"
        onClick={start}
      >
        Bắt đầu làm bài
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

function PrimaryAction({ state, examCode }: { state: StudentStateView; examCode: string }) {
  const router = useRouter();
  if (state.phase === "in_progress") {
    return (
      <Button
        variant="success"
        size="lg"
        className="w-[220px]"
        onClick={() => router.push(examPath(examCode, "lam-bai"))}
      >
        Tiếp tục làm bài
      </Button>
    );
  }
  if (state.phase === "completed") {
    return (
      <Button size="lg" onClick={() => router.push(examPath(examCode, "ket-qua"))}>
        Xem kết quả
      </Button>
    );
  }
  return <StartButton state={state} examCode={examCode} />;
}

function WaitingCard({ state, examCode }: { state: StudentStateView; examCode: string }) {
  const badge = classBadge(state);
  const alert = phaseAlert(state);
  const nextAttempt = Math.min(state.attemptsUsed + 1, state.maxAttempts);
  return (
    <Card className="flex flex-col gap-5 p-8">
      <div className="flex flex-wrap gap-2">
        <Badge tone="brand">{state.exam.subjectName}</Badge>
        <Badge tone="neutral" className="font-mono">
          Mã bài thi: {state.exam.code}
        </Badge>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <h1 className="font-display text-3xl font-extrabold text-ink">{state.exam.title}</h1>
      <div className="grid grid-cols-2 gap-4">
        <InfoBox
          title="Thí sinh"
          lines={[
            state.student.fullName ?? state.student.code,
            `${state.student.code} · Lớp ${state.className}`,
          ]}
        />
        <InfoBox
          title="Lượt thi"
          lines={[
            `${state.exam.durationMinutes} phút · ${state.exam.questionCount} câu`,
            `Lượt sắp làm: ${nextAttempt}/${state.maxAttempts} · Cảnh báo tối đa: ${state.warnLimit}`,
          ]}
        />
      </div>
      <Alert tone={alert.tone}>{alert.text}</Alert>
      <div className="flex items-start justify-between gap-4">
        <PrimaryAction state={state} examCode={examCode} />
        <a href="/thi" className="text-base font-semibold text-ink-secondary underline">
          Rời phòng chờ
        </a>
      </div>
    </Card>
  );
}

/** Phòng chờ (design-spec §5.1, FR-033): tự cập nhật trạng thái lớp mỗi 3 giây. */
export function WaitingRoom({ examCode }: { examCode: string }) {
  const { state, error, reload } = useStudentState(true);
  const sessionLost = error !== null && isSessionError(error);
  return (
    <PortalFrame>
      {error && (sessionLost || !state) ? (
        <LoadError
          message={error.message}
          onRetry={reload}
          enterHref={sessionLost ? examPath(examCode) : undefined}
        />
      ) : null}
      {state && !sessionLost ? <WaitingCard state={state} examCode={examCode} /> : null}
      {!state && !error ? <CardSkeleton /> : null}
    </PortalFrame>
  );
}
