"use client";

import type { StaffMe, StaffRole } from "@quiq/shared/auth";
import { IconFileSearch, IconLogout } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Alert, Button, buttonVariants, EmptyState, Skeleton, useToast } from "@/components/ui";
import { SessionExpiredDialog } from "@/features/auth/session-expired-dialog";
import { useStaffSession } from "@/features/auth/use-session";
import { cn } from "@/lib/cn";
import { isNavItemActive, LOGIN_PATH, STAFF_AREAS, type StaffArea } from "./nav-config";

function BrandLockup() {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex size-9.5 items-center justify-center rounded-md border-b-3 border-brand-border bg-surface font-display text-xl font-black text-brand"
      >
        Q
      </span>
      <span className="font-display text-[1.375rem] font-black tracking-tight text-on-brand">Quiq</span>
    </div>
  );
}

function UserBlock({ user, area, onLogout }: { user: StaffMe; area: StaffArea; onLogout: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const handleLogout = async () => {
    setPending(true);
    try {
      await onLogout();
    } catch {
      setPending(false);
      toast({ tone: "danger", title: "Chưa đăng xuất được", description: "Hãy kiểm tra kết nối rồi thử lại." });
    }
  };
  return (
    <div className="flex flex-col gap-3 border-t border-white/15 px-3 py-3.5">
      <div className="rounded-sm border border-white/15 bg-white/10 px-3.5 py-3">
        <p className="text-xs font-extrabold tracking-wide text-on-brand-label uppercase">{area.roleLabel}</p>
        <p className="mt-0.5 font-bold text-on-brand">{user.displayName}</p>
        {user.subject ? <p className="mt-0.5 text-sm text-on-brand-muted">Môn {user.subject.name}</p> : null}
        {user.schoolName ? <p className="text-sm text-on-brand-muted">{user.schoolName}</p> : null}
      </div>
      <Button variant="secondary" onClick={handleLogout} loading={pending} loadingLabel="Đang đăng xuất…">
        <IconLogout size={18} aria-hidden="true" />
        Đăng xuất
      </Button>
    </div>
  );
}

function Sidebar({ user, area, onLogout }: { user: StaffMe; area: StaffArea; onLogout: () => Promise<void> }) {
  const pathname = usePathname() ?? "";
  return (
    <aside className="sticky top-0 flex h-dvh flex-col bg-brand-dark text-on-brand">
      <div className="border-b border-white/15 px-4.5 pt-5 pb-4">
        <BrandLockup />
      </div>
      <nav aria-label="Menu chính" className="flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-3.5">
        {area.nav.map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2.5 rounded-sm px-3.5 text-control font-semibold transition-colors duration-150",
                active
                  ? "bg-surface font-extrabold text-brand-dark shadow-[0_3px_0_rgba(0,0,0,0.25)]"
                  : "text-on-brand-muted hover:bg-white/12 hover:text-on-brand",
              )}
            >
              <item.icon size={20} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <UserBlock user={user} area={area} onLogout={onLogout} />
    </aside>
  );
}

function ShellSkeleton() {
  return (
    <div className="grid min-h-dvh grid-cols-[var(--layout-sidebar-width)_minmax(0,1fr)]" aria-busy="true">
      <div className="bg-brand-dark" />
      <div className="flex flex-col gap-4 px-9 pt-7">
        <p className="sr-only" role="status">
          Đang tải…
        </p>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-96" />
        <Skeleton className="mt-4 h-64 w-full max-w-(--layout-content-max)" />
      </div>
    </div>
  );
}

function CenteredPanel({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center bg-portal px-8">{children}</main>;
}

/**
 * Khung ứng dụng cán bộ (design-spec §3): sidebar 276px + vùng nội dung. Kiêm route guard phía client:
 * chỉ render trang con khi phiên hợp lệ và đúng vai trò của khu vực.
 */
export function AppShell({ role, children }: { role: StaffRole; children: ReactNode }) {
  const { state, expired, retry, goToLogin, logout } = useStaffSession();
  const area = STAFF_AREAS[role];

  if (state.status === "loading") return <ShellSkeleton />;
  if (state.status === "locked" || state.status === "error") {
    const action =
      state.status === "locked" ? (
        <Link href={LOGIN_PATH} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Về trang đăng nhập
        </Link>
      ) : (
        <Button variant="secondary" size="sm" onClick={retry}>
          Thử lại
        </Button>
      );
    return (
      <CenteredPanel>
        <Alert tone="danger" className="max-w-xl" action={action}>
          {state.message}
        </Alert>
      </CenteredPanel>
    );
  }
  // Sai vai trò hiện như 404 chung (design-spec §6.5), không lộ khu vực của vai trò khác.
  if (!area || state.user.role !== role) {
    return (
      <CenteredPanel>
        <EmptyState
          icon={<IconFileSearch size={28} />}
          title="Không tìm thấy trang"
          description="Trang bạn tìm không tồn tại hoặc bạn không có quyền xem."
        />
      </CenteredPanel>
    );
  }

  return (
    <div className="grid min-h-dvh grid-cols-[var(--layout-sidebar-width)_minmax(0,1fr)] bg-canvas">
      <Sidebar user={state.user} area={area} onLogout={logout} />
      <main className="min-w-0 px-9 pt-7 pb-13">
        <div className="max-w-(--layout-content-max)">{children}</div>
      </main>
      <SessionExpiredDialog open={expired} onConfirm={goToLogin} />
    </div>
  );
}
