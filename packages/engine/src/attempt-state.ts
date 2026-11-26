import { EngineError, type StartAttemptDecision, type StartAttemptInput } from "./types";

// Thời gian luôn là tham số (giờ máy chủ do tầng api truyền vào, FR-041); file này không đọc đồng hồ hệ thống.

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;

export function computeEndsAt(startedAt: Date, minutes: number): Date {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new EngineError("invalid_input", `Số phút làm bài không hợp lệ: ${minutes}`);
  }
  return new Date(startedAt.getTime() + minutes * MS_PER_MINUTE);
}

/** Số giây còn lại, làm tròn lên để đồng hồ chỉ về 0 đúng lúc hết giờ; không âm. */
export function remainingSeconds(endsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / MS_PER_SECOND));
}

/**
 * Hết hạn khi now > endsAt + graceSeconds (nghiêm ngặt). Đúng endsAt + grace vẫn còn được chấp nhận,
 * để bù độ trễ mạng của lần lưu/nộp cuối.
 */
export function isExpired(endsAt: Date, now: Date, graceSeconds = 3): boolean {
  if (!Number.isFinite(graceSeconds) || graceSeconds < 0) {
    throw new EngineError("invalid_input", `graceSeconds không hợp lệ: ${graceSeconds}`);
  }
  return now.getTime() > endsAt.getTime() + graceSeconds * MS_PER_SECOND;
}

function assertCount(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new EngineError("invalid_input", `${name} phải là số nguyên không âm: ${value}`);
  }
}

/**
 * Điều kiện "Bắt đầu làm bài" (state machine, BR-005). Thứ tự ưu tiên lý do:
 * trạng thái lớp -> đã hoàn thành -> đang làm dở nơi khác -> hết lượt.
 * Hết lượt xét sau cùng vì usedAttempts đã tính cả attempt completed/in_progress, lý do cụ thể hơn nên báo trước.
 */
export function canStartAttempt(input: StartAttemptInput): StartAttemptDecision {
  // Fail-closed: NaN/undefined/âm/không nguyên sẽ làm phép so sánh lượt luôn sai và vô tình cho phép làm bài.
  assertCount("usedAttempts", input.usedAttempts);
  assertCount("maxAttempts", input.maxAttempts);
  if (input.classStatus === "assigned") return { ok: false, reason: "not_dispatched" };
  if (input.classStatus === "closed") return { ok: false, reason: "closed" };
  if (input.hasCompleted) return { ok: false, reason: "already_completed" };
  if (input.hasInProgress) return { ok: false, reason: "in_progress_elsewhere" };
  if (input.usedAttempts >= input.maxAttempts) return { ok: false, reason: "max_attempts" };
  return { ok: true };
}
