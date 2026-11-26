import { cn } from "@/lib/cn";

export const TIMER_WARNING_SECONDS = 120;
const ANNOUNCE_FIVE_MINUTES = 300;
const ANNOUNCE_ONE_MINUTE = 60;
const ANNOUNCE_THIRTY_SECONDS = 30;

/** Định dạng mm:ss, hoặc h:mm:ss khi từ 1 giờ trở lên. Số giây âm được coi là 0. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

// Vùng aria-live chỉ đổi chữ ở ba mốc (5 phút, 1 phút, 30 giây; design-spec §11) nên trình đọc màn hình
// không đọc mỗi giây. "Tối đa" vì đúng mốc (300, 60, 30 giây) cũng được tính.
function announcementFor(remainingSeconds: number): string {
  if (remainingSeconds <= ANNOUNCE_THIRTY_SECONDS) return "Còn tối đa 30 giây";
  if (remainingSeconds <= ANNOUNCE_ONE_MINUTE) return "Còn tối đa 1 phút";
  if (remainingSeconds <= ANNOUNCE_FIVE_MINUTES) return "Còn tối đa 5 phút";
  return "";
}

export interface TimerProps {
  /** Số giây còn lại, tính từ giờ máy chủ (`ends_at`) ở nơi gọi. */
  remainingSeconds: number;
  className?: string;
}

export function Timer({ remainingSeconds, className }: TimerProps) {
  const urgent = remainingSeconds <= TIMER_WARNING_SECONDS;
  return (
    <>
      <span
        role="timer"
        aria-label="Thời gian còn lại"
        data-urgent={urgent || undefined}
        className={cn(
          "inline-flex items-center rounded-full border-2 px-4 py-1.5 font-mono text-lg font-bold tabular-nums",
          urgent
            ? "border-on-brand bg-quiq-rose text-on-brand"
            : "border-line-strong bg-surface text-ink",
          className,
        )}
      >
        {formatClock(remainingSeconds)}
      </span>
      <span className="sr-only" aria-live="assertive">
        {announcementFor(remainingSeconds)}
      </span>
    </>
  );
}
