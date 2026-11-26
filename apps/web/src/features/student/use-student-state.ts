"use client";

import type { StudentStateView } from "@quiq/shared/student";
import { useCallback, useEffect, useState } from "react";
import type { ApiError } from "@/lib/api-client";
import { studentApi, toApiError } from "./student-api";

export const STATE_POLL_MS = 3000;

export interface StudentStateResult {
  state: StudentStateView | null;
  error: ApiError | null;
  /** Tải lại ngay (nút "Thử lại"). */
  reload: () => void;
}

/**
 * Trạng thái phòng chờ từ máy chủ, hỏi lại mỗi 3 giây khi `poll` bật (giáo viên phát đề thì nút
 * Bắt đầu tự bật, không cần tải lại trang). Lỗi giữ lại dữ liệu cũ để màn không nháy.
 */
export function useStudentState(poll: boolean): StudentStateResult {
  const [state, setState] = useState<StudentStateView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const next = await studentApi.state();
        if (cancelled) return;
        setState(next);
        setError(null);
      } catch (cause) {
        if (!cancelled) setError(toApiError(cause));
      }
    };
    void load();
    const timer = poll ? window.setInterval(() => void load(), STATE_POLL_MS) : undefined;
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [poll, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { state, error, reload };
}
