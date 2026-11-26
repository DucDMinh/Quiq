import { attempts, enrollments, students, waitingPresence, type DatabaseLike } from "@quiq/db";
import { officialScore } from "@quiq/engine";
import type { RosterStatus, RosterStudent, RosterView } from "@quiq/shared/exams";
import { WAITING_PRESENCE_FRESH_SECONDS } from "@quiq/shared/student";
import { and, asc, eq } from "drizzle-orm";
import type { AppDeps } from "../../http/deps";
import { finalizeAttempt, isPastGrace } from "../attempts/finalize";
import type { TeacherScope } from "../exams/service";
import { loadOwnedExamClass, toClassState, type ExamClassRef, type OwnedExamClass } from "./service";

interface StudentActivity {
  statuses: string[];
  submittedScores: number[];
  lastSeenAt: Date | null;
}

/** Cùng thứ tự ưu tiên với pha phòng chờ của học sinh: đang làm, đã nộp, đang chờ, chưa làm. */
export function deriveRosterStatus(
  activity: StudentActivity,
  classStatus: OwnedExamClass["status"],
  now: Date,
): RosterStatus {
  if (activity.statuses.includes("in_progress")) return "in_progress";
  if (activity.statuses.includes("submitted")) return "submitted";
  // Lớp đã thu bài thì không còn ai "đang chờ" nữa, dù dấu hiện diện chưa kịp cũ.
  const fresh =
    activity.lastSeenAt !== null &&
    now.getTime() - activity.lastSeenAt.getTime() <= WAITING_PRESENCE_FRESH_SECONDS * 1000;
  return fresh && classStatus !== "closed" ? "waiting" : "not_started";
}

async function loadClassActivity(db: DatabaseLike, examClassId: string) {
  const attemptRows = await db
    .select({ studentId: attempts.studentId, status: attempts.status, score: attempts.score })
    .from(attempts)
    .where(eq(attempts.examClassId, examClassId));
  const presenceRows = await db
    .select({ studentId: waitingPresence.studentId, lastSeenAt: waitingPresence.lastSeenAt })
    .from(waitingPresence)
    .where(eq(waitingPresence.examClassId, examClassId));

  const activity = new Map<string, StudentActivity>();
  const entry = (studentId: string) => {
    const existing = activity.get(studentId);
    if (existing) return existing;
    const created: StudentActivity = { statuses: [], submittedScores: [], lastSeenAt: null };
    activity.set(studentId, created);
    return created;
  };
  for (const row of attemptRows) {
    const item = entry(row.studentId);
    item.statuses.push(row.status);
    if (row.status === "submitted" && row.score !== null) item.submittedScores.push(row.score);
  }
  for (const row of presenceRows) entry(row.studentId).lastSeenAt = row.lastSeenAt;
  return activity;
}

/**
 * G-12: hết giờ kiểm lười theo LỚP (sweeper nền là tính năng sau). Bài đang làm đã quá `ends_at + 3 giây`
 * được nộp với lý do `timeout` trước khi tính trạng thái, để bảng không còn "Đang làm" với bài đã hết giờ.
 */
async function expireDueClassAttempts(deps: AppDeps, examClassId: string): Promise<void> {
  const running = await deps.db
    .select()
    .from(attempts)
    .where(and(eq(attempts.examClassId, examClassId), eq(attempts.status, "in_progress")));
  const now = deps.clock.now();
  for (const attempt of running) {
    if (isPastGrace(attempt, now)) await finalizeAttempt(deps, attempt.id, "timeout");
  }
}

/** Bảng trạng thái lớp (FR-035; SSE + polling dự phòng): chỉ học sinh ghi danh vào CHÍNH lớp này, mã chưa vô hiệu. */
export async function getRoster(
  deps: AppDeps,
  scope: TeacherScope,
  ref: ExamClassRef,
): Promise<RosterView> {
  // Kiểm quyền TRƯỚC mọi thay đổi dữ liệu.
  const examClass = await loadOwnedExamClass(deps.db, scope, ref);
  await expireDueClassAttempts(deps, examClass.id);
  const studentRows = await deps.db
    .select({ studentId: students.id, code: students.code, fullName: students.fullName })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .where(
      and(
        eq(enrollments.classId, examClass.classId),
        eq(enrollments.schoolId, scope.schoolId),
        eq(students.codeVoided, false),
      ),
    )
    .orderBy(asc(students.code));
  const activity = await loadClassActivity(deps.db, examClass.id);
  const now = deps.clock.now();

  const counts: RosterView["counts"] = { not_started: 0, waiting: 0, in_progress: 0, submitted: 0 };
  const rosterStudents: RosterStudent[] = studentRows.map((student) => {
    const item = activity.get(student.studentId) ?? {
      statuses: [],
      submittedScores: [],
      lastSeenAt: null,
    };
    const status = deriveRosterStatus(item, examClass.status, now);
    counts[status] += 1;
    return {
      ...student,
      status,
      attemptsUsed: item.statuses.filter((s) => s !== "waiting").length,
      bestScore: officialScore(item.submittedScores),
      // Layer 7 mới sinh trạng thái `interrupted`; tới đó cờ luôn false.
      interrupted: item.statuses.includes("interrupted"),
    };
  });

  return {
    examClass: toClassState(examClass),
    students: rosterStudents,
    counts,
    serverNow: now.toISOString(),
  };
}
