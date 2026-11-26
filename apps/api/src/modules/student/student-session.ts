import { attempts, studentSessions, type DatabaseLike } from "@quiq/db";
import { and, eq, isNull } from "drizzle-orm";
import type { Context } from "koa";
import { createHash, randomBytes } from "node:crypto";
import type { AppDeps } from "../../http/deps";
import { studentError } from "./errors";

/**
 * Phiên học sinh: cookie `quiq_stu` mang token đục, DB chỉ giữ SHA-256 của token.
 * Phiên "còn hiệu lực" (revoked_at null) giữ mã học sinh; mỗi học sinh chỉ có một phiên như vậy
 * (chỉ mục `student_sessions_one_active_key`). Kết thúc lần làm thì phiên bị thu hồi để bài thi sau
 * không coi nhầm là đổi máy; phiên đã thu hồi vẫn được XEM kết quả của lần đã nộp trong lớp đó.
 */
export const STUDENT_COOKIE = "quiq_stu";

export interface StudentSession {
  id: string;
  schoolId: string;
  studentId: string;
  examClassId: string;
  /** false: phiên đã thu hồi, chỉ còn quyền xem trạng thái và kết quả đã nộp. */
  active: boolean;
}

/** `active`: thao tác làm bài (bắt đầu, lưu đáp án). `read`: xem trạng thái, nộp lại, xem kết quả. */
export type SessionAccess = "active" | "read";

export function hashStudentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssueSessionInput {
  schoolId: string;
  studentId: string;
  examClassId: string;
  now: Date;
  /** Học sinh đã nộp bài lớp này: tạo phiên đã thu hồi sẵn, chỉ để xem kết quả, không giữ mã. */
  readOnly: boolean;
}

/**
 * Tạo phiên mới; gọi trong transaction. Trả token gốc để đặt cookie.
 * Phiên hiệu lực mới thu hồi phiên hiệu lực cũ (chỉ mục một-phiên-mỗi-học-sinh); nơi gọi phải chắc chắn
 * học sinh KHÔNG có lần làm đang diễn ra. Phiên chỉ-xem không đụng tới phiên nào khác.
 */
export async function issueStudentSession(
  tx: DatabaseLike,
  input: IssueSessionInput,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  if (!input.readOnly) {
    await tx
      .update(studentSessions)
      .set({ revokedAt: input.now })
      .where(
        and(eq(studentSessions.studentId, input.studentId), isNull(studentSessions.revokedAt)),
      );
  }
  await tx.insert(studentSessions).values({
    schoolId: input.schoolId,
    studentId: input.studentId,
    examClassId: input.examClassId,
    tokenHash: hashStudentToken(token),
    createdAt: input.now,
    revokedAt: input.readOnly ? input.now : null,
  });
  return token;
}

/** Cookie hiện có là phiên còn hiệu lực của đúng học sinh và đúng lớp thi này (quay lại làm tiếp, C-13). */
export async function isOwnActiveSession(
  db: DatabaseLike,
  token: string | undefined,
  studentId: string,
  examClassId: string,
): Promise<boolean> {
  if (!token) return false;
  const rows = await db
    .select({ id: studentSessions.id })
    .from(studentSessions)
    .where(
      and(
        eq(studentSessions.tokenHash, hashStudentToken(token)),
        eq(studentSessions.studentId, studentId),
        eq(studentSessions.examClassId, examClassId),
        isNull(studentSessions.revokedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Thu hồi phiên còn hiệu lực của học sinh trong một lớp thi (khi lần làm kết thúc). */
export async function revokeStudentSessions(
  tx: DatabaseLike,
  studentId: string,
  examClassId: string,
  now: Date,
): Promise<void> {
  await tx
    .update(studentSessions)
    .set({ revokedAt: now })
    .where(
      and(
        eq(studentSessions.studentId, studentId),
        eq(studentSessions.examClassId, examClassId),
        isNull(studentSessions.revokedAt),
      ),
    );
}

export function setStudentCookie(ctx: Context, token: string): void {
  // secure theo kết nối thật: bật khi chạy HTTPS, tắt ở http local (Koa ném lỗi nếu ép secure trên http).
  ctx.cookies.set(STUDENT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: ctx.secure,
  });
}

async function hasSubmittedAttempt(
  db: DatabaseLike,
  studentId: string,
  examClassId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(
      and(
        eq(attempts.studentId, studentId),
        eq(attempts.examClassId, examClassId),
        eq(attempts.status, "submitted"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Đọc phiên từ cookie. Không có, sai, hoặc đã thu hồi (khi cần `active`) đều trả cùng một lỗi 401.
 * Phiên đã thu hồi chỉ được `read` khi học sinh đã nộp bài trong lớp của phiên đó.
 */
export async function requireStudentSession(
  ctx: Context,
  deps: AppDeps,
  access: SessionAccess,
): Promise<StudentSession> {
  const token = ctx.cookies.get(STUDENT_COOKIE);
  if (!token) throw studentError("STUDENT_SESSION_REQUIRED");

  const [row] = await deps.db
    .select()
    .from(studentSessions)
    .where(eq(studentSessions.tokenHash, hashStudentToken(token)))
    .limit(1);
  if (!row) throw studentError("STUDENT_SESSION_REQUIRED");

  const session: StudentSession = {
    id: row.id,
    schoolId: row.schoolId,
    studentId: row.studentId,
    examClassId: row.examClassId,
    active: row.revokedAt === null,
  };
  if (session.active) return session;
  if (access === "read" && (await hasSubmittedAttempt(deps.db, row.studentId, row.examClassId)))
    return session;
  throw studentError("STUDENT_SESSION_REQUIRED");
}
