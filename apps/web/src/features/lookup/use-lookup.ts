"use client";

import type { LookupBody, LookupScoreRow, LookupSchool, LookupYear } from "@quiq/shared/lookup";
import { useCallback, useEffect, useRef, useState } from "react";
import { lookupApi, retryAfterSeconds, toApiError } from "./lookup-api";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

/** Danh sách trường cho ô chọn; `reload` cho nút "Thử lại". */
export function useSchools() {
  const [state, setState] = useState<LoadState<LookupSchool[]>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    lookupApi
      .schools()
      .then((data) => {
        if (!ignore) setState({ status: "ready", data });
      })
      .catch((cause: unknown) => {
        if (!ignore) setState({ status: "error", message: toApiError(cause).message });
      });
    return () => {
      ignore = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);
  return { state, reload };
}

export type YearsStatus = "idle" | "loading" | "error" | "ready";

interface YearsOutcome {
  /** Trường + lần tải mà kết quả này trả lời; kết quả của trường cũ trả về muộn không bao giờ khớp. */
  key: string;
  years: LookupYear[] | null;
}

const defaultYearId = (years: readonly LookupYear[]) =>
  years.find((year) => year.isCurrent)?.id ?? years[0]?.id ?? null;

/**
 * Năm học của trường đang chọn; đổi trường thì chọn sẵn năm hiện tại.
 * Lỗi tải là trạng thái riêng (`error` + `reload`), không giả làm "trường chưa có năm học".
 */
export function useYears(schoolId: string | null) {
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<YearsOutcome | null>(null);
  const [chosen, setChosen] = useState<{ schoolId: string; yearId: string } | null>(null);
  const key = schoolId ? `${schoolId}#${attempt}` : null;

  useEffect(() => {
    if (!schoolId || !key) return;
    let ignore = false;
    lookupApi
      .years(schoolId)
      .then((years) => !ignore && setOutcome({ key, years }))
      .catch(() => !ignore && setOutcome({ key, years: null }));
    return () => {
      ignore = true;
    };
  }, [schoolId, key]);

  const settled = key !== null && outcome?.key === key ? outcome : null;
  const years = settled?.years ?? [];
  const status: YearsStatus = !key ? "idle" : !settled ? "loading" : settled.years ? "ready" : "error";
  const yearId =
    chosen && chosen.schoolId === schoolId ? chosen.yearId : status === "ready" ? defaultYearId(years) : null;

  const setYearId = useCallback(
    (id: string) => schoolId && setChosen({ schoolId, yearId: id }),
    [schoolId],
  );
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { years, yearId, setYearId, status, reload };
}

export type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; items: LookupScoreRow[] }
  | { status: "error"; message: string }
  | { status: "throttled"; retryAfter: number | null };

/**
 * Gửi tra cứu; chỉ kết quả của lần gửi mới nhất được hiển thị. `retry` gửi lại đúng lần trước,
 * `reset` xóa bảng cũ (và bỏ qua lần đang chờ) khi người dùng đổi trường, mã hoặc năm học.
 */
export function useScoreLookup() {
  const [state, setState] = useState<LookupState>({ status: "idle" });
  const latest = useRef(0);
  const lastBody = useRef<LookupBody | null>(null);

  const run = useCallback(async (body: LookupBody) => {
    const requestNo = ++latest.current;
    lastBody.current = body;
    setState({ status: "loading" });
    try {
      const result = await lookupApi.lookup(body);
      if (requestNo === latest.current) setState({ status: "done", items: result.items });
    } catch (cause) {
      if (requestNo !== latest.current) return;
      const error = toApiError(cause);
      setState(
        error.status === 429
          ? { status: "throttled", retryAfter: retryAfterSeconds(error) }
          : { status: "error", message: error.message },
      );
    }
  }, []);

  const retry = useCallback(() => {
    if (lastBody.current) void run(lastBody.current);
  }, [run]);

  const reset = useCallback(() => {
    latest.current += 1;
    lastBody.current = null;
    setState({ status: "idle" });
  }, []);

  return { state, run, retry, reset };
}
