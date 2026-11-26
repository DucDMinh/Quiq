import { attempts, examClasses, exams, type DatabaseLike, type ExamClassStatus } from "@quiq/db";
import {
  canStartAttempt,
  computeEndsAt,
  shuffleAttempt,
  type ClassStatus,
  type StartDeniedReason,
} from "@quiq/engine";
import type { PaperQuestion, StudentErrorCode } from "@quiq/shared/student";
import { and, eq } from "drizzle-orm";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";
import { isUniqueViolation, studentError } from "../student/errors";
import type { StudentSession } from "../student/student-session";
import type { AttemptRow } from "./finalize";

const DENIED_ERROR: Record<StartDeniedReason, StudentErrorCode> = {
  not_dispatched: "EXAM_NOT_DISPATCHED",
  closed: "EXAM_CLOSED",
  already_completed: "ATTEMPT_ALREADY_COMPLETED",
  in_progress_elsewhere: "ATTEMPT_IN_PROGRESS",
  max_attempts: "ATTEMPT_LIMIT_REACHED",
};

// DB gọi lớp chưa phát đề là "draft", engine gọi là "assigned".
export function toEngineClassStatus(status: ExamClassStatus): ClassStatus {
  return status === "draft" ? "assigned" : status;
}

export interface StartCounts {
  used: number;
  hasCompleted: boolean;
  /** Đang có attempt in_progress ở BẤT KỲ lớp nào (BR-004: một mã chỉ thi một bài tại một thời điểm). */
  hasInProgress: boolean;
}

/** Đếm lượt của học sinh trong lớp thi này + kiểm lần làm đang diễn ra ở mọi lớp. */
export async function loadStartCounts(
  db: DatabaseLike,
  studentId: string,
  examClassId: string,
): Promise<StartCounts> {
  const rows = await db
    .select({ examClassId: attempts.examClassId, status: attempts.status })
    .from(attempts)
    .where(eq(attempts.studentId, studentId));
  let used = 0;
  let hasCompleted = false;
  let hasInProgress = false;
  for (const row of rows) {
    if (row.status === "in_progress") hasInProgress = true;
    if (row.examClassId !== examClassId) continue;
    if (row.status !== "waiting") used += 1;
    if (row.status === "submitted") hasCompleted = true;
  }
  return { used, hasCompleted, hasInProgress };
}

// Nhận tx: mọi truy vấn trong transaction phải đi qua tx (PGlite chỉ có một kết nối, gọi db ngoài sẽ treo).
type LoadQuestions = (tx: DatabaseLike, examId: string) => Promise<PaperQuestion[]>;

async function insertAttempt(deps: AppDeps, session: StudentSession, loadQuestions: LoadQuestions) {
  return deps.db.transaction(async (tx) => {
    // Khóa hàng lớp (FOR UPDATE) tới hết transaction: Thu bài (UPDATE cùng hàng) phải chờ. Hoặc Bắt đầu commit
    // trước và lần quét của Thu bài thấy attempt mới, hoặc Thu bài commit trước và ở đây đọc lại được `closed`.
    // Không thể có attempt in_progress tạo ra sau khi lớp đã đóng. Xóa đề cũng khóa cùng hàng này.
    const [examClass] = await tx
      .select({
        status: examClasses.status,
        maxAttempts: examClasses.maxAttemptsSnap,
        examId: exams.id,
        minutes: exams.durationMinutes,
      })
      .from(examClasses)
      .innerJoin(exams, eq(exams.id, examClasses.examId))
      .where(
        and(eq(examClasses.id, session.examClassId), eq(examClasses.schoolId, session.schoolId)),
      )
      .for("update", { of: examClasses });
    if (!examClass) throw new AppError("NOT_FOUND");

    const counts = await loadStartCounts(tx, session.studentId, session.examClassId);
    const classStatus = toEngineClassStatus(examClass.status);
    // Lớp chưa phát đề chưa có snapshot (maxAttempts null): engine báo not_dispatched trước khi xét lượt.
    const decision = canStartAttempt({
      classStatus,
      usedAttempts: counts.used,
      maxAttempts: examClass.maxAttempts ?? 0,
      hasCompleted: counts.hasCompleted,
      hasInProgress: counts.hasInProgress,
    });
    if (!decision.ok) throw studentError(DENIED_ERROR[decision.reason]);

    const now = deps.clock.now();
    const shuffle = shuffleAttempt(await loadQuestions(tx, examClass.examId));
    const [created] = await tx
      .insert(attempts)
      .values({
        schoolId: session.schoolId,
        examClassId: session.examClassId,
        studentId: session.studentId,
        attemptNo: counts.used + 1,
        status: "in_progress",
        startedAt: now,
        // Giờ máy chủ (FR-041): client chỉ đếm lùi tới mốc này.
        endsAt: computeEndsAt(now, examClass.minutes),
        questionOrder: shuffle.questionOrder,
        optionOrders: shuffle.optionOrders,
        createdAt: now,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL");
    return created;
  });
}

/**
 * Tạo attempt `in_progress`. Hai request Bắt đầu cùng lúc: DB (chỉ mục `attempts_one_in_progress_key`,
 * `attempts_exam_class_student_no_key`) từ chối hàng thứ hai, ta trả 409 thay vì 500.
 */
export async function startAttemptRow(
  deps: AppDeps,
  session: StudentSession,
  loadQuestions: LoadQuestions,
): Promise<AttemptRow> {
  try {
    return await insertAttempt(deps, session, loadQuestions);
  } catch (error) {
    if (isUniqueViolation(error)) throw studentError("ATTEMPT_IN_PROGRESS");
    throw error;
  }
}
