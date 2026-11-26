"use client";

import type { ExamPaperView } from "@quiq/shared/student";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError } from "@/lib/api-client";
import { examPath, isSessionError, studentApi, toApiError } from "./student-api";

export type ExamLoad =
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  /** offsetMs = giờ máy chủ - giờ máy học sinh lúc nhận đề; đồng hồ đếm theo giờ máy chủ. */
  | { status: "ready"; paper: ExamPaperView; offsetMs: number };

/** Lần làm đã kết thúc (hết giờ, đã nộp ở tab khác) hoặc phiên không còn: sang trang kết quả. */
const endsExam = (error: ApiError) => error.code === "ATTEMPT_ENDED" || isSessionError(error);

/** Tải đề của lần làm đang diễn ra; không có thì chuyển về phòng chờ hoặc trang kết quả. */
function useExamLoad(examCode: string) {
  const router = useRouter();
  const [load, setLoad] = useState<ExamLoad>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const state = await studentApi.state();
        if (state.phase === "completed") return router.replace(examPath(examCode, "ket-qua"));
        if (state.phase !== "in_progress" || !state.attempt)
          return router.replace(examPath(examCode, "phong-cho"));
        const paper = await studentApi.paper(state.attempt.id);
        if (!cancelled)
          setLoad({ status: "ready", paper, offsetMs: Date.parse(paper.serverNow) - Date.now() });
      } catch (cause) {
        if (!cancelled) setLoad({ status: "error", error: toApiError(cause) });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [examCode, router, reloadKey]);

  const reload = useCallback(() => {
    setLoad({ status: "loading" });
    setReloadKey((key) => key + 1);
  }, []);
  return { load, reload };
}

/** Đáp án: cập nhật ngay trên màn, lưu lên máy chủ theo thứ tự từng câu (lần chọn sau luôn thắng). */
function useAnswerSaving(paper: ExamPaperView | null, onEnded: () => void) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [unsaved, setUnsaved] = useState<string[]>([]);
  const queues = useRef(new Map<string, Promise<void>>());
  const attemptId = paper?.attemptId;

  // Đổi sang đề khác (tải lại) thì lấy đáp án đã lưu trên máy chủ làm gốc.
  const [loadedFor, setLoadedFor] = useState<string | undefined>(undefined);
  if (paper && loadedFor !== paper.attemptId) {
    setLoadedFor(paper.attemptId);
    setAnswers(paper.answers);
  }

  const persist = useCallback(
    (questionId: string, optionIds: string[]) => {
      if (!attemptId) return;
      const previous = queues.current.get(questionId) ?? Promise.resolve();
      const next = previous.then(async () => {
        try {
          await studentApi.saveAnswer(attemptId, { questionId, optionIds });
          setUnsaved((ids) => ids.filter((id) => id !== questionId));
        } catch (cause) {
          const error = toApiError(cause);
          if (endsExam(error)) return onEnded();
          setUnsaved((ids) => (ids.includes(questionId) ? ids : [...ids, questionId]));
        }
      });
      queues.current.set(questionId, next);
    },
    [attemptId, onEnded],
  );

  const select = (questionId: string, optionIds: string[]) => {
    setAnswers((current) => ({ ...current, [questionId]: optionIds }));
    persist(questionId, optionIds);
  };
  const retryUnsaved = () => {
    for (const questionId of unsaved) persist(questionId, answers[questionId] ?? []);
  };
  const flush = () => Promise.all(queues.current.values());
  return { answers, unsaved, select, retryUnsaved, flush };
}

export function useExamAttempt(examCode: string) {
  const router = useRouter();
  const { load, reload } = useExamLoad(examCode);
  const paper = load.status === "ready" ? load.paper : null;
  const goToResult = useCallback(
    () => router.replace(examPath(examCode, "ket-qua")),
    [router, examCode],
  );
  const saving = useAnswerSaving(paper, goToResult);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submit = async () => {
    if (!paper) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await saving.flush();
      await studentApi.submit(paper.attemptId);
      goToResult();
    } catch (cause) {
      const error = toApiError(cause);
      if (endsExam(error)) return goToResult();
      setSubmitError(error.message);
      setSubmitting(false);
    }
  };

  return { load, reload, ...saving, submit, submitting, submitError };
}

const secondsLeft = (endsAtMs: number, offsetMs: number) =>
  Math.max(0, Math.ceil((endsAtMs - (Date.now() + offsetMs)) / 1000));

/** Đếm lùi theo giờ máy chủ: client chỉ bù lệch đồng hồ (offsetMs), không tự quyết hạn chót. */
export function useCountdown(endsAt: string, offsetMs: number, onExpire: () => void): number {
  const endsAtMs = Date.parse(endsAt);
  const [remaining, setRemaining] = useState(() => secondsLeft(endsAtMs, offsetMs));
  const expireRef = useRef(onExpire);
  useEffect(() => {
    expireRef.current = onExpire;
  });
  useEffect(() => {
    let fired = false;
    const tick = () => {
      const next = secondsLeft(endsAtMs, offsetMs);
      setRemaining(next);
      if (next === 0 && !fired) {
        fired = true;
        expireRef.current();
      }
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endsAtMs, offsetMs]);
  return remaining;
}

/** Phím 1 đến 4 hoặc A đến D chọn đáp án, mũi tên trái/phải chuyển câu (design-spec §5.2). */
export function useExamKeys(
  enabled: boolean,
  onChoose: (position: number) => void,
  onStep: (delta: number) => void,
) {
  useEffect(() => {
    if (!enabled) return;
    const handle = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.key === "ArrowLeft") return onStep(-1);
      if (event.key === "ArrowRight") return onStep(1);
      const position =
        "1234".indexOf(event.key) >= 0
          ? "1234".indexOf(event.key)
          : "abcd".indexOf(event.key.toLowerCase());
      if (event.key.length === 1 && position >= 0) onChoose(position);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [enabled, onChoose, onStep]);
}
