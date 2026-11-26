import type { NextConfig } from "next";

// Trình duyệt chỉ gọi same-origin /api/*; Next chuyển tiếp sang Koa để cookie HttpOnly dùng được.
const apiOrigin = process.env.API_ORIGIN ?? `http://localhost:${process.env.API_PORT ?? "4000"}`;

const nextConfig: NextConfig = {
  // Next 16.4 tự sinh apps/web/AGENTS.md khi chạy dev; repo đã có AGENTS.md gốc nên tắt.
  agentRules: false,
  // @quiq/shared xuất thẳng file TypeScript nên Next phải tự biên dịch nó.
  transpilePackages: ["@quiq/shared"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` }];
  },
};

export default nextConfig;
