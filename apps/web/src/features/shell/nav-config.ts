import type { StaffRole } from "@quiq/shared/auth";
import { IconBooks, IconClipboardList, IconDoorEnter, type Icon } from "@tabler/icons-react";

export interface NavItem {
  label: string;
  href: string;
  icon: Icon;
}

export interface StaffArea {
  /** Tiền tố đường dẫn của khu vực, ví dụ "/giao-vien". */
  basePath: string;
  /** Trang mở sau khi đăng nhập. */
  homePath: string;
  roleLabel: string;
  nav: NavItem[];
}

/**
 * Khu vực và menu theo vai trò. Layer tính năng sau thêm mục menu tại đây (sửa tuần tự, không song song).
 * Vai trò chưa có giao diện thì không có khu vực: đăng nhập xong báo "Chưa có giao diện cho vai trò này".
 */
export const STAFF_AREAS: Partial<Record<StaffRole, StaffArea>> = {
  teacher: {
    basePath: "/giao-vien",
    homePath: "/giao-vien/ngan-hang",
    roleLabel: "Giáo viên",
    nav: [
      { label: "Ngân hàng câu hỏi", href: "/giao-vien/ngan-hang", icon: IconBooks },
      { label: "Bài thi", href: "/giao-vien/bai-thi", icon: IconClipboardList },
      { label: "Phòng thi", href: "/giao-vien/phong-thi", icon: IconDoorEnter },
    ],
  },
};

export const LOGIN_PATH = "/dang-nhap";

const isUnder = (path: string, basePath: string) => path === basePath || path.startsWith(`${basePath}/`);

/** Mục menu đang mở: khớp đúng đường dẫn hoặc trang con của nó. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return isUnder(pathname, item.href);
}

/**
 * Trang đích sau đăng nhập. `returnTo` chỉ được nhận khi là đường dẫn nội bộ nằm trong khu vực của vai trò
 * (chặn chuyển hướng ra ngoài như `//evil.com` hay `https://...`). Trả null khi vai trò chưa có giao diện.
 */
export function postLoginPath(role: StaffRole, returnTo?: string | null): string | null {
  const area = STAFF_AREAS[role];
  if (!area) return null;
  const isInternal = !!returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\");
  return isInternal && isUnder(returnTo.split(/[?#]/)[0]!, area.basePath) ? returnTo : area.homePath;
}

/** Trang đăng nhập kèm đường dẫn để quay lại sau khi đăng nhập. */
export function loginPathWithReturn(currentPath: string): string {
  return `${LOGIN_PATH}?next=${encodeURIComponent(currentPath)}`;
}
