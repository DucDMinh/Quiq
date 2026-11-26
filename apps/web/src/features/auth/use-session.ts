"use client";

import type { StaffMe } from "@quiq/shared/auth";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, UNAUTHENTICATED_EVENT } from "@/lib/api-client";
import { LOGIN_PATH, loginPathWithReturn } from "@/features/shell/nav-config";

export type StaffSessionState =
  | { status: "loading" }
  | { status: "authenticated"; user: StaffMe }
  | { status: "locked"; message: string }
  | { status: "error"; message: string };

// Kiểm theo tên vì DOMException của jsdom/Node/trình duyệt là các lớp khác nhau.
const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";

/**
 * Route guard phía client cho khu vực cán bộ: hỏi `/api/auth/me` khi vào trang.
 * - Chưa đăng nhập (401 lúc vào): chuyển thẳng sang trang đăng nhập, kèm trang hiện tại để quay lại.
 * - Hết phiên giữa chừng (API khác trả 401 phát sự kiện `quiq:unauthenticated`): bật `expired` để hiện dialog.
 */
export function useStaffSession() {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [state, setState] = useState<StaffSessionState>({ status: "loading" });
  const [expired, setExpired] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      // 401 ở đây là "chưa đăng nhập", không phải hết phiên giữa chừng: tự xử lý, không phát sự kiện.
      .get<StaffMe>("/auth/me", { signal: controller.signal, skipUnauthenticatedEvent: true })
      .then((user) => setState({ status: "authenticated", user }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace(loginPathWithReturn(pathname));
          return;
        }
        const message = error instanceof Error ? error.message : "Đã có lỗi xảy ra, vui lòng thử lại sau.";
        const locked = error instanceof ApiError && error.code === "SCHOOL_LOCKED";
        setState(locked ? { status: "locked", message } : { status: "error", message });
      });
    return () => controller.abort();
  }, [router, pathname, reloadKey]);

  useEffect(() => {
    const onUnauthenticated = () => setExpired(true);
    window.addEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, onUnauthenticated);
  }, []);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setReloadKey((key) => key + 1);
  }, []);

  const goToLogin = useCallback(() => router.replace(loginPathWithReturn(pathname)), [router, pathname]);

  /** Thu hồi phiên ở máy chủ rồi về trang đăng nhập; lỗi mạng thì ném để giao diện báo. */
  const logout = useCallback(async () => {
    await api.post("/auth/logout", undefined, { skipUnauthenticatedEvent: true });
    router.replace(LOGIN_PATH);
  }, [router]);

  return { state, expired, retry, goToLogin, logout };
}
