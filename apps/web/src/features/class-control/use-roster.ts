"use client";

import type { CloseClassResult, ExamClassState, RosterView } from "@quiq/shared/exams";
import { useCallback, useEffect, useState } from "react";
import { api, type ApiError } from "@/lib/api-client";
import { toApiError } from "@/features/exams/use-exams";

export interface ExamClassTarget {
  examId: string;
  classId: string;
}

const classPath = (t: ExamClassTarget, action: string) =>
  `/teacher/exams/${t.examId}/classes/${t.classId}/${action}`;

export const classControlApi = {
  dispatch: (t: ExamClassTarget) => api.post<ExamClassState>(classPath(t, "dispatch")),
  close: (t: ExamClassTarget) => api.post<CloseClassResult>(classPath(t, "close")),
  roster: (t: ExamClassTarget) => api.get<RosterView>(classPath(t, "roster")),
};

/** Chưa có SSE (tính năng sau): hỏi lại bảng trạng thái mỗi 3 giây. */
export const ROSTER_POLL_MS = 3000;

export interface RosterResult {
  roster: RosterView | null;
  error: ApiError | null;
  reload: () => void;
}

/** Bảng trạng thái lớp đang chọn; lỗi tạm thời giữ dữ liệu cũ để màn không nháy. */
export function useRoster(target: ExamClassTarget | null): RosterResult {
  // Kết quả gắn với lớp đã nạp nó: đổi lớp thì dữ liệu lớp cũ không còn hiển thị (không cần reset trong effect).
  const [loaded, setLoaded] = useState<{ key: string; roster: RosterView | null; error: ApiError | null }>({
    key: "",
    roster: null,
    error: null,
  });
  const [reloadKey, setReloadKey] = useState(0);
  const examId = target?.examId;
  const classId = target?.classId;
  const key = examId && classId ? `${examId}/${classId}` : "";

  useEffect(() => {
    if (!examId || !classId) return;
    const loadedKey = `${examId}/${classId}`;
    let cancelled = false;
    const load = async () => {
      try {
        const next = await classControlApi.roster({ examId, classId });
        if (!cancelled) setLoaded({ key: loadedKey, roster: next, error: null });
      } catch (cause) {
        if (!cancelled)
          setLoaded((prev) => ({
            key: loadedKey,
            roster: prev.key === loadedKey ? prev.roster : null,
            error: toApiError(cause),
          }));
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), ROSTER_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [examId, classId, reloadKey]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);
  const current = key !== "" && loaded.key === key;
  return { roster: current ? loaded.roster : null, error: current ? loaded.error : null, reload };
}
