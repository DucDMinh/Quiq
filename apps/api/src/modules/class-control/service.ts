import {
  attempts,
  classes,
  enrollments,
  examClasses,
  exams,
  schools,
  studentSessions,
  students,
  waitingPresence,
  type DatabaseLike,
} from "@quiq/db";
import { officialScore } from "@quiq/engine";
import type {
  CloseClassResult,
  ExamClassState,
  RosterStatus,
  RosterStudent,
  RosterView,
} from "@quiq/shared/exams";
import { WAITING_PRESENCE_FRESH_SECONDS } from "@quiq/shared/student";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";
import { finalizeAttempt } from "../attempts/finalize";
import { examError, type TeacherScope } from "../exams/service";

export interface ExamClassRef {
  examId: string;
  classId: string;
}

/** Lớp của một bài thi do CHÍNH giáo viên này ra, trong trường của phiên; khác đi thì 404. */
async function loadOwnedExamClass(db: DatabaseLike, scope: TeacherScope, ref: ExamClassRef) {
  const [row] = await db
    .select({
      id: examClasses.id,
      examId: examClasses.examId,
      classId: examClasses.classId,
      className: classes.name,
      status: examClasses.status,
      dispatchedAt: examClasses.dispatchedAt,
      closedAt: examClasses.closedAt,
      maxAttempts: examClasses.maxAttemptsSnap,
      warnLimit: examClasses.warnLimitSnap,
      interruptSecs: examClasses.interruptSecsSnap,
    })
    .from(examClasses)
    .innerJoin(exams, eq(exams.id, examClasses.examId))
    .innerJoin(classes, eq(classes.id, examClasses.classId))
    .where(
      and(
        eq(examClasses.examId, ref.examId),
        eq(examClasses.classId, ref.classId),
        eq(examClasses.schoolId, scope.schoolId),
        eq(exams.schoolId, scope.schoolId),
        eq(exams.teacherId, scope.teacherId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

type OwnedExamClass = Awaited<ReturnType<typeof loadOwnedExamClass>>;

function toClassState(row: OwnedExamClass): ExamClassState {
  return {
    examId: row.examId,
    classId: row.classId,
    className: row.className,
    status: row.status,
    dispatchedAt: row.dispatchedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    maxAttempts: row.maxAttempts,
    warnLimit: row.warnLimit,
    interruptSecs: row.interruptSecs,
  };
}

function rejectByStatus(status: OwnedExamClass["status"]): AppError {
  if (status === "dispatched") return examError("CLASS_ALREADY_DISPATCHED");
  if (status === "closed") return examError("CLASS_ALREADY_CLOSED");
  return examError("CLASS_NOT_DISPATCHED");
}

/**
 * Phát đề (FR-033, BR-006): chụp thiết lập hiện tại của trường vào lớp (C-04, C-06). Đổi thiết lập trường sau đó
 * không ảnh hưởng lớp đã phát. Cập nhật có điều kiện `status = 'draft'` nên hai lần bấm cùng lúc chỉ một lần thắng.
 */
export async function dispatchClass(
  deps: AppDeps,
  scope: TeacherScope,
  ref: ExamClassRef,
): Promise<ExamClassState> {
  const examClass = await loadOwnedExamClass(deps.db, scope, ref);
  if (examClass.status !== "draft") throw rejectByStatus(examClass.status);

  const [school] = await deps.db
    .select({
      maxAttempts: schools.maxAttempts,
      warnLimit: schools.warnLimit,
      interruptSecs: schools.interruptSecs,
    })
    .from(schools)
    .where(eq(schools.id, scope.schoolId));
  if (!school) throw new AppError("NOT_FOUND");

  const updated = await deps.db
    .update(examClasses)
    .set({
      status: "dispatched",
      dispatchedAt: deps.clock.now(),
      maxAttemptsSnap: school.maxAttempts,
      warnLimitSnap: school.warnLimit,
      interruptSecsSnap: school.interruptSecs,
    })
    .where(and(eq(examClasses.id, examClass.id), eq(examClasses.status, "draft")))
    .returning({ id: examClasses.id });
  if (updated.length === 0) throw examError("CLASS_ALREADY_DISPATCHED");
  return toClassState(await loadOwnedExamClass(deps.db, scope, ref));
}

async function finalizeRunningAttempts(deps: AppDeps, examClassId: string): Promise<number> {
  const running = await deps.db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.examClassId, examClassId), eq(attempts.status, "in_progress")));
  // Mỗi lần nộp là một transaction riêng của finalizeAttempt; không bọc trong transaction ngoài.
  for (const attempt of running) await finalizeAttempt(deps, attempt.id, "closed");
  return running.length;
}

/**
 * Đóng lớp (có điều kiện `status = 'dispatched'`). UPDATE này tranh cùng khóa hàng với transaction Bắt đầu
 * (`attempts/start.ts` khóa FOR UPDATE), nên sau khi nó commit không còn lần Bắt đầu nào tạo attempt được.
 * Trả closed_at đã lưu (kể cả khi một lần thu bài khác vừa đóng trước).
 */
async function markClosed(deps: AppDeps, examClassId: string): Promise<Date> {
  const [closed] = await deps.db
    .update(examClasses)
    .set({ status: "closed", closedAt: deps.clock.now() })
    .where(and(eq(examClasses.id, examClassId), eq(examClasses.status, "dispatched")))
    .returning({ closedAt: examClasses.closedAt });
  if (closed?.closedAt) return closed.closedAt;
  const [current] = await deps.db
    .select({ closedAt: examClasses.closedAt })
    .from(examClasses)
    .where(and(eq(examClasses.id, examClassId), eq(examClasses.status, "closed")));
  if (!current?.closedAt) throw new AppError("CONFLICT");
  return current.closedAt;
}

/**
 * Thu bài (FR-034, BR-006, G-06), ba bước tách rời (finalizeAttempt tự mở transaction riêng):
 * 1. Đóng lớp: từ đây không ai Bắt đầu được nữa.
 * 2. Thu hồi MỌI phiên còn hiệu lực của lớp (kể cả học sinh ở phòng chờ), revoked_at = closed_at.
 * 3. Nộp + chấm ngay mọi lần làm đang diễn ra qua `finalizeAttempt(..., "closed")`.
 * IDEMPOTENT: gọi lại với lớp đã `closed` chạy lại bước 2 và 3 rồi trả 200, để lần thu bài lỗi giữa chừng
 * luôn hoàn tất được (finalizeAttempt bỏ qua bài đã nộp, thu hồi chỉ đụng phiên còn hiệu lực).
 */
export async function closeClass(
  deps: AppDeps,
  scope: TeacherScope,
  ref: ExamClassRef,
): Promise<CloseClassResult> {
  const examClass = await loadOwnedExamClass(deps.db, scope, ref);
  if (examClass.status === "draft") throw examError("CLASS_NOT_DISPATCHED");

  const closedAt =
    examClass.status === "closed" && examClass.closedAt
      ? examClass.closedAt
      : await markClosed(deps, examClass.id);
  await deps.db
    .update(studentSessions)
    .set({ revokedAt: closedAt })
    .where(and(eq(studentSessions.examClassId, examClass.id), isNull(studentSessions.revokedAt)));
  const finalizedAttempts = await finalizeRunningAttempts(deps, examClass.id);

  return {
    examClass: toClassState(await loadOwnedExamClass(deps.db, scope, ref)),
    finalizedAttempts,
  };
}

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

/** Bảng trạng thái lớp (FR-035, polling 3 giây): chỉ học sinh ghi danh vào CHÍNH lớp này, mã chưa vô hiệu. */
export async function getRoster(
  deps: AppDeps,
  scope: TeacherScope,
  ref: ExamClassRef,
): Promise<RosterView> {
  const examClass = await loadOwnedExamClass(deps.db, scope, ref);
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
    };
  });

  return {
    examClass: toClassState(examClass),
    students: rosterStudents,
    counts,
    serverNow: now.toISOString(),
  };
}
