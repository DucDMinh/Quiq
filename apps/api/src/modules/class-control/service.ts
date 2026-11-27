import { attempts, classes, examClasses, exams, schools, studentSessions, type DatabaseLike } from "@quiq/db";
import type { CloseClassResult, ExamClassState, PublishKind } from "@quiq/shared/exams";
import { and, asc, eq, isNull, ne, type SQL } from "drizzle-orm";
import type { AppDeps } from "../../http/deps";
import { AppError } from "../../http/errors";
import { finalizeAttempt, isPastGrace } from "../attempts/finalize";
import { examError, type TeacherScope } from "../exams/service";

export interface ExamClassRef {
  examId: string;
  classId: string;
}

/** Lớp của một bài thi do CHÍNH giáo viên này ra, trong trường của phiên; khác đi thì 404. */
export async function loadOwnedExamClass(db: DatabaseLike, scope: TeacherScope, ref: ExamClassRef) {
  const [row] = await db
    .select({
      id: examClasses.id,
      examId: examClasses.examId,
      classId: examClasses.classId,
      className: classes.name,
      status: examClasses.status,
      dispatchedAt: examClasses.dispatchedAt,
      closedAt: examClasses.closedAt,
      answersPublishedAt: examClasses.answersPublishedAt,
      scoresPublishedAt: examClasses.scoresPublishedAt,
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
  return { ...row, otherClassesOpen: await hasUnfinishedClass(db, row.examId, row.id) };
}

export type OwnedExamClass = Awaited<ReturnType<typeof loadOwnedExamClass>>;

export function toClassState(row: OwnedExamClass): ExamClassState {
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
    answersPublishedAt: row.answersPublishedAt?.toISOString() ?? null,
    scoresPublishedAt: row.scoresPublishedAt?.toISOString() ?? null,
    otherClassesOpen: row.otherClassesOpen,
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
  deps.realtime?.publish(examClass.id);
  return toClassState(await loadOwnedExamClass(deps.db, scope, ref));
}

/**
 * G-12: bài đã quá `ends_at + 3 giây` (cùng dung sai với lưu đáp án) là hết giờ thật, kết thúc với `timeout`;
 * bài còn giờ mới là bị thu (`closed`).
 */
async function finalizeRunningAttempts(deps: AppDeps, examClassId: string): Promise<number> {
  const running = await deps.db
    .select()
    .from(attempts)
    .where(and(eq(attempts.examClassId, examClassId), eq(attempts.status, "in_progress")));
  const now = deps.clock.now();
  // Mỗi lần nộp là một transaction riêng của finalizeAttempt; không bọc trong transaction ngoài.
  for (const attempt of running) {
    await finalizeAttempt(deps, attempt.id, isPastGrace(attempt, now) ? "timeout" : "closed");
  }
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
 * 3. Nộp + chấm ngay mọi lần làm đang diễn ra qua `finalizeAttempt` (`closed`, hoặc `timeout` nếu đã quá hạn).
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
  deps.realtime?.publish(examClass.id);

  return {
    examClass: toClassState(await loadOwnedExamClass(deps.db, scope, ref)),
    finalizedAttempts,
  };
}

/**
 * Còn lớp nào của bài thi (trừ `exceptExamClassId`) chưa thu bài xong: chưa `closed` (kể cả `draft`), hoặc đã
 * `closed` mà còn bài đang làm (lần thu bài lỗi giữa chừng). Câu hỏi thuộc BÀI THI, các lớp chỉ khác thứ tự trộn,
 * nên đáp án công bố cho một lớp là lộ cho mọi lớp còn đang thi (R1).
 */
export async function hasUnfinishedClass(
  db: DatabaseLike,
  examId: string,
  exceptExamClassId?: string,
): Promise<boolean> {
  const others = (base: SQL | undefined) =>
    exceptExamClassId ? and(base, ne(examClasses.id, exceptExamClassId)) : base;
  const open = await db
    .select({ id: examClasses.id })
    .from(examClasses)
    .where(others(and(eq(examClasses.examId, examId), ne(examClasses.status, "closed"))))
    .limit(1);
  if (open.length > 0) return true;
  const running = await db
    .select({ id: attempts.id })
    .from(attempts)
    .innerJoin(examClasses, eq(examClasses.id, attempts.examClassId))
    .where(others(and(eq(examClasses.examId, examId), eq(attempts.status, "in_progress"))))
    .limit(1);
  return running.length > 0;
}

/**
 * Lớp đã `closed` mà còn bài đang làm = lần thu bài trước lỗi giữa chừng (học sinh đó vẫn lưu đáp án được).
 * Lớp đã đóng thì không ai Bắt đầu thêm được, nên kiểm một lần là đủ.
 */
async function hasRunningAttempt(db: DatabaseLike, examClassId: string): Promise<boolean> {
  const rows = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.examClassId, examClassId), eq(attempts.status, "in_progress")))
    .limit(1);
  return rows.length > 0;
}

