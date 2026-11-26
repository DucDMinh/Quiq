"use client";

import { IconDeviceDesktop } from "@tabler/icons-react";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PortalContainerProvider } from "./portal-container";

const MIN_WIDTH_QUERY = "(min-width: 1024px)";

// Trang chỉ là bảng đọc nên vẫn dùng được trên màn hẹp (design-spec §1).
export const MIN_WIDTH_EXEMPT_PATHS: readonly string[] = ["/tra-cuu"];

function isExemptPath(pathname: string): boolean {
  return MIN_WIDTH_EXEMPT_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function subscribeToViewport(onChange: () => void): () => void {
  const media = window.matchMedia(MIN_WIDTH_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const getViewportWide = (): boolean => window.matchMedia(MIN_WIDTH_QUERY).matches;
// Máy chủ không biết kích thước cửa sổ: coi như đủ rộng, CSS (`max-lg`) lo phần màn hẹp.
const getServerViewportWide = (): boolean => true;

// false khi render trên máy chủ và lần render hydrate đầu; true ngay sau đó trên trình duyệt.
const subscribeNever = (): (() => void) => () => undefined;
const getHydrated = (): boolean => true;
const getServerHydrated = (): boolean => false;

function NarrowScreenNotice({ beforeHydration }: { beforeHydration: boolean }) {
  return (
    <div
      role="alert"
      // aria-live tường minh để hideOthers của Radix (khi có Dialog mở) không gắn aria-hidden lên thông báo.
      aria-live="assertive"
      // Trước hydrate chỉ CSS quyết định hiện hay không, để thông báo có sẵn trong HTML mà không nháy trên màn rộng.
      className={cn(
        "fixed inset-0 z-[200] flex-col items-center justify-center gap-4 bg-portal px-8 text-center",
        beforeHydration ? "hidden max-lg:flex" : "flex",
      )}
    >
      <IconDeviceDesktop size={48} className="text-brand" aria-hidden="true" />
      <h1 className="font-display text-2xl font-extrabold text-ink">Quiq chỉ hỗ trợ máy tính</h1>
      <p className="max-w-md text-base text-ink-secondary">
        Hãy mở bằng laptop hoặc máy bàn (màn hình rộng từ 1024px).
      </p>
    </div>
  );
}

/**
 * Dưới 1024px: phủ thông báo "chỉ hỗ trợ máy tính" và ẩn nội dung (design-spec §1).
 * Nội dung chỉ bị ẩn bằng `hidden`, KHÔNG unmount: đồng hồ thi, kết nối và đáp án trong bộ nhớ vẫn chạy.
 * Đường dẫn trong MIN_WIDTH_EXEMPT_PATHS không bị chặn.
 */
export function MinWidthGuard({ children }: { children: ReactNode }) {
  const isWide = useSyncExternalStore(subscribeToViewport, getViewportWide, getServerViewportWide);
  const hydrated = useSyncExternalStore(subscribeNever, getHydrated, getServerHydrated);
  const exempt = isExemptPath(usePathname() ?? "");
  // Chỗ portal của Dialog/Select nằm TRONG wrapper bị ẩn nên chúng cũng bị ẩn (không còn nhận focus dưới thông báo).
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  const blocked = hydrated && !isWide && !exempt;
  const showNotice = !exempt && (blocked || !hydrated);

  return (
    <>
      <div hidden={blocked} className={cn(!hydrated && !exempt && "max-lg:hidden")}>
        <PortalContainerProvider value={portalContainer}>{children}</PortalContainerProvider>
        <div ref={setPortalContainer} />
      </div>
      {showNotice ? <NarrowScreenNotice beforeHydration={!hydrated} /> : null}
    </>
  );
}
