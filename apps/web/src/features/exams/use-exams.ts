"use client";

import type {
  AssignableClass,
  BankCounts,
  CreateExamBody,
  ExamDetailView,
  ExamListItem,
} from "@quiq/shared/exams";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, CLIENT_ERROR_CODES } from "@/lib/api-client";

export const examsApi = {
  list: () => api.get<ExamListItem[]>("/teacher/exams"),
  detail: (examId: string) => api.get<ExamDetailView>(`/teacher/exams/${examId}`),
  create: (body: CreateExamBody) => api.post<ExamListItem>("/teacher/exams", body),
  remove: (examId: string) => api.delete<{ id: string }>(`/teacher/exams/${examId}`),
  classes: () => api.get<AssignableClass[]>("/teacher/exams/classes"),
  bankCounts: () => api.get<BankCounts>("/teacher/exams/bank-counts"),
};

/** Mọi lỗi về một ApiError để hiển thị thông điệp tiếng Việt. */
export function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause;
  return new ApiError(
    0,
    CLIENT_ERROR_CODES.NETWORK,
    "Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.",
  );
}

export interface ExamsResult {
  exams: ExamListItem[] | null;
  error: ApiError | null;
  reload: () => void;
}

/** Danh sách bài thi của giáo viên; `reload` sau khi tạo/xóa. */
export function useExams(): ExamsResult {
  const [exams, setExams] = useState<ExamListItem[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    examsApi.list().then(
      (list) => {
        if (cancelled) return;
        setExams(list);
        setError(null);
      },
      (cause: unknown) => {
        if (!cancelled) setError(toApiError(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { exams, error, reload };
}

export interface CreateExamOptions {
  classes: AssignableClass[] | null;
  bankCounts: BankCounts | null;
  error: ApiError | null;
}

/** Lớp được gán và số câu theo mức, nạp mỗi lần mở dialog tạo bài thi (ngân hàng có thể vừa đổi). */
export function useCreateExamOptions(open: boolean): CreateExamOptions {
  const [options, setOptions] = useState<CreateExamOptions>({
    classes: null,
    bankCounts: null,
    error: null,
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.all([examsApi.classes(), examsApi.bankCounts()]).then(
      ([classes, bankCounts]) => {
        if (!cancelled) setOptions({ classes, bankCounts, error: null });
      },
      (cause: unknown) => {
        if (!cancelled) setOptions({ classes: null, bankCounts: null, error: toApiError(cause) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  return options;
}
