import { schools, sessions, staffAccounts, subjects, type DatabaseLike, type StaffRole } from "@quiq/db";
import { hashPassword, verifyPassword } from "@quiq/db/security";
import { STAFF_SESSION_TTL_MS, type LoginRequest, type StaffMe } from "@quiq/shared/auth";
import { and, eq, gt, isNull, sql } from "drizzle-orm";

/** Thông tin phiên mà guard cần; không chứa hash mật khẩu. */
export interface ActiveSession {
  sessionId: string;
  staffId: string;
  role: StaffRole;
  schoolId: string | null;
  staffActive: boolean;
  schoolLocked: boolean;
}

export type LoginOutcome =
  | { kind: "ok"; staffId: string }
  | { kind: "invalid" }
  | { kind: "school_locked" };

const sessionExpiryFrom = (now: Date) => new Date(now.getTime() + STAFF_SESSION_TTL_MS);

// Hash giả để tài khoản không tồn tại cũng tốn đúng một lần scrypt: thời gian phản hồi không lộ tên đăng nhập nào có thật.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword("quiq-dummy-password-for-timing"));

/** Gọi lúc đăng ký route: tính sẵn hash giả trước request đăng nhập đầu tiên. */
export async function prepareLoginTiming(): Promise<void> {
  await getDummyHash();
}

async function findStaffByUsername(db: DatabaseLike, username: string) {
  const [row] = await db
    .select({
      id: staffAccounts.id,
      passwordHash: staffAccounts.passwordHash,
      isActive: staffAccounts.isActive,
      schoolStatus: schools.status,
    })
    .from(staffAccounts)
    .leftJoin(schools, eq(schools.id, staffAccounts.schoolId))
    // Khớp chỉ mục duy nhất lower(username).
    .where(sql`lower(${staffAccounts.username}) = ${username.toLowerCase()}`)
    .limit(1);
  return row;
}

/**
 * Kiểm mật khẩu trước, rồi mới xét tài khoản vô hiệu và trường bị khóa,
 * để người không biết mật khẩu không dò được trạng thái tài khoản hay trường.
 */
export async function verifyLogin(db: DatabaseLike, credentials: LoginRequest): Promise<LoginOutcome> {
  const staff = await findStaffByUsername(db, credentials.username);
  const passwordMatches = await verifyPassword(credentials.password, staff?.passwordHash ?? (await getDummyHash()));
  if (!staff || !passwordMatches || !staff.isActive) return { kind: "invalid" };
  if (staff.schoolStatus === "locked") return { kind: "school_locked" };
  return { kind: "ok", staffId: staff.id };
}

export async function createSession(db: DatabaseLike, staffId: string, tokenHash: string, now: Date): Promise<void> {
  await db.insert(sessions).values({ staffId, tokenHash, expiresAt: sessionExpiryFrom(now) });
}

/** Phiên còn hiệu lực (chưa thu hồi, chưa hết hạn) theo hash token; trạng thái tài khoản/trường để guard quyết. */
export async function findActiveSession(
  db: DatabaseLike,
  tokenHash: string,
  now: Date,
): Promise<ActiveSession | undefined> {
  const [row] = await db
    .select({
      sessionId: sessions.id,
      staffId: staffAccounts.id,
      role: staffAccounts.role,
      schoolId: staffAccounts.schoolId,
      staffActive: staffAccounts.isActive,
      schoolStatus: schools.status,
    })
    .from(sessions)
    .innerJoin(staffAccounts, eq(staffAccounts.id, sessions.staffId))
    .leftJoin(schools, eq(schools.id, staffAccounts.schoolId))
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!row) return undefined;
  const { schoolStatus, ...session } = row;
  return { ...session, schoolLocked: schoolStatus === "locked" };
}

/** Hết hạn trượt: mỗi request hợp lệ đẩy hạn lên now + 8 giờ. */
export async function extendSession(db: DatabaseLike, sessionId: string, now: Date): Promise<void> {
  await db.update(sessions).set({ expiresAt: sessionExpiryFrom(now) }).where(eq(sessions.id, sessionId));
}

export async function revokeSession(db: DatabaseLike, tokenHash: string, now: Date): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
}

/** Hồ sơ trả cho client: chọn cột tường minh, không bao giờ có password_hash. */
export async function loadStaffMe(db: DatabaseLike, staffId: string): Promise<StaffMe | undefined> {
  const [row] = await db
    .select({
      id: staffAccounts.id,
      username: staffAccounts.username,
      displayName: staffAccounts.displayName,
      role: staffAccounts.role,
      schoolId: staffAccounts.schoolId,
      schoolName: schools.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
    })
    .from(staffAccounts)
    .leftJoin(schools, eq(schools.id, staffAccounts.schoolId))
    .leftJoin(subjects, eq(subjects.id, staffAccounts.subjectId))
    .where(eq(staffAccounts.id, staffId))
    .limit(1);
  if (!row) return undefined;
  const { subjectId, subjectName, ...profile } = row;
  const subject = subjectId && subjectName ? { id: subjectId, name: subjectName } : null;
  return { ...profile, subject };
}
