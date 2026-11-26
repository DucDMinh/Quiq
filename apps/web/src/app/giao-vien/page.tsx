import { redirect } from "next/navigation";
import { STAFF_AREAS } from "@/features/shell/nav-config";

export default function TeacherHomePage() {
  redirect(STAFF_AREAS.teacher!.homePath);
}
