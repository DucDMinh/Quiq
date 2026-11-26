import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

// Portal shell (design-spec §4.2): nền phẳng, thẻ đăng nhập ở giữa. `next` là trang cần quay lại sau đăng nhập;
// LoginForm chỉ nhận nó khi là đường dẫn nội bộ thuộc khu vực của vai trò.
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-portal px-8 py-12">
      <p className="font-display text-3xl font-black tracking-tight text-brand-dark">Quiq</p>
      <Card className="w-full max-w-md p-8">
        <h1 className="font-display text-2xl font-extrabold text-ink">Đăng nhập cán bộ</h1>
        <p className="mt-1 mb-6 text-base text-ink-secondary">Dành cho admin và giáo viên của trường.</p>
        <LoginForm returnTo={typeof next === "string" ? next : undefined} />
      </Card>
    </main>
  );
}
