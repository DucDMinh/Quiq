/**
 * Kênh "lớp đổi" trong MỘT tiến trình API (FR-035, C-12): chỗ ghi dữ liệu gọi `publish(examClassId)` sau khi
 * commit, luồng SSE của giáo viên đang mở lớp đó tính lại bảng trạng thái. Chỉ báo "có đổi", không mang dữ liệu,
 * nên người nghe luôn đọc lại từ DB (một nguồn sự thật). Chạy nhiều instance thì mỗi instance chỉ thấy tín hiệu
 * của chính nó; polling dự phòng của client vẫn đúng.
 */
export type ClassChangeListener = () => void;

export interface RealtimeTiming {
  /** Gộp các tín hiệu tới trong khoảng này thành một lần tính lại. */
  coalesceMs: number;
  /** Nhịp tính lại định kỳ (presence "Đang chờ" hết hạn) + comment keepalive. */
  refreshMs: number;
}

export const DEFAULT_REALTIME_TIMING: RealtimeTiming = { coalesceMs: 250, refreshMs: 10_000 };

export interface RealtimeHub {
  readonly timing: RealtimeTiming;
  /** Trả hàm huỷ đăng ký; gọi nhiều lần vô hại. */
  subscribe(examClassId: string, listener: ClassChangeListener): () => void;
  publish(examClassId: string): void;
  /** Số người nghe của một lớp, bỏ trống = tổng mọi lớp (kiểm tra rò rỉ). */
  listenerCount(examClassId?: string): number;
}

export function createRealtimeHub(timing: Partial<RealtimeTiming> = {}): RealtimeHub {
  const listenersByClass = new Map<string, Set<ClassChangeListener>>();
  return {
    timing: { ...DEFAULT_REALTIME_TIMING, ...timing },
    subscribe(examClassId, listener) {
      const listeners = listenersByClass.get(examClassId) ?? new Set<ClassChangeListener>();
      listeners.add(listener);
      listenersByClass.set(examClassId, listeners);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && listenersByClass.get(examClassId) === listeners) {
          listenersByClass.delete(examClassId);
        }
      };
    },
    publish(examClassId) {
      // Chép ra trước khi gọi: người nghe có thể tự huỷ đăng ký ngay trong lúc được báo.
      for (const listener of [...(listenersByClass.get(examClassId) ?? [])]) {
        try {
          listener();
        } catch {
          // Một người nghe lỗi không được chặn người khác, càng không được làm hỏng request vừa ghi dữ liệu.
        }
      }
    },
    listenerCount(examClassId) {
      if (examClassId !== undefined) return listenersByClass.get(examClassId)?.size ?? 0;
      let total = 0;
      for (const listeners of listenersByClass.values()) total += listeners.size;
      return total;
    },
  };
}
