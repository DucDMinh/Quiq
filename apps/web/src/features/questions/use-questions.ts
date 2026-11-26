"use client";

import type { Difficulty, Question, QuestionInput, QuestionListResult } from "@quiq/shared/questions";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

const QUESTIONS_PATH = "/teacher/questions";

export const createQuestion = (input: QuestionInput) => api.post<Question>(QUESTIONS_PATH, input);
export const updateQuestion = (id: string, input: QuestionInput) =>
  api.put<Question>(`${QUESTIONS_PATH}/${id}`, input);
export const deleteQuestion = (id: string) => api.delete<{ id: string }>(`${QUESTIONS_PATH}/${id}`);

// Kiểm theo tên vì DOMException của jsdom/Node/trình duyệt là các lớp khác nhau.
const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";

/**
 * Danh sách ngân hàng theo bộ lọc mức + trang. Đổi lọc/trang bật `loading` (danh sách hiện skeleton);
 * `reload` sau khi lưu/xóa tải lại ngầm, giữ danh sách cũ để các nút đang mở dialog không bị gỡ khỏi DOM.
 * State chỉ đổi trong handler/callback, không setState đồng bộ trong effect.
 */
export function useQuestionList() {
  const [difficulty, setDifficulty] = useState<Difficulty | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<QuestionListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<QuestionListResult>(QUESTIONS_PATH, { query: { difficulty, page }, signal: controller.signal })
      .then((result) => {
        setData(result);
        setError(null);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(cause instanceof Error ? cause.message : "Đã có lỗi xảy ra, vui lòng thử lại sau.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [difficulty, page, reloadKey]);

  const startLoading = () => {
    setLoading(true);
    setError(null);
  };

  const changeDifficulty = useCallback((next: Difficulty | undefined) => {
    startLoading();
    setDifficulty(next);
    setPage(1);
  }, []);

  const goToPage = useCallback((next: number) => {
    startLoading();
    setPage(next);
  }, []);

  const reload = useCallback(() => {
    setError(null);
    setReloadKey((key) => key + 1);
  }, []);

  /** Sau khi xóa: xóa câu cuối cùng của một trang thì lùi về trang trước. */
  const reloadAfterDelete = useCallback(() => {
    if (page > 1 && data?.items.length === 1) goToPage(page - 1);
    else reload();
  }, [data, page, goToPage, reload]);

  return { difficulty, page, data, loading, error, changeDifficulty, goToPage, reload, reloadAfterDelete };
}
