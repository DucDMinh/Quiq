"use client";

import type { ApiResponse } from "@quiq/shared/common";
import { useEffect, useState } from "react";

type HealthState = "checking" | "alive" | "down";

const HEALTH_LABEL: Record<HealthState, string> = {
  checking: "Đang kiểm tra API...",
  alive: "API sống",
  down: "API không phản hồi",
};

export default function HomePage() {
  const [health, setHealth] = useState<HealthState>("checking");

  useEffect(() => {
    // Gọi qua rewrite same-origin /api/* của Next, không gọi thẳng cổng 4000.
    fetch("/api/health")
      .then((res) => res.json() as Promise<ApiResponse<{ status: string }>>)
      .then((body) => setHealth(body.success && body.data.status === "ok" ? "alive" : "down"))
      .catch(() => setHealth("down"));
  }, []);

  return (
    <main>
      <h1>Quiq</h1>
      <p data-testid="api-health">{HEALTH_LABEL[health]}</p>
      <p>
        <a href="/tra-cuu">Tra cứu điểm</a>
      </p>
    </main>
  );
}
