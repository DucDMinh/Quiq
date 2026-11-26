"use client";

import { useSyncExternalStore } from "react";
import { ControlPanel } from "@/features/class-control/control-panel";

// `?bai=` không đổi khi đang ở trang: không cần đăng ký lắng nghe.
const subscribeNothing = () => () => {};
const readExamIdParam = () => new URLSearchParams(window.location.search).get("bai");
const serverExamIdParam = () => undefined;

export default function ExamRoomPage() {
  // Đọc query ở client (không dùng useSearchParams để trang không cần Suspense lúc build).
  const initialExamId = useSyncExternalStore(subscribeNothing, readExamIdParam, serverExamIdParam);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink">Phòng thi</h1>
        <p className="text-ink-secondary">Phát đề, theo dõi và thu bài theo từng lớp.</p>
      </header>
      {initialExamId === undefined ? null : <ControlPanel initialExamId={initialExamId} />}
    </div>
  );
}
