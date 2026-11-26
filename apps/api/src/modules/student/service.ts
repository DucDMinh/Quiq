import {
  attempts,
  classes,
  enrollments,
  examClasses,
  examQuestions,
  exams,
  schools,
  students,
  subjects,
  waitingPresence,
  type DatabaseLike,
} from "@quiq/db";
import type { ClosedReason, StudentPhase, StudentStateView } from "@quiq/shared/student";
import { and, desc, eq, sql } from "drizzle-orm";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";
import { expireDueAttempts } from "../attempts/finalize";
import { isUniqueViolation, studentError } from "./errors";
import { isOwnActiveSession, issueStudentSession, type StudentSession } from "./student-session";

export interface EnterResult {
  token: string;
  examCode: string;
}

async function findExam(db: DatabaseLike, examCode: string) {
  // Mã đã chuẩn hóa chữ hoa; so bằng upper() để mã lưu khác hoa thường vẫn khớp. Trùng >1 coi như không thấy.
  const rows = await db
    .select({
      id: exams.id,
      code: exams.code,
      schoolId: exams.schoolId,
      schoolStatus: schools.status,
    })
    .from(exams)
    .innerJoin(schools, eq(schools.id, exams.schoolId))
    .where(sql`upper(${exams.code}) = ${examCode}`)
    .limit(2);
  if (rows.length !== 1 || !rows[0]) throw studentError("EXAM_NOT_FOUND");
  return rows[0];
}

/** Học sinh thuộc trường của bài thi, mã chưa vô hiệu, và được ghi danh vào một lớp được gán bài này. */
async function findEligibleStudent(
  db: DatabaseLike,
  schoolId: string,
  examId: string,
  studentCode: string,
) {
  const candidates = await db
    .select({ id: students.id })
    .from(students)
    .where(
      and(
        eq(students.schoolId, schoolId),
        sql`upper(${students.code}) = ${studentCode}`,
        eq(students.codeVoided, false),
      ),
    )
    .limit(2);
  const student = candidates.length === 1 ? candidates[0] : undefined;
  if (!student) throw studentError("STUDENT_NOT_ALLOWED");

  const [examClass] = await db
    .select({ id: examClasses.id, status: examClasses.status })
    .from(examClasses)
    .innerJoin(enrollments, eq(enrollments.classId, examClasses.classId))
    .where(and(eq(examClasses.examId, examId), eq(enrollments.studentId, student.id)))
    .orderBy(desc(examClasses.createdAt))
    .limit(1);
  if (!examClass) throw studentError("STUDENT_NOT_ALLOWED");
  return { studentId: student.id, examClassId: examClass.id, classClosed: examClass.status === "closed" };
}