/** Ghi mốc công bố nếu chưa có (`IS NULL`): bấm lại, kể cả hai lần cùng lúc, giữ nguyên mốc đầu tiên. */
async function markPublished(db: DatabaseLike, examClassId: string, kind: PublishKind, now: Date) {
  const column = kind === "answers" ? examClasses.answersPublishedAt : examClasses.scoresPublishedAt;
  const updated = await db
    .update(examClasses)
    .set(kind === "answers" ? { answersPublishedAt: now } : { scoresPublishedAt: now })
    .where(and(eq(examClasses.id, examClassId), eq(examClasses.status, "closed"), isNull(column)))
    .returning({ id: examClasses.id });
  return updated.length > 0;
}

/**
 * Công bố đáp án chỉ khi MỌI lớp của bài đã thu bài xong. Khóa FOR UPDATE mọi hàng exam_classes của bài (theo id
 * để không deadlock) rồi mới kiểm và ghi: phát đề/thu bài/Bắt đầu ở lớp khác đều đụng hàng của lớp đó nên phải
 * chờ transaction này, không chen vào giữa lúc kiểm và lúc ghi.
 */
async function publishAnswersWhenExamFinished(deps: AppDeps, examClass: OwnedExamClass): Promise<boolean> {
  return deps.db.transaction(async (tx) => {
    await tx
      .select({ id: examClasses.id })
      .from(examClasses)
      .where(eq(examClasses.examId, examClass.examId))
      .orderBy(asc(examClasses.id))
      .for("update");
    if (await hasUnfinishedClass(tx, examClass.examId)) throw examError("OTHER_CLASSES_NOT_CLOSED");
    return markPublished(tx, examClass.id, "answers", deps.clock.now());
  });
}

/**
 * Công bố đáp án hoặc bảng điểm của một lớp (FR-037, FR-038, BR-010): hai mốc độc lập, bấm tay, MỘT CHIỀU.
 * Lớp phải thu bài XONG (không còn bài đang làm), để học sinh làm xong không chuyền đáp án cho bạn còn đang thi.
 * Đáp án còn đòi mọi lớp khác của cùng bài thi đã thu bài xong; bảng điểm thì không (không lộ đáp án).
 */
export async function publishClass(
  deps: AppDeps,
  scope: TeacherScope,
  ref: ExamClassRef,
  kind: PublishKind,
): Promise<ExamClassState> {
  const examClass = await loadOwnedExamClass(deps.db, scope, ref);
  if (examClass.status !== "closed" || (await hasRunningAttempt(deps.db, examClass.id))) {
    throw examError("CLASS_NOT_CLOSED");
  }
  const written =
    kind === "answers"
      ? await publishAnswersWhenExamFinished(deps, examClass)
      : await markPublished(deps.db, examClass.id, "scores", deps.clock.now());
  if (written) deps.realtime?.publish(examClass.id);
  return toClassState(await loadOwnedExamClass(deps.db, scope, ref));
}
