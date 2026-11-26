import { schools, sessions, staffAccounts, subjects, type DatabaseLike, type SchoolStatus } from "@quiq/db";
import { hashPassword } from "@quiq/db/security";
import { STAFF_SESSION_TTL_MS } from "@quiq/shared/auth";
import { hashSessionToken, newSessionToken, STAFF_SESSION_COOKIE } from "../http/session-cookie";

// Dữ liệu dựng sẵn cho test cán bộ/phiên. Mật khẩu đi qua hashPassword thật để đăng nhập chạy đúng luồng.

export const FIXTURE_PASSWORD = "Mat-khau-test-2026";

let counter = 0;
const nextLabel = () => `f${++counter}`;

export interface SchoolFixture {
  schoolId: string;
  subjectId: string;
}

export async function insertSchool(db: DatabaseLike, status: SchoolStatus = "active"): Promise<SchoolFixture> {
  const [school] = await db.insert(schools).values({ name: `Trường ${nextLabel()}`, status }).returning();
  const [subject] = await db.insert(subjects).values({ schoolId: school!.id, name: "Toán" }).returning();
  return { schoolId: school!.id, subjectId: subject!.id };
}

export interface StaffFixture {
  staffId: string;
  username: string;
  password: string;
}

type StaffSpec =
  | { role: "teacher"; school: SchoolFixture; username?: string; isActive?: boolean }
  | { role: "school_admin"; school: SchoolFixture; username?: string; isActive?: boolean }
  | { role: "super_admin"; username?: string; isActive?: boolean };

export async function insertStaff(db: DatabaseLike, spec: StaffSpec): Promise<StaffFixture> {
  const username = spec.username ?? `cb.${nextLabel()}`;
  const scope =
    spec.role === "teacher"
      ? { schoolId: spec.school.schoolId, subjectId: spec.school.subjectId }
      : spec.role === "school_admin"
        ? { schoolId: spec.school.schoolId }
        : {};
  const [staff] = await db
    .insert(staffAccounts)
    .values({
      ...scope,
      role: spec.role,
      username,
      passwordHash: await hashPassword(FIXTURE_PASSWORD),
      displayName: `Cán bộ ${username}`,
      isActive: spec.isActive ?? true,
    })
    .returning();
  return { staffId: staff!.id, username, password: FIXTURE_PASSWORD };
}

/** Tạo thẳng một phiên trong DB, trả chuỗi Cookie để gửi kèm request. */
export async function insertSessionCookie(
  db: DatabaseLike,
  staffId: string,
  secret: string,
  expiresAt: Date,
): Promise<string> {
  const token = newSessionToken();
  await db.insert(sessions).values({ staffId, tokenHash: hashSessionToken(token, secret), expiresAt });
  return `${STAFF_SESSION_COOKIE}=${token}`;
}

export const sessionExpiryAfter = (now: Date) => new Date(now.getTime() + STAFF_SESSION_TTL_MS);
