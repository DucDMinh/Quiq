import { normalizeExamCode } from "@quiq/shared/student";
import type { Metadata } from "next";
import { WaitingRoom } from "@/features/student/waiting-room";

export const metadata: Metadata = { title: "Phòng chờ" };

export default async function WaitingRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <WaitingRoom examCode={normalizeExamCode(code)} />;
}
