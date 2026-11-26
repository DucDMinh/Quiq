import type { Metadata } from "next";
import { EnterForm } from "@/features/student/enter-form";
import { PortalFrame } from "@/features/student/portal-frame";

export const metadata: Metadata = { title: "Vào thi" };

export default function EnterPage() {
  return (
    <PortalFrame>
      <EnterForm />
    </PortalFrame>
  );
}