async function hasAttemptWithStatus(
  db: DatabaseLike,
  studentId: string,
  status: "in_progress" | "submitted",
  examClassId?: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(
      and(
        eq(attempts.studentId, studentId),
        eq(attempts.status, status),
        examClassId ? eq(attempts.examClassId, examClassId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Vào thi (FR-040): kiểm bài thi, trường không bị khóa, mã học sinh thuộc đúng trường và lớp được gán.
 * - Cookie hiện có là phiên hiệu lực của chính học sinh ở lớp này: giữ nguyên phiên (làm tiếp, C-13).
 * - Không có cookie đó mà học sinh đang làm bài (ở bất kỳ lớp nào): từ chối 409, không thu hồi, không cấp
 *   phiên. Nếu không, ai biết mã bài thi và mã học sinh là chiếm được bài đang làm (đổi máy là tính năng sau).
 * - Đã nộp bài lớp này, hoặc lớp đã thu bài: cấp phiên chỉ-xem (thấy kết quả / trạng thái đã thu bài).
 */
export async function enterExam(
  deps: AppDeps,
  input: { examCode: string; studentCode: string; currentToken: string | undefined },
): Promise<EnterResult> {
  const exam = await findExam(deps.db, input.examCode);
  if (exam.schoolStatus === "locked") throw studentError("SCHOOL_LOCKED");
  const { studentId, examClassId, classClosed } = await findEligibleStudent(
    deps.db,
    exam.schoolId,
    exam.id,
    input.studentCode,
  );
  if (
    input.currentToken &&
    (await isOwnActiveSession(deps.db, input.currentToken, studentId, examClassId))
  ) {
    return { token: input.currentToken, examCode: exam.code };
  }

  // Bài đã quá hạn thì tự nộp trước, để học sinh vào lại sau hết giờ thấy được kết quả.
  await expireDueAttempts(deps, studentId);

  const now = deps.clock.now();
  try {
    const token = await deps.db.transaction(async (tx) => {
      // Kiểm trong cùng transaction với lúc cấp phiên để thu hẹp cửa sổ tranh chấp với một lần Bắt đầu.
      if (await hasAttemptWithStatus(tx, studentId, "in_progress")) {
        throw studentError("ATTEMPT_IN_PROGRESS");
      }
      const finished = await hasAttemptWithStatus(tx, studentId, "submitted", examClassId);
      return issueStudentSession(tx, {
        schoolId: exam.schoolId,
        studentId,
        examClassId,
        now,
        // Lớp đã thu bài: chỉ được xem trạng thái, không bao giờ cấp phiên làm bài (giữ mã học sinh).
        readOnly: finished || classClosed,
      });
    });
    return { token, examCode: exam.code };
  } catch (error) {
    // Hai lần vào thi cùng lúc của cùng một mã: chỉ mục một-phiên-hiệu-lực từ chối lần sau.
    if (isUniqueViolation(error)) throw studentError("ENTER_CONFLICT");
    throw error;
  }
}

async function loadStateContext(db: DatabaseLike, session: StudentSession) {
  const [row] = await db
    .select({
      examId: exams.id,
      code: exams.code,
      title: exams.title,
      durationMinutes: exams.durationMinutes,
      subjectName: subjects.name,
      className: classes.name,
      classStatus: examClasses.status,
      maxAttempts: examClasses.maxAttemptsSnap,
      warnLimit: examClasses.warnLimitSnap,
      // Lớp chưa phát đề chưa có snapshot: hiển thị thiết lập hiện tại của trường.
      schoolMaxAttempts: schools.maxAttempts,
      schoolWarnLimit: schools.warnLimit,
      studentCode: students.code,
      studentName: students.fullName,
    })
    .from(examClasses)
    .innerJoin(exams, eq(exams.id, examClasses.examId))
    .innerJoin(subjects, eq(subjects.id, exams.subjectId))
    .innerJoin(classes, eq(classes.id, examClasses.classId))
    .innerJoin(students, eq(students.id, session.studentId))
    .innerJoin(schools, eq(schools.id, examClasses.schoolId))
    .where(
      and(eq(examClasses.id, session.examClassId), eq(examClasses.schoolId, session.schoolId)),
    );
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

type AttemptSummary = { id: string; attemptNo: number; status: string; endsAt: Date | null };

interface PhaseInput {
  classStatus: "draft" | "dispatched" | "closed";
  attempts: AttemptSummary[];
  maxAttempts: number;
}

/** Pha phòng chờ theo thứ tự ưu tiên: đang làm, đã hoàn thành, lớp đã thu bài, chưa phát đề, hết lượt. */
export function derivePhase(input: PhaseInput): {
  phase: StudentPhase;
  closedReason: ClosedReason | null;
} {
  if (input.attempts.some((a) => a.status === "in_progress"))
    return { phase: "in_progress", closedReason: null };
  if (input.attempts.some((a) => a.status === "submitted"))
    return { phase: "completed", closedReason: null };
  if (input.classStatus === "closed") return { phase: "closed", closedReason: "class_closed" };
  if (input.classStatus === "draft") return { phase: "waiting", closedReason: null };
  const used = input.attempts.filter((a) => a.status !== "waiting").length;
  if (used >= input.maxAttempts) return { phase: "closed", closedReason: "max_attempts" };
  return { phase: "can_start", closedReason: null };
}

async function touchPresence(db: DatabaseLike, session: StudentSession, now: Date): Promise<void> {
  await db
    .insert(waitingPresence)
    .values({
      schoolId: session.schoolId,
      examClassId: session.examClassId,
      studentId: session.studentId,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: [waitingPresence.examClassId, waitingPresence.studentId],
      set: { lastSeenAt: now },
    });
}

async function loadClassAttempts(db: DatabaseLike, session: StudentSession) {
  return db
    .select({
      id: attempts.id,
      attemptNo: attempts.attemptNo,
      status: attempts.status,
      endsAt: attempts.endsAt,
    })
    .from(attempts)
    .where(
      and(eq(attempts.studentId, session.studentId), eq(attempts.examClassId, session.examClassId)),
    )
    .orderBy(desc(attempts.attemptNo));
}

/** Trạng thái phòng chờ (client hỏi mỗi 3 giây); kiểm hết giờ lười và ghi "đang chờ" khi còn ở phòng chờ. */
export async function getStudentState(
  deps: AppDeps,
  session: StudentSession,
): Promise<StudentStateView> {
  await expireDueAttempts(deps, session.studentId);
  const context = await loadStateContext(deps.db, session);
  const attemptRows = await loadClassAttempts(deps.db, session);
  const questionCount = await deps.db.$count(
    examQuestions,
    eq(examQuestions.examId, context.examId),
  );
  const maxAttempts = context.maxAttempts ?? context.schoolMaxAttempts;
  const { phase, closedReason } = derivePhase({
    classStatus: context.classStatus,
    attempts: attemptRows,
    maxAttempts,
  });

  const now = deps.clock.now();
  if (session.active && (phase === "waiting" || phase === "can_start"))
    await touchPresence(deps.db, session, now);

  const current = attemptRows.find((a) => a.status === "in_progress" || a.status === "submitted");
  return {
    phase,
    closedReason,
    exam: {
      code: context.code,
      title: context.title,
      subjectName: context.subjectName,
      durationMinutes: context.durationMinutes,
      questionCount,
    },
    student: { code: context.studentCode, fullName: context.studentName },
    className: context.className,
    attempt: current
      ? {
          id: current.id,
          attemptNo: current.attemptNo,
          endsAt: current.endsAt?.toISOString() ?? null,
        }
      : null,
    attemptsUsed: attemptRows.filter((a) => a.status !== "waiting").length,
    maxAttempts,
    warnLimit: context.warnLimit ?? context.schoolWarnLimit,
    serverNow: now.toISOString(),
  };
}
