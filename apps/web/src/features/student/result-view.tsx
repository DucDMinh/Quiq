"use client";

import type { AttemptEndReason, AttemptResultView } from "@quiq/shared/student";
import { useEffect, useState } from "react";
import type { ApiError } from "@/lib/api-client";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { CardSkeleton, LoadError, PortalFrame } from "./portal-frame";
import { examPath, isSessionError, studentApi, toApiError } from "./student-api";

const END_REASON_LABEL: Record<AttemptEndReason, string> = {
  submitted: "Đã nộp bài",
  timeout: "Hết giờ",
  violation: "Vi phạm quy chế",
  closed: "Giáo viên thu bài",
};

const formatScore = (score: number) =>
  score.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type ResultLoad =
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "not_finished" }
  | { status: "ready"; result: AttemptResultView };

function useAttemptResult(reloadKey: number): ResultLoad {
  const [load, setLoad] = useState<ResultLoad>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const state = await studentApi.state();
        const next: ResultLoad =
          state.phase === "completed" && state.attempt
            ? { status: "ready", result: await studentApi.result(state.attempt.id) }
            : { status: "not_finished" };
        if (!cancelled) setLoad(next);
      } catch (cause) {
        if (!cancelled) setLoad({ status: "error", error: toApiError(cause) });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);
  return load;
}

function ResultCard({ result }: { result: AttemptResultView }) {
  const [showAnswers, setShowAnswers] = useState(false);
  return (
    <Card className="flex flex-col gap-6 p-8">
      <div className="flex items-stretch justify-between gap-6">
        <div className="flex flex-col gap-3">
          <Badge tone="success" className="self-start">
            Đã hoàn thành bài thi
          </Badge>
          <h1 className="font-display text-2xl font-extrabold text-ink">{result.examTitle}</h1>
          <p className="text-base text-ink">
            {result.student.fullName ?? result.student.code} ({result.student.code})
          </p>
          <p className="text-base text-ink-secondary">
            Lý do kết thúc: {END_REASON_LABEL[result.endReason]} · Lượt #{result.attemptNo}
          </p>
        </div>
        <div className="flex min-w-56 flex-col justify-center rounded-md bg-brand-dark px-6 py-5 text-on-brand">
          <p className="text-sm font-semibold text-on-brand-label">Điểm lần thi này</p>
          <p className="font-mono text-score font-bold tabular-nums" data-testid="score">
            {formatScore(result.score)}
          </p>
          <p className="text-sm text-on-brand-muted">
            Đúng {result.correct}/{result.total} câu (thang 10)
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-line pt-5">
        <p className="text-sm text-ink-muted">
          Đóng trang này thì không có nơi khác để xem lại đáp án.
        </p>
        <Button onClick={() => setShowAnswers(true)}>Xem đáp án</Button>
      </div>
      {/* Công bố đáp án là tính năng sau: hiện chưa có đường nào lấy đáp án đúng. */}
      {showAnswers ? <Alert tone="info">Giáo viên chưa công bố đáp án</Alert> : null}
      <a href="/" className="self-start text-base font-semibold text-ink-secondary underline">
        Thoát về cổng chính
      </a>
    </Card>
  );
}

/** Kết quả (design-spec §5.3, FR-046, FR-047): điểm lần vừa làm, không hiện câu đã chọn hay đáp án đúng. */
export function ResultView({ examCode }: { examCode: string }) {
  const [reloadKey, setReloadKey] = useState(0);
  const load = useAttemptResult(reloadKey);
  return (
    <PortalFrame width="result">
      {load.status === "loading" ? <CardSkeleton /> : null}
      {load.status === "error" ? (
        <LoadError
          message={load.error.message}
          onRetry={() => setReloadKey((key) => key + 1)}
          enterHref={isSessionError(load.error) ? examPath(examCode) : undefined}
        />
      ) : null}
      {load.status === "not_finished" ? (
        <Alert
          tone="info"
          action={
            <a href={examPath(examCode, "phong-cho")} className="font-bold underline">
              Về phòng chờ
            </a>
          }
        >
          Bạn chưa hoàn thành bài thi này nên chưa có kết quả.
        </Alert>
      ) : null}
      {load.status === "ready" ? <ResultCard result={load.result} /> : null}
    </PortalFrame>
  );
}
